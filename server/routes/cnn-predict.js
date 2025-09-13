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

    console.log(`🧠 Mock CNN processing gesture for user: ${username}`);
    console.log(`📊 Gesture points: ${inputData.length}`);

    // Mock CNN prediction based on pattern complexity
    const complexity = calculatePatternComplexity(inputData);
    const confidence = Math.min(
      0.95,
      Math.max(0.4, complexity * 0.7 + Math.random() * 0.3)
    );

    res.json({
      success: true,
      confidence: confidence,
      method: "Mock CNN",
      prediction: confidence > 0.7 ? "authentic" : "suspicious",
      modelLoaded: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("❌ Mock CNN prediction error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

function calculatePatternComplexity(points) {
  if (points.length < 3) return 0.4;

  let totalDistance = 0;
  let angleChanges = 0;

  for (let i = 1; i < points.length; i++) {
    const dx = points[i].X - points[i - 1].X;
    const dy = points[i].Y - points[i - 1].Y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);

    if (i > 1) {
      const prevDx = points[i - 1].X - points[i - 2].X;
      const prevDy = points[i - 1].Y - points[i - 2].Y;
      const angle1 = Math.atan2(prevDy, prevDx);
      const angle2 = Math.atan2(dy, dx);
      angleChanges += Math.abs(angle2 - angle1);
    }
  }

  return Math.min(
    1.0,
    totalDistance / (points.length * 30) + angleChanges / points.length
  );
}

module.exports = router;
