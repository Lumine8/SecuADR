const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  debug: true,
});

const app = express();
const port = process.env.PORT || 5000;

// Enhanced CORS configuration - FIXED to include localhost:3001
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001", // Added this for your frontend
      "https://finadr.vercel.app",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Cache-Control",
      "Pragma",
      "Expires",
      "X-Requested-With",
    ],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  })
);

// Enhanced middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Additional manual CORS headers for preflight requests
app.use((req, res, next) => {
  // Allow requests from localhost:3001 specifically
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "https://finadr.vercel.app",
  ];

  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Cache-Control, Pragma, Expires, X-Requested-With"
  );
  res.setHeader("Access-Control-Allow-Credentials", "true");

  // Handle preflight OPTIONS requests
  if (req.method === "OPTIONS") {
    console.log(`🔍 CORS Preflight: ${req.headers.origin} -> ${req.url}`);
    return res.status(200).end();
  }

  next();
});

// Debug environment variables
console.log("🔍 Environment Variables Check:");
console.log("MONGODB_URI defined:", !!process.env.MONGODB_URI);
console.log(
  "MONGODB_URI length:",
  process.env.MONGODB_URI ? process.env.MONGODB_URI.length : "undefined"
);

// MongoDB connection (removed deprecated options)
const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/secuadr";

mongoose
  .connect(mongoUri)
  .then(() => {
    console.log("🔗 Mongoose connected to MongoDB");
    console.log("✅ MongoDB connected successfully");
    console.log("📊 Database: patternLogin");
  })
  .catch((err) => {
    console.error("❌ MongoDB connection error:", err.message);
    console.log("🔄 Continuing without database - some features may not work");
  });

// Import routes
const authenticateRoutes = require("./routes/authenticate");
const savePatternRoutes = require("./routes/save-pattern");
const getPatternRoutes = require("./routes/get-pattern");
const cnnPredictRoutes = require("./routes/cnn-predict");
const cnnStatusRoutes = require("./routes/cnn-status");
const fallbackAuthRoutes = require("./routes/fallback-auth");
const fallbackRoutes = require("./routes/fallback");

// ONNX Predictor Service
const ONNXPredictor = require("./services/ONNXPredictor");

// Initialize ONNX predictor on server startup
const initializeONNX = async () => {
  console.log("🧠 Initializing ONNX CNN model...");
  const predictor = new ONNXPredictor();

  try {
    console.log("🔍 Loading ONNX CNN model from: ./models/gesture_cnn.onnx");
    await predictor.loadModel("./models/gesture_cnn.onnx");
    console.log("✅ ONNX CNN model loaded successfully");
    global.onnxPredictor = predictor; // Make available globally
  } catch (error) {
    console.error("❌ Failed to load ONNX model:", error.message);
    console.log(
      "🔄 Continuing with mock/fallback mode - CNN features disabled"
    );
    global.onnxPredictor = null;
  }

  console.log("✅ ONNX CNN model initialization complete");
};

// Apply routes with logging
app.use(
  "/api/authenticate",
  (req, res, next) => {
    console.log(
      `🔐 Authentication request from ${req.headers.origin || "unknown"}`
    );
    next();
  },
  authenticateRoutes
);

app.use(
  "/api/save-pattern",
  (req, res, next) => {
    console.log(
      `💾 Pattern save request from ${req.headers.origin || "unknown"}`
    );
    next();
  },
  savePatternRoutes
);

app.use("/api/get-pattern", getPatternRoutes);
app.use("/api/cnn-predict", cnnPredictRoutes);

app.use(
  "/api/cnn-status",
  (req, res, next) => {
    console.log(`📡 CNN status check from ${req.headers.origin || "unknown"}`);
    next();
  },
  cnnStatusRoutes
);

app.use("/api/fallback-auth", fallbackAuthRoutes);
app.use("/api/fallback", fallbackRoutes);

// Enhanced health check endpoint
app.get("/health", (req, res) => {
  console.log(`🏥 Health check from ${req.headers.origin || "unknown"}`);

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: "SecuADR Backend API",
    version: "3.0.0",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    onnx: global.onnxPredictor?.isModelLoaded() ? "loaded" : "not_loaded",
    cors: {
      allowedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "https://finadr.vercel.app",
      ],
      requestOrigin: req.headers.origin || "none",
    },
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + "MB",
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + "MB",
    },
  };

  res.json(healthData);
});

