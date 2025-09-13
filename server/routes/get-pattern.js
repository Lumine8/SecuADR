const express = require("express");
const router = express.Router();
const Pattern = require("../models/Pattern");

// Get pattern by username
router.get("/:username", async (req, res) => {
  try {
    const { username } = req.params;

    const pattern = await Pattern.findOne({ username });

    if (!pattern) {
      return res.status(404).json({
        success: false,
        message: "Pattern not found for this user",
      });
    }

    res.json({
      success: true,
      pattern: pattern.pattern,
      metadata: pattern.metadata,
      createdAt: pattern.createdAt,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to retrieve pattern",
    });
  }
});

module.exports = router;
