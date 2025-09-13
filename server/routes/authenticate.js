const express = require("express");
const router = express.Router();
const Pattern = require("../models/Pattern");
const admin = require("../firebase");

// Enhanced authentication with AI fallback handling
router.post("/", async (req, res) => {
  try {
    const { cnnConfidence, dollarScore, username, metadata } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required",
      });
    }

    // Check AI engine availability
    const aiEngineStatus = await checkAIEngineStatus();

    // Adaptive thresholds based on available AI components
    const thresholds = getAdaptiveThresholds(
      username,
      metadata,
      aiEngineStatus
    );

    // Authentication paths with fallback consideration
    const authPaths = {
      excellentCNN: cnnConfidence >= 0.9 && aiEngineStatus.cnnAvailable,
      excellentDollar: dollarScore >= 0.92,
      personalizedCNN:
        cnnConfidence >= thresholds.cnn && aiEngineStatus.cnnAvailable,
      personalizedDollar: dollarScore >= thresholds.dollar,
      contextualHybrid:
        calculateContextualScore(cnnConfidence, dollarScore, metadata) >=
        thresholds.hybrid,
      dollarFallback: !aiEngineStatus.cnnAvailable && dollarScore >= 0.7, // Fallback mode
    };

    // Smart authentication decision with fallback
    const success =
      authPaths.excellentCNN ||
      authPaths.excellentDollar ||
      (authPaths.personalizedCNN && authPaths.personalizedDollar) ||
      authPaths.contextualHybrid ||
      authPaths.dollarFallback;

    // Calculate final score with AI status awareness
    const finalScore = calculateAdaptiveScore(
      cnnConfidence,
      dollarScore,
      metadata,
      aiEngineStatus
    );

    // Determine authentication method
    let method = aiEngineStatus.cnnAvailable
      ? "Adaptive Multi-Modal AI"
      : "Enhanced $1 Recognizer";
    if (authPaths.excellentCNN) method += " (CNN-Excellent)";
    else if (authPaths.excellentDollar) method += " (Dollar-Excellent)";
    else if (authPaths.dollarFallback) method += " (Fallback Mode)";

    console.log(`🎯 Auth Decision for ${username}:`, {
      method,
      aiStatus: aiEngineStatus.cnnAvailable ? "Full AI" : "Fallback Mode",
      score: (finalScore * 100).toFixed(1) + "%",
      decision: success ? "✅ ACCEPT" : "❌ REJECT",
    });

    if (success) {
      try {
        // Create Firebase custom token
        const firebaseToken = await admin.auth().createCustomToken(username, {
          secuAdrAuth: true,
          authMethod: method,
          confidence: finalScore,
          aiMode: aiEngineStatus.cnnAvailable ? "full" : "fallback",
          authTime: Date.now(),
        });

        res.json({
          success: true,
          finalScore: finalScore,
          method: method,
          details: `CNN: ${((cnnConfidence || 0) * 100).toFixed(1)}%, $1: ${(
            (dollarScore || 0) * 100
          ).toFixed(1)}%`,
          firebaseToken: firebaseToken,
          aiEngine: aiEngineStatus,
          threshold: thresholds.hybrid,
          improvementTips: [],
        });
      } catch (firebaseError) {
        console.error("❌ Firebase token creation error:", firebaseError);
        res.json({
          success: true,
          finalScore: finalScore,
          method: method,
          details: `CNN: ${((cnnConfidence || 0) * 100).toFixed(1)}%, $1: ${(
            (dollarScore || 0) * 100
          ).toFixed(1)}%`,
          aiEngine: aiEngineStatus,
          warning: "Firebase integration unavailable",
        });
      }
    } else {
      res.json({
        success: false,
        finalScore: finalScore,
        method: method,
        details: `CNN: ${((cnnConfidence || 0) * 100).toFixed(1)}%, $1: ${(
          (dollarScore || 0) * 100
        ).toFixed(1)}%`,
        improvementTips: generateImprovementTips(
          cnnConfidence,
          dollarScore,
          metadata,
          aiEngineStatus
        ),
        threshold: thresholds.hybrid,
        aiEngine: aiEngineStatus,
      });
    }
  } catch (error) {
    console.error("❌ Authentication engine error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication engine failed",
    });
  }
});

// Check AI engine status
async function checkAIEngineStatus() {
  try {
    // In production, check if CNN model is loaded
    // For now, return fallback status
    return {
      cnnAvailable: false, // Set to true when CNN model is loaded
      dollarAvailable: true,
      mode: "fallback",
      message: "Using $1 recognizer only",
    };
  } catch (error) {
    return {
      cnnAvailable: false,
      dollarAvailable: true,
      mode: "fallback",
      message: "AI engine check failed",
    };
  }
}

// Adaptive thresholds with AI status awareness
function getAdaptiveThresholds(username, metadata, aiStatus) {
  let thresholds = {
    cnn: aiStatus.cnnAvailable ? 0.7 : 0.0, // Ignore CNN if unavailable
    dollar: 0.75,
    hybrid: aiStatus.cnnAvailable ? 0.65 : 0.7, // Higher threshold for fallback
  };

  // Time-based adjustments
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 6) {
    thresholds.dollar -= 0.05;
    thresholds.hybrid -= 0.05;
  }

  return thresholds;
}

// Adaptive scoring with AI awareness
function calculateAdaptiveScore(cnn, dollar, metadata, aiStatus) {
  const safeCnn = cnn || 0;
  const safeDollar = dollar || 0;

  if (!aiStatus.cnnAvailable) {
    // Fallback mode: rely entirely on $1 recognizer
    return safeDollar;
  }

  // Full AI mode: hybrid scoring
  return safeCnn * 0.6 + safeDollar * 0.4;
}

// Context-aware scoring (unchanged)
function calculateContextualScore(cnn, dollar, metadata) {
  const safeCnn = cnn || 0;
  const safeDollar = dollar || 0;
  let baseScore = safeCnn * 0.6 + safeDollar * 0.4;

  if (metadata?.drawingTime > 1000 && metadata?.drawingTime < 8000) {
    baseScore += 0.03;
  }

  return Math.min(baseScore, 1.0);
}

// Enhanced improvement tips with AI status
function generateImprovementTips(cnn, dollar, metadata, aiStatus) {
  const tips = [];

  if (!aiStatus.cnnAvailable) {
    tips.push("🤖 AI engine in fallback mode - focus on gesture precision");
  }

  if ((dollar || 0) < 0.7) {
    tips.push("📐 Draw your pattern more consistently");
  }

  if (metadata?.drawingTime < 800) {
    tips.push("⏱️ Draw slightly slower for better recognition");
  }

  return tips.slice(0, 2);
}

module.exports = router;
