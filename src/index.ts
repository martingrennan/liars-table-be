import express from "express";
import { connectToDatabase } from "./services/database.service";
import { usersRouter } from "./users/users.routes";
import { Server } from "socket.io";
import http from "http";

// Create Express app and HTTP server
export const app = express();
const server = http.createServer(app);
export const io = new Server(server);

// Room interface and available rooms list
interface Room {
  roomName: string;
  isPrivate: boolean;
  password: string | null;
  playerCount: number;
}
let availableRooms: Room[] = [];

// Socket.IO connection handler
io.on("connection", (socket) => {
  console.log("A user has connected");

  // Event to create a new room
  socket.on("createRoom", (roomName: string, password: string) => {
    const validRoom = availableRooms.find((room) => room.roomName === roomName);
    if (validRoom) {
      socket.emit("room name already exists");
    } else {
      const newRoom: Room = {
        roomName,
        isPrivate: password.length > 0,
        password: password || null,
        playerCount: 0,
      };
      availableRooms.push(newRoom); // Add room to availableRooms
      io.emit("activeRooms", availableRooms); // Emit updated room list to all connected clients
    }
  });

  // Event to join an existing room
  socket.on("joinRoom", (roomName: string, password: string | null) => {
    const validRoom = availableRooms.find((room) => room.roomName === roomName);
    if (validRoom && validRoom.password === null && validRoom.playerCount < 4) {
      socket.join(roomName); // Join the room if no password and not full
      validRoom.playerCount++;
    } else if (
      validRoom &&
      validRoom.password === password &&
      validRoom.playerCount < 4
    ) {
      socket.join(roomName); // Join the room if correct password and not full
      validRoom.playerCount++;
    } else {
      socket.emit("invalid room name or password or the room is full");
    }
  });

  // Emit active rooms to newly connected clients
  socket.emit("activeRooms", availableRooms);
});

// Connect server to port
server.listen(8080, () => {
  console.log("Server running at http://localhost:8080");
});

// Database connection and routing setup
connectToDatabase()
  .then(() => {
    app.use("/", usersRouter); // Set up routes after DB connection
  })
  .catch((error: Error) => {
    console.error("Database connection failed", error);
    process.exit();
  });
