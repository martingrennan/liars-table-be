import express from "express";
import { connectToDatabase } from "./services/database.service";
import { usersRouter } from "./users/users.routes";
import { Server } from "socket.io";
import http from "http";
// import { setupSockets } from "./socket";

export const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["my-custom-header"],
    credentials: true,
  },
});

server.listen(8080, () => {
  console.log("Server running at http://localhost:8080");
});

// Database connection and routing setup
connectToDatabase()
  .then(() => {
    app.use("/", usersRouter);
  })
  .catch((error: Error) => {
    console.error("Database connection failed", error);
    process.exit();
  })
  .then(() => {
    io.on("connection", (socket) => {
      console.log("A new socket connection has been made:", socket.id);
      // setupSockets(socket); // Initialize the socket events
      console.log("in socket");
      interface Room {
        roomName: string;
        isPrivate: boolean;
        password: string | null;
        playerCount: number;
      }

      let availableRooms: Room[] = [];

      console.log("A user has connected");

      // Event to create a new room
      socket.on(
        "createRoom",
        (room: { roomName: string; password: string }, callback: Function) => {
          console.log("Received createRoom data:", room);
          const { roomName, password } = room;
          const validRoom = availableRooms.find(
            (room) => room.roomName === roomName
          );
          if (validRoom) {
            console.log("Room name already exists:", roomName);
            callback("Room name already exists");
          } else {
            const newRoom: Room = {
              roomName,
              isPrivate: password.length > 0,
              password: password || null,
              playerCount: 0,
            };
            availableRooms.push(newRoom);
            console.log("New room created:", newRoom);
            io.emit("activeRooms", availableRooms);
            callback("Room created successfully");
          }
          console.log("Current available rooms:", availableRooms);
        }
      );

      // Event to request active rooms
      socket.on("requestActiveRooms", () => {
        console.log("Active rooms requested. Current rooms:", availableRooms);
        socket.emit("activeRooms", availableRooms);
      });

      // Event to join an existing room
      socket.on("joinRoom", (roomName: string, password: string | null) => {
        console.log(
          `Join room request: roomName=${roomName}, password=${password}`
        );
        const validRoom = availableRooms.find(
          (room) => room.roomName === roomName
        );

        if (validRoom) {
          if (validRoom.password === password && validRoom.playerCount < 4) {
            socket.join(roomName);
            validRoom.playerCount++;
            console.log(
              `User joined room: ${roomName}, Updated room data:`,
              validRoom
            );
          } else {
            console.log(
              `Join failed for room: ${roomName}. Password incorrect or room full.`
            );
            socket.emit("invalid room name or password or the room is full");
          }
        } else {
          console.log(`Room "${roomName}" not found.`);
          socket.emit("invalid room name or password or the room is full");
        }
      });
      socket.emit("activeRooms", availableRooms);
    });
  });
