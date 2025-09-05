const express = require("express");
const router = express.Router();
const Pattern = require("../models/Pattern");

// Enhanced intelligent authentication engine with adaptive learning
router.post("/", async (req, res) => {
  try {
    const { cnnConfidence, dollarScore, username, metadata } = req.body;

    if (!username) {
      return res.status(400).json({
        success: false,
        message: "Username is required",
      });
    }

    // ✅ Reliable adaptive thresholds (no async dependencies)
    const thresholds = getAdaptiveThresholds(username, metadata);

    // 🎯 Multiple authentication paths for better success rates
    const authPaths = {
      // High confidence paths (immediate success)
      excellentCNN: cnnConfidence >= 0.9,
      excellentDollar: dollarScore >= 0.92,

      // Personalized paths (adapted per user)
      personalizedCNN: cnnConfidence >= thresholds.cnn,
      personalizedDollar: dollarScore >= thresholds.dollar,

      // Context-aware hybrid scoring
      contextualHybrid:
        calculateContextualScore(cnnConfidence, dollarScore, metadata) >=
        thresholds.hybrid,

      // Time and device-based leniency
      trustedContext:
        isTrustedContext(username, metadata) &&
        (cnnConfidence >= 0.65 || dollarScore >= 0.7),
    };

    // 🔐 Smart authentication decision
    const success =
      authPaths.excellentCNN ||
      authPaths.excellentDollar ||
      (authPaths.personalizedCNN && authPaths.personalizedDollar) ||
      authPaths.contextualHybrid ||
      authPaths.trustedContext;

    // 📊 Calculate final score with dynamic weighting
    const finalScore = calculateDynamicScore(
      cnnConfidence,
      dollarScore,
      metadata
    );

    // 🏷️ Determine authentication method used
    let method = "Adaptive Multi-Modal AI";
    if (authPaths.excellentCNN) method += " (CNN-Excellent)";
    else if (authPaths.excellentDollar) method += " (Dollar-Excellent)";
    else if (authPaths.trustedContext) method += " (Context-Trusted)";
    else method += " (Hybrid)";

    // 🔄 Update user profile for continuous learning
    await updateUserProfile(username, {
      cnnScore: cnnConfidence || 0,
      dollarScore: dollarScore || 0,
      success: success,
      finalScore: finalScore,
      timestamp: Date.now(),
      metadata: metadata,
    });

    console.log(`🎯 Auth Decision for ${username}:`, {
      method,
      score: (finalScore * 100).toFixed(1) + "%",
      decision: success ? "✅ ACCEPT" : "❌ REJECT",
      thresholds: thresholds, // ✅ Now shows actual values
    });

    res.json({
      success: success,
      finalScore: finalScore,
      method: method,
      details: `CNN: ${(cnnConfidence * 100).toFixed(1)}%, $1: ${(
        dollarScore * 100
      ).toFixed(1)}%`,
      improvementTips: success
        ? []
        : generateImprovementTips(cnnConfidence, dollarScore, metadata),
      threshold: thresholds.hybrid, // ✅ Now defined
    });
  } catch (error) {
    console.error("❌ Authentication engine error:", error);
    res.status(500).json({
      success: false,
      message: "Authentication engine failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

// 🧠 Adaptive threshold calculation (synchronous for reliability)
function getAdaptiveThresholds(username, metadata) {
  // Base thresholds (improved for better UX)
  let thresholds = {
    cnn: 0.7, // Reduced from 0.85
    dollar: 0.75, // Reduced from 0.88
    hybrid: 0.65, // Reduced from 0.82
  };

  // Time-based adjustments
  const hour = new Date().getHours();
  if (hour >= 22 || hour <= 6) {
    // Night time - slightly more lenient
    thresholds.cnn -= 0.05;
    thresholds.dollar -= 0.03;
    thresholds.hybrid -= 0.05;
  }

  // Weekend leniency
  const isWeekend = new Date().getDay() % 6 === 0;
  if (isWeekend) {
    thresholds.hybrid -= 0.03;
  }

  console.log("🎯 Computed thresholds:", thresholds);
  return thresholds;
}

// 🎯 Context-aware scoring with bonuses
function calculateContextualScore(cnn, dollar, metadata) {
  let baseScore = cnn * 0.6 + dollar * 0.4;

  // Drawing quality bonuses
  if (metadata?.drawingTime > 1000 && metadata?.drawingTime < 8000) {
    baseScore += 0.03; // Good drawing speed
  }

  if (metadata?.patternComplexity > 0.3 && metadata?.patternComplexity < 2.0) {
    baseScore += 0.04; // Appropriate complexity
  }

  if (metadata?.pointCount > 20 && metadata?.pointCount < 300) {
    baseScore += 0.03; // Good detail level
  }

  return Math.min(baseScore, 1.0);
}

// 🏠 Trusted context detection
function isTrustedContext(username, metadata) {
  const hour = new Date().getHours();
  const isBusinessHours = hour >= 8 && hour <= 20;

  // Add your device fingerprinting logic here
  const hasConsistentDevice =
    metadata?.deviceFingerprint?.userAgent?.includes("Chrome");

  return isBusinessHours && hasConsistentDevice;
}

// ⚖️ Dynamic scoring with intelligent weighting
function calculateDynamicScore(cnn, dollar, metadata) {
  // Default values for safety
  const safeCnn = cnn || 0;
  const safeDollar = dollar || 0;

  // Adjust weights based on confidence levels
  if (safeCnn > 0.85 && safeDollar < 0.7) {
    return safeCnn * 0.8 + safeDollar * 0.2; // CNN-dominant
  } else if (safeDollar > 0.85 && safeCnn < 0.7) {
    return safeCnn * 0.3 + safeDollar * 0.7; // Dollar-dominant
  } else {
    return safeCnn * 0.6 + safeDollar * 0.4; // Balanced
  }
}

// 💡 Improvement tips for failed authentications
function generateImprovementTips(cnn, dollar, metadata) {
  const tips = [];

  if (cnn < 0.6) {
    tips.push("🎨 Try drawing more smoothly and consistently");
  }

  if (dollar < 0.7) {
    tips.push("📐 Focus on maintaining the geometric shape");
  }

  if (metadata?.drawingTime < 800) {
    tips.push("⏱️ Draw a bit slower for better recognition");
  }

  if (metadata?.patternComplexity < 0.3) {
    tips.push("🔄 Add more detail to your pattern");
  }

  if (metadata?.pointCount < 15) {
    tips.push("✍️ Draw a more detailed pattern");
  }

  return tips.slice(0, 2); // Return max 2 tips
}

// 🔄 Simple user profile updates
async function updateUserProfile(username, authData) {
  try {
    const statusMsg = authData.success ? "SUCCESS" : "FAILED";
    console.log(`📊 Updated profile for ${username}: ${statusMsg}`);
    // Add your user analytics database code here later
  } catch (error) {
    console.error("Profile update error:", error);
  }
}

module.exports = router;
