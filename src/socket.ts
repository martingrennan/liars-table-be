import { Server, Socket } from "socket.io";

interface Player {
  socketId: string;
  username: string;
  avatar: string;
  hand: any[];
}

interface Room {
  roomName: string;
  isPrivate: boolean;
  password: string | null;
  playerCount: number;
  players: Player[];
  currentTurnIndex: number;
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
});

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
            hand: [],
          };
          const newRoom: Room = {
            roomName,
            isPrivate: Boolean(password && password.length > 0),
            password: password || null,
            playerCount: 1,
            players: [firstPlayer], // Add the creator as first player
            currentTurnIndex: 0,
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

      // if (room.turnTimer && room.players.length === 0) {
      //   clearTimeout(room.turnTimer);
      // }
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

    //   function startTurn(io: Server, room: Room) {
    //     const currentPlayer = room.players[room.currentTurnIndex];

    //     io.to(currentPlayer.socketId).emit("yourTurn", true);
    //     io.to(room.roomName).emit("updateTurn", currentPlayer);

    //     room.turnTimer = setTimeout(() => {
    //       io.to(currentPlayer.socketId).emit("turnTimedOut");
    //       room.currentTurnIndex =
    //         (room.currentTurnIndex + 1) % room.players.length;
    //       startTurn(io, room);
    //     }, 10000);
    //   }
    // });
  });
};
