import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import BehavioralProfile from "../models/BehavioralProfile.js";
import Session from "../models/Session.js";
import RiskLog from "../models/RiskLog.js";
import {
  FEATURE_NAMES,
  extractBehaviorFeatures,
  normalizeIdentityVector,
  computeBaseline,
  runRLFS,
  runSADR,
  buildExplanation,
  computeDriftState,
  createScenarioPoints,
} from "../lib/behaviorTrustEngine.js";

const router = express.Router();

function ensureDbReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({
      success: false,
      message: "Database unavailable. Trust analysis cannot proceed.",
    });
    return false;
  }
  return true;
}

function defaultDemoPoints() {
  const now = Date.now();
  return [
    { x: 40, y: 50, t: now + 0 },
    { x: 70, y: 85, t: now + 80 },
    { x: 110, y: 120, t: now + 160 },
    { x: 150, y: 100, t: now + 260 },
    { x: 190, y: 70, t: now + 340 },
    { x: 220, y: 95, t: now + 430 },
    { x: 250, y: 120, t: now + 520 },
    { x: 280, y: 95, t: now + 620 },
    { x: 300, y: 60, t: now + 700 },
  ];
}

async function getOrCreateUser(username) {
  let user = await User.findOne({ username });
  if (!user) {
    user = await User.create({ username, enrollment_status: "pending" });
  }
  return user;
}

async function getOrCreateProfile(userId) {
  let profile = await BehavioralProfile.findOne({
    user_id: userId,
    is_active: true,
  });
  if (!profile) {
    profile = await BehavioralProfile.create({
      user_id: userId,
      sfam_hash: Buffer.from([0]),
      sfam_hash_continuous: [],
      sfam_salt: "demo",
      sfam_seed: 0,
      model_version: "trust-engine-mvp-1.0",
      feature_history: [],
      identity_model: {
        last_n: 20,
        vectors: [],
        baseline_vector: [],
        variance_vector: [],
        range_min_vector: [],
        range_max_vector: [],
        drift_state: "stable",
      },
    });
  }
  return profile;
}

