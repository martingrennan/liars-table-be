import User from "./users.model";
import { collections } from "../services/database.service";
import { Request, Response } from "express";

export const getAllUsers = async (_req: Request, res: Response) => {

  try {
    console.log(_req.headers)
    const users = await collections.Users?.find({}).toArray();

    if (!users) {
      res.status(404).send("No users found.");
      return;
    }
    res.status(200).send(users);
  } catch (error) {
    res.status(500).send(error instanceof Error ? error.message : "An error occurred.");
  }
};

export const getSpecificUser = async (req: Request, res: Response) => {
  const username = req.params.username; 
  const query: { username: string } = { username: username };

  try {
    if (!collections.Users) {
      throw new Error("Users collection is not initialized.");
    }

    const user = (await collections.Users?.findOne(query)) as User; 

    if (user) {
      res.status(200).send(user);
    } else {
      res.status(404).send(`User with username ${username} not found`);
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("Unable to find user");
  }
}

export const createUser = async (req: Request, res: Response) => {
  try {
      const newUser = req.body as User;
      const result = await collections.Users?.insertOne(newUser);

      result
          ? res.status(201).send(`Successfully created new user`)
          : res.status(500).send("Failed to create a new user.");
  } catch (error) {
      console.error(error);
      res.status(400).send(error instanceof Error ? error.message : "An error occurred.");
  }
}

export const changeUser = async (req: Request, res: Response) => {
  const username = req.params.username;

  try {
      const updatedUser: User = req.body as User;
      const query: { username: string } = { username: username };
      const { _id, ...userWithoutId } = updatedUser;

      const result = await collections.Users?.updateOne(query, { $set: userWithoutId });
      result
          ? res.status(200).send(`Successfully updated user with username ${username}`)
          : res.status(304).send(`User: ${username} not updated`);
  } catch (error) {
      console.error(error instanceof Error ? error.message : "An error occurred.");
      res.status(400).send(error instanceof Error ? error.message : "An error occurred.");
  }
}

export const deleteUser = async (req: Request, res: Response) => {
  const username = req.params.username;

  try {
    const query: { username: string } = { username: username };
      const result = await collections.Users?.deleteOne(query);

      if (result && result.deletedCount) {
          res.status(202).send(`Successfully removed user: ${username}`);
      } else if (!result) {
          res.status(400).send(`Failed to remove user "${username}"`);
      } else if (!result.deletedCount) {
          res.status(404).send(`User "${username}" does not exist`);
      }
  } catch (error) {
      console.error(error instanceof Error ? error.message : "An error occurred.");
      res.status(400).send(error instanceof Error ? error.message : "An error occurred.");
  }
}

// async function getAllUsers (_req: Request, res: Response) => {
//   try {
//     const users = await collections.Users?.find({}).toArray();

//     if (!users) {
//       res.status(404).send("No users found.");
//       return;
//     }
//     res.status(200).send(users);
//   } catch (error) {
//     res.status(500).send(error instanceof Error ? error.message : "An error occurred.");
//   }
// }

// module.exports = {getAllUsers}

// import { Request, Response, NextFunction } from "express";
// // import { User, UserInput } from "./users.model";
// import { IncomingMessage, ServerResponse} from "http";
// const { MongoClient } = require("mongodb");
// require("dotenv").config({
//   path: `${__dirname}/../.env.mongo`,
// });
// const { MONGODB_URL } = process.env;
// const client = new MongoClient(MONGODB_URL);
// client.connect();

// // get all users
// const getAllUsers = async (_req: Request, res: any) => {
//   try {
//     const dataset = await client
//       .db("Users")
//       .collection("Users")
//       .find()
//       .toArray();
//     return res.status(200).json({ dataset });
//   } catch {
//     console.log("db closed");
//     await client.close();
//   }
// };

// //get specific user
// const getUser = async (req: Request, res: any, next: NextFunction) => {
//   const { username } = req.params;
//   try {
//     const dataset = await client
//       .db("Users")
//       .collection("Users")
//       .find({ username: { $eq: `${username}` } })
//       .toArray();
//     return res.status(200).json({ dataset });
//   } catch (error) {
//     res.status(500).json({ error: "Internal Server Error" });
//   }
// };

// //post a new user
// const createUser = async (req: Request, res: any) => {
//   const { email, name, username, avatar } = req.body;

//   if (!email || !name || !username || !avatar) {
//     return res.status(422).json({ message: 'The fields email, name, username and avatar are required' });
//   }

//   // const userInput: UserInput = {
//   //   name,
//   //   email,
//   //   username,
//   //   avatar
//   // };

//   // try {
//   //   console.log(userInput)
//   //   await client
//   //     .db("Users")
//   //     .collection("Users")
//   //     .insertOne({ userInput })
//   //   return res.status(201).json({ userInput });
//   // } catch (error) {
//   //   res.status(500).json({ error: "Internal Server Error" });
//   // }
// };

// // //update user fields
// // const updateUser = async (req: Request, res: any) => {
// //   const identifier = req.params.username;
// //   const { name, email, avatar, username } = req.body;

// //   if (!identifier) {
// //     return res.status(404).json({ message: `${identifier} not found.` });
// //   }

// //   // if (!fullName || !role) {
// //   //   return res.status(422).json({ message: 'The fields fullName and role are required' });
// //   // }

// //   await User.updateOne({ _id: id }, { enabled, fullName, role });

// //   const userUpdated = await User.findById(id);

// //   return res.status(200).json({ data: userUpdated });
// // };

// // const deleteUser = async (req: Request, res: Response) => {
// //   const { id } = req.params;

// //   await User.findByIdAndDelete(id);

// //   return res.status(200).json({ message: 'User deleted successfully.' });
// // };

// // export { createUser, deleteUser, getAllUsers, getUser, updateUser };

// export { getAllUsers, getUser, createUser };
