import { ObjectId } from "mongodb";

export default class User {
  constructor(
    public _id: string,
    public name: string, 
    public username: string, 
    public email: string, 
    public avatar: string, 
    public id?: ObjectId) {}
}