router.post("/analyze", async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const {
      username,
      points,
      scenario = "normal",
      enroll = false,
      updateBaseline = true,
      deviceContext = {},
    } = req.body || {};

    if (!username || typeof username !== "string") {
      return res
        .status(400)
        .json({ success: false, message: "username is required" });
    }

    const user = await getOrCreateUser(username.trim());
    const profile = await getOrCreateProfile(user._id);

    const sourcePoints =
      Array.isArray(points) && points.length > 0 ? points : defaultDemoPoints();
    const scenarioPoints = createScenarioPoints(sourcePoints, scenario);

    const behaviorFeatures = extractBehaviorFeatures(scenarioPoints);
    const identityVector = normalizeIdentityVector(behaviorFeatures);

    const previousVectors = profile.identity_model?.vectors || [];
    const baselineModel = computeBaseline(previousVectors);
    const rlfs = runRLFS(identityVector, baselineModel);
    const sadr = runSADR(rlfs);
    const trustScore = Number((1 - sadr.risk_score).toFixed(3));
    const explanation = buildExplanation(rlfs.top_anomalies);

    const shouldBootstrap = enroll || previousVectors.length === 0;
    const vectorToStore = shouldBootstrap
      ? [identityVector, identityVector]
      : [...previousVectors, identityVector];
    const cappedVectors = vectorToStore.slice(
      -1 * (profile.identity_model?.last_n || 20),
    );
    const nextBaseline = computeBaseline(cappedVectors);
    const driftState = computeDriftState(cappedVectors);

    if (updateBaseline) {
      profile.identity_model = {
        ...(profile.identity_model?.toObject?.() ||
          profile.identity_model ||
          {}),
        last_n: profile.identity_model?.last_n || 20,
        vectors: cappedVectors,
        baseline_vector: nextBaseline.baseline_vector,
        variance_vector: nextBaseline.variance_vector,
        range_min_vector: nextBaseline.range_min_vector,
        range_max_vector: nextBaseline.range_max_vector,
        drift_state: driftState,
        last_vector_at: new Date(),
      };

      profile.feature_history.push({
        timestamp: new Date(),
        features: {
          identity_vector: identityVector,
          raw: {
            total_time: behaviorFeatures.totalTime,
            average_interval: behaviorFeatures.averageInterval,
            pause_count: behaviorFeatures.pauseCount,
            avg_speed: behaviorFeatures.avgVelocity,
            max_speed: behaviorFeatures.maxSpeed,
            speed_variance: behaviorFeatures.velocityVariance,
            rhythm_consistency: behaviorFeatures.rhythmConsistency,
            curvature: behaviorFeatures.curvature,
            pause_ratio: behaviorFeatures.pauseRatio,
            tortuosity: behaviorFeatures.tortuosity,
            direction_change_frequency:
              behaviorFeatures.directionChangeFrequency,
          },
          scenario,
        },
        source: shouldBootstrap ? "enrollment" : "authentication",
      });

      if (profile.feature_history.length > 100) {
        profile.feature_history = profile.feature_history.slice(-100);
      }

      profile.last_updated = new Date();
      await profile.save();
    }

    const session = await Session.create({
      user_id: user._id,
      timestamp: new Date(),
      input: {
        gesture: {
          raw_points: scenarioPoints.map((p) => ({
            x: p.x,
            y: p.y,
            timestamp: p.t,
          })),
          duration_ms: behaviorFeatures.totalTime,
        },
      },
      rlfs_output: {
        anomaly_score: rlfs.anomaly_score,
        confidence: rlfs.classification,
        feature_breakdown: {
          gesture: rlfs.anomaly_score,
          typing: 0,
          touch: 0,
          session: 0,
        },
        temporal_trend: driftState,
        is_first_use: previousVectors.length === 0,
        detected_anomalies: rlfs.top_anomalies,
        feature_alerts: explanation,
      },
      sadr_output: {
        decision:
          sadr.decision === "allow"
            ? "ALLOW"
            : sadr.decision === "allow_with_warning"
              ? "ALLOW_WITH_WARNING"
              : sadr.decision === "step_up"
                ? "CHALLENGE"
                : "BLOCK",
        risk_level:
          sadr.risk_level === "low"
            ? "LOW"
            : sadr.risk_level === "medium"
              ? "MEDIUM"
              : "HIGH",
        confidence: 1 - sadr.risk_score,
        adaptive_threshold: 0.6,
        reason: explanation.join(", "),
        recommended_action: sadr.decision,
        trust_factors: explanation,
      },
      sfam_output: {
        hamming_distance: rlfs.hamming_distance,
        confidence: rlfs.cosine_similarity,
      },
      metadata: {
        api_version: "trust-engine-mvp-1.0",
        sfam_service_healthy: true,
        euclidean_distance: rlfs.euclidean_distance,
        cosine_similarity: rlfs.cosine_similarity,
        dtw_distance: rlfs.dtw_distance,
        identity_vector: identityVector,
      },
    });

    if (sadr.risk_score >= 0.6) {
      await RiskLog.create({
        user_id: user._id,
        session_id: session._id,
        event_type:
          sadr.decision === "block" ? "fraud_suspected" : "anomaly_detected",
        action_taken:
          sadr.decision === "allow"
            ? "ALLOW"
            : sadr.decision === "allow_with_warning"
              ? "ALLOW_WITH_WARNING"
              : sadr.decision === "step_up"
                ? "CHALLENGE"
                : "BLOCK",
        risk_indicators: {
          anomaly_score: rlfs.anomaly_score,
          trust_factors: explanation,
          feature_alerts: rlfs.top_anomalies,
          context_changes: Object.keys(deviceContext).filter(
            (k) => !!deviceContext[k],
          ),
        },
        severity: sadr.risk_score >= 0.8 ? "critical" : "high",
      });
    }

    return res.json({
      success: true,
      pipeline:
        "INPUT -> SFAM -> Identity Vector -> Baseline Model -> RLFS -> S-ADR -> Trust Score",
      session_id: session._id,
      trust_score: trustScore,
      risk_level: sadr.risk_level,
      decision: sadr.decision,
      explanation,
      rlfs: {
        anomaly_score: rlfs.anomaly_score,
        cosine_similarity: rlfs.cosine_similarity,
        euclidean_distance: rlfs.euclidean_distance,
        hamming_distance: rlfs.hamming_distance,
        dtw_distance: rlfs.dtw_distance,
        top_anomalies: rlfs.top_anomalies,
        deviation_vector: rlfs.deviation_vector,
      },
      sadr,
      identity_vector: identityVector,
      baseline_vector: baselineModel.baseline_vector,
      behavioral_features: {
        total_time: behaviorFeatures.totalTime,
        average_interval: behaviorFeatures.averageInterval,
        pause_count: behaviorFeatures.pauseCount,
        rhythm_consistency: behaviorFeatures.rhythmConsistency,
        instantaneous_velocity: behaviorFeatures.instantaneousVelocity,
        avg_speed: behaviorFeatures.avgVelocity,
        max_speed: behaviorFeatures.maxSpeed,
        speed_variance: behaviorFeatures.velocityVariance,
        acceleration_patterns: behaviorFeatures.accelerationPatterns,
        curvature_score: behaviorFeatures.curvature,
        curvature_per_segment: behaviorFeatures.curvaturePerSegment,
        direction_change_frequency: behaviorFeatures.directionChangeFrequency,
        angle_sequence: behaviorFeatures.angleSequence,
        direction_vectors: behaviorFeatures.directionVectors,
        shape_signature: behaviorFeatures.shapeSignature,
        pause_pattern: behaviorFeatures.pauseRatio,
        tortuosity: behaviorFeatures.tortuosity,
      },
      drift: {
        state: driftState,
      },
      ui: {
        feature_labels: FEATURE_NAMES,
      },
    });
  } catch (error) {
    console.error("[Trust Engine] analyze failed:", error);
    return res.status(500).json({
      success: false,
      message: "Trust analysis failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

router.get("/timeline/:username", async (req, res) => {
  try {
    if (!ensureDbReady(res)) return;

    const { username } = req.params;
    const limit = Math.min(120, Number(req.query.limit || 40));

    const user = await User.findOne({ username });
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const sessions = await Session.find({ user_id: user._id })
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const timeline = sessions.reverse().map((s, i) => ({
      index: i + 1,
      timestamp: s.timestamp,
      trust_score: Number((1 - (s.rlfs_output?.anomaly_score || 0)).toFixed(3)),
      anomaly_score: s.rlfs_output?.anomaly_score || 0,
      decision: s.sadr_output?.recommended_action || "allow",
      risk_level: (s.sadr_output?.risk_level || "LOW").toLowerCase(),
    }));

    const profile = await BehavioralProfile.findOne({
      user_id: user._id,
      is_active: true,
    }).lean();

    return res.json({
      success: true,
      username,
      timeline,
      drift_state: profile?.identity_model?.drift_state || "stable",
      baseline_vector: profile?.identity_model?.baseline_vector || [],
      variance_vector: profile?.identity_model?.variance_vector || [],
    });
  } catch (error) {
    console.error("[Trust Engine] timeline failed:", error);
    return res
      .status(500)
      .json({ success: false, message: "Failed to fetch timeline" });
  }
});

router.get("/mock/:scenario", (req, res) => {
  const scenario = req.params.scenario;

  const map = {
    normal: {
      trust_score: 0.92,
      risk_level: "low",
      decision: "allow",
      explanation: ["Behavior aligned with baseline"],
      rlfs: {
        anomaly_score: 0.08,
        top_anomalies: [],
        deviation_vector: [0.08, 0.12, 0.09, 0.11, 0.05],
      },
    },
    variation: {
      trust_score: 0.57,
      risk_level: "medium",
      decision: "allow_with_warning",
      explanation: ["timing anomaly", "speed inconsistency"],
      rlfs: {
        anomaly_score: 0.43,
        top_anomalies: ["timing", "avg_velocity"],
        deviation_vector: [0.55, 0.46, 0.32, 0.25, 0.2],
      },
    },
    attacker: {
      trust_score: 0.11,
      risk_level: "high",
      decision: "block",
      explanation: ["timing anomaly", "hesitation pattern shift"],
      rlfs: {
        anomaly_score: 0.89,
        top_anomalies: ["timing", "pause_pattern"],
        deviation_vector: [0.92, 0.84, 0.71, 0.8, 0.97],
      },
    },
  };

  const payload = map[scenario] || map.normal;
  res.json({
    success: true,
    scenario,
    ...payload,
    ui: { feature_labels: FEATURE_NAMES },
  });
});

export default router;
