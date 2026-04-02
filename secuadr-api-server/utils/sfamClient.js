import axios from "axios";
import config from "../config/config.js";
import { transformGestureToSFAM } from "./gestureFeatures.js";

/**
 * SFAM Client - Communicates with the Python SFAM service
 * Handles enrollment and verification of biometric hashes
 */

class SFAMClient {
  constructor() {
    this.baseURL = config.sfam.serviceUrl;
    this.timeout = config.sfam.timeoutMs;
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Check if SFAM service is healthy and reachable
   */
  async checkHealth() {
    try {
      const response = await this.client.get("/health", { timeout: 2000 });
      return response.status === 200;
    } catch (error) {
      const reason =
        error?.message ||
        error?.code ||
        (error?.response?.status
          ? `HTTP ${error.response.status}`
          : "unknown error");
      console.warn(
        `⚠️  SFAM health check failed (${this.baseURL}/health): ${reason}`,
      );
      return false;
    }
  }

  /**
   * Enroll a user's biometric features with SFAM
   * @param {Object} gestureData - Raw gesture input with points
   * @param {Array} gestureData.points - Gesture points {X, Y, ID}
   * @returns {Object} Enrollment data with hash, salt, seed
   */
  async enrollUser(gestureData) {
    try {
      console.log("📝 Enrolling user with SFAM...");

      // Transform raw gesture points to SFAM format (spatial + behavioral)
      const sfamFeatures = transformGestureToSFAM(gestureData.points || []);

      const response = await this.client.post("/sfam/enroll", {
        spatial: sfamFeatures.spatial,
        behavioral: sfamFeatures.behavioral,
        stats: sfamFeatures.stats,
        shape_signature: sfamFeatures.shape_signature,
      });

      if (!response.data) {
        throw new Error("Empty response from SFAM enroll");
      }

      return {
        sfam_hash: response.data.sfam_hash, // 256-bit array
        sfam_seed: response.data.seed,
        sfam_salt: response.data.salt,
        confidence: response.data.confidence || 1.0,
        stats: response.data.stats || sfamFeatures.stats,
        shape_signature:
          response.data.shape_signature || sfamFeatures.shape_signature,
        hash_distance: 0, // Baseline is distance 0 after enrollment
      };
    } catch (error) {
      console.error("❌ SFAM enrollment error:", error.message);
      throw new Error(`SFAM enrollment failed: ${error.message}`);
    }
  }

  /**
   * Verify a user's gesture against their baseline
   * @param {Object} gestureData - Current gesture input with points
   * @param {Array} gestureData.points - Gesture points {X, Y, ID}
   * @param {Object} baseline - User's baseline (sfam_hash, salt, seed)
   * @returns {Object} Verification result with hash distance and confidence
   */
  async verifyUser(gestureData, baseline) {
    try {
      console.log("🔍 Verifying user with SFAM...");

      if (!baseline || !baseline.sfam_hash) {
        throw new Error("No baseline hash provided for verification");
      }

      // Transform raw gesture points to SFAM format (spatial + behavioral)
      const sfamFeatures = transformGestureToSFAM(gestureData.points || []);

      const response = await this.client.post("/sfam/verify", {
        spatial: sfamFeatures.spatial,
        behavioral: sfamFeatures.behavioral,
        stats: sfamFeatures.stats,
        shape_signature: sfamFeatures.shape_signature,
        reference: {
          sfam_hash: baseline.sfam_hash,
          seed: baseline.sfam_seed,
          salt: baseline.sfam_salt,
          enrollment_stats: baseline.enrollment_stats,
          shape_signature: baseline.shape_signature,
        },
      });

      if (!response.data) {
        throw new Error("Empty response from SFAM verify");
      }

      return {
        hash_distance: response.data.hamming_distance || 0, // 0-1
        confidence: 1 - (response.data.hamming_distance || 0), // Convert distance to confidence
        is_match: response.data.auth_pass === true,
        reason: response.data.reason,
        metrics: response.data.metrics,
        possible_attack: response.data.possible_attack || null,
      };
    } catch (error) {
      console.error("❌ SFAM verification error:", error.message);
      // Don't throw - return a failed verification result instead
      return {
        hash_distance: 1.0, // Maximum distance
        confidence: 0,
        is_match: false,
        error: error.message,
      };
    }
  }

  /**
   * Get SFAM service version/status
   */
  async getStatus() {
    try {
      const response = await this.client.get("/version");
      return response.data;
    } catch (error) {
      console.warn("⚠️  Could not fetch SFAM version:", error.message);
      return { version: "unknown", status: "unavailable" };
    }
  }
}

// Export singleton instance
export const sfamClient = new SFAMClient();

// Export convenience functions that wrap the singleton
export const checkSFAMHealth = async () => sfamClient.checkHealth();
export const enrollSFAM = async (gestureData) =>
  sfamClient.enrollUser(gestureData);
export const verifySFAM = async (gestureData, baseline) =>
  sfamClient.verifyUser(gestureData, baseline);
export const getSFAMStatus = async () => sfamClient.getStatus();

export default sfamClient;
