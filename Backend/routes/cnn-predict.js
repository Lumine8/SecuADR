const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { gestureData, username, points } = req.body;
    const inputData = gestureData || points || [];

    if (!inputData || inputData.length === 0) {
      return res.status(400).json({
        success: false,
        error: "No gesture data provided",
      });
    }

    console.log(`🧠 Real CNN processing gesture for user: ${username}`);
    console.log(`📊 Gesture points: ${inputData.length}`);

    // Use real CNN model
    const gestureCNN = global.gestureCNN;
    if (!gestureCNN) {
      return res.status(500).json({
        success: false,
        error: "CNN model not initialized",
      });
    }

    // Get real prediction
    const prediction = await gestureCNN.predict(username, inputData);

    res.json({
      success: true,
      confidence: prediction.confidence,
      method: prediction.method,
      prediction: prediction.authentic ? "authentic" : "suspicious",
      modelLoaded: prediction.modelLoaded,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Real CNN prediction error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
