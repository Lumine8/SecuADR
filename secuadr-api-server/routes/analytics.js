import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Session from "../models/Session.js";
import BehavioralProfile from "../models/BehavioralProfile.js";
import RiskLog from "../models/RiskLog.js";

const router = express.Router();

const STREAM_HEARTBEAT_MS = 15000;

function clamp01(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

function statsToRadarVector(stats = {}) {
  if (!stats || typeof stats !== "object") return [];

  const timeRaw = Number(stats.time ?? stats.duration ?? 0);
  const speedRaw = Number(stats.speed ?? 0);
  const speedVarRaw = Number(stats.speed_var ?? stats.stability ?? 0);
  const tortRaw = Number(stats.tortuosity ?? 1);
  const curvRaw = Number(stats.curvature ?? 0);
  const shapeRaw = Number(stats.shape ?? 0);
  const rhythmRaw = Number(stats.rhythm ?? 0);

  return [
    clamp01(timeRaw / 3.0),
    clamp01(speedRaw / 3.0),
    clamp01(speedVarRaw),
    clamp01((tortRaw - 1.0) / 4.0),
    clamp01(curvRaw),
    clamp01(shapeRaw),
    clamp01(rhythmRaw),
  ];
}

function vectorFromRawPoints(rawPoints = []) {
  if (!Array.isArray(rawPoints) || rawPoints.length < 3) return [];

  const points = rawPoints
    .map((p, idx) => ({
      x: Number(p.x),
      y: Number(p.y),
      t: Number(p.timestamp ?? idx),
    }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
    .sort((a, b) => a.t - b.t);

  if (points.length < 3) return [];

  const velocities = [];
  const intervals = [];
  const headings = [];
  let pathLength = 0;

  for (let i = 1; i < points.length; i++) {
    const p1 = points[i - 1];
    const p2 = points[i];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);
    const dt = Math.max(p2.t - p1.t, 1);

    velocities.push(dist / dt);
    intervals.push(dt);
    headings.push(Math.atan2(dy, dx));
    pathLength += dist;
  }

  if (!velocities.length) return [];

  const mean = (arr) =>
    arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;
  const std = (arr) => {
    if (!arr.length) return 0;
    const m = mean(arr);
    return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
  };

  const headingDelta = [];
  for (let i = 1; i < headings.length; i++) {
    let d = Math.abs(headings[i] - headings[i - 1]);
    if (d > Math.PI) d = 2 * Math.PI - d;
    headingDelta.push(d);
  }

  const start = points[0];
  const end = points[points.length - 1];
  const euclidean = Math.hypot(end.x - start.x, end.y - start.y);
  const tortuosity = pathLength / (euclidean + 1e-5);
  const curvature = headingDelta.length ? mean(headingDelta) / Math.PI : 0;
  const rhythm = clamp01(1 - std(intervals) / (mean(intervals) + 1e-5));
  const shape = clamp01(
    curvature * 0.6 + clamp01((tortuosity - 1.0) / 3.0) * 0.4,
  );
  const durationSec = Math.max(
    (points[points.length - 1].t - points[0].t) / 1000,
    0.01,
  );

  return [
    clamp01(durationSec / 3.0),
    clamp01(mean(velocities) * 200),
    clamp01(std(velocities) * 200),
    clamp01((tortuosity - 1.0) / 4.0),
    clamp01(curvature),
    clamp01(shape),
    clamp01(rhythm),
  ];
}

function deriveAnomalyScoreFromSession(session = {}) {
  const rlfsAnomaly = session?.rlfs_output?.anomaly_score;
  if (Number.isFinite(rlfsAnomaly)) {
    return clamp01(Number(rlfsAnomaly));
  }

  const hamming = Number(session?.sfam_output?.hamming_distance);
  const metricDiffs = session?.sfam_output?.behavior_metrics || {};
  const diffKeys = [
    "dur_diff",
    "spd_diff",
    "spv_diff",
    "tort_diff",
    "curv_diff",
    "rhythm_diff",
    "shape_stat_diff",
    "shp_diff",
  ];

  const diffs = diffKeys
    .map((k) => Number(metricDiffs?.[k]))
    .filter((v) => Number.isFinite(v))
    .map((v) => clamp01(v));

  const diffMean = diffs.length
    ? diffs.reduce((sum, v) => sum + v, 0) / diffs.length
    : null;

  const hammingNorm = Number.isFinite(hamming) ? clamp01(hamming) : null;

  if (diffMean !== null && hammingNorm !== null) {
    return clamp01(diffMean * 0.65 + hammingNorm * 0.35);
  }
  if (diffMean !== null) {
    return clamp01(diffMean);
  }
  if (hammingNorm !== null) {
    return clamp01(hammingNorm);
  }

  return 0;
}

function deriveEuclideanDistanceFromSession(session = {}) {
  const fromMetadata = Number(session?.metadata?.euclidean_distance);
  if (Number.isFinite(fromMetadata)) return fromMetadata;

  const metricDiffs = session?.sfam_output?.behavior_metrics || {};
  const diffKeys = [
    "dur_diff",
    "spd_diff",
    "spv_diff",
    "tort_diff",
    "curv_diff",
    "rhythm_diff",
    "shape_stat_diff",
    "shp_diff",
  ];

  const diffs = diffKeys
    .map((k) => Number(metricDiffs?.[k]))
    .filter((v) => Number.isFinite(v));

  if (!diffs.length) return null;

  const sq = diffs.reduce((sum, v) => sum + v * v, 0);
  return Number(Math.sqrt(sq).toFixed(4));
}

function deriveDriftStateFromSessions(sessions = [], profileState = "stable") {
  if (!Array.isArray(sessions) || sessions.length === 0) {
    return profileState || "stable";
  }

  // Sessions are sorted newest-first by caller.
  const recentScores = sessions
    .slice(0, 12)
    .map((s) => deriveAnomalyScoreFromSession(s))
    .filter((v) => Number.isFinite(v));

  if (recentScores.length < 3) {
    const latest = recentScores[0];
    if (Number.isFinite(latest) && latest >= 0.8) return "spiking";
    if (Number.isFinite(latest) && latest >= 0.55) return "drifting";
    return profileState || "stable";
  }

  const mean = (arr) =>
    arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0;

  const latestWindow = recentScores.slice(0, 4);
  const priorWindow = recentScores.slice(4, 8);
  const latestMean = mean(latestWindow);
  const priorMean = priorWindow.length ? mean(priorWindow) : latestMean;
  const delta = latestMean - priorMean;

  if (latestMean >= 0.8 || (latestMean >= 0.7 && delta >= 0.12)) {
    return "spiking";
  }
  if (latestMean >= 0.5 || delta >= 0.06) {
    return "drifting";
  }
  return "stable";
}

function dbReady(res) {
  if (mongoose.connection.readyState !== 1) {
    res.status(503).json({ success: false, message: "Database unavailable" });
    return false;
  }
  return true;
}

async function resolveUser(userIdOrUsername) {
  if (mongoose.Types.ObjectId.isValid(userIdOrUsername)) {
    const byId = await User.findById(userIdOrUsername);
    if (byId) return byId;
  }
  return User.findOne({ username: userIdOrUsername });
}

router.get("/users", async (req, res) => {
  try {
    if (!dbReady(res)) return;

    const users = await User.find({}).sort({ updatedAt: -1 }).lean();

    const userIds = users.map((u) => u._id);
    const sessions = await Session.find({ user_id: { $in: userIds } })
      .sort({ timestamp: -1 })
      .lean();

    const byUser = new Map();
    for (const s of sessions) {
      const key = String(s.user_id);
      if (!byUser.has(key)) byUser.set(key, []);
      byUser.get(key).push(s);
    }

    const payload = users.map((u) => {
      const rows = byUser.get(String(u._id)) || [];
      const avgTrust = rows.length
        ? rows.reduce(
            (sum, r) => sum + (1 - (r.rlfs_output?.anomaly_score || 0)),
            0,
          ) / rows.length
        : 0;
      const last = rows[0];
      return {
        id: u._id,
        username: u.username,
        avg_trust_score: Number(avgTrust.toFixed(3)),
        risk_level: (last?.sadr_output?.risk_level || "LOW").toLowerCase(),
        last_activity: last?.timestamp || u.updatedAt || u.createdAt,
        session_count: rows.length,
      };
    });

    res.json({ success: true, users: payload });
  } catch (error) {
    console.error("[analytics/users] failed", error);
    res.status(500).json({ success: false, message: "Failed to fetch users" });
  }
});

router.get("/users/:id", async (req, res) => {
  try {
    if (!dbReady(res)) return;

    const user = await resolveUser(req.params.id);
    if (!user) {
      return res
        .status(404)
        .json({ success: false, message: "User not found" });
    }

    const [profile, sessions, risks] = await Promise.all([
      BehavioralProfile.findOne({ user_id: user._id, is_active: true }).lean(),
      Session.find({ user_id: user._id })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
      RiskLog.find({ user_id: user._id })
        .sort({ timestamp: -1 })
        .limit(100)
        .lean(),
    ]);

    const profileBaseline = profile?.identity_model?.baseline_vector || [];
    const enrolledStats = user?.sfam?.enrollmentStats || null;
    const latestSession = sessions[0] || null;
    const sessionMetricStats =
      latestSession?.sfam_output?.behavior_metrics?.current ||
      latestSession?.sfam_output?.behavior_metrics?.enrolled ||
      null;

    let baselineVector = profileBaseline;
    let vectorSource = "profile";

    if (!Array.isArray(baselineVector) || baselineVector.length < 7) {
      if (enrolledStats) {
        baselineVector = statsToRadarVector(enrolledStats);
        vectorSource = "sfam_enrollment_stats";
      } else if (sessionMetricStats) {
        baselineVector = statsToRadarVector(sessionMetricStats);
        vectorSource = "session_behavior_metrics";
      } else if (latestSession?.input?.gesture?.raw_points?.length) {
        baselineVector = vectorFromRawPoints(
          latestSession.input.gesture.raw_points,
        );
        vectorSource = "raw_points_computed";
      } else {
        baselineVector = [];
        vectorSource = "unavailable";
      }
    }

    const derivedDrift = deriveDriftStateFromSessions(
      sessions,
      profile?.identity_model?.drift_state || "stable",
    );

    const timeline = sessions
      .slice()
      .reverse()
      .map((s, i) => ({
        index: i + 1,
        timestamp: s.timestamp,
        trust_score: Number((1 - deriveAnomalyScoreFromSession(s)).toFixed(3)),
        anomaly_score: Number(deriveAnomalyScoreFromSession(s).toFixed(3)),
        cosine_similarity: s.rlfs_output?.feature_breakdown?.gesture
          ? 1 - s.rlfs_output.feature_breakdown.gesture
          : null,
        decision: s.sadr_output?.recommended_action || "allow",
      }));

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        baseline_vector: baselineVector,
        variance_vector: profile?.identity_model?.variance_vector || [],
        drift_state: derivedDrift,
        vector_source: vectorSource,
      },
      sessions,
      timeline,
      risk_logs: risks,
    });
  } catch (error) {
    console.error("[analytics/user] failed", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch user detail" });
  }
});

