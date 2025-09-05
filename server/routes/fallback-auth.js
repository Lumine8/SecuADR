const express = require("express");
const router = express.Router();
const Token = require("../models/Token");
const Pattern = require("../models/Pattern");
const DollarRecognizer = require("../utils/dollarOneRecognizer");
const auth = require("../middleware/auth");

// POST /api/fallback-auth
router.post("/fallback-auth", auth, async (req, res) => {
  const { token, attempt } = req.body;

  if (!token || !Array.isArray(attempt)) {
    return res.status(400).json({
      success: false,
      message: "Invalid input",
    });
  }

  console.log("🔐 Fallback Auth Request for token:", token);

  try {
    // Validate token
    const entry = await Token.findOne({ token });
    if (!entry) {
      return res.status(400).json({
        success: false,
        message: "Invalid token",
      });
    }

    if (entry.used) {
      return res.status(403).json({
        success: false,
        message: "Token already used",
      });
    }

    if (Date.now() > new Date(entry.expiresAt).getTime()) {
      return res.status(410).json({
        success: false,
        message: "Token expired",
      });
    }

    // Find user patterns
    const user = await Pattern.findOne({ username: entry.username });
    if (!user || !user.patterns || user.patterns.length === 0) {
      return res.status(404).json({
        success: false,
        message: "User patterns not found",
      });
    }

    // Test against all stored patterns
    const recognizer = new DollarRecognizer();
    let bestScore = 0;
    let matched = false;

    // Add all user patterns as templates
    user.patterns.forEach((pattern, index) => {
      recognizer.AddGesture(`LoginPattern_${index}`, pattern.data);
    });

    // Recognize attempt
    const result = recognizer.Recognize(attempt);
    console.log("🔎 Recognition Result:", result);

    if (result.Score > 0.88) {
      // Mark token as used
      entry.used = true;
      await entry.save();

      console.log(`✅ Authentication successful for ${entry.username}`);
      return res.json({ success: true, score: result.Score });
    } else {
      console.log(
        `❌ Authentication failed for ${entry.username}, score: ${result.Score}`
      );
      return res.status(401).json({
        success: false,
        message: "Pattern mismatch",
      });
    }
  } catch (err) {
    console.error("❌ Error in fallback-auth:", err);
    return res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
