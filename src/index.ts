import express from "express";
import { connectToDatabase } from "./services/database.service";
import { usersRouter } from "./users/users.routes";
import { Server } from "socket.io";
import http from "http";
import { setupSockets } from "./socket";

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

setupSockets(io);

const PORT: number = Number(process.env.PORT) || 8080; // process.env.PORT is a string, so we convert it to a number
server.listen(PORT,  () => {
  console.log(`Server running at http://localhost:${PORT}`);
});



connectToDatabase()
  .then(() => {
    app.use("/", usersRouter);
    console.log("Database connected successfully");
  })
  .catch((error: Error) => {
    console.error("Database connection failed", error);
    process.exit();
  });
