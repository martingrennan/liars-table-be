import { ObjectId } from "mongodb";

interface Card {
  code: string;
  image: string;
  images: object;
  suit: string;
  value: string;
}

export default class User {
  constructor(
    public _id: string,
    public username: string, 
    public email: string, 
    public hand: Card[],
    public avatar: string = "https://icons.veryicon.com/png/o/miscellaneous/rookie-official-icon-gallery/225-default-avatar.png", 
    public id?: ObjectId) {}

}