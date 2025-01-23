import { Server, Socket } from "socket.io";

interface Player {
  socketId: string;
  username: string;
  avatar: string;
  cardCount: number;
  hand: Card[];
}

interface Room {
  roomName: string;
  isPrivate: boolean;
  password: string | null;
  playerCount: number;
  players: Player[];
  currentTurnIndex: number;
  isGameStarted: boolean; // Adding for turn management testing.
  discardPile: any[];
}

// Moved this here to store rooms at module level to persist across connections - previously i accidentally placed it inside the io.on
let availableRooms: Room[] = [];
availableRooms.push({
  roomName: "testOnLaunch",
  isPrivate: true,
  password: "123",
  playerCount: 0,
  players: [],
  currentTurnIndex: 0,
  isGameStarted: false,
  discardPile: [],
});

interface LastPlayerTracker {
  // Idea is to scope a variable that tracks whoever last finished a turn. We can use this for a function that updates at the end of ever turn. Ready for scoping for the challenge socket.
  socketId: string;
  roomName: string;
}

interface Card {
  code: string;
  image: string;
  images: object;
  suit: string;
  value: string;
}

let lastPlayerMoves: { [roomName: string]: string } = {};

export const setupSockets = (io: Server) => {
  io.on("connection", (socket: Socket) => {
    console.log("A new socket connection has been made:", socket.id);
    socket.emit("activeRooms", availableRooms);

    const logRooms = () => {
      console.log("\n=== Available Rooms ===");
      console.log("Total rooms:", availableRooms.length);
      availableRooms.forEach((room, index) => {
        console.log(`- Name: ${room.roomName}`);
        console.log(`- Players: ${room.playerCount}/4`);
        console.log(`- Type: ${room.isPrivate ? "Private" : "Public"}`);
      });
      console.log("end log of logRooms");
    };

    socket.on(
      "joinRoom",
      async (
        roomName: string,
        {
          password,
          username,
          avatar,
        }: { password: string | null; username: string; avatar: string },
        callback: Function
      ) => {
        try {
          console.log(
            `Join room attempt - Room: ${roomName}, User: ${username}`
          );

          // Validate callback
          if (typeof callback !== "function") {
            console.error("Callback is not provided or not a function");
            return;
          }

          // Validate user details
          if (!username || !avatar) {
            console.log("Missing user details");
            callback({ success: false, message: "Missing user details." });
            return;
          }

          // Find room
          const roomIndex = availableRooms.findIndex(
            (r) => r.roomName === roomName
          );
          if (roomIndex === -1) {
            console.log(`Room not found: ${roomName}`);
            callback({ success: false, message: "Room not found." });
            return;
          }

          const room = availableRooms[roomIndex];
          console.log("Current room state:", {
            name: room.roomName,
            playerCount: room.playerCount,
            players: room.players,
          });

          // Check room access
          if (room.isPrivate && room.password !== password) {
            console.log("Incorrect password attempt");
            callback({ success: false, message: "Incorrect password." });
            return;
          }

          // Check room capacity
          if (room.playerCount >= 4) {
            console.log("Room is full");
            callback({ success: false, message: "Room is full." });
            return;
          }

          // Create new player without slot assignment
          const newPlayer: Player = {
            socketId: socket.id,
            username,
            avatar,
            cardCount: 0,
            hand: [],
          };

          // Add player to room
          room.players.push(newPlayer);
          room.playerCount++;

          // Join the socket room
          await socket.join(roomName);
          console.log(`Socket ${socket.id} joined room ${roomName}`);

          // Emit updated players to room with current player identifier
          io.to(roomName).emit("playerJoined", {
            players: room.players,
            currentPlayerSocketId: socket.id,
          });
          console.log(
            "Emitted playerJoined event to room:",
            roomName,
            "with players:",
            room.players,
            "currentPlayer:",
            socket.id
          );

          // Update room list for all clients
          io.emit("activeRooms", availableRooms);
          console.log("Emitted activeRooms event with updated rooms");

          // Send success callback
          callback({ success: true, message: "Successfully joined room." });

          // Log final state
          console.log("Updated room state:", {
            name: room.roomName,
            playerCount: room.playerCount,
            players: room.players,
          });
        } catch (error) {
          console.error(`Error joining room ${roomName}:`, error);
          if (typeof callback === "function") {
            callback({ success: false, message: "Failed to join room." });
          }
        }
      }
    );

    socket.on(
      "createRoom",
      async (
        room: {
          roomName: string;
          password: string;
          username: string;
          avatar: string;
        },
        callback: Function
      ) => {
        try {
          console.log("Received createRoom request:", room);
          const { roomName, password, username, avatar } = room;

          const validRoom = availableRooms.find(
            (room) => room.roomName === roomName
          );

          if (validRoom) {
            console.log("Room creation failed: Room name already exists");
            callback({
              success: false,
              message: "Room name already exists",
            });
            return;
          }
          const firstPlayer: Player = {
            socketId: socket.id,
            username,
            avatar,
            cardCount: 0,
            hand: [],
          };
          const newRoom: Room = {
            roomName,
            isPrivate: Boolean(password && password.length > 0),
            password: password || null,
            playerCount: 1,
            players: [firstPlayer], // Add the creator as first player
            currentTurnIndex: 0,
            isGameStarted: false,
            discardPile: [],
          };
          availableRooms.push(newRoom);
          await socket.join(roomName);
          io.to(roomName).emit("playerJoined", {
            players: newRoom.players,
            currentPlayerSocketId: socket.id,
          });
          logRooms();
          io.emit("activeRooms", availableRooms);
          callback({
            success: true,
            message: "Room created successfully",
          });
        } catch (error) {
          console.error("Error creating room:", error);
          callback({
            success: false,
            message: "Failed to create room",
          });
        }
      }
    );

    socket.on("requestRoomState", (roomName: string, callback: Function) => {
      try {
        const room = availableRooms.find((r) => r.roomName === roomName);
        if (room) {
          callback({ success: true, players: room.players });
        } else {
          callback({ success: false, message: "Room not found" });
        }
      } catch (error) {
        console.error("Error getting room state:", error);
        callback({ success: false, message: "Error getting room state" });
      }
    });

    socket.on("requestActiveRooms", () => {
      console.log("Active rooms requested");
      logRooms();
      socket.emit("activeRooms", availableRooms);
    });

    socket.on("startGame", (roomName: string, callback: Function) => {
      try {
        const room = availableRooms.find((r) => r.roomName === roomName);
        if (!room) {
          callback({ success: false, message: "Room not found" });
          return;
        }

        // Only start if we have at least 2 players
        if (room.playerCount < 2) {
          callback({
            success: false,
            message: "Need all players to start",
          });
          return;
        }

        room.isGameStarted = true;
        console.log(room.isGameStarted, "In startGame");
        room.currentTurnIndex = 0;
        const currentPlayer = room.players[room.currentTurnIndex];
        io.to(roomName).emit("turnUpdate", {
          currentPlayer: currentPlayer,
          currentTurnIndex: room.currentTurnIndex,
        });

        callback({ success: true });
      } catch (error) {
        callback({ success: false, message: "Failed to start game" });
      }
    });

    socket.on("endTurn", (roomName: string, callback: Function) => {
      try {
        const room = availableRooms.find((r) => r.roomName === roomName);
        if (!room || !room.isGameStarted) {
          callback({ success: false, message: "Game not in progress" });
          return;
        }

        // Scope the last player info for the challenge button before processing the end turn.
        lastPlayerMoves[roomName] =
          room.players[room.currentTurnIndex].socketId;

        room.currentTurnIndex =
          (room.currentTurnIndex + 1) % room.players.length;
        const nextPlayer = room.players[room.currentTurnIndex];

        io.to(roomName).emit("turnUpdate", {
          currentPlayer: nextPlayer,
          currentTurnIndex: room.currentTurnIndex,
          lastPlayer: lastPlayerMoves[roomName], // include this in the emit.
        });

        callback({ success: true });
      } catch (error) {
        callback({ success: false, message: "Failed to end turn" });
      }
      // Here is the code for the new card to play each turn once the turn actually ends
      const order = [
        "ACE",
        "2",
        "3",
        "4",
        "5",
        "6",
        "7",
        "8",
        "9",
        "10",
        "JACK",
        "QUEEN",
        "KING",
      ];
      const cardThisTurn = order[Math.floor(Math.random() * 13)];
      console.log(cardThisTurn);
      socket.emit("cardToPlay", cardThisTurn);
    });

    socket.on(
      "discardPile",
      ({ roomName, discardedCards }, callback: Function) => {
        try {
          console.log("Received discardPile event:", {
            roomName,
            cardsToDiscard: discardedCards?.length,
          });

          const room = availableRooms.find((r) => r.roomName === roomName);
          console.log("Found room:", {
            name: room?.roomName,
            currentDiscardSize: room?.discardPile?.length,
            isGameStarted: room?.isGameStarted,
          });

          if (!room || !room.isGameStarted) {
            console.log("Game not in progress or room not found");
            callback({ success: false, message: "Game not in progress" });
            return;
          }

          // Ensure discardedCards is an array
          if (!Array.isArray(discardedCards)) {
            console.log("Invalid discard data - not an array");
            callback({ success: false, message: "Invalid discard data" });
            return;
          }

          // Add cards to room's discard pile
          const oldLength = room.discardPile.length;
          room.discardPile = [...room.discardPile, ...discardedCards];

          console.log("Discard pile updated:", {
            oldSize: oldLength,
            newSize: room.discardPile.length,
            added: discardedCards.length,
          });

          // Emit the FULL discard pile to all players
          io.to(roomName).emit("discardPileUpdated", {
            discardPile: room.discardPile,
            lastDiscarded: discardedCards,
          });

          console.log("Emitted discardPileUpdated event");
          callback({ success: true });
        } catch (error) {
          console.error("Error in discardPile:", error);
          callback({
            success: false,
            message: "Failed to update discard pile",
          });
        }
      }
    );

    socket.on("initiateDuel", ({ roomName }, callback: Function) => {
      // remember to ge the challengePlayerId from whoever turn it was from the array index.
      try {
        const room = availableRooms.find((r) => r.roomName === roomName);
        if (!room || !room.isGameStarted) {
          callback({ success: false, message: "Game not in progress" });
          return;
        }

        // logic for working out who the last player was. IN theory the logic below should gie us a condition where if player 4 went last, then player 1 channelged,, the modulo should be as follows: (0 - 1 + 4) % 4 = 3
        // need to test this out.

        const lastPlayerSocketId = lastPlayerMoves[roomName];
        if (!lastPlayerSocketId) {
          callback({
            success: false,
            message: "No previous moves in this room",
          });
          return;
        }

        // Remember this is the code that works out who the challenger is and the duel is below it.
        const challenger = room.players.find((p) => p.socketId === socket.id);
        const challengedPlayer = room.players.find(
          (p) => p.socketId === lastPlayerSocketId
        );

        if (!challenger || !challengedPlayer) {
          // typescript error handling because of null stuff.
          callback({ success: false, message: "Invalid players for duel" });
          return;
        }
        io.to(lastPlayerSocketId).emit("duelStarted", {
          challenger: challenger.username,
          challengerId: challenger.socketId,
        });

        io.to(roomName).emit("duelInitiated", {
          challenger: challenger.username,
          challenged: challengedPlayer.username,
        });

        callback({ success: true });
      } catch (error) {
        callback({ success: false, message: "Failed to initiate duel" });
      }
    });

    socket.on(
      "updateCardCount",
      ({ roomName, cardCount }, callback: Function) => {
        try {
          const room = availableRooms.find((r) => r.roomName === roomName);
          if (!room || !room.isGameStarted) {
            callback({ success: false, message: "Game not in progress" });
            return;
          }

          const player = room.players.find((p) => p.socketId === socket.id);
          if (player) {
            player.cardCount = cardCount;

            // Emit updated player info to everyone in room
            io.to(roomName).emit("playerStatsUpdated", {
              players: room.players,
            }); // update the playingTAble component so that it now takes the player.cardCount to display their hand amount to everyone in the lobby.

            callback({ success: true });
          } else {
            callback({ success: false, message: "Player not found" });
          }
        } catch (error) {
          callback({ success: false, message: "Failed to update card count" });
        }
      }
    );
    // for sending the card to players
    socket.on(
      "distributeCards",
      ({ roomName, hands }: { roomName: string; hands: Card[][] }) => {
        try {
          const room = availableRooms.find((r) => r.roomName === roomName);

          if (!room) {
            console.error("Room not found:", roomName);
            return;
          }

          if (room.players.length !== hands.length) {
            console.error("Mismatch between players and card hands.");
            return;
          }
          room.players.forEach((player, index) => {
            player.hand = hands[index];
            player.cardCount = hands[index].length;
          });

          io.to(roomName).emit("cardsDealt", {
            players: room.players.map(({ username, cardCount, hand }) => ({
              username,
              cardCount,
              hand,
            })),
          });

          console.log(`Cards distributed for room: ${roomName}`);
        } catch (error) {
          console.error("Error distributing cards:", error);
        }
      }
    );

    socket.on("getRoomInfo", (roomName: string, callback: Function) => {
      try {
        const room = availableRooms.find((r) => r.roomName === roomName);
        if (room) {
          console.log("Found room:", room);
          socket.emit("roomInfo", room);
          callback({ success: true });
        } else {
          console.log("Room not found:", roomName);
          callback({ success: false, message: "Room not found" });
        }
      } catch (error) {
        console.error("Error getting room info:", error);
        callback({ success: false, message: "Error fetching room info" });
      }
    });

    socket.on("leaveRoom", async (roomName: string, callback: Function) => {
      try {
        await handlePlayerLeave(socket, roomName, callback);
        socket.leave(roomName);
        if (callback) {
          callback({ success: false, message: "failed to leave room" });
        }
      } catch (error) {
        console.error(error);
      }
    });

    socket.on("disconnect", () => {
      const socketRooms = Array.from(socket.rooms); // Get all rooms the socket is in maybe??
      socketRooms.forEach((roomName) => {
        if (roomName !== socket.id) {
          handlePlayerLeave(socket, roomName);
        }
      });
    });

    async function handlePlayerLeave(
      socket: Socket,
      roomName: string,
      callback?: Function
    ) {
      const roomIndex = availableRooms.findIndex(
        (r) => r.roomName === roomName
      );

      if (roomIndex === -1) {
        if (callback) callback({ success: false, message: "Room not found" });
        return;
      }

      const room = availableRooms[roomIndex];
      console.log("current room state", room);
      const playerIndex = room.players.findIndex(
        (p) => p.socketId === socket.id
      );

      if (playerIndex === -1) {
        console.log(`Player not found inside room ${socket.id}`);
        return;
      }
      room.players.splice(playerIndex, 1);
      room.playerCount--;
      console.log(`updating ${room} with disconnect/leaver`);

      if (room.isGameStarted && playerIndex <= room.currentTurnIndex) {
        if (playerIndex === room.currentTurnIndex) {
          room.currentTurnIndex = room.currentTurnIndex % room.players.length;
          io.to(roomName).emit("turnUpdate", {
            currentPlayer: room.players[room.currentTurnIndex],
            currentTurnIndex: room.currentTurnIndex,
          });
        } else {
          room.currentTurnIndex--;
        }
      }
      if (room.playerCount <= 0) {
        availableRooms.splice(roomIndex, 1);
      }
      io.emit("activeRooms", availableRooms);
      io.to(roomName).emit("playerLeft", {
        players: room.players,
        leftPlayerId: socket.id,
      });

      if (callback)
        callback({ success: true, message: "Successfully left the room" });

      console.log(`Player ${socket.id} left room: ${roomName}`);
    }
  });
};
