const express = require("express");
const router = express.Router();

router.post("/", async (req, res) => {
  try {
    const { username, gestures, isAuthentic = true } = req.body;

    if (!username || !gestures || gestures.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Username and gesture data required",
      });
    }

    const gestureCNN = global.gestureCNN;
    if (!gestureCNN) {
      return res.status(500).json({
        success: false,
        message: "CNN model not available",
      });
    }

    console.log(
      `🎯 Training model with ${gestures.length} gestures for ${username}`
    );

    const trainingResult = await gestureCNN.trainWithUserData(
      username,
      gestures,
      isAuthentic
    );

    // Save the updated model
    await gestureCNN.saveModel();

    res.json({
      success: true,
      message: "Model trained successfully",
      trainingResult: trainingResult,
      username: username,
    });
  } catch (error) {
    console.error("❌ Model training error:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
