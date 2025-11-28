const mongoose = require("mongoose");

const patternSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  pattern: {
    type: String, // Could be base64 encoded or JSON string
    required: true,
  },
  metadata: {
    timestamp: { type: Number, default: Date.now },
    deviceType: String,
    patternComplexity: Number,
    pointCount: Number,
    drawingTime: Number,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Update timestamp on save
patternSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

module.exports = mongoose.model("Pattern", patternSchema);