// FIXED: 404 handler for undefined routes - Express v5 compatible
app.use("/{*catchall}", (req, res) => {
  console.log(
    `❌ 404: ${req.method} ${req.originalUrl} from ${
      req.headers.origin || "unknown"
    }`
  );
  res.status(404).json({
    success: false,
    message: "Endpoint not found",
    availableEndpoints: [
      "GET /health",
      "GET /api/cnn-status",
      "POST /api/authenticate",
      "POST /api/save-pattern",
      "GET /api/get-pattern",
      "POST /api/cnn-predict",
      "POST /api/fallback-auth",
      "POST /api/fallback",
    ],
    requestedPath: req.originalUrl,
    method: req.method,
  });
});

// Enhanced AI Engine Status Checker
async function checkAIEngineStatus() {
  try {
    // Wait for server to fully start
    await new Promise((resolve) => setTimeout(resolve, 3000));

    console.log("🔍 Checking AI engine status...");
    const response = await axios.get(
      `http://localhost:${port}/api/cnn-status`,
      {
        timeout: 5000,
        headers: {
          "User-Agent": "SecuADR-Internal-Health-Check",
        },
      }
    );

    const responseData = response.data;
    console.log("📊 AI Health Result:", {
      mode: responseData.mode || responseData.currentMode,
      available: responseData.available || responseData.mlService?.status,
      modelLoaded:
        responseData.modelLoaded || responseData.aiEngine?.cnn?.modelLoaded,
      type: responseData.type || responseData.aiEngine?.cnn?.type || "unknown",
    });

    if (
      responseData.mode === "cnn_leading_adaptive_ai" ||
      (responseData.currentMode === "cnn_leading_adaptive_ai" &&
        responseData.aiEngine?.cnn?.modelLoaded)
    ) {
      console.log("🧠 AI Engine: ✅ CNN Model Leading Adaptive AI Engine");
      console.log(
        `📊 CNN Service: ${
          responseData.available || responseData.mlService?.status
        } (${
          responseData.service ||
          responseData.aiEngine?.cnn?.service ||
          "CNN Service"
        })`
      );
    } else {
      console.log(
        "🧠 AI Engine: ⚠️ $1 Recognizer Only (Adaptive AI Unavailable)"
      );
      if (responseData.mlService && responseData.mlService.error) {
        console.log(`📊 AI Service Error: ${responseData.mlService.error}`);
      }
    }
  } catch (error) {
    console.log(
      "🧠 AI Engine: ⚠️ $1 Recognizer Only (Adaptive AI Unavailable)"
    );
    console.log(`📊 AI Service Status: Unable to connect (${error.message})`);
  }
}

// Start server with ONNX initialization
app.listen(port, async () => {
  console.log(`🚀 SecuADR Server running on port ${port}`);
  console.log("🧠 AI-Powered Authentication System Ready");
  console.log(
    "🌐 CORS enabled for: localhost:3000, localhost:3001, finadr.vercel.app"
  );
  console.log("📡 Available API endpoints:");
  console.log(
    "   POST /api/authenticate     - Intelligent fusion authentication"
  );
  console.log("   POST /api/save-pattern     - Pattern enrollment");
  console.log("   GET  /api/get-pattern      - Pattern retrieval");
  console.log("   POST /api/cnn-predict      - ONNX CNN inference");
  console.log("   GET  /api/cnn-status       - AI health check");
  console.log("   POST /api/fallback-auth    - Enhanced fallback auth");
  console.log("   POST /api/fallback         - Email fallback");
  console.log("   GET  /health               - API health status");
  console.log("");

  // Initialize ONNX model
  await initializeONNX();

  // Check AI engine status after initialization
  checkAIEngineStatus();
});

// Enhanced graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down SecuADR server gracefully...");

  // Close database connection
  mongoose.connection.close(() => {
    console.log("📊 Database connection closed");
  });

  // Clean up ONNX predictor
  if (global.onnxPredictor) {
    try {
      global.onnxPredictor.cleanup();
      console.log("🧠 ONNX predictor cleaned up");
    } catch (error) {
      console.log("⚠️ Error cleaning up ONNX predictor:", error.message);
    }
  }

  console.log("✅ SecuADR server shutdown complete");
  process.exit(0);
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  console.log(
    "🔄 Server will continue running, but this should be investigated"
  );
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  console.log("🛑 Server shutting down due to uncaught exception");
  process.exit(1);
});

module.exports = app;
