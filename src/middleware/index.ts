const admin = require("../config/firebase-config");
import { Request, Response, NextFunction } from 'express';

class Middleware {
  async decodeToken(req: Request, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(" ")[1]; 

    // if (!token) {
    //   return res.status(401).json({ message: "No token provided" });
    // }

    try {
      const decodeValue = await admin.auth().verifyIdToken(token);
      console.log(decodeValue);

      if (decodeValue) {
        return next(); 
      }

      return res.status(401).json({ message: "Unauthorized" }); 
    } catch (e) {
      console.error(e);
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

export default new Middleware();