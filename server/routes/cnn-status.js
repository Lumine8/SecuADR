const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");

router.get("/", (req, res) => {
  try {
    const modelPath = path.join(
      __dirname,
      "../../training/models/secuadr_cnn_model.h5"
    );
    const scriptPath = path.join(__dirname, "../utils/cnn-predictor.py");

    const modelExists = fs.existsSync(modelPath);
    const scriptExists = fs.existsSync(scriptPath);
    const available = modelExists && scriptExists;

    console.log(
      `🔍 CNN Health Check: ${available ? "✅ Available" : "❌ Unavailable"}`
    );

    res.json({
      success: true,
      available: available,
      status: available ? "ready" : "unavailable",
      components: {
        model: modelExists,
        script: scriptExists,
      },
      message: available
        ? "Server CNN ready for predictions"
        : "Server CNN unavailable - missing components",
    });
  } catch (error) {
    console.error("❌ CNN status check error:", error);
    res.json({
      success: true,
      available: false,
      status: "error",
      message: "CNN status check failed",
    });
  }
});

module.exports = router;
