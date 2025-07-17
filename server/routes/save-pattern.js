// server/routes/save-pattern.js
const express = require('express');
const router = express.Router();
const Pattern = require('../models/Pattern');

router.post('/save-pattern', async (req, res) => {
  const { username, pattern } = req.body;

  if (!username || !pattern || !Array.isArray(pattern)) {
    return res.status(400).json({ success: false, message: 'Invalid data' });
  }

  try {
    // Overwrite if pattern already exists
    const existing = await Pattern.findOne({ username });
    if (existing) {
      existing.pattern = pattern;
      await existing.save();
    } else {
      await Pattern.create({ username, pattern });
    }

    res.json({ success: true });
  } catch (err) {
    console.error('❌ Error saving pattern:', err);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
