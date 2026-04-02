/**
 * Behavioral Model Layer Service
 * Handles user profile building, baseline management, and feature storage
 */

import BehavioralProfile from "../models/BehavioralProfile.js";
import User from "../models/User.js";

class BehavioralModelService {
  /**
   * Load user's behavioral profile
   */
  async loadUserProfile(user_id) {
    try {
      const profile = await BehavioralProfile.findOne({ user_id });
      if (!profile) {
        console.warn(`⚠️  No behavioral profile found for user ${user_id}`);
        return null;
      }
      return profile.toObject();
    } catch (error) {
      console.error("❌ Error loading behavioral profile:", error);
      return null;
    }
  }

  /**
   * Create new behavioral profile during enrollment
   */
  async createProfile(user_id, sfamOutput, extractedFeatures) {
    try {
      const profile = new BehavioralProfile({
        user_id,
        sfam_hash: Buffer.from(sfamOutput.sfam_hash || []),
        sfam_hash_continuous: sfamOutput.sfam_hash_continuous || [],
        sfam_salt: sfamOutput.sfam_salt || "",
        sfam_seed: sfamOutput.sfam_seed || 0,
        feature_baseline: {
          gesture_velocity_mean: extractedFeatures?.gesture?.velocity_mean || 0,
          gesture_velocity_std: extractedFeatures?.gesture?.velocity_std || 0,
          gesture_acceleration_mean:
            extractedFeatures?.gesture?.acceleration_mean || 0,
          gesture_acceleration_std:
            extractedFeatures?.gesture?.acceleration_std || 0,
          gesture_jerk_mean: extractedFeatures?.gesture?.jerk_mean || 0,
          gesture_jerk_std: extractedFeatures?.gesture?.jerk_std || 0,
          typing_dwell_time_mean:
            extractedFeatures?.typing?.dwell_time_mean || 0,
          typing_dwell_time_std: extractedFeatures?.typing?.dwell_time_std || 0,
          typing_flight_time_mean:
            extractedFeatures?.typing?.flight_time_mean || 0,
          typing_flight_time_std:
            extractedFeatures?.typing?.flight_time_std || 0,
          touch_pressure_mean: extractedFeatures?.touch?.pressure_mean || 0,
          touch_pressure_std: extractedFeatures?.touch?.pressure_std || 0,
          touch_area_mean: extractedFeatures?.touch?.area_mean || 0,
          touch_area_std: extractedFeatures?.touch?.area_std || 0,
          session_time_distribution: Array(24).fill(1),
          session_location_baseline: "unknown",
        },
        stats: {
          total_enrollments: 1,
          total_authentications: 0,
          successful_authentications: 0,
          false_rejections_count: 0,
          false_acceptance_count: 0,
        },
      });

      await profile.save();
      console.log(`✅ Behavioral profile created for user ${user_id}`);
      return profile.toObject();
    } catch (error) {
      console.error("❌ Error creating behavioral profile:", error);
      throw error;
    }
  }

  /**
   * Update profile with new authentication data
   */
  async updateProfileWithSession(user_id, sessionData, isSuccessful = true) {
    try {
      const profile = await BehavioralProfile.findOne({ user_id });
      if (!profile) {
        console.warn(`⚠️  Profile not found for user ${user_id}`);
        return null;
      }

      // Add to feature history (keep last 50)
      const featureEntry = {
        timestamp: new Date(),
        features: sessionData.extracted_features || {},
        session_id: sessionData.session_id,
        source: "authentication",
      };

      if (!profile.feature_history) profile.feature_history = [];
      profile.feature_history.push(featureEntry);
      if (profile.feature_history.length > 50) {
        profile.feature_history = profile.feature_history.slice(-50);
      }

      // Update statistics
      profile.stats.total_authentications += 1;
      if (isSuccessful) {
        profile.stats.successful_authentications += 1;
      } else {
        profile.stats.false_rejections_count += 1;
      }

      profile.last_updated = new Date();

      await profile.save();
      console.log(`✅ Profile updated for user ${user_id}`);
      return profile.toObject();
    } catch (error) {
      console.error("❌ Error updating profile:", error);
      return null;
    }
  }

  /**
   * Get user metadata
   */
  async getUserMetadata(user_id) {
    try {
      const user = await User.findById(user_id);
      if (!user) {
        return null;
      }
      return {
        user_id: user._id,
        username: user.username,
        email: user.email,
        enrollment_status: user.enrollment_status,
        enrolled_at: user.enrolled_at,
        last_login_at: user.lastLoginAt,
      };
    } catch (error) {
      console.error("❌ Error fetching user metadata:", error);
      return null;
    }
  }

  /**
   * Update user last login
   */
  async updateLastLogin(user_id) {
    try {
      await User.findByIdAndUpdate(user_id, { lastLoginAt: new Date() });
    } catch (error) {
      console.error("⚠️  Error updating last login:", error);
    }
  }

  /**
   * Mark user as enrolled
   */
  async markAsEnrolled(user_id) {
    try {
      await User.findByIdAndUpdate(user_id, {
        enrollment_status: "enrolled",
        enrolled_at: new Date(),
      });
      console.log(`✅ User ${user_id} marked as enrolled`);
    } catch (error) {
      console.error("❌ Error marking user as enrolled:", error);
    }
  }
}

export const behavioralModelService = new BehavioralModelService();
export default behavioralModelService;
