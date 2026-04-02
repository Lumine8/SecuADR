import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Session from "../models/Session.js";
import { verifySFAM, checkSFAMHealth } from "../utils/sfamClient.js";

const router = express.Router();

async function persistAuthAttempt({
  user,
  pattern,
  sfamHealthy,
  sfamResult,
  possibleAttack,
  authenticated,
  token,
  reason,
  deviceFingerprint,
}) {
  try {
    const rawPoints = Array.isArray(pattern)
      ? pattern.map((point, idx) => ({
          x: point.X,
          y: point.Y,
          timestamp:
            Number(point.T ?? point.t ?? point.timestamp ?? idx) || idx,
        }))
      : [];

    const startTs = rawPoints.length ? rawPoints[0].timestamp : 0;
    const endTs = rawPoints.length
      ? rawPoints[rawPoints.length - 1].timestamp
      : 0;
    const durationMs = Math.max(endTs - startTs, 0);

    await Session.create({
      user_id: user._id,
      timestamp: new Date(),
      input: {
        gesture: {
          raw_points: rawPoints,
          duration_ms: durationMs,
        },
        session_context: {
          user_agent:
            typeof deviceFingerprint === "object"
              ? deviceFingerprint.userAgent
              : undefined,
        },
      },
      sfam_output: {
        confidence: sfamResult?.confidence || 0,
        hamming_distance: sfamResult?.hash_distance,
        reason: sfamResult?.reason,
        behavior_metrics: sfamResult?.metrics,
      },
      sadr_output: {
        decision: authenticated ? "ALLOW" : "BLOCK",
        risk_level: authenticated ? "LOW" : "HIGH",
        confidence: sfamResult?.confidence || 0,
        reason: sfamResult?.reason || reason,
        recommended_action: authenticated ? "allow" : "block",
        trust_factors: sfamResult?.reason ? [sfamResult.reason] : [],
      },
      authentication: {
        status: authenticated ? "success" : "failed",
        token: authenticated ? token : undefined,
        error_message: authenticated ? undefined : reason,
      },
      metadata: {
        api_version: "2.0",
        sfam_service_healthy: sfamHealthy,
        sfam_reason: sfamResult?.reason,
        possible_attack: possibleAttack || {
          flag: false,
          score: 0,
          reasons: [],
        },
        is_simulated_attempt: Boolean(deviceFingerprint?.attackSimulation),
      },
    });
  } catch (error) {
    console.error(`⚠️ Failed to persist session log: ${error.message}`);
  }
}

function toFiniteNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function getBehaviorDeltas(metrics = {}) {
  const keys = [
    "dur_diff",
    "spd_diff",
    "spv_diff",
    "tort_diff",
    "curv_diff",
    "rhythm_diff",
    "shape_stat_diff",
    "shp_diff",
  ];

  return keys
    .map((k) => toFiniteNumber(metrics?.[k]))
    .filter((v) => v !== null);
}

