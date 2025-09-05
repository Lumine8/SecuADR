const express = require("express");
const router = express.Router();
const Pattern = require("../models/Pattern");

router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const userPattern = await Pattern.findOne({ username });

    if (!userPattern || userPattern.patterns.length === 0) {
      return res.json({
        success: false,
        message: "No patterns found for this user",
        patterns: [],
      });
    }

    res.json({
      success: true,
      patterns: userPattern.patterns,
      sampleCount: userPattern.patterns.length,
    });
  } catch (error) {
    console.error("❌ Get pattern error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patterns",
    });
  }
});

module.exports = router;
