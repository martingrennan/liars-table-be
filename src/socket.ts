import { Server, Socket } from "socket.io";

interface Player {
  socketId: string;
  username: string;
  avatar: string;
  hand: any[]; // need the array to be dynamic for now
  slot: any; // we need the slot to dynamically adjust with code logic. Specifics are not ideal for now.
}

interface Room {
  roomName: string;
  isPrivate: boolean;
  password: string | null;
  playerCount: number;
  players: Player[];
  currentTurnIndex: number;
  turnTimer?: NodeJS.Timeout;
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
          const { roomName, password, username, avatar } = room;
          const validRoom = availableRooms.find((r) => r.roomName === roomName);
          if (validRoom) {
            callback({ success: false, message: "Room name already exists" });
            return;
          }

          const newRoom: Room = {
            roomName,
            isPrivate: Boolean(password && password.length > 0),
            password: password || null,
            playerCount: 1,
            players: [
              {
                socketId: socket.id,
                username,
                avatar,
                hand: [],
                slot: "top",
              },
            ],
            currentTurnIndex: 0,
          };

          availableRooms.push(newRoom);
          await socket.join(roomName);

          console.log("Room created successfully:", newRoom);
          io.emit("activeRooms", availableRooms);
          callback({ success: true, message: "Room created successfully" });
        } catch (error) {
          console.error("Error creating room:", error);
          callback({ success: false, message: "Failed to create room" });
        }
      }
    );
    socket.on("requestActiveRooms", () => {
      console.log("Active rooms requested");
      logRooms();
      socket.emit("activeRooms", availableRooms);
    });

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
          const roomIndex = availableRooms.findIndex(
            (r) => r.roomName === roomName
          );

          if (roomIndex === -1) {
            callback({ success: false, message: "Room not found" });
            return;
          }

          const room = availableRooms[roomIndex];
          if (room.isPrivate && room.password !== password) {
            callback({ success: false, message: "Incorrect password" });
            return;
          }
          if (room.playerCount >= 4) {
            callback({ success: false, message: "Room is full" });
            return;
          }

          const availableSlots = ["top", "right", "bottom", "left"];
          const usedSlots = room.players.map((player) => player.slot);
          const availableSlot =
            availableSlots.find((slot) => !usedSlots.includes(slot)) || "top"; // default to "top" if no slots are available

          const newPlayer: Player = {
            socketId: socket.id,
            username,
            avatar,
            hand: [],
            slot: availableSlot,
          };
          room.players.push(newPlayer);
          room.playerCount++;
          await socket.join(roomName);
          io.emit("activeRooms", availableRooms);
          io.to(roomName).emit("playerJoined", room.players);

          callback({ success: true, message: "Successfully joined room" });
        } catch (error) {
          console.error("Error joining room:", error);
          callback({ success: false, message: "Failed to join room" });
        }
      }
    );

    socket.on("leaveRoom", (roomName: string, callback: Function) => {
      handlePlayerLeave(socket, roomName, callback);
    });

    socket.on("disconnect", () => {
      const socketRooms = Array.from(socket.rooms); // Get all rooms the socket is in maybe??
      socketRooms.forEach((roomName) => {
        if (roomName !== socket.id) {
          handlePlayerLeave(socket, roomName);
        }
      });
    });

    function handlePlayerLeave(
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
      const playerIndex = room.players.findIndex(
        (p) => p.socketId === socket.id
      );

      if (playerIndex === -1) {
        if (callback)
          callback({ success: false, message: "Player not found in room" });
        return;
      }
      room.players.splice(playerIndex, 1);
      room.playerCount--;

      if (room.turnTimer && room.players.length === 0) {
        clearTimeout(room.turnTimer);
      }
      if (room.playerCount <= 0) {
        availableRooms.splice(roomIndex, 1);
      }
      io.emit("activeRooms", availableRooms);
      io.to(roomName).emit("playerLeft", room.players);

      if (callback)
        callback({ success: true, message: "Successfully left the room" });

      console.log(`Player ${socket.id} left room: ${roomName}`);
    }

    socket.on("disconnect", () => {
      const socketRooms = Array.from(socket.rooms);
      socketRooms.forEach((roomName) => {
        if (roomName !== socket.id) {
          const roomIndex = availableRooms.findIndex(
            (r) => r.roomName === roomName
          );
          if (roomIndex !== -1) {
            availableRooms[roomIndex].playerCount--;

            if (availableRooms[roomIndex].playerCount <= 0) {
              availableRooms.splice(roomIndex, 1);
            }
            io.emit("activeRooms", availableRooms);
            io.to(roomName).emit("playerLeft", {
              roomName,
              playerCount: availableRooms[roomIndex]?.playerCount || 0,
            });
          }
        }
      });
    });
    function startTurn(io: Server, room: Room) {
      const currentPlayer = room.players[room.currentTurnIndex];

      io.to(currentPlayer.socketId).emit("yourTurn", true);
      io.to(room.roomName).emit("updateTurn", currentPlayer);

      room.turnTimer = setTimeout(() => {
        io.to(currentPlayer.socketId).emit("turnTimedOut");
        room.currentTurnIndex =
          (room.currentTurnIndex + 1) % room.players.length;
        startTurn(io, room);
      }, 10000);
    }
  });
};
