import express from "express";
import cors from "cors";
import helmet from "helmet";
import compression from "compression";
import { connectDB } from "./config/database.js";
import config from "./config/config.js";
import { sfamClient } from "./utils/sfamClient.js";
import authenticationService from "./services/authenticationService.js";

const app = express();

// ===== MIDDLEWARE =====
app.use(helmet());
app.use(compression());
app.use(
  cors({
    origin: config.cors.origin,
    credentials: config.cors.credentials,
  }),
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ===== STARTUP & INITIALIZATION =====
let dbConnected = false;

// Initialize database connection
async function initializeServices() {
  try {
    console.log("\n🚀 Starting SecuADR API Server v1.0\n");

    // Connect to MongoDB
    console.log("🔌 Initializing database...");
    try {
      await connectDB();
      dbConnected = true;
      console.log("✅ Database ready");
    } catch (error) {
      console.error(
        "⚠️  Database connection failed (will retry):",
        error.message,
      );
      dbConnected = false;
    }

    // Check SFAM service
    console.log("🧠 Checking SFAM service...");
    const sfamHealthy = await sfamClient.checkHealth();
    console.log(
      sfamHealthy
        ? "✅ SFAM service available"
        : "⚠️  SFAM service unreachable",
    );

    console.log(`\n🎯 Configuration:\n`);
    console.log(`  Port: ${config.port}`);
    console.log(`  Environment: ${config.nodeEnv}`);
    console.log(`  Database: ${config.mongodb.uri}`);
    console.log(`  SFAM Service: ${config.sfam.serviceUrl}`);
    console.log(`  RLFS Enabled: ${config.features.enableRlfsAnomaly}`);
    console.log(`  S-ADR Enabled: ${config.features.enableSadrResponse}\n`);
  } catch (error) {
    console.error("❌ Initialization error:", error);
  }
}

initializeServices();

// ===== HEALTH ENDPOINTS =====
app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date(),
    services: {
      database: dbConnected ? "connected" : "disconnected",
      api: "running",
    },
  });
});

app.get("/api/status", (req, res) => {
  res.json({
    version: "1.0",
    name: "SecuADR API",
    status: "active",
    database: dbConnected ? "connected" : "disconnected",
    sfam: config.sfam.serviceUrl,
    timestamp: new Date(),
  });
});

// ===== AUTHENTICATION API =====

/**
 * POST /api/auth/gesture
 * Main authentication endpoint
 * Input: gesture data, optional typing/touch/context
 */
app.post("/api/auth/gesture", async (req, res) => {
  try {
    const { user_id, gesture, typing, touch, device_context } = req.body;

    if (!user_id) {
      return res.status(400).json({
        success: false,
        error: "user_id is required",
      });
    }

    if (!gesture || !Array.isArray(gesture)) {
      return res.status(400).json({
        success: false,
        error: "gesture data required (array of points)",
      });
    }

    // Prepare context
    const contextFactors = {
      device_is_new: device_context?.is_new || false,
      location_is_new: device_context?.location_is_new || false,
      is_after_hours: device_context?.is_after_hours || false,
      ip_address: req.ip,
      user_agent: req.get("user-agent"),
      timestamp: new Date(),
    };

    // Authenticate through all 5 layers
    const result = await authenticationService.authenticateUser(
      user_id,
      {
        gesture,
        typing,
        touch,
        session: contextFactors,
      },
      contextFactors,
    );

    // Return appropriate HTTP status
    const statusCode = result.success
      ? 200
      : result.requires_challenge
        ? 401
        : 403;
    res.status(statusCode).json(result);
  } catch (error) {
    console.error("❌ Authentication endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Authentication processing failed",
      message: error.message,
    });
  }
});

/**
 * POST /api/auth/enroll
 * Enrollment endpoint
 */
app.post("/api/auth/enroll", async (req, res) => {
  try {
    const { user_id, gesture, typing, touch } = req.body;

    if (!user_id || !gesture) {
      return res.status(400).json({
        success: false,
        error: "user_id and gesture required",
      });
    }

    const result = await authenticationService.enrollUser(user_id, {
      gesture,
      typing,
      touch,
    });

    res.status(result.success ? 200 : 400).json(result);
  } catch (error) {
    console.error("❌ Enrollment endpoint error:", error);
    res.status(500).json({
      success: false,
      error: "Enrollment failed",
      message: error.message,
    });
  }
});

// ===== 404 & ERROR HANDLING =====

app.use((req, res) => {
  res.status(404).json({
    error: "Endpoint not found",
    path: req.path,
    method: req.method,
  });
});

app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(500).json({
    error: "Internal server error",
    message: config.isDev ? err.message : "Please contact support",
  });
});

// ===== START SERVER =====

const PORT = config.port;
const server = app.listen(PORT, () => {
  console.log(`\n✅ SecuADR API Server running on http://localhost:${PORT}\n`);
  console.log("Available endpoints:");
  console.log("  GET  /health - Health check");
  console.log("  GET  /api/status - Server status");
  console.log("  POST /api/auth/gesture - Authenticate");
  console.log("  POST /api/auth/enroll - Enroll new user\n");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("\n🛑 SIGTERM received, shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

export default app;
