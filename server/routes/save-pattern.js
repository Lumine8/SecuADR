const express = require("express");
const router = express.Router();
const Pattern = require("../models/Pattern");

router.post("/", async (req, res) => {
  try {
    const { username, pattern, metadata } = req.body;

    // Validate input
    if (!username || !pattern) {
      return res.status(400).json({
        success: false,
        message: "Username and pattern are required",
      });
    }

    if (!Array.isArray(pattern) || pattern.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Pattern must be a non-empty array",
      });
    }

    console.log(`📝 Enrolling pattern for user: ${username}`);
    console.log(`📊 Pattern points: ${pattern.length}`);

    // Find existing user or create new one
    let userPattern = await Pattern.findOne({ username });

    if (!userPattern) {
      // Create new user with first pattern
      userPattern = new Pattern({
        username,
        patterns: [
          {
            data: pattern,
            metadata: metadata || {},
            createdAt: new Date(),
          },
        ],
      });

      console.log("🆕 Creating new user pattern record");
    } else {
      // Add new pattern to existing user
      userPattern.patterns.push({
        data: pattern,
        metadata: metadata || {},
        createdAt: new Date(),
      });

      console.log(
        `🔄 Adding pattern to existing user (total: ${userPattern.patterns.length})`
      );
    }

    // Save to database
    const savedPattern = await userPattern.save();

    console.log(`✅ Pattern saved successfully for ${username}`);

    res.json({
      success: true,
      message: "Pattern enrolled successfully",
      sampleCount: savedPattern.patterns.length,
      username: username,
    });
  } catch (error) {
    console.error("❌ Pattern enrollment error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to save pattern",
      error:
        process.env.NODE_ENV === "development"
          ? error.message
          : "Internal server error",
    });
  }
});

module.exports = router;
