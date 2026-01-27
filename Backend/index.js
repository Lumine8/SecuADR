const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const path = require("path");
const axios = require("axios");
require("dotenv").config({
  path: path.resolve(__dirname, ".env"),
  debug: true,
});

// Import TensorFlow.js and custom services
// const GestureCNN = require("./services/GestureCNN");

const app = express();
const port = process.env.PORT || 5000;

// Enhanced CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://127.0.0.1:3000",
      "http://127.0.0.1:3001",
      "http://172.16.74.47:3001",
      "http://10.163.66.54:3001",
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
    optionsSuccessStatus: 200,
  })
);

// Enhanced middleware
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// Additional manual CORS headers for preflight requests
app.use((req, res, next) => {
  const allowedOrigins = [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
    "http://172.16.74.47:3001",
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

// MongoDB connection
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
// const cnnPredictRoutes = require("./routes/cnn-predict");
// const cnnStatusRoutes = require("./routes/cnn-status");
const fallbackAuthRoutes = require("./routes/fallback-auth");
const fallbackRoutes = require("./routes/fallback");
// const trainCnnRoutes = require("./routes/train-cnn");

// NEW: Import model training route
// const trainModelRoutes = require("./routes/train-model");

// Legacy services (for backward compatibility)
// const ONNXPredictor = require("./services/ONNXPredictor");
// const CNNTrainingService = require("./services/CNNTraining");

// Import OIDC routes
const oidcRoutes = require("./routes/oidc");


// Initialize services
let onnxPredictor = null;
let cnnTrainingService = null;
let gestureCNN = null;

// NEW: Initialize Real Gesture CNN
const initializeGestureCNN = async () => {
  console.log("🧠 Skipping Real Gesture CNN for OIDC integration (temporary)...");
  
  // TEMPORARY: Skip TensorFlow.js for now
  console.log("✅ Using mock gesture validation for OIDC demo");
  console.log("📊 CNN will be re-enabled after Dec 15 deadline");
  
  global.gestureCNN = null;
  return null;
};

// Initialize ONNX predictor (legacy support)
const initializeONNX = async () => {
  console.log("🧠 Skipping ONNX CNN model (temporary)...");
  global.onnxPredictor = null;
};

// Initialize CNN Training Service (legacy)
const initializeCNNTraining = async () => {
  console.log("🧠 Skipping Legacy CNN Training (temporary)...");
  global.cnnTrainingService = null;
};

// Apply routes with enhanced logging
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
// app.use("/api/cnn-predict", cnnPredictRoutes);

// app.use(
//   "/api/cnn-status",
//   (req, res, next) => {
//     console.log(`📡 CNN status check from ${req.headers.origin || "unknown"}`);
//     next();
//   },
//   cnnStatusRoutes
// );

app.use("/api/fallback-auth", fallbackAuthRoutes);
app.use("/api/fallback", fallbackRoutes);

// Legacy CNN training routes
// app.use(
//   "/api/train-cnn",
//   (req, res, next) => {
//     console.log(
//       `🧠 Legacy CNN training request from ${req.headers.origin || "unknown"}`
//     );
//     next();
//   },
//   trainCnnRoutes
// );

// NEW: Real model training routes
// app.use(
//   "/api/train-model",
//   (req, res, next) => {
//     console.log(
//       `🎯 Real model training request from ${req.headers.origin || "unknown"}`
//     );
//     next();
//   },
//   trainModelRoutes
// );

// OIDC routes for Okta integration
app.use("/api/oidc", (req, res, next) => {
  console.log(`🔐 OIDC: ${req.method} ${req.url}`);
  next();
}, oidcRoutes);


// Enhanced health check endpoint
app.get("/health", (req, res) => {
  console.log(`🏥 Health check from ${req.headers.origin || "unknown"}`);

  const healthData = {
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    service: "SecuADR Backend API",
    version: "4.0.0", // Updated version with real CNN
    mongodb:
      mongoose.connection.readyState === 1 ? "connected" : "disconnected",

    // Real CNN status
    realCNN: {
      available: global.gestureCNN ? "available" : "disabled",
      modelLoaded: global.gestureCNN?.isModelLoaded || false,
      framework: "TensorFlow.js",
      architecture: "Dense Neural Network",
    },

    // Legacy ONNX model status
    onnx: global.onnxPredictor?.isModelLoaded() ? "loaded" : "not_loaded",

    // Legacy CNN Training service status
    legacyCNNTraining: {
      available: global.cnnTrainingService ? "available" : "disabled",
      modelReady: global.cnnTrainingService?.isModelReady()
        ? "ready"
        : "not_ready",
      isTraining: global.cnnTrainingService?.isTraining || false,
    },

    cors: {
      allowedOrigins: [
        "http://localhost:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3000",
        "http://127.0.0.1:3001",
        "http://172.16.74.47:3001",
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

// 404 handler - FIXED
app.use("*", (req, res) => {
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
      // Legacy endpoints
      "POST /api/train-cnn",
      "GET /api/train-cnn/progress",
      "POST /api/train-cnn/test",
      // NEW: Real model training
      "POST /api/train-model",
    ],
    requestedPath: req.originalUrl,
    method: req.method,
  });
});

// Enhanced AI Engine Status Checker
async function checkAIEngineStatus() {
  try {
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
      framework: responseData.aiEngine?.cnn?.framework || "unknown",
    });

    if (
      responseData.currentMode === "cnn_leading_adaptive_ai" &&
      responseData.aiEngine?.cnn?.modelLoaded
    ) {
      console.log("🧠 AI Engine: ✅ Real CNN Model Active");
      console.log(
        `📊 CNN Framework: ${
          responseData.aiEngine?.cnn?.framework || "TensorFlow.js"
        }`
      );
      console.log(
        `🎯 CNN Architecture: ${
          responseData.aiEngine?.cnn?.architecture || "Dense Neural Network"
        }`
      );
    } else {
      console.log("🧠 AI Engine: ⚠️ CNN Initializing or Fallback Mode");
    }

    // Check Real CNN status
    if (global.gestureCNN) {
      const cnnStatus = global.gestureCNN.getStatus();
      if (cnnStatus.modelLoaded) {
        console.log("🧠 Real Gesture CNN: ✅ Model Ready for Inference");
        console.log(`🎯 Input Shape: ${JSON.stringify(cnnStatus.inputShape)}`);
        console.log(
          `📊 Output Shape: ${JSON.stringify(cnnStatus.outputShape)}`
        );
      } else {
        console.log("🧠 Real Gesture CNN: 🔄 Model Loading");
      }
    }

    // Check legacy systems
    if (global.cnnTrainingService) {
      const isReady = global.cnnTrainingService.isModelReady();
      const isTraining = global.cnnTrainingService.isTraining;

      if (isReady) {
        console.log("🧠 Legacy CNN Training: ✅ Model Ready");
      } else if (isTraining) {
        console.log("🧠 Legacy CNN Training: 🔄 Training in Progress");
      } else {
        console.log("🧠 Legacy CNN Training: 📊 Available");
      }
    }
  } catch (error) {
    console.log("🧠 AI Engine: ⚠️ Status Check Failed - Using Fallback Mode");
    console.log(`📊 AI Service Status: Unable to connect (${error.message})`);
  }
}

// Start server with enhanced initialization
app.listen(port, async () => {
  console.log(`🚀 SecuADR Server running on port ${port}`);
  console.log("🧠 AI-Powered Gesture Authentication System");
  console.log("🎯 Version 4.0.0 - Real TensorFlow.js CNN Integration");
  console.log(
    "🌐 CORS enabled for: localhost:3000, localhost:3001, 172.16.74.47:3001, finadr.vercel.app"
  );
  console.log("");
  console.log("📡 Available API endpoints:");
  console.log(
    "   POST /api/authenticate     - Intelligent fusion authentication"
  );
  console.log("   POST /api/save-pattern     - Pattern enrollment");
  console.log("   GET  /api/get-pattern      - Pattern retrieval");
  console.log("   POST /api/cnn-predict      - Real CNN inference");
  console.log("   GET  /api/cnn-status       - AI health check");
  console.log("   POST /api/fallback-auth    - Enhanced fallback auth");
  console.log("   POST /api/fallback         - Email fallback");
  console.log("   GET  /health               - API health status");
  console.log("");
  console.log("🎯 Real AI Model Endpoints:");
  console.log("   POST /api/train-model      - Train real CNN with user data");
  console.log("");
  console.log("🔧 Legacy Endpoints:");
  console.log("   POST /api/train-cnn        - Legacy CNN training");
  console.log("   GET  /api/train-cnn/progress - Legacy training progress");
  console.log("   POST /api/train-cnn/test   - Legacy model test");
  console.log("");

  console.log("🎯 Initializing AI Systems...");

  // Initialize Real Gesture CNN (Primary)
  const realCNN = await initializeGestureCNN();
  if (realCNN) {
    console.log("✅ Primary AI System: Real TensorFlow.js CNN Active");
  } else {
    console.log("⚠️ Primary AI System: Failed - Using Fallback");
  }

  // Initialize legacy systems (for backward compatibility)
  await initializeONNX();
  await initializeCNNTraining();

  console.log("");
  console.log("🔍 Running comprehensive AI engine status check...");

  // Check AI engine status after initialization
  checkAIEngineStatus();

  console.log("");
  console.log("🎉 SecuADR Server initialization complete!");
  console.log(`📊 Access health check: http://localhost:${port}/health`);
  console.log(`🧠 Access CNN status: http://localhost:${port}/api/cnn-status`);
});

// Enhanced graceful shutdown
process.on("SIGINT", () => {
  console.log("\n🛑 Shutting down SecuADR server gracefully...");

  // Close database connection
  mongoose.connection.close(() => {
    console.log("📊 Database connection closed");
  });

  // Clean up Real CNN
  if (global.gestureCNN) {
    try {
      // TensorFlow.js cleanup if needed
      console.log("🧠 Real CNN cleaned up");
    } catch (error) {
      console.log("⚠️ Error cleaning up Real CNN:", error.message);
    }
  }

  // Clean up ONNX predictor
  if (global.onnxPredictor) {
    try {
      global.onnxPredictor.cleanup();
      console.log("🧠 ONNX predictor cleaned up");
    } catch (error) {
      console.log("⚠️ Error cleaning up ONNX predictor:", error.message);
    }
  }

  // Clean up legacy CNN Training Service
  if (global.cnnTrainingService) {
    try {
      console.log("🧠 Legacy CNN training service cleaned up");
    } catch (error) {
      console.log("⚠️ Error cleaning up legacy CNN service:", error.message);
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
