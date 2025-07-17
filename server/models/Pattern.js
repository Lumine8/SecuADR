const mongoose = require('mongoose');

const patternSchema = new mongoose.Schema({
  username: { type: String, required: true },
  pattern: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Pattern', patternSchema);
