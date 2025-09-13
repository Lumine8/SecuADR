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

// Middleware
app.use(
  cors({
    origin: ["http://localhost:3000", "https://finadr.vercel.app"],
    credentials: true,
  })
);
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

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
    await predictor.loadModel("./models/gesture_cnn.onnx");
    console.log("✅ ONNX CNN model initialization complete");
    global.onnxPredictor = predictor; // Make available globally
  } catch (error) {
    console.error("❌ ONNX CNN model initialization failed:", error.message);
    console.log("🔄 Continuing with fallback mode only");
    global.onnxPredictor = null;
  }
};

// Apply routes
app.use("/api/authenticate", authenticateRoutes);
app.use("/api/save-pattern", savePatternRoutes);
app.use("/api/get-pattern", getPatternRoutes);
app.use("/api/cnn-predict", cnnPredictRoutes);
app.use("/api/cnn-status", cnnStatusRoutes);
app.use("/api/fallback-auth", fallbackAuthRoutes);
app.use("/api/fallback", fallbackRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    service: "SecuADR Backend",
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",
    onnx: global.onnxPredictor?.isModelLoaded() ? "loaded" : "not_loaded",
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
      }
    );

    const { currentMode, mlService, aiEngine } = response.data;
    console.log("📊 AI Health Result:", {
      mode: currentMode,
      available: mlService.status,
      modelLoaded: aiEngine.cnn.modelLoaded,
      type: aiEngine.cnn.type,
    });

    if (currentMode === "cnn_leading_adaptive_ai" && aiEngine.cnn.modelLoaded) {
      console.log("🧠 AI Engine: ✅ CNN Model Leading Adaptive AI Engine");
      console.log(
        `📊 CNN Service: ${mlService.status} (${aiEngine.cnn.service})`
      );
    } else {
      console.log(
        "🧠 AI Engine: ⚠️ $1 Recognizer Only (Adaptive AI Unavailable)"
      );
      if (mlService && mlService.error) {
        console.log(`📊 AI Service Error: ${mlService.error}`);
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
  console.log("🌐 CORS enabled for: localhost:3000, finadr.vercel.app");
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

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down SecuADR server gracefully...");
  mongoose.connection.close(() => {
    console.log("📊 Database connection closed");
    process.exit(0);
  });
});

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});

module.exports = app;
