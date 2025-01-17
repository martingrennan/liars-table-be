import * as admin from "firebase-admin";

const serviceAccount = require("./firebase-config.json");

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });

const auth = admin.auth();
const firestore = admin.firestore();

module.exports = { admin, auth, firestore };