async function detectPossibleAttack({ userId, sfamResult, authenticated }) {
  const reasons = [];
  let score = 0;

  const currentDistance = toFiniteNumber(sfamResult?.hash_distance);
  const metricDiffs = getBehaviorDeltas(sfamResult?.metrics);
  const avgMetricDelta = metricDiffs.length
    ? metricDiffs.reduce((sum, v) => sum + v, 0) / metricDiffs.length
    : null;

  // Incorporate SFAM-local heuristics first.
  if (sfamResult?.possible_attack?.flag) {
    reasons.push(...(sfamResult.possible_attack.reasons || ["sfam_suspicion"]));
    score += 0.35;
  }

  const recent = await Session.find({ user_id: userId })
    .sort({ timestamp: -1 })
    .limit(20)
    .lean();

  const lastSuccess = recent.find(
    (s) => s?.authentication?.status === "success",
  );
  const lastSuccessDistance = toFiniteNumber(
    lastSuccess?.sfam_output?.hamming_distance,
  );

  if (
    authenticated &&
    currentDistance !== null &&
    lastSuccessDistance !== null &&
    currentDistance < 0.035 &&
    lastSuccessDistance < 0.035 &&
    Math.abs(currentDistance - lastSuccessDistance) < 0.003 &&
    avgMetricDelta !== null &&
    avgMetricDelta < 0.04
  ) {
    reasons.push("possible_attack: suspiciously_perfect_repeat");
    score += 0.45;
  }

  const failedRecent = recent
    .filter((s) => s?.authentication?.status === "failed")
    .slice(0, 5)
    .map((s) => toFiniteNumber(s?.sfam_output?.hamming_distance))
    .filter((v) => v !== null);

  if (failedRecent.length >= 3) {
    const oldestToNewest = [...failedRecent].reverse();
    const deltas = oldestToNewest
      .slice(1)
      .map((v, idx) => oldestToNewest[idx] - v);
    const meanDelta = deltas.reduce((sum, v) => sum + v, 0) / deltas.length;
    const improvingSteps = deltas.filter((d) => d > 0.01).length;

    if (meanDelta > 0.008 && improvingSteps >= 2) {
      reasons.push("possible_attack: gradual_convergence_pattern");
      score += 0.4;
    }
  }

  if (
    avgMetricDelta !== null &&
    avgMetricDelta < 0.02 &&
    currentDistance !== null &&
    currentDistance < 0.02
  ) {
    reasons.push("possible_attack: over_consistent_behavior");
    score += 0.25;
  }

  const uniqueReasons = [...new Set(reasons)];
  const finalScore = Math.min(1, Number(score.toFixed(3)));

  return {
    flag: uniqueReasons.length > 0 && finalScore >= 0.35,
    score: finalScore,
    reasons: uniqueReasons,
  };
}

/**
 * POST /authenticate
 *
 * Authenticates a user using their gesture pattern.
 *
 * Request body:
 * {
 *   username: string,
 *   pattern: [{X: number, Y: number, ID: number}, ...],  // Raw gesture points from frontend
 *   sessionId?: string,
 *   deviceFingerprint?: string
 * }
 *
 * Response on success:
 * {
 *   success: true,
 *   authenticated: true,
 *   username: string,
 *   token: string,          // JWT token for authenticated session
 *   method: string,
 *   confidence: number,     // 0.0 - 1.0
 *   message: string
 * }
 *
 * Response on failure:
 * {
 *   success: false,
 *   authenticated: false,
 *   message: string,
 *   confidence: number
 * }
 */
