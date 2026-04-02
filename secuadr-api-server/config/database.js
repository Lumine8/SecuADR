import mongoose from "mongoose";
import config from "./config.js";

let isConnected = false;

export async function connectDB() {
  if (isConnected) {
    console.log("✅ Using existing database connection");
    return;
  }

  try {
    console.log("🔌 Connecting to MongoDB...");
    const conn = await mongoose.connect(config.mongodb.uri, {
      dbName: config.mongodb.dbName,
      retryWrites: true,
      w: "majority",
    });

    isConnected = true;
    console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
    return conn;
  } catch (error) {
    console.error("❌ MongoDB Connection Failed:", error.message);
    process.exit(1);
  }
}

export async function disconnectDB() {
  try {
    if (isConnected) {
      await mongoose.disconnect();
      isConnected = false;
      console.log("🔌 MongoDB Disconnected");
    }
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error);
  }
}

export function isDBConnected() {
  return isConnected;
}

export function getDB() {
  if (!isConnected) {
    throw new Error("Database not connected. Call connectDB() first.");
  }
  return mongoose.connection;
}
