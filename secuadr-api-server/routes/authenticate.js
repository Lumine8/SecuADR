const express = require("express");
const router = express.Router();
const User = require("../models/User");
const admin = require("../firebase");
const { verifySFAM, checkSFAMHealth } = require("../utils/sfamClient");

/* ==========================================================================
   AUTHENTICATION ROUTE - SFAM HYBRID ENGINE
   ========================================================================== */
router.post("/", async (req, res) => {
  try {
    // 1. EXTRACT PAYLOAD
    const {
      username,
      gesture, // { spatial: [[x,y]...], behavioral: [[dx,dy,v,a]...] }
      cnnConfidence, // 0.0 - 1.0 (from Client TFLite)
      dollarScore, // 0.0 - 1.0 (from Client $1 Recognizer)
      metadata, // { drawingTime, touchEvents, etc. }
    } = req.body;

    // 2. INPUT VALIDATION
    if (!username) {
      return res
        .status(400)
        .json({ success: false, message: "Username is required" });
    }

    // Protect against malformed gesture objects causing crashes
    if (gesture && (!gesture.spatial || !gesture.behavioral)) {
      console.warn(`⚠️ Malformed gesture payload received from: ${username}`);
      return res.status(400).json({
        success: false,
        message: "Invalid gesture payload: missing spatial or behavioral data",
      });
    }

    // 3. FETCH USER CONTEXT
    const user = await User.findOne({ username });
    if (!user) {
      // Return generic error to prevent user enumeration
      return res
        .status(401)
        .json({ success: false, message: "Authentication failed" });
    }

    // 4. CHECK SYSTEM HEALTH
    // Refinement A: Pass cnnConfidence to dynamically check if client side AI ran
    const aiEngineStatus = await checkAIEngineStatus(cnnConfidence);

    /* ==========================================================================
       🔒 SECURITY CHECK: DOWNGRADE ATTACK PREVENTION
       If the user is enrolled in SFAM and the system is healthy, 
       we MUST receive gesture data. We cannot allow fallback to weak auth.
       ========================================================================== */
    const isEnrolled = user.sfam && user.sfam.hash && user.sfam.hash.length > 0;
    const isSystemHealthy = aiEngineStatus.sfamAvailable;
    const isDataMissing = !gesture;

    if (isEnrolled && isSystemHealthy && isDataMissing) {
      console.warn(
        `🚨 Security Alert: Downgrade attack blocked for ${username}`,
      );
      return res.status(400).json({
        success: false,
        message: "High-Security Mode Active: Gesture data is required.",
      });
    }

    // 5. RUN SFAM VERIFICATION
    let sfamResult = { auth_pass: false, hamming_distance: 1.0, ran: false };

    if (isEnrolled && isSystemHealthy && gesture) {
      try {
        sfamResult = await verifySFAM(
          {
            spatial: gesture.spatial,
            behavioral: gesture.behavioral,
          },
          {
            sfam_hash: user.sfam.hash,
            seed: user.sfam.seed,
            salt: user.sfam.salt,
          },
        );
        sfamResult.ran = true;
      } catch (err) {
        console.error("⚠️ SFAM Verification Error:", err.message);

        // Refinement B: Explicit Policy Documentation
        // CURRENT POLICY: Fail Open (allow fallback to Legacy AI for UX)
        // NOTE: Switch 'ran' to 'false' if you want to allow fallback.
        // NOTE: For High-Security (Banks/Gov), return 500 here (Fail Closed).
        sfamResult.ran = false;
      }
    }

    // 6. CALCULATE THRESHOLDS & SCORES
    const thresholds = getAdaptiveThresholds(
      username,
      metadata,
      aiEngineStatus,
    );

    // Define all possible success paths
    const authPaths = {
      // Tier 1: SFAM (High Security - Temporal+Spatial)
      // This is the "Authoritative" check.
      sfamSecure: sfamResult.ran && sfamResult.auth_pass,

      // Tier 2: Legacy CNN (Medium Security - Spatial Only)
      excellentCNN: cnnConfidence >= 0.9 && aiEngineStatus.cnnAvailable,
      personalizedCNN:
        cnnConfidence >= thresholds.cnn && aiEngineStatus.cnnAvailable,

      // Tier 3: $1 Recognizer (Fallback - Geometric)
      excellentDollar: dollarScore >= 0.92,
      personalizedDollar: dollarScore >= thresholds.dollar,
      dollarFallback: !aiEngineStatus.cnnAvailable && dollarScore >= 0.7,

      // Tier 4: Hybrid Context
      contextualHybrid:
        calculateContextualScore(cnnConfidence, dollarScore, metadata) >=
        thresholds.hybrid,
    };

    // 7. DECISION MATRIX
    let success = false;
    let method = "Unknown";
    let finalScore = 0.0;

    if (sfamResult.ran) {
      // --- SFAM IS AUTHORITY ---
      if (authPaths.sfamSecure) {
        success = true;
        method = "SFAM Neural Fusion";
        // Invert distance for score (0.0 dist = 1.0 score)
        finalScore = 1.0 - sfamResult.hamming_distance;
      } else {
        success = false;
        method = "Blocked by SFAM Gate";
        finalScore = 1.0 - sfamResult.hamming_distance;
      }
    } else {
      // --- LEGACY FALLBACK ---
      success =
        authPaths.excellentCNN ||
        authPaths.excellentDollar ||
        (authPaths.personalizedCNN && authPaths.personalizedDollar) ||
        authPaths.contextualHybrid ||
        authPaths.dollarFallback;

      method = aiEngineStatus.cnnAvailable
        ? "Adaptive Multi-Modal AI"
        : "Enhanced $1 Recognizer";
      finalScore = calculateAdaptiveScore(
        cnnConfidence,
        dollarScore,
        metadata,
        aiEngineStatus,
      );
    }

    // Ensure score is valid number
    finalScore = Number.isFinite(finalScore) ? finalScore : 0.0;

    console.log(`🎯 Auth Decision for ${username}:`, {
      method,
      sfamRan: sfamResult.ran,
      score: (finalScore * 100).toFixed(1) + "%",
      decision: success ? "✅ ACCEPT" : "❌ REJECT",
    });

    // 8. RESPONSE GENERATION
    if (success) {
      try {
        // Create Firebase Custom Token with Security Metadata
        const firebaseToken = await admin.auth().createCustomToken(username, {
          secuAdrAuth: true,
          authMethod: method,
          confidence: finalScore,
          isSfamVerified: sfamResult.ran,
          authTime: Date.now(),
        });

        res.json({
          success: true,
          finalScore,
          method,
          details: sfamResult.ran
            ? `SFAM Dist: ${sfamResult.hamming_distance.toFixed(3)}`
            : `Legacy Score: ${(finalScore * 100).toFixed(1)}%`,
          firebaseToken,
          aiEngine: aiEngineStatus,
          threshold: thresholds.hybrid,
          improvementTips: [],
        });
      } catch (firebaseError) {
        console.error("❌ Firebase Token Error:", firebaseError);
        res
          .status(500)
          .json({ success: false, message: "Token generation failed" });
      }
    } else {
      // Auth Failed - Send helpful tips
      res.json({
        success: false,
        finalScore,
        method,
        improvementTips: generateImprovementTips(
          cnnConfidence,
          dollarScore,
          metadata,
          aiEngineStatus,
          sfamResult,
        ),
        threshold: thresholds.hybrid,
        aiEngine: aiEngineStatus,
      });
    }
  } catch (error) {
    console.error("❌ Critical Authentication Error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

/* ==========================================================================
   HELPER FUNCTIONS
   ========================================================================== */

/**
 * Checks status of all AI sub-systems.
 * Refinement A: Uses actual payload data to verify client-side AI status.
 */
async function checkAIEngineStatus(clientCnnConfidence) {
  try {
    // 1. Check SFAM Python Service
    const isSfamUp = await checkSFAMHealth();

    // 2. Check CNN (Refinement A)
    // If the client sent a valid number, the client-side model is "loaded" and working.
    const cnnModelLoaded = typeof clientCnnConfidence === "number";

    return {
      cnnAvailable: cnnModelLoaded,
      sfamAvailable: isSfamUp,
      dollarAvailable: true, // Native JS always available
      mode: isSfamUp ? "Hybrid Neural" : "Fallback Legacy",
      message: isSfamUp
        ? "All systems operational"
        : "SFAM service unreachable",
    };
  } catch (error) {
    return {
      cnnAvailable: false,
      sfamAvailable: false,
      dollarAvailable: true,
      mode: "Emergency Fallback",
      message: "AI Status Check Failed",
    };
  }
}

/**
 * Calculates dynamic thresholds based on context (Time, User History, etc.)
 */
function getAdaptiveThresholds(username, metadata, aiStatus) {
  let thresholds = {
    cnn: aiStatus.cnnAvailable ? 0.7 : 0.0, // Ignore CNN if unavailable
    dollar: 0.75,
    hybrid: aiStatus.cnnAvailable ? 0.65 : 0.7, // Higher threshold if falling back
  };

  // Example: Relax thresholds slightly at night (users are tired/sloppy)
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 6) {
    thresholds.dollar -= 0.05;
    thresholds.hybrid -= 0.05;
  }

  return thresholds;
}

/**
 * Computes weighted score for Legacy Mode
 */
function calculateAdaptiveScore(cnn, dollar, metadata, aiStatus) {
  const safeCnn = cnn || 0;
  const safeDollar = dollar || 0;

  if (!aiStatus.cnnAvailable) {
    // Fallback mode: rely entirely on $1 recognizer
    return safeDollar;
  }

  // Full AI mode: Weighted average
  return safeCnn * 0.6 + safeDollar * 0.4;
}

/**
 * Boosts score if metadata (drawing speed) is within "human" range
 */
function calculateContextualScore(cnn, dollar, metadata) {
  const safeCnn = cnn || 0;
  const safeDollar = dollar || 0;
  let baseScore = safeCnn * 0.6 + safeDollar * 0.4;

  // Bonus for natural drawing speed (1s - 8s)
  if (metadata?.drawingTime > 1000 && metadata?.drawingTime < 8000) {
    baseScore += 0.03;
  }

  return Math.min(baseScore, 1.0);
}

/**
 * Generates user feedback based on which engine rejected them
 */
function generateImprovementTips(cnn, dollar, metadata, aiStatus, sfamResult) {
  const tips = [];

  // 1. SFAM Specific Tips
  if (sfamResult && sfamResult.ran && !sfamResult.auth_pass) {
    tips.push("🔒 Security Check Failed: Rhythm mismatch.");
    tips.push("Try to maintain your natural drawing speed and pressure.");
    return tips; // Return immediately as this is the primary reason
  }

  // 2. Legacy Tips
  if (!aiStatus.cnnAvailable && !aiStatus.sfamAvailable) {
    tips.push("⚠️ Offline Mode: Please draw very precisely.");
  }

  if ((dollar || 0) < 0.7) {
    tips.push("📐 Shape Distortion: Watch your corners and proportions.");
  }

  if (metadata?.drawingTime < 800) {
    tips.push("⏱️ Too Fast: Slow down slightly for better recognition.");
  }

  if (metadata?.drawingTime > 10000) {
    tips.push("💤 Too Slow: Try to draw in one fluid motion.");
  }

  return tips.slice(0, 2); // Return top 2 tips
}

module.exports = router;
