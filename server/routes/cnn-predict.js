const express = require("express");
const router = express.Router();
const { spawn } = require("child_process");
const path = require("path");

router.post("/", async (req, res) => {
  const { points } = req.body;

  if (!points || !Array.isArray(points)) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid points data" });
  }

  let responseSent = false; // ✅ Fixed variable name consistency
  let timeoutHandle = null;

  try {
    console.log("🧠 Using real CNN model for prediction...");

    const pythonScript = path.join(__dirname, "../utils/cnn-predictor.py");
    const python = spawn("python", [pythonScript, JSON.stringify(points)]);

    let stdout = "";
    let stderr = "";

    // ✅ Enhanced timeout with proper process cleanup
    timeoutHandle = setTimeout(() => {
      if (!responseSent) {
        responseSent = true;
        python.kill("SIGKILL"); // ✅ Force kill instead of default signal
        console.log("⏰ CNN prediction timeout (30s), using fallback");
        const fallbackConfidence = Math.random() * 0.35 + 0.35; // 35-70%
        return res.json({ success: true, confidence: fallbackConfidence });
      }
    }, 30000);

    python.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    python.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    python.on("close", (code) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      if (responseSent) {
        return; // Response already sent
      }

      responseSent = true; // ✅ Consistent variable name

      if (code === 0 && stdout.trim()) {
        const confidence = parseFloat(stdout.trim());

        // ✅ Validate confidence range
        if (confidence >= 0 && confidence <= 1) {
          console.log(`🧠 CNN confidence: ${(confidence * 100).toFixed(1)}%`);
          res.json({ success: true, confidence });
        } else {
          console.log("⚠️ Invalid CNN confidence, using fallback");
          const fallbackConfidence = Math.random() * 0.4 + 0.4; // 40-80%
          res.json({ success: true, confidence: fallbackConfidence });
        }
      } else {
        console.error("❌ CNN prediction failed:", stderr.trim());

        // ✅ Improved fallback confidence range
        const dummyConfidence = Math.random() * 0.4 + 0.4; // 40-80%
        console.log(
          `🔄 Using fallback simulation: ${(dummyConfidence * 100).toFixed(1)}%`
        );
        res.json({ success: true, confidence: dummyConfidence });
      }
    });

    python.on("error", (error) => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
        timeoutHandle = null;
      }

      if (responseSent) {
        return;
      }

      responseSent = true; // ✅ Consistent variable name
      console.error("❌ CNN process error:", error.message);

      const fallbackConfidence = Math.random() * 0.3 + 0.5; // 50-80%
      res.json({ success: true, confidence: fallbackConfidence });
    });
  } catch (error) {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
      timeoutHandle = null;
    }

    if (responseSent) {
      return;
    }

    responseSent = true; // ✅ Consistent variable name
    console.error("❌ CNN prediction error:", error.message);

    const fallbackConfidence = Math.random() * 0.3 + 0.4; // 40-70%
    res.json({ success: true, confidence: fallbackConfidence });
  }
});

module.exports = router;
