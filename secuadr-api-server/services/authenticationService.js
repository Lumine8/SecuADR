/**
 * Authentication Service - Orchestrates all 5 layers
 * Controls the full behavioral authentication pipeline
 */

import { sfamClient } from "../utils/sfamClient.js";
import inputLayerService from "./inputLayerService.js";
import behavioralModelService from "./behavioralModelService.js";
import rlfsModule from "../lib/rlfsModule.js";
import sadrModule from "../lib/sadrModule.js";
import { Session } from "../models/Session.js";
import { RiskLog } from "../models/RiskLog.js";
import jwt from "jsonwebtoken";
import config from "../config/config.js";

class AuthenticationService {
  /**
   * Main authentication endpoint
   * Processes gesture input through all 5 layers
   */
  async authenticateUser(user_id, clientInput, contextFactors = {}) {
    const startTime = Date.now();

    try {
      console.log(`🔐 Starting authentication for user: ${user_id}`);

      // ===== LAYER 1: INPUT LAYER =====
      console.log("📥 LAYER 1: Processing input...");
      const processedInput = inputLayerService.processAllInput(clientInput);

      // ===== LAYER 2: SFAM INTEGRATION =====
      console.log("🧠 LAYER 2: SFAM feature extraction...");
      const profile = await behavioralModelService.loadUserProfile(user_id);

      let sfamOutput;
      if (profile && profile.sfam_hash) {
        // Verification mode
        const sfamResult = await sfamClient.verifyUser(clientInput.gesture, {
          sfam_hash: profile.sfam_hash,
          sfam_seed: profile.sfam_seed,
          sfam_salt: profile.sfam_salt,
        });
        sfamOutput = sfamResult;
      } else {
        // New user - will use fallback
        sfamOutput = {
          sfam_hash: null,
          hash_distance: 0.5,
          confidence: 0.3,
          is_match: false,
        };
      }

      // ===== LAYER 3: BEHAVIORAL MODEL =====
      console.log("👤 LAYER 3: Building behavioral model...");
      const userMetadata =
        await behavioralModelService.getUserMetadata(user_id);
      const sessionHistory = profile?.feature_history || [];

      // ===== LAYER 4: RLFS - ANOMALY DETECTION =====
      console.log("🚨 LAYER 4: RLFS anomaly analysis...");
      const rlfsReport = rlfsModule.analyzeSession(
        {
          sfam_output: sfamOutput,
          gesture_velocity: processedInput.gesture.velocity_mean,
          gesture_jerk_mean: processedInput.gesture.jerk_mean,
          typing_dwell_time: processedInput.typing.dwell_time_mean,
          touch_pressure: processedInput.touch.pressure_mean,
          session_time: processedInput.session.timestamp,
          session_timestamp: processedInput.session.timestamp,
          anomaly_score: sfamOutput.hash_distance,
        },
        profile,
        sessionHistory,
      );

      // ===== LAYER 5: S-ADR - SECURITY DECISION =====
      console.log("⚖️  LAYER 5: S-ADR adaptive response...");
      const contextComplete = {
        ...contextFactors,
        recent_auth_failures: 0, // Default, would come from request rate checking
        device_is_new: contextFactors.device_is_new || false,
        location_is_new: contextFactors.location_is_new || false,
        is_after_hours: contextFactors.is_after_hours || false,
        system_security_state: "normal",
      };

      const securityDecision = sadrModule.makeSecurityDecision(
        rlfsReport,
        profile || {},
        contextComplete,
      );

      // ===== COMPOSE RESPONSE =====
      const processingTime = Date.now() - startTime;

      const authResponse = {
        success:
          securityDecision.decision === "ALLOW" ||
          securityDecision.decision === "ALLOW_WITH_WARNING",
        decision: securityDecision.decision,
        risk_level: securityDecision.risk_level,
        confidence: securityDecision.confidence,
        token: null,
        message: securityDecision.reason,
        requires_challenge: securityDecision.decision === "CHALLENGE",
        challenge_method:
          securityDecision.decision === "CHALLENGE" ? "email_otp" : null,
      };

      // Issue token if allowed
      if (
        securityDecision.decision === "ALLOW" ||
        securityDecision.decision === "ALLOW_WITH_WARNING"
      ) {
        authResponse.token = jwt.sign(
          { user_id, username: userMetadata?.username },
          config.jwt.secret,
          { expiresIn: config.jwt.expiresIn },
        );
      }

      // ===== SAVE SESSION TO DATABASE =====
      const session = new Session({
        user_id,
        timestamp: new Date(),
        input: {
          gesture: processedInput.gesture,
          typing: processedInput.typing,
          touch: processedInput.touch,
          session_context: processedInput.session,
        },
        sfam_output: sfamOutput,
        rlfs_output: rlfsReport,
        sadr_output: {
          decision: securityDecision.decision,
          risk_level: securityDecision.risk_level,
          confidence: securityDecision.confidence,
          adaptive_threshold: securityDecision.adaptive_threshold,
          reason: securityDecision.reason,
          recommended_action: securityDecision.recommended_action,
          trust_factors: securityDecision.trust_factors,
        },
        authentication: {
          status: authResponse.success
            ? "success"
            : securityDecision.decision === "CHALLENGE"
              ? "challenge_issued"
              : "failed",
          token: authResponse.token,
          challenge_method: authResponse.challenge_method,
          error_message: authResponse.success ? null : securityDecision.reason,
        },
        metadata: {
          api_version: "1.0",
          processing_time_total_ms: processingTime,
          sfam_service_healthy: sfamOutput.confidence > 0,
        },
      });

      await session.save();

      // Update user last login if successful
      if (authResponse.success) {
        await behavioralModelService.updateLastLogin(user_id);
        await behavioralModelService.updateProfileWithSession(
          user_id,
          {
            session_id: session._id,
            extracted_features: processedInput,
          },
          true,
        );
      }

      // Log significant events
      if (
        securityDecision.risk_level === "CRITICAL" ||
        securityDecision.decision === "BLOCK"
      ) {
        const riskLog = new RiskLog({
          user_id,
          session_id: session._id,
          event_type: "fraud_suspected",
          risk_indicators: {
            anomaly_score: rlfsReport.anomaly_score,
            trust_factors: securityDecision.trust_factors,
            feature_alerts: rlfsReport.feature_alerts,
          },
          action_taken: securityDecision.decision,
          severity: "critical",
        });
        await riskLog.save();
      }

      return { ...authResponse, session_id: session._id };
    } catch (error) {
      console.error("❌ Authentication error:", error);
      return {
        success: false,
        decision: "BLOCK",
        risk_level: "CRITICAL",
        confidence: 0,
        token: null,
        message: "Authentication processing failed. Please try again.",
        error: error.message,
      };
    }
  }

  /**
   * Enrollment endpoint
   */
  async enrollUser(user_id, clientInput) {
    try {
      console.log(`📝 Enrolling user: ${user_id}`);

      // Process input
      const processedInput = inputLayerService.processAllInput(clientInput);

      // Get SFAM hash
      const sfamOutput = await sfamClient.enrollUser(clientInput.gesture);

      // Create behavioral profile
      const profile = await behavioralModelService.createProfile(
        user_id,
        sfamOutput,
        processedInput,
      );

      // Mark user as enrolled
      await behavioralModelService.markAsEnrolled(user_id);

      return {
        success: true,
        message: "User enrolled successfully",
        profile: {
          user_id,
          enrollment_date: profile.enrollment_date,
          sfam_hash_distance: 0, // Baseline is 0
        },
      };
    } catch (error) {
      console.error("❌ Enrollment error:", error);
      return {
        success: false,
        message: "Enrollment failed",
        error: error.message,
      };
    }
  }
}

export const authenticationService = new AuthenticationService();
export default authenticationService;
