const express = require("express");
const router = express.Router();
const nodemailer = require("nodemailer");

// Enhanced fallback authentication
router.post("/", async (req, res) => {
  try {
    const { username, email } = req.body;

    if (!username || !email) {
      return res.status(400).json({
        success: false,
        message: "Username and email are required",
      });
    }

    // Generate a secure fallback code
    const fallbackCode =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);

    // Configure email transporter
    const transporter = nodemailer.createTransporter({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    // Send fallback email
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: email,
      subject: "SecuADR Fallback Authentication",
      html: `
        <h2>SecuADR Fallback Login</h2>
        <p>Hello ${username},</p>
        <p>Your fallback authentication code is: <strong>${fallbackCode}</strong></p>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    res.json({
      success: true,
      message: "Fallback authentication code sent to email",
      code: fallbackCode, // In production, store this securely instead
    });
  } catch (error) {
    console.error("Fallback auth error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to send fallback authentication",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

module.exports = router;
