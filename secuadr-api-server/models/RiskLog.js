import mongoose from "mongoose";

const RiskLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },

    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    session_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      index: true,
    },

    // Event classification
    event_type: {
      type: String,
      enum: [
        "authentication_success",
        "authentication_failed",
        "challenge_issued",
        "fraud_suspected",
        "profile_updated",
        "anomaly_detected",
        "system_event",
      ],
      required: true,
      index: true,
    },

    // Risk indicators
    risk_indicators: {
      anomaly_score: Number,
      trust_factors: [String], // What increased/decreased trust
      feature_alerts: [String], // Which features triggered
      context_changes: [String], // Device, location, etc.
    },

    // Action taken
    action_taken: {
      type: String,
      enum: ["ALLOW", "ALLOW_WITH_WARNING", "CHALLENGE", "BLOCK", "LOG"],
    },

    // Followup recommendations
    followup_actions: [String], // Recommended monitoring

    // Resolution
    resolved: {
      type: Boolean,
      default: false,
    },

    resolution_time_ms: Number,

    // Security team notes
    notes: String,

    // Severity level
    severity: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },

    // Additional context
    context: mongoose.Schema.Types.Mixed,
  },
  {
    collection: "risk_logs",
    timestamps: true,
  },
);

// Indexes
RiskLogSchema.index({ user_id: 1, timestamp: -1 });
RiskLogSchema.index({ event_type: 1, timestamp: -1 });
RiskLogSchema.index({ severity: 1, resolved: 1 });

export default mongoose.model("RiskLog", RiskLogSchema);
