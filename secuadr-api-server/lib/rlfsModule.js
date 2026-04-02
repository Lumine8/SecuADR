/**
 * RLFS Module - Representation-Level Failure Sensitivity
 * Refactored as: Anomaly Sensitivity Engine
 *
 * Responsibilities:
 * - Detect deviation between current input and baseline
 * - Track feature-level failure signals
 * - Identify sudden shifts, inconsistencies, adversarial mimicry
 */

import config from "../config/config.js";

class RLFSModule {
  constructor() {
    this.baseThreshold = config.thresholds.rlfsBaseAnomaly;
    this.highConfidenceThreshold = config.thresholds.rlfsHighConfidence;
    this.mediumConfidenceThreshold = config.thresholds.rlfsMedianConfidence;
    this.lowConfidenceThreshold = config.thresholds.rlfsLowConfidence;
  }

  /**
   * Main entry point: Analyze session for anomalies
   */
  analyzeSession(currentFeatures, baselineFeatures, sessionHistory = []) {
    if (!config.features.enableRlfsAnomaly) {
      return this._createNullAnomalyReport();
    }

    try {
      // 1. SFAM Hash Comparison (Primary Signal)
      const sfamAnomaly = this._calculateSFAMAnomalyScore(
        currentFeatures.sfam_output,
        baselineFeatures,
      );

      // 2. Feature-Level Anomalies (Secondary Signals)
      const featureAnomalies = this._calculateFeatureAnomalies(
        currentFeatures,
        baselineFeatures,
      );

      // 3. Temporal Pattern Analysis
      const temporalAnomaly = this._analyzeTemporalPatterns(
        currentFeatures,
        sessionHistory,
      );

      // 4. Adversarial Detection (Optional)
      const adversarialSignals = this._detectAdversarialPatterns(
        currentFeatures,
        baselineFeatures,
      );

      // 5. Combined Anomaly Score
      const combinedAnomalies = {
        primary: sfamAnomaly,
        secondary: Math.max(
          featureAnomalies.gesture,
          featureAnomalies.typing,
          featureAnomalies.touch,
          featureAnomalies.session,
        ),
        temporal: temporalAnomaly,
      };

      const anomalyScore = this._combineAnomalyScores(combinedAnomalies);
      const confidence = this._assessConfidence(anomalyScore);
      const isFirstUse = !sessionHistory || sessionHistory.length === 0;

      return {
        anomaly_score: anomalyScore,
        confidence,
        feature_breakdown: featureAnomalies,
        temporal_trend: this._determineTrend(sessionHistory),
        is_first_use: isFirstUse,
        detected_anomalies: this._summarizeAnomalies(
          featureAnomalies,
          adversarialSignals,
        ),
        feature_alerts: this._generateAlerts(
          featureAnomalies,
          adversarialSignals,
        ),
        details: {
          sfam_primary: sfamAnomaly,
          adversarial_signals: adversarialSignals,
        },
      };
    } catch (error) {
      console.error("❌ RLFS analysis error:", error);
      // Return safe default indicating anomaly if we can't analyze
      return {
        anomaly_score: 0.7,
        confidence: "low",
        feature_breakdown: { gesture: 0.7, typing: 0, touch: 0, session: 0 },
        temporal_trend: "unknown",
        is_first_use: true,
        detected_anomalies: ["processing_error"],
        feature_alerts: ["Could not fully analyze features"],
        details: { error: error.message },
      };
    }
  }

  /**
   * 1. SFAM Hash Comparison (Primary Signal)
   * Hamming distance between current and baseline hash
   */
  _calculateSFAMAnomalyScore(sfamOutput, baselineFeatures) {
    if (!sfamOutput || sfamOutput.hamming_distance === undefined) {
      return 0.5; // Default to medium anomaly if data missing
    }

    const hammingDist = sfamOutput.hamming_distance;

    // Normalize Hamming distance to 0-1 range
    // 0 = identical, 1 = completely opposite
    return Math.min(hammingDist, 1.0);
  }

