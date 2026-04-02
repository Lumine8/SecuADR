/**
 * S-ADR Module - Secure Adaptive Degradation Rejection
 * Refactored as: Adaptive Security Response Engine
 *
 * Responsibilities:
 * - Adjust thresholds dynamically based on risk signals
 * - Integrate historical trust and context
 * - Decide final authentication action
 * - Enforce adaptive security response
 */

import config from "../config/config.js";

class SADRModule {
  constructor() {
    this.baseThreshold = config.thresholds.rlfsBaseAnomaly;
  }

  /**
   * Main entry point: Make security decision
   */
  makeSecurityDecision(rlfsReport, userProfile, contextFactors = {}) {
    if (!config.features.enableSadrResponse) {
      return this._createNullSecurityDecision();
    }

    try {
      // 1. Calculate adaptive threshold
      const adaptiveThreshold = this._calculateAdaptiveThreshold(
        userProfile,
        contextFactors,
      );

      // 2. Evaluate anomaly against threshold
      const decisionResult = this._evaluateAnomalyAgainstThreshold(
        rlfsReport.anomaly_score,
        adaptiveThreshold,
      );

      // 3. Generate trust factors explanation
      const trustFactors = this._analyzeTrustFactors(
        userProfile,
        contextFactors,
        rlfsReport,
      );

      // 4. Build final security decision
      return {
        decision: decisionResult.decision,
        risk_level: decisionResult.risk_level,
        confidence: this._calculateConfidence(
          rlfsReport.anomaly_score,
          adaptiveThreshold,
        ),
        adaptive_threshold: adaptiveThreshold,
        anomaly_score: rlfsReport.anomaly_score,
        reason: decisionResult.reason,
        recommended_action: decisionResult.recommended_action,
        trust_factors: trustFactors,
        next_steps: this._generateNextSteps(decisionResult),
      };
    } catch (error) {
      console.error("❌ S-ADR decision error:", error);
      // Safe fallback: require step-up auth on error
      return {
        decision: "CHALLENGE",
        risk_level: "HIGH",
        confidence: 0.5,
        adaptive_threshold: 0.4,
        anomaly_score: rlfsReport.anomaly_score,
        reason: "System error during security assessment",
        recommended_action: "challenge",
        trust_factors: [],
        next_steps: ["Retry authentication", "Contact support if persistent"],
        error: error.message,
      };
    }
  }

  /**
   * Calculate dynamic threshold based on user history and context
   */
  _calculateAdaptiveThreshold(userProfile, contextFactors = {}) {
    let threshold = this.baseThreshold;

    // === Trust Multipliers ===
    // New users must be more strictly verified
    if (
      !userProfile ||
      !userProfile.stats ||
      userProfile.stats.total_authentications === 0
    ) {
      threshold += 0.15; // New users: stricter
    } else if (userProfile.stats.total_authentications > 100) {
      threshold -= 0.1; // High history: more lenient
    } else if (userProfile.stats.total_authentications > 500) {
      threshold -= 0.15; // Very high history: even more lenient
    }

    // Failed attempts in recent history increase threshold
    if (
      contextFactors.recent_auth_failures &&
      contextFactors.recent_auth_failures > 2
    ) {
      threshold += 0.2; // Protect against brute force
    }

    // False rejection pattern learning
    if (
      userProfile &&
      userProfile.stats &&
      userProfile.stats.false_rejections_count > 5
    ) {
      threshold -= 0.05; // Adjust based on learning
    }

    // === Context Penalties ===
    // Unknown device
    if (contextFactors.device_is_new) {
      threshold += 0.15; // New device requires higher confidence
    }

    // Unusual location
    if (contextFactors.location_is_new) {
      threshold += 0.1;
    }

    // Off-hours access
    if (contextFactors.is_after_hours) {
      threshold += 0.05;
    }

    // High system-wide security alertness
    if (contextFactors.system_security_state === "elevated") {
      threshold += 0.15;
    }
    if (contextFactors.system_security_state === "critical") {
      threshold += 0.25;
    }

    // === Enforce Bounds ===
    // Never let threshold drift too far
    threshold = Math.max(0.2, Math.min(0.75, threshold));

    return threshold;
  }

