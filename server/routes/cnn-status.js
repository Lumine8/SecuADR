const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  console.log("📡 CNN Status endpoint called (Mock CNN Mode)");

  const response = {
    success: true,
    currentMode: "cnn_leading_adaptive_ai", // Always show CNN as leading
    aiEngine: {
      cnn: {
        status: "online",
        modelLoaded: true, // Always show as loaded
        service: "Mock CNN Service (Development)",
        type: "mock",
      },
    },
    mlService: {
      url: "embedded://mock",
      status: "connected",
      error: null,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("📊 Sending response: cnn_leading_adaptive_ai (Mock Mode)");
  res.json(response);
});

module.exports = router;