  /**
   * 2. Feature-Level Anomalies
   * Z-score analysis on each feature domain
   */
  _calculateFeatureAnomalies(currentFeatures, baselineFeatures) {
    const anomalies = {
      gesture: 0,
      typing: 0,
      touch: 0,
      session: 0,
    };

    // Gesture anomalies
    if (
      baselineFeatures &&
      baselineFeatures.feature_baseline &&
      currentFeatures.gesture_velocity !== undefined
    ) {
      const baseline = baselineFeatures.feature_baseline;
      const zScore = Math.abs(
        (currentFeatures.gesture_velocity - baseline.gesture_velocity_mean) /
          (baseline.gesture_velocity_std || 1),
      );
      anomalies.gesture = Math.min(zScore / 3, 1.0); // Normalize: 3σ = 1.0
    }

    // Typing anomalies
    if (
      baselineFeatures &&
      baselineFeatures.feature_baseline &&
      currentFeatures.typing_dwell_time !== undefined
    ) {
      const baseline = baselineFeatures.feature_baseline;
      const zScore = Math.abs(
        (currentFeatures.typing_dwell_time - baseline.typing_dwell_time_mean) /
          (baseline.typing_dwell_time_std || 1),
      );
      anomalies.typing = Math.min(zScore / 3, 1.0);
    }

    // Touch anomalies
    if (currentFeatures.touch_pressure !== undefined) {
      // If baseline has touch data, compare
      if (
        baselineFeatures &&
        baselineFeatures.feature_baseline?.touch_pressure_mean
      ) {
        const baseline = baselineFeatures.feature_baseline;
        const zScore = Math.abs(
          (currentFeatures.touch_pressure - baseline.touch_pressure_mean) /
            (baseline.touch_pressure_std || 1),
        );
        anomalies.touch = Math.min(zScore / 3, 1.0);
      }
    }

    // Session anomalies
    if (currentFeatures.session_time !== undefined) {
      // Check for time-of-day anomaly
      const currentHour = new Date(
        currentFeatures.session_timestamp,
      ).getHours();
      if (
        baselineFeatures &&
        baselineFeatures.feature_baseline?.session_time_distribution
      ) {
        const baseline = baselineFeatures.feature_baseline;
        const expectedFreq =
          baseline.session_time_distribution[currentHour] || 0;
        // If user never logs in at this hour, anomaly score increases
        anomalies.session = expectedFreq === 0 ? 0.5 : 0;
      }
    }

    return anomalies;
  }

  /**
   * 3. Temporal Pattern Analysis
   * Detect gradual drift vs. sudden attacks
   */
  _analyzeTemporalPatterns(currentFeatures, sessionHistory = []) {
    if (!sessionHistory || sessionHistory.length === 0) {
      return 0; // No history, can't analyze trend
    }

    try {
      // Look at last few sessions
      const recentSessions = sessionHistory.slice(-5);
      const anomalyScores = recentSessions.map((s) => s.anomaly_score || 0);

      // Sudden spike: current anomaly >> average of recent
      const avgRecent =
        anomalyScores.reduce((a, b) => a + b, 0) / anomalyScores.length;
      if (currentFeatures.anomaly_score > avgRecent + 0.2) {
        return 0.7; // High temporal anomaly (sudden spike)
      }

      // Gradual drift: trending upward
      if (anomalyScores.length >= 3) {
        const trend = anomalyScores[2] - anomalyScores[0];
        if (trend > 0.1) {
          return 0.3; // Medium (drifting)
        }
      }

      return 0; // Low or no anomaly
    } catch (error) {
      console.warn("⚠️  Temporal analysis error:", error.message);
      return 0;
    }
  }

  /**
   * 4. Adversarial Detection
   * Check for "copy attack" signatures
   */
  _detectAdversarialPatterns(currentFeatures, baselineFeatures) {
    const signals = [];

    // Check for jitter patterns (synthesized gesture vs natural)
    if (currentFeatures.gesture_jerk_mean !== undefined) {
      const jerk = currentFeatures.gesture_jerk_mean;
      if (jerk > 2.0) {
        signals.push("high_jitter_synthetic_motion");
      }
    }

    // Check for pressure curve anomalies
    if (
      currentFeatures.touch_pressure &&
      Array.isArray(currentFeatures.touch_pressure)
    ) {
      const variance = this._calculateVariance(currentFeatures.touch_pressure);
      if (variance < 0.01) {
        signals.push("uniform_pressure_suspicious");
      }
    }

    // Check for missing natural hesitations
    if (
      currentFeatures.gesture_duration &&
      currentFeatures.gesture_duration < 100
    ) {
      signals.push("unusually_fast_execution");
    }

    return signals;
  }

