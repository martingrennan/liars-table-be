import * as mongoDB from "mongodb";
import * as dotenv from "dotenv";
import User from "../users/users.model";

export const collections: { Users?: mongoDB.Collection<User> } = {};

dotenv.config({
    path: `${__dirname}/../../.env.mongo`,
  });

export async function connectToDatabase() {

  const client: mongoDB.MongoClient = new mongoDB.MongoClient(
    process.env.DB_CONN_STRING as string
  );

  await client.connect();

  const db: mongoDB.Db = client.db(process.env.USERS_DB as string);

  const usersCollection: mongoDB.Collection<User> = db.collection<User>(
    process.env.USERS_COLLECTION as string
  );

  collections.Users = usersCollection;
  console.log(
    `Successfully connected to database: ${db.databaseName} and collection: ${usersCollection.collectionName}`
  );
}

