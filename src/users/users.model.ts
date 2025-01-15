import { ObjectId } from "mongodb";

export default class User {
  constructor(
    public _id: string,
    public name: string, 
    public username: string, 
    public email: string, 
    public avatar: string = "https://icons.veryicon.com/png/o/miscellaneous/rookie-official-icon-gallery/225-default-avatar.png", 
    public id?: ObjectId) {}
}