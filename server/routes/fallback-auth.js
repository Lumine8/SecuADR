// server/routes/fallback-auth.js
const express = require('express');
const router = express.Router();
const Token = require('../models/Token');
const User = require('../models/Pattern'); // Assumes username + pattern stored here
const DollarRecognizer = require('../utils/dollarOneRecognizer');

// POST /api/fallback-auth
router.post('/fallback-auth', async (req, res) => {
  const { token, attempt } = req.body;

  if (!token || !Array.isArray(attempt)) {
    return res.status(400).json({ success: false, message: "Invalid input" });
  }

  console.log("🔐 Fallback Auth Request:", req.body);

  try {
    const entry = await Token.findOne({ token });

    if (!entry) return res.status(400).json({ success: false, message: "Invalid token" });
    if (entry.used) return res.status(403).json({ success: false, message: "Token already used" });
    if (Date.now() > new Date(entry.expiresAt).getTime())
      return res.status(410).json({ success: false, message: "Token expired" });

    const user = await User.findOne({ username: entry.username });
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const recognizer = new DollarRecognizer();
    recognizer.AddGesture("LoginPattern", user.pattern);

    const result = recognizer.Recognize(attempt);
    console.log("🔎 Recognition Result:", result);

    if (result.Name === "LoginPattern" && result.Score > 0.88) {
      entry.used = true;
      await entry.save();
      return res.json({ success: true });
    } else {
      return res.status(401).json({ success: false, message: "Pattern mismatch" });
    }

  } catch (err) {
    console.error("❌ Error in fallback-auth:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

module.exports = router;
