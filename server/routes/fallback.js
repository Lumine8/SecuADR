// server/routes/fallback.js
const express = require('express');
const router = express.Router();
const Token = require('../models/Token');
const sendFallbackEmail = require('../utils/mailer');

router.post('/send-fallback', async (req, res) => {
  const { username, email } = req.body;

  if (!username || !email) {
    return res.status(400).json({ success: false, message: 'Username and email required' });
  }

  try {
    const token = Math.random().toString(36).substring(2, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

    await Token.create({ token, username, expiresAt, used: false });

    const sent = await sendFallbackEmail(email, token);
    if (sent) {
      console.log(`📧 Fallback email sent to ${email} with token ${token}`);
      res.json({ success: true });
    } else {
      res.status(500).json({ success: false, message: 'Failed to send email' });
    }
  } catch (err) {
    console.error('❌ Error sending fallback token:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
