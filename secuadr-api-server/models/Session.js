import mongoose from "mongoose";

const SessionSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    // ===== INPUT LAYER DATA =====
    input: {
      gesture: {
        raw_points: [
          {
            x: Number,
            y: Number,
            timestamp: Number,
          },
        ],
        duration_ms: Number,
        bounding_box: {
          min_x: Number,
          min_y: Number,
          max_x: Number,
          max_y: Number,
        },
      },
      typing: {
        dwell_times: [Number], // Per keypress
        flight_times: [Number], // Inter-key intervals
        hold_duration: Number,
      },
      touch: {
        pressure_curve: [Number],
        touch_area: [Number],
        multi_touch: Boolean,
      },
      session_context: {
        ip_address: String,
        user_agent: String,
        device: {
          id: String,
          type: String,
          name: String,
        },
        location: {
          lat: Number,
          lon: Number,
          accuracy: Number,
        },
      },
    },

    // ===== LAYER 2: SFAM OUTPUT =====
    sfam_output: {
      hash_continuous: [Number], // 256D real-valued
      hash_binary: Buffer, // 256-bit binarized
      hamming_distance: Number, // Distance from baseline
      confidence: Number,
      processing_time_ms: Number,
      reason: String,
      behavior_metrics: {
        dur_diff: Number,
        spd_diff: Number,
        spv_diff: Number,
        tort_diff: Number,
        curv_diff: Number,
        rhythm_diff: Number,
        shape_stat_diff: Number,
        shp_diff: Number,
        current: {
          time: Number,
          speed: Number,
          speed_var: Number,
          tortuosity: Number,
          curvature: Number,
          shape: Number,
          rhythm: Number,
        },
        enrolled: {
          time: Number,
          speed: Number,
          speed_var: Number,
          tortuosity: Number,
          curvature: Number,
          shape: Number,
          rhythm: Number,
        },
      },
    },

    // ===== LAYER 4: RLFS OUTPUT =====
    rlfs_output: {
      anomaly_score: Number, // 0-1
      confidence: String, // 'high' | 'medium' | 'low'
      feature_breakdown: {
        gesture: Number,
        typing: Number,
        touch: Number,
        session: Number,
      },
      temporal_trend: String, // 'stable' | 'drifting' | 'spiking'
      is_first_use: Boolean,
      detected_anomalies: [String], // ['speed_spike', 'rhythm_change']
      feature_alerts: [String],
    },

    // ===== LAYER 5: S-ADR OUTPUT =====
    sadr_output: {
      decision: {
        type: String,
        enum: ["ALLOW", "ALLOW_WITH_WARNING", "CHALLENGE", "BLOCK"],
      },
      risk_level: {
        type: String,
        enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      },
      confidence: Number,
      adaptive_threshold: Number,
      reason: String,
      recommended_action: String, // 'allow' | 'log_warning' | 'challenge' | 'block'
      trust_factors: [String],
    },

    // ===== FINAL AUTHENTICATION OUTCOME =====
    authentication: {
      status: {
        type: String,
        enum: ["success", "challenge_issued", "failed"],
      },
      token: String, // JWT if successful
      challenge_method: String, // 'email_otp' | 'sms' | 'security_qa'
      error_message: String,
    },

    // ===== METADATA =====
    metadata: {
      api_version: String,
      processing_time_total_ms: Number,
      sfam_service_healthy: Boolean,
      possible_attack: {
        flag: Boolean,
        score: Number,
        reasons: [String],
      },
      is_simulated_attempt: Boolean,
    },
  },
  {
    collection: "sessions",
    timestamps: true,
  },
);

// Indexes for common queries
SessionSchema.index({ user_id: 1, timestamp: -1 });
SessionSchema.index({ timestamp: -1 });
SessionSchema.index({ "sadr_output.decision": 1 });

export default mongoose.model("Session", SessionSchema);
