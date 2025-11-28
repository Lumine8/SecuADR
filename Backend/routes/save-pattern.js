const express = require("express");
const router = express.Router();
const Pattern = require("../models/Pattern");

router.post("/", async (req, res) => {
  try {
    const { username, pattern, metadata } = req.body;

    if (!username || !pattern) {
      return res.status(400).json({
        success: false,
        message: "Username and pattern are required",
      });
    }

    // Check if pattern already exists for user
    const existingPattern = await Pattern.findOne({ username });

    if (existingPattern) {
      // Update existing pattern
      existingPattern.pattern = pattern;
      existingPattern.metadata = { ...existingPattern.metadata, ...metadata };
      await existingPattern.save();

      res.json({
        success: true,
        message: "Pattern updated successfully",
        username: username,
      });
    } else {
      // Create new pattern
      const newPattern = new Pattern({
        username,
        pattern,
        metadata,
      });

      await newPattern.save();

      res.json({
        success: true,
        message: "Pattern saved successfully",
        username: username,
      });
    }
  } catch (error) {
    console.error("Pattern save error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to save pattern",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
