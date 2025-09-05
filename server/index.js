const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// MongoDB Connection
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected successfully"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

// Import all routes
const authenticateRoutes = require("./routes/authenticate");
const cnnPredictRoutes = require("./routes/cnn-predict");
const cnnStatusRoutes = require("./routes/cnn-status");
const fallbackAuthRoutes = require("./routes/fallback-auth");
const fallbackRoutes = require("./routes/fallback");
const getPatternRoutes = require("./routes/get-pattern");
const savePatternRoutes = require("./routes/save-pattern");

// Register all routes
app.use("/api/authenticate", authenticateRoutes);
app.use("/api/cnn-predict", cnnPredictRoutes);
app.use("/api/cnn-status", cnnStatusRoutes);
app.use("/api/fallback-auth", fallbackAuthRoutes);
app.use("/api/fallback", fallbackRoutes);
app.use("/api/get-pattern", getPatternRoutes);
app.use("/api/save-pattern", savePatternRoutes);

// ✅ Express v5 compatible catch-all (regex pattern)
app.all(/.*/, (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableEndpoints: [
      "POST /api/authenticate",
      "POST /api/save-pattern",
      "GET  /api/get-pattern/:username",
      "POST /api/cnn-predict",
      "GET  /api/cnn-status",
      "POST /api/fallback-auth",
      "POST /api/fallback",
    ],
  });
});

// Global error handler
app.use((error, req, res, next) => {
  console.error("❌ Server error:", error);
  res.status(500).json({
    success: false,
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined,
  });
});

app.listen(PORT, () => {
  console.log(`🚀 SecuADR Server running on port ${PORT}`);
  console.log(`🧠 AI-Powered Authentication System Ready`);
  console.log(`📡 Available API endpoints:`);
  console.log(
    `   POST /api/authenticate     - Intelligent fusion authentication`
  );
  console.log(`   POST /api/save-pattern     - Pattern enrollment`);
  console.log(`   GET  /api/get-pattern/:id  - Pattern retrieval`);
  console.log(`   POST /api/cnn-predict      - CNN inference`);
  console.log(`   GET  /api/cnn-status       - AI health check`);
  console.log(`   POST /api/fallback-auth    - Enhanced fallback auth`);
  console.log(`   POST /api/fallback         - Email fallback`);
});
