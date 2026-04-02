import mongoose from "mongoose";

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
    confidence: {
      type: Number,
      default: 0,
    },
    enrollmentStats: {
      time: Number,
      speed: Number,
      speed_var: Number,
      max_speed: Number,
      accel: Number,
      stability: Number,
      duration: Number,
      tortuosity: Number,
      curvature: Number,
      shape: Number,
      rhythm: Number,
    },
    shapeSignature: {
      type: [[Number]],
      default: undefined,
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

    // User Profile
    profile: {
      first_name: String,
      last_name: String,
      organization: String,
    },

    // Enrollment Status
    enrollment_status: {
      type: String,
      enum: ["pending", "enrolled", "suspended"],
      default: "pending",
    },
    enrolled_at: Date,

    // Metadata
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
    timestamps: true,
  },
);

export default mongoose.model("User", UserSchema);
