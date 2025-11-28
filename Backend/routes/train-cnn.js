const express = require("express");
const router = express.Router();

let cnnTrainingService = null;

// Initialize CNN training service
function initializeCNNService() {
  if (!cnnTrainingService) {
    const CNNTrainingService = require("../services/CNNTraining");
    cnnTrainingService = new CNNTrainingService();
  }
  return cnnTrainingService;
}

// Start training
router.post("/", async (req, res) => {
  try {
    const service = initializeCNNService();

    if (service.isTraining) {
      return res.status(409).json({
        success: false,
        message: "Training already in progress",
        progress: service.getTrainingProgress(),
      });
    }

    // Start training in background
    service
      .trainModel()
      .then((result) => {
        console.log("🎉 Training completed:", result);
      })
      .catch((error) => {
        console.error("❌ Training failed:", error);
      });

    res.json({
      success: true,
      message: "CNN training started",
      progress: service.getTrainingProgress(),
    });
  } catch (error) {
    console.error("❌ Training start failed:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Get training progress
router.get("/progress", (req, res) => {
  try {
    const service = initializeCNNService();

    res.json({
      success: true,
      progress: service.getTrainingProgress(),
      modelReady: service.isModelReady(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// Test trained model
router.post("/test", async (req, res) => {
  try {
    const service = initializeCNNService();
    const { pattern } = req.body;

    if (!service.isModelReady()) {
      return res.status(400).json({
        success: false,
        message: "No trained model available. Train the model first.",
      });
    }

    const result = await service.predict(pattern);

    res.json({
      success: true,
      prediction: result,
    });
  } catch (error) {
    console.error("❌ Prediction failed:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

module.exports = router;
