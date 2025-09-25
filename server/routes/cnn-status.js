const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  console.log("📡 CNN Status endpoint called (Real TensorFlow.js CNN)");

  // Get real model status
  const gestureCNN = global.gestureCNN;
  const modelStatus = gestureCNN ? gestureCNN.getStatus() : null;

  const response = {
    success: true,
    currentMode: modelStatus?.modelLoaded
      ? "cnn_leading_adaptive_ai"
      : "initializing",
    aiEngine: {
      cnn: {
        status: modelStatus?.modelLoaded ? "online" : "loading",
        modelLoaded: modelStatus?.modelLoaded || false,
        service: "TensorFlow.js CNN Service",
        type: "real",
        architecture: modelStatus?.architecture || "Dense Neural Network",
        framework: "TensorFlow.js",
      },
    },
    mlService: {
      url: "embedded://tensorflow.js",
      status: modelStatus?.modelLoaded ? "connected" : "initializing",
      error: null,
    },
    timestamp: new Date().toISOString(),
  };

  console.log("📊 Real CNN Status:", response.currentMode);
  res.json(response);
});

module.exports = router;
