import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import { enrollSFAM, checkSFAMHealth } from "../utils/sfamClient.js";

const router = express.Router();

/**
 * POST /enroll/sfam
 *
 * Enrolls a user's gesture pattern with SFAM
 * Creates a cancelable biometric template (hash + seed + salt)
 *
 * Request body:
 * {
 *   username: string,
 *   pattern: [{X: number, Y: number, ID: number}, ...],  // Raw gesture points
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message: string,
 *   enrolledAt: string (ISO timestamp)
 * }
 */
router.post("/", async (req, res) => {
  try {
    // 1. EXTRACT PAYLOAD
    const { username, pattern } = req.body;

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

    console.log(`📝 SFAM enrollment request for user: ${username}`);

    if (mongoose.connection.readyState !== 1) {
      return res.status(503).json({
        success: false,
        message: "Database unavailable. Enrollment cannot proceed.",
      });
    }

    // 3. CHECK SFAM SERVICE HEALTH
    const isSfamUp = await checkSFAMHealth();
    if (!isSfamUp) {
      return res.status(503).json({
        success: false,
        message: "SFAM service unavailable. Enrollment cannot proceed.",
      });
    }

    // 4. FETCH OR CREATE USER
    let user = await User.findOne({ username });
    if (!user) {
      user = await User.create({
        username,
        enrollment_status: "pending",
      });
      console.log(`👤 Created new user record for enrollment: ${username}`);
    }

    // 5. PREVENT RE-ENROLLMENT
    if (user.sfam && user.sfam.hash && user.sfam.hash.length > 0) {
      return res.status(409).json({
        success: false,
        message:
          "User is already enrolled in SFAM. Use a different gesture pattern to re-enroll.",
      });
    }

    console.log(`🔐 Enrolling user ${username} with SFAM...`);

    // 6. CALL SFAM PYTHON SERVICE WITH RAW GESTURE POINTS
    // The enrollSFAM function will transform the raw points via transformGestureToSFAM()
    const sfamResponse = await enrollSFAM({
      points: pattern, // Raw gesture points - will be transformed by sfamClient
    });

    /**
     * Expected SFAM response:
     * {
     *   sfam_hash: number[],        // 256-bit hash
     *   seed: number,               // Random seed for this user
     *   salt: string,               // Salt for re-enrollment
     *   confidence: number          // Enrollment confidence
     * }
     */
    const {
      sfam_hash,
      sfam_seed,
      sfam_salt,
      confidence,
      stats,
      shape_signature,
    } = sfamResponse;

    if (!sfam_hash) {
      throw new Error("SFAM enrollment did not return a valid hash");
    }

    console.log(
      `✅ SFAM hash generated (length: ${sfam_hash.length}, confidence: ${confidence?.toFixed(3) || "N/A"})`,
    );

    // 7. STORE CANCELABLE BIOMETRIC TEMPLATE IN DATABASE
    user.sfam = {
      hash: sfam_hash,
      seed: sfam_seed,
      salt: sfam_salt,
      enrolledAt: new Date(),
      confidence: confidence || 0,
      enrollmentStats: stats,
      shapeSignature: shape_signature,
    };

    await user.save();

    console.log(`✅ User ${username} enrolled in SFAM database`);

    // 8. RESPONSE (NO RAW BIOMETRIC DATA IS LEAKED)
    return res.status(200).json({
      success: true,
      message: "SFAM enrollment successful",
      enrolledAt: user.sfam.enrolledAt,
      userId: user._id,
    });
  } catch (error) {
    console.error(`❌ SFAM Enrollment Error: ${error.message}`);
    console.error(error.stack);

    return res.status(500).json({
      success: false,
      message: "SFAM enrollment failed",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
});

export default router;
