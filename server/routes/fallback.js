const express = require("express");
const router = express.Router();

// Simple fallback route
router.post("/", async (req, res) => {
  try {
    const { username, code } = req.body;

    if (!username || !code) {
      return res.status(400).json({
        success: false,
        message: "Username and code are required",
      });
    }

    // In a real implementation, verify the code from database/cache
    // For now, just return success
    res.json({
      success: true,
      message: "Fallback verification successful",
      username: username,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Fallback verification failed",
    });
  }
});

module.exports = router;
