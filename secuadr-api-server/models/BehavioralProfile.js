import mongoose from "mongoose";

const BehavioralProfileSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // SFAM Biometric Data
    sfam_hash: {
      type: Buffer, // 256-bit binarized hash
      required: true,
    },
    sfam_hash_continuous: [Number], // 256D continuous representation
    sfam_salt: String, // For key generation
    sfam_seed: Number, // User-specific seed

    enrollment_date: {
      type: Date,
      default: Date.now,
    },

    // Feature Baseline Statistics
    feature_baseline: {
      // Gesture Features
      gesture_velocity_mean: Number,
      gesture_velocity_std: Number,
      gesture_acceleration_mean: Number,
      gesture_acceleration_std: Number,
      gesture_jerk_mean: Number,
      gesture_jerk_std: Number,

      // Typing Features
      typing_dwell_time_mean: Number,
      typing_dwell_time_std: Number,
      typing_flight_time_mean: Number,
      typing_flight_time_std: Number,

      // Touch Features (if applicable)
      touch_pressure_mean: Number,
      touch_pressure_std: Number,
      touch_area_mean: Number,
      touch_area_std: Number,

      // Session Features
      session_time_distribution: [Number], // Histogram of 24 hours
      session_location_baseline: String,
    },

    // Feature History (last 50 sessions)
    feature_history: [
      {
        timestamp: Date,
        features: mongoose.Schema.Types.Mixed, // Raw feature vector
        session_id: mongoose.Schema.Types.ObjectId,
        source: String, // 'enrollment' | 'authentication'
      },
    ],

    // Statistics
    stats: {
      total_enrollments: { type: Number, default: 1 },
      total_authentications: { type: Number, default: 0 },
      successful_authentications: { type: Number, default: 0 },
      false_rejections_count: { type: Number, default: 0 },
      false_acceptance_count: { type: Number, default: 0 },
    },

    // Identity Vector Baseline Model (Behavioral Trust Engine)
    identity_model: {
      last_n: { type: Number, default: 20 },
      vectors: {
        type: [[Number]],
        default: [],
      },
      baseline_vector: {
        type: [Number],
        default: [],
      },
      variance_vector: {
        type: [Number],
        default: [],
      },
      range_min_vector: {
        type: [Number],
        default: [],
      },
      range_max_vector: {
        type: [Number],
        default: [],
      },
      drift_state: {
        type: String,
        enum: ["stable", "gradual", "sudden"],
        default: "stable",
      },
      last_vector_at: Date,
    },

    // Model versioning
    model_version: {
      type: String,
      default: "1.0",
    },

    // Profile health
    is_active: {
      type: Boolean,
      default: true,
    },

    last_updated: {
      type: Date,
      default: Date.now,
    },
  },
  {
    collection: "behavioral_profiles",
    timestamps: true,
  },
);

// Index for performance
BehavioralProfileSchema.index({ user_id: 1 });
BehavioralProfileSchema.index({ is_active: 1 });

export default mongoose.model("BehavioralProfile", BehavioralProfileSchema);
