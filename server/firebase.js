const admin = require("firebase-admin");
const serviceAccount = require("./finadr-c216d-firebase-adminsdk-fbsvc-13033fbb90.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: "finadr-c216d",
});

console.log("✅ Firebase Admin SDK initialized for finadr-c216d");

module.exports = admin;
