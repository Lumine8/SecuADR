const mongoose = require("mongoose");

const tokenSchema = new mongoose.Schema({
  token: String,
  username: String,
  expiresAt: Date,
  used: Boolean
});

module.exports = mongoose.model("Token", tokenSchema);