router.post("/", async (req, res) => {
  try {
    // 1. EXTRACT PAYLOAD
    const {
      username,
      pattern, // Raw gesture points from frontend: [{X, Y, ID}]
      sessionId,
      deviceFingerprint,
    } = req.body;

    // 2. INPUT VALIDATION
    if (!username || typeof username !== "string") {
      return res.status(400).json({
        success: false,
        message: "Username is required and must be a string",
      });
    }

    if (!pattern || !Array.isArray(pattern) || pattern.length < 5) {
      return res.status(400).json({
        success: false,
        message: "Invalid gesture pattern: minimum 5 points required",
      });
    }

    // Validate gesture points have required properties
    const validPattern = pattern.every(
      (point) =>
        typeof point.X === "number" &&
        typeof point.Y === "number" &&
        typeof point.ID === "number",
    );

    if (!validPattern) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid gesture points: each point must have X, Y, ID properties",
      });
    }

    console.log(`📝 Auth attempt for user: ${username}`);

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        authenticated: false,
        message: "Database unavailable. Authentication cannot proceed.",
      });
    }

    // 3. FETCH USER CONTEXT
    const user = await User.findOne({ username });
    if (!user) {
      // Return generic error to prevent user enumeration
      return res.status(401).json({
        success: false,
        message: "Authentication failed",
      });
    }

    console.log(
      `✅ User found: ${username}, SFAM enrolled: ${!!user.sfam?.hash}`,
    );

    // 4. CHECK SFAM AVAILABILITY
    const sfamHealthy = await checkSFAMHealth();
    console.log(
      `🔌 SFAM Service Status: ${sfamHealthy ? "HEALTHY" : "UNAVAILABLE"}`,
    );

    // 5. RUN SFAM VERIFICATION
    let sfamResult = {
      is_match: false,
      hash_distance: 1.0,
      confidence: 0,
    };
    let sfamSucceeded = false;

    // Only run SFAM if user is enrolled and service is available
    if (user.sfam && user.sfam.hash && sfamHealthy) {
      try {
        console.log(`🔍 Running SFAM verification for ${username}...`);

        // Call verifySFAM with raw gesture points
        // The sfamClient will handle transformation to spatial/behavioral data
        sfamResult = await verifySFAM(
          {
            points: pattern, // Will be transformed by sfamClient
          },
          {
            sfam_hash: user.sfam.hash,
            sfam_seed: user.sfam.seed,
            sfam_salt: user.sfam.salt,
            enrollment_stats: user.sfam.enrollmentStats,
            shape_signature: user.sfam.shapeSignature,
          },
        );

        sfamSucceeded = sfamResult.is_match === true;

        console.log(
          `✅ SFAM Result: ${sfamSucceeded ? "MATCH" : "MISMATCH"} | Distance: ${sfamResult.hash_distance?.toFixed(3) || "N/A"} | Confidence: ${sfamResult.confidence?.toFixed(3) || "N/A"}`,
        );
      } catch (err) {
        console.error(`⚠️ SFAM Verification Error: ${err.message}`);
        sfamSucceeded = false;
        // Continue - don't block auth if SFAM fails unexpectedly
      }
    } else if (!user.sfam?.hash) {
      console.log(`ℹ️ User not enrolled in SFAM`);
    } else if (!sfamHealthy) {
      console.log(`ℹ️ SFAM service unavailable, skipping verification`);
    }

    // 6. GENERATE RESPONSE
    const possibleAttack = await detectPossibleAttack({
      userId: user._id,
      sfamResult,
      authenticated: sfamSucceeded,
    });

    if (sfamSucceeded) {
      // ✅ Authentication successful
      const token = generateJWTToken(username);

      console.log(`✅ Authentication SUCCEEDED for ${username}`);

      await persistAuthAttempt({
        user,
        pattern,
        sfamHealthy,
        sfamResult,
        possibleAttack,
        authenticated: true,
        token,
        reason: "Authentication successful",
        deviceFingerprint,
      });

      return res.status(200).json({
        success: true,
        authenticated: true,
        username,
        token,
        method: "SFAM Gesture Recognition",
        confidence: sfamResult.confidence || 0,
        message: "Authentication successful",
        sessionId: sessionId || undefined,
        sfam: {
          reason: sfamResult.reason || "Hash match",
          hash_distance: sfamResult.hash_distance,
          metrics: sfamResult.metrics || null,
          possible_attack: possibleAttack,
        },
        possible_attack: possibleAttack,
      });
    } else {
      // ❌ Authentication failed
      console.log(`❌ Authentication FAILED for ${username}`);

      // Check if user is enrolled but failed SFAM
      const failureReason = user.sfam?.hash
        ? "Gesture not recognized"
        : "User not enrolled in gesture authentication";

      await persistAuthAttempt({
        user,
        pattern,
        sfamHealthy,
        sfamResult,
        possibleAttack,
        authenticated: false,
        token: null,
        reason: failureReason,
        deviceFingerprint,
      });

      return res.status(401).json({
        success: false,
        authenticated: false,
        username,
        message: `Authentication failed: ${sfamResult?.reason || failureReason}`,
        confidence: sfamResult?.confidence || 0,
        sfam: {
          reason: sfamResult?.reason || failureReason,
          hash_distance: sfamResult?.hash_distance,
          metrics: sfamResult?.metrics || null,
          possible_attack: possibleAttack,
        },
        possible_attack: possibleAttack,
      });
    }
  } catch (error) {
    console.error(`❌ Critical Authentication Error: ${error.message}`);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      message: "Internal server error during authentication",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

/**
 * Generates a simple JWT-like token
 * In production, use jsonwebtoken library with proper signing
 */
function generateJWTToken(username) {
  // PLACEHOLDER: In production, use:
  // const jwt = require('jsonwebtoken');
  // return jwt.sign({ username, iat: Date.now() }, process.env.JWT_SECRET, { expiresIn: '24h' });

  // For now, return a simple token
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64");
  const payload = Buffer.from(
    JSON.stringify({
      username,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 86400, // 24 hours
    }),
  ).toString("base64");

  // Mock signature (not cryptographically valid)
  const signature = Buffer.from(
    `${username}${Date.now()}${process.env.JWT_SECRET || "default-secret"}`,
  )
    .toString("base64")
    .substring(0, 20);

  return `${header}.${payload}.${signature}`;
}

export default router;
