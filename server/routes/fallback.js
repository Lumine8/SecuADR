const express = require("express");
const router = express.Router();
const Token = require("../models/Token");
const sendFallbackEmail = require("../utils/mailer");
const crypto = require("crypto");
const auth = require("../middleware/auth");

router.post("/send-fallback", auth, async (req, res) => {
  const { username, email } = req.body;

  // Input validation
  if (!username || !email) {
    return res.status(400).json({
      success: false,
      message: "Username and email required",
    });
  }

  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format",
    });
  }

  try {
    // Generate cryptographically secure token
    const token = crypto.randomBytes(8).toString("hex");
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Save token to database
    await Token.create({
      token,
      username,
      expiresAt,
      used: false,
    });

    // Send email
    const sent = await sendFallbackEmail(email, token);

    if (sent) {
      console.log(`📧 Fallback email sent to ${email}`);
      res.json({ success: true });
    } else {
      res.status(500).json({
        success: false,
        message: "Failed to send email",
      });
    }
  } catch (err) {
    console.error("❌ Error sending fallback token:", err);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
});

module.exports = router;
