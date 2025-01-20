// External Dependencies
import express, { Request, Response, NextFunction } from "express";
import {
  changeUser,
  createUser,
  deleteUser,
  getAllUsers,
  getSpecificUser,
} from "./users.controller";
const cors = require("cors");
import { Server } from "socket.io";
import http from "http";
import { app } from "../index";
const server = http.createServer(app);
const io = new Server(server);

export const usersRouter = express.Router();
usersRouter.use(cors());
usersRouter.use(express.json());

// usersRouter.use(async (req: Request, res: Response, next: NextFunction) => {
//     try {
//       await middleware.decodeToken(req, res, next);
//     } catch (err) {
//       res.status(500).json({ message: 'Internal server error' });
//     }
//   });

// get all users

usersRouter.get("/api/users", getAllUsers);

//get specific user
usersRouter.get("/api/users/:email", getSpecificUser);

// POST
usersRouter.post("/api/users", createUser);

// PUT
usersRouter.put("/api/users/:username", changeUser);

// DELETE
usersRouter.delete("/api/users/:username", deleteUser);
