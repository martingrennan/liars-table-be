import { Server, Socket } from "socket.io";

interface Room {
  roomName: string;
  isPrivate: boolean;
  password: string | null;
  playerCount: number;
}

// Moved this here to store rooms at module level to persist across connections - previously i accidentally placed it inside the io.on
let availableRooms: Room[] = [];
availableRooms.push({
  roomName: "testOnLaunch",
  isPrivate: true,
  password: "123",
  playerCount: 0,
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
        room: { roomName: string; password: string },
        callback: Function
      ) => {
        try {
          console.log("Received createRoom request:", room);
          const { roomName, password } = room;

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

          const newRoom = {
            roomName,
            isPrivate: Boolean(password && password.length > 0),
            password: password || null,
            playerCount: 1,
          };

          availableRooms.push(newRoom);
          await socket.join(roomName);

          console.log("Room created successfully:", newRoom);
          logRooms(); // Log all rooms after creation

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
    socket.on("requestActiveRooms", () => {
      console.log("Active rooms requested");
      logRooms();
      socket.emit("activeRooms", availableRooms);
    });

    socket.on(
      "joinRoom",
      async (roomName: string, password: string | null, callback: Function) => {
        try {
          console.log(`Join room request: roomName=${roomName}`);

          const roomIndex = availableRooms.findIndex(
            (room) => room.roomName === roomName
          );

          if (roomIndex === -1) {
            callback({
              success: false,
              message: "Room not found",
            });
            return;
          }

          const room = availableRooms[roomIndex];

          if (room.playerCount >= 4) {
            callback({
              success: false,
              message: "Room is full",
            });
            return;
          }

          if (room.isPrivate && room.password !== password) {
            callback({
              success: false,
              message: "Incorrect password",
            });
            return;
          }
          await socket.join(roomName);
          availableRooms[roomIndex].playerCount++;
          io.emit("activeRooms", availableRooms);

          callback({
            success: true,
            message: "Successfully joined room",
          });
          io.to(roomName).emit("playerJoined", {
            roomName,
            playerCount: availableRooms[roomIndex].playerCount,
          });
        } catch (error) {
          console.error("Error joining room:", error);
          callback({
            success: false,
            message: "Failed to join room",
          });
        }
      }
    );

    socket.on("leaveRoom", (roomName: string, callback: Function) => {
      try {
        const roomIndex = availableRooms.findIndex(
          (room) => room.roomName === roomName
        );

        if (roomIndex === -1) {
          callback({ success: false, message: "Room not found" });
          return;
        }

        const room = availableRooms[roomIndex];
        room.playerCount--;

        if (room.playerCount <= 0) {
          availableRooms.splice(roomIndex, 1);
        }

        socket.leave(roomName);

        io.emit("activeRooms", availableRooms);
        io.to(roomName).emit("playerLeft", {
          // update to template literal when we get user info passing successfully.
          roomName,
          playerCount: availableRooms[roomIndex]?.playerCount || 0,
        });

        callback({ success: true, message: "Successfully left the room" });
      } catch (error) {
        console.error("Error leaving room:", error);
        callback({ success: false, message: "Failed to leave room" });
      }
    });

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
  });
};
