import express from "express";
import { connectToDatabase } from "./services/database.service";
import { usersRouter } from './users/users.routes';

const app = express();

// Always use the dynamic PORT for cloud services like Render
const port = process.env.PORT || 8080; // Render will set this automatically

connectToDatabase()
    .then(() => {
        app.use("/", usersRouter);

        app.listen(port, () => {
            console.log(`Server started at http://localhost:${port}`);
        });
    })
    .catch((error: Error) => {
        console.error("Database connection failed", error);
        process.exit();
    });