import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authenticateRoutes from "./routes/authenticate.js";
import enrollSfamRoutes from "./routes/enrollSfam.js";
import oidcRoutes from "./routes/oidc.js";
import trustEngineRoutes from "./routes/trustEngine.js";
import analyticsRoutes from "./routes/analytics.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 5000;

function startHttpServer(listenPort) {
  return new Promise((resolve, reject) => {
    const server = app.listen(listenPort, () => {
      console.log(
        `\n✅ SecuADR API Server running on http://localhost:${listenPort}`,
      );
      console.log(`   Health: http://localhost:${listenPort}/health`);
      console.log(`   Status: http://localhost:${listenPort}/api/status\n`);
      resolve(server);
    });

    server.once("error", (error) => {
      reject(error);
    });
  });
}

// ===== MIDDLEWARE =====
app.use(helmet());
app.use(compression());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ===== DATABASE INITIALIZATION =====
async function initializeDatabase() {
  try {
    console.log("\n🚀 Starting SecuADR API Server v2.0\n");
    console.log("🔌 Connecting to MongoDB...");

    const mongoUri =
      process.env.MONGODB_URI || "mongodb://localhost:27017/secuadr";
    const dbName = process.env.MONGODB_DBNAME || "secuadr";

    await mongoose.connect(mongoUri, {
      dbName,
      serverSelectionTimeoutMS: 12000,
      connectTimeoutMS: 12000,
    });

    console.log("✅ MongoDB connected successfully");
  } catch (error) {
    console.error("⚠️  MongoDB connection failed:", error.message);
    if ((error.message || "").toLowerCase().includes("whitelist")) {
      console.error(
        "   Atlas IP access issue detected. Add your current IP in Atlas Network Access or allow 0.0.0.0/0 for testing.",
      );
    }
    console.log("   Continuing with limited functionality...");
  }
}

// ===== ROUTES =====
app.use("/api/authenticate", authenticateRoutes);
app.use("/api/sfam/enroll", enrollSfamRoutes);
app.use("/api/oidc", oidcRoutes);
app.use("/api/trust", trustEngineRoutes);
app.use("/", analyticsRoutes);

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "SecuADR Backend API",
    version: "2.0",
    uptime: process.uptime(),
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// API Status
app.get("/api/status", (req, res) => {
  res.json({
    status: "ok",
    service: "SecuADR",
    features: {
      authentication: true,
      enrollment: true,
      oidc: true,
    },
    timestamp: new Date().toISOString(),
  });
});

// CNN status endpoint used by frontend health checks
app.get("/api/cnn-status", (req, res) => {
  res.json({
    status: "ok",
    success: true,
    currentMode: "cnn_leading_adaptive_ai",
    mode: "cnn_leading_adaptive_ai",
    available: "connected",
    modelLoaded: true,
    service: "SecuADR Backend API",
    type: process.env.NODE_ENV || "development",
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// ===== ERROR HANDLER =====
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

// ===== START SERVER =====
async function start() {
  try {
    await initializeDatabase();

    await startHttpServer(port);
  } catch (error) {
    if (error.code === "EADDRINUSE") {
      const currentPort = Number(port);
      const suggestedPort = Number.isInteger(currentPort)
        ? currentPort + 1
        : 5001;
      console.error(
        `❌ Port ${port} is already in use. Another SecuADR server is likely running.`,
      );
      console.error(
        `   Stop the running process or start this server on another port, e.g. PORT=${suggestedPort} node index.js`,
      );
    } else {
      console.error("❌ Failed to start server:", error);
    }
    process.exit(1);
  }
}

start();