router.get("/sessions", async (req, res) => {
  try {
    if (!dbReady(res)) return;

    const limit = Math.min(200, Number(req.query.limit || 100));
    const rawSessions = await Session.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const sessions = rawSessions.map((s) => {
      const anomaly = deriveAnomalyScoreFromSession(s);
      const possibleAttack = s?.metadata?.possible_attack || {
        flag: false,
        score: 0,
        reasons: [],
      };
      return {
        ...s,
        anomaly_score: Number(anomaly.toFixed(3)),
        trust_score: Number((1 - anomaly).toFixed(3)),
        possible_attack: possibleAttack,
      };
    });

    res.json({ success: true, sessions });
  } catch (error) {
    console.error("[analytics/sessions] failed", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch sessions" });
  }
});

router.get("/metrics", async (req, res) => {
  try {
    if (!dbReady(res)) return;

    const limit = Math.min(200, Number(req.query.limit || 120));
    const sessions = await Session.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .lean();

    const rows = sessions
      .slice()
      .reverse()
      .map((s, i) => {
        const anomaly = deriveAnomalyScoreFromSession(s);
        return {
          index: i + 1,
          timestamp: s.timestamp,
          trust_score: Number((1 - anomaly).toFixed(3)),
          anomaly_score: Number(anomaly.toFixed(3)),
          cosine_similarity: s.sfam_output?.confidence ?? null,
          euclidean_distance: deriveEuclideanDistanceFromSession(s),
          hamming_distance: s.sfam_output?.hamming_distance ?? null,
        };
      });

    res.json({ success: true, metrics: rows });
  } catch (error) {
    console.error("[analytics/metrics] failed", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch metrics" });
  }
});

router.get("/risk", async (req, res) => {
  try {
    if (!dbReady(res)) return;

    const logs = await RiskLog.find({})
      .populate("user_id", "username")
      .sort({ timestamp: -1 })
      .limit(120)
      .lean();

    let riskFeed = logs.map((log) => {
      const possibleAttackScore = Number(
        log?.risk_indicators?.possible_attack_score,
      );

      return {
        ...log,
        user_id: log?.user_id?._id || log?.user_id || null,
        username: log?.user_id?.username || null,
        possible_attack: {
          flag: Number.isFinite(possibleAttackScore) && possibleAttackScore > 0,
          score: Number.isFinite(possibleAttackScore)
            ? Number(possibleAttackScore.toFixed(3))
            : 0,
          reasons:
            log?.context?.possible_attack_reasons ||
            log?.risk_indicators?.feature_alerts ||
            [],
        },
      };
    });
    if (riskFeed.length === 0) {
      const sessions = await Session.find({})
        .sort({ timestamp: -1 })
        .limit(160)
        .lean();

      riskFeed = sessions
        .map((s) => {
          const anomaly = deriveAnomalyScoreFromSession(s);
          const possibleAttack = s?.metadata?.possible_attack;
          const flaggedAsAttack = Boolean(possibleAttack?.flag);
          if (anomaly < 0.35 && !flaggedAsAttack) return null;

          const severity = flaggedAsAttack
            ? possibleAttack?.score >= 0.7
              ? "critical"
              : "high"
            : anomaly >= 0.8
              ? "critical"
              : anomaly >= 0.6
                ? "high"
                : "medium";

          const reason =
            (flaggedAsAttack
              ? `possible attack: ${(possibleAttack?.reasons || []).join(", ")}`
              : null) ||
            s?.sadr_output?.reason ||
            s?.sfam_output?.reason ||
            (s?.rlfs_output?.feature_alerts || []).join(", ") ||
            (s?.rlfs_output?.detected_anomalies || []).join(", ") ||
            "behavioral anomaly";

          return {
            _id: s._id,
            timestamp: s.timestamp,
            user_id: s.user_id || null,
            severity,
            reason,
            event_type: "anomaly_detected",
            action_taken: s?.sadr_output?.decision || "CHALLENGE",
            possible_attack: {
              flag: flaggedAsAttack,
              score: flaggedAsAttack
                ? Number((possibleAttack?.score || 0).toFixed(3))
                : 0,
              reasons: flaggedAsAttack ? possibleAttack?.reasons || [] : [],
            },
            risk_indicators: {
              anomaly_score: Number(anomaly.toFixed(3)),
              possible_attack_score: flaggedAsAttack
                ? Number((possibleAttack?.score || 0).toFixed(3))
                : 0,
              feature_alerts: [reason],
            },
          };
        })
        .filter(Boolean);
    }

    const flagged = riskFeed.filter((r) =>
      ["high", "critical"].includes((r.severity || "").toLowerCase()),
    );

    res.json({ success: true, risk: riskFeed, flagged_sessions: flagged });
  } catch (error) {
    console.error("[analytics/risk] failed", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch risk feed" });
  }
});

router.get("/stream", async (req, res) => {
  if (!dbReady(res)) return;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const send = (event, data) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  send("connected", {
    status: "ok",
    time: new Date().toISOString(),
    source: "mongodb-change-stream",
  });

  const streams = [];

  const watchCollection = (model, label) => {
    try {
      const changeStream = model.watch([], { fullDocument: "updateLookup" });
      streams.push(changeStream);

      changeStream.on("change", (change) => {
        send("update", {
          collection: label,
          operation: change.operationType,
          documentId: change.documentKey?._id,
          clusterTime: change.clusterTime,
          time: new Date().toISOString(),
        });
      });

      changeStream.on("error", (err) => {
        send("stream_error", {
          collection: label,
          message: err.message,
        });
      });
    } catch (err) {
      send("stream_error", {
        collection: label,
        message: err.message,
      });
    }
  };

  watchCollection(User, "users");
  watchCollection(Session, "sessions");
  watchCollection(BehavioralProfile, "behavioral_profiles");
  watchCollection(RiskLog, "risk_logs");

  const heartbeat = setInterval(() => {
    send("heartbeat", { time: new Date().toISOString() });
  }, STREAM_HEARTBEAT_MS);

  req.on("close", async () => {
    clearInterval(heartbeat);
    await Promise.all(
      streams.map(async (stream) => {
        try {
          if (stream && typeof stream.close === "function") {
            await stream.close();
          }
        } catch {
          return null;
        }
        return null;
      }),
    );
    res.end();
  });
});

export default router;