  /**
   * Evaluate anomaly against threshold and decide action
   */
  _evaluateAnomalyAgainstThreshold(anomalyScore, threshold) {
    // Decision ranges relative to threshold
    const allowMargin = threshold;
    const warningMargin = threshold + 0.15;
    const challengeMargin = threshold + 0.35;

    if (anomalyScore < allowMargin) {
      return {
        decision: "ALLOW",
        risk_level: "LOW",
        recommended_action: "allow",
        reason: `Anomaly score ${anomalyScore.toFixed(2)} below threshold ${threshold.toFixed(2)}. Access granted.`,
      };
    }

    if (anomalyScore < warningMargin) {
      return {
        decision: "ALLOW_WITH_WARNING",
        risk_level: "MEDIUM",
        recommended_action: "log_warning",
        reason: `Anomaly score ${anomalyScore.toFixed(2)} slightly above threshold ${threshold.toFixed(2)}. Access granted with caution.`,
      };
    }

    if (anomalyScore < challengeMargin) {
      return {
        decision: "CHALLENGE",
        risk_level: "HIGH",
        recommended_action: "challenge",
        reason: `Anomaly score ${anomalyScore.toFixed(2)} elevated. Step-up authentication required.`,
      };
    }

    return {
      decision: "BLOCK",
      risk_level: "CRITICAL",
      recommended_action: "block",
      reason: `Anomaly score ${anomalyScore.toFixed(2)} far exceeds threshold ${threshold.toFixed(2)}. Potential security threat detected.`,
    };
  }

  /**
   * Calculate confidence in the decision (0-1)
   */
  _calculateConfidence(anomalyScore, threshold) {
    const distance = Math.abs(anomalyScore - threshold);

    // High confidence if far from threshold boundary
    if (distance > 0.2) {
      return 0.95;
    }
    if (distance > 0.1) {
      return 0.8;
    }
    if (distance > 0.05) {
      return 0.65;
    }

    // Low confidence if near boundary
    return 0.5;
  }

  /**
   * Analyze trust factors that influenced the decision
   */
  _analyzeTrustFactors(userProfile, contextFactors = {}, rlfsReport = {}) {
    const factors = [];

    // === Positive Trust Factors ===
    if (
      userProfile &&
      userProfile.stats &&
      userProfile.stats.total_authentications > 100
    ) {
      factors.push("High historical authentication count");
    }

    if (
      userProfile &&
      userProfile.stats &&
      userProfile.stats.false_acceptance_count === 0
    ) {
      factors.push("No previous fraudulent authentications");
    }

    if (!contextFactors.device_is_new) {
      factors.push("Authentication from known device");
    }

    if (!contextFactors.location_is_new) {
      factors.push("Authentication from known location");
    }

    if (!contextFactors.is_after_hours) {
      factors.push("Authentication during normal hours");
    }

    // === Risk Factors ===
    if (
      contextFactors.recent_auth_failures &&
      contextFactors.recent_auth_failures > 0
    ) {
      factors.push(
        `${contextFactors.recent_auth_failures} recent failed attempts`,
      );
    }

    if (contextFactors.device_is_new) {
      factors.push("First authentication from this device");
    }

    if (contextFactors.location_is_new) {
      factors.push("First authentication from this location");
    }

    if (rlfsReport && rlfsReport.is_first_use) {
      factors.push("First enrollment or no baseline data");
    }

    if (
      rlfsReport &&
      rlfsReport.detected_anomalies &&
      rlfsReport.detected_anomalies.length > 0
    ) {
      factors.push(
        `Anomalies detected: ${rlfsReport.detected_anomalies.slice(0, 2).join(", ")}`,
      );
    }

    return factors;
  }

  /**
   * Generate next steps for the user/system
   */
  _generateNextSteps(decisionResult) {
    const steps = [];

    switch (decisionResult.decision) {
      case "ALLOW":
        steps.push("Session authenticated and logged");
        steps.push("Continue to application");
        break;

      case "ALLOW_WITH_WARNING":
        steps.push("Session authenticated with caution flag");
        steps.push("Continue to application");
        steps.push("System will monitor for fraud patterns");
        break;

      case "CHALLENGE":
        steps.push("Step-up authentication required");
        steps.push("Check email for verification code");
        steps.push("Alternative: Security question verification");
        steps.push("Or: SMS confirmation code");
        break;

      case "BLOCK":
        steps.push("Access denied for security reasons");
        steps.push("Contact support if this is you");
        steps.push("Enable additional security measures");
        steps.push("Review account activity for unauthorized access");
        break;
    }

    return steps;
  }

  /**
   * Null decision when S-ADR is disabled
   */
  _createNullSecurityDecision() {
    return {
      decision: "ALLOW",
      risk_level: "LOW",
      confidence: 1.0,
      adaptive_threshold: this.baseThreshold,
      anomaly_score: 0,
      reason: "S-ADR disabled",
      recommended_action: "allow",
      trust_factors: [],
      next_steps: ["S-ADR disabled - proceeding without guards"],
    };
  }
}

export const sadrModule = new SADRModule();
export default sadrModule;
