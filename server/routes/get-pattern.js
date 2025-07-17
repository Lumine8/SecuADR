// server/routes/get-pattern.js
const express = require('express');
const router = express.Router();
const Pattern = require('../models/Pattern');

router.get('/get-pattern/:username', async (req, res) => {
  const { username } = req.params;

  if (!username) {
    return res.status(400).json({ success: false, message: 'Username required' });
  }

  try {
    const record = await Pattern.findOne({ username });
    if (!record) {
      return res.status(404).json({ success: false, message: 'Pattern not found' });
    }

    res.json({ success: true, pattern: record.pattern });
  } catch (err) {
    console.error('❌ Error fetching pattern:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
