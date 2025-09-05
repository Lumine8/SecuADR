const mongoose = require("mongoose");

const PatternSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
  },
  patterns: [
    {
      data: [
        {
          X: { type: Number, required: true },
          Y: { type: Number, required: true },
          ID: { type: Number, default: 0 },
        },
      ],
      metadata: {
        canvasSize: {
          width: { type: Number, default: 300 },
          height: { type: Number, default: 300 },
        },
        deviceType: { type: String, default: "desktop" },
        drawingTime: { type: Number, default: 0 },
        pointCount: { type: Number, default: 0 },
        complexity: { type: Number, default: 0 },
        deviceFingerprint: { type: Object, default: {} },
        sessionId: { type: String, default: "" },
      },
      createdAt: { type: Date, default: Date.now },
    },
  ],
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});

// Update lastUpdated on save
PatternSchema.pre("save", function (next) {
  this.lastUpdated = Date.now();
  next();
});

module.exports = mongoose.model("Pattern", PatternSchema);