  /**
   * Combine anomaly scores into single metric
   */
  _combineAnomalyScores(anomalies) {
    // Weighted average: primary signal is most important
    const weights = {
      primary: 0.6,
      secondary: 0.3,
      temporal: 0.1,
    };

    const scored =
      anomalies.primary * weights.primary +
      anomalies.secondary * weights.secondary +
      anomalies.temporal * weights.temporal;

    return Math.min(scored, 1.0);
  }

  /**
   * Assess confidence level based on anomaly score
   */
  _assessConfidence(anomalyScore) {
    if (anomalyScore < this.highConfidenceThreshold) {
      return "high";
    }
    if (anomalyScore < this.mediumConfidenceThreshold) {
      return "medium";
    }
    if (anomalyScore < this.lowConfidenceThreshold) {
      return "low";
    }
    return "anomalous";
  }

  /**
   * Determine trend from session history
   */
  _determineTrend(sessionHistory = []) {
    if (!sessionHistory || sessionHistory.length < 3) {
      return "insufficient_data";
    }

    const recent = sessionHistory.slice(-3);
    const scores = recent.map((s) => s.anomaly_score || 0);
    const avg = scores.reduce((a, b) => a + b) / scores.length;

    const isSpike = scores[scores.length - 1] > avg + 0.2;
    const isDrift = scores[scores.length - 1] > scores[0] + 0.1;

    if (isSpike) return "spiking";
    if (isDrift) return "drifting";
    return "stable";
  }

  /**
   * Summarize detected anomalies
   */
  _summarizeAnomalies(featureAnomalies, adversarialSignals) {
    const summary = [];

    if (featureAnomalies.gesture > 0.5) {
      summary.push("gesture_anomaly_detected");
    }
    if (featureAnomalies.typing > 0.5) {
      summary.push("typing_rhythm_anomaly");
    }
    if (featureAnomalies.touch > 0.5) {
      summary.push("touch_dynamics_anomaly");
    }
    if (featureAnomalies.session > 0.3) {
      summary.push("session_context_anomaly");
    }

    return [...summary, ...adversarialSignals];
  }

  /**
   * Generate detailed alert messages
   */
  _generateAlerts(featureAnomalies, adversarialSignals) {
    const alerts = [];

    if (featureAnomalies.gesture > 0.7) {
      alerts.push("Gesture speed/pattern significantly different");
    }
    if (featureAnomalies.typing > 0.7) {
      alerts.push("Typing rhythm changed from baseline");
    }
    if (featureAnomalies.touch > 0.5) {
      alerts.push("Touch pressure or area characteristics different");
    }
    if (featureAnomalies.session > 0.4) {
      alerts.push("Session occurring at unusual time/location");
    }

    adversarialSignals.forEach((signal) => {
      if (signal.includes("jitter")) {
        alerts.push("Gesture shows signs of artificial tremor");
      }
      if (signal.includes("pressure")) {
        alerts.push("Pressure curve appears unnatural");
      }
      if (signal.includes("fast")) {
        alerts.push("Gesture executed faster than baseline");
      }
    });

    return alerts;
  }

  /**
   * Helper: Calculate variance of array
   */
  _calculateVariance(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return 0;
    const mean = arr.reduce((a, b) => a + b) / arr.length;
    const variance =
      arr.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / arr.length;
    return variance;
  }

  /**
   * Null report for when RLFS is disabled
   */
  _createNullAnomalyReport() {
    return {
      anomaly_score: 0,
      confidence: "high",
      feature_breakdown: { gesture: 0, typing: 0, touch: 0, session: 0 },
      temporal_trend: "N/A",
      is_first_use: false,
      detected_anomalies: [],
      feature_alerts: ["RLFS disabled"],
    };
  }
}

export const rlfsModule = new RLFSModule();
export default rlfsModule;
