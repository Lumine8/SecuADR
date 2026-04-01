const mongoose = require("mongoose");

const SfamSchema = new mongoose.Schema(
  {
    hash: {
      type: [Number], // Binary hash from SFAM (±1 or 0/1)
      required: true,
    },
    seed: {
      type: Number,
      required: true,
    },
    salt: {
      type: String,
      required: true,
    },
    enrolledAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false },
);

const UserSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },

    email: {
      type: String,
      index: true,
    },

    // 🔐 SFAM Enrollment Data
    sfam: {
      type: SfamSchema,
      default: null,
    },

    // Optional metadata
    createdAt: {
      type: Date,
      default: Date.now,
    },

    lastLoginAt: {
      type: Date,
    },

    securityLevel: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "high",
    },
  },
  {
    collection: "users",
  },
);

module.exports = mongoose.model("User", UserSchema);
