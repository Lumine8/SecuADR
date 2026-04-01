const express = require("express");
const router = express.Router();
const User = require("../models/User");
const { enrollSFAM, checkSFAMHealth } = require("../utils/sfamClient");

/* ==========================================================================
   SFAM ENROLLMENT ROUTE
   Purpose:
   - Capture user's behavioral baseline
   - Generate cancelable biometric template
   - Store only hash + seed + salt (never raw gesture)
   ========================================================================== */
router.post("/", async (req, res) => {
  try {
    // 1. EXTRACT PAYLOAD
    const {
      username,
      gesture, // { spatial: [[x,y]...], behavioral: [v1,v2,v3,v4,v5,v6] }
    } = req.body;

    // 2. BASIC VALIDATION
    if (!username || !gesture) {
      return res.status(400).json({
        success: false,
        message: "Username and gesture data are required for SFAM enrollment",
      });
    }

    if (!gesture.spatial || !gesture.behavioral) {
      return res.status(400).json({
        success: false,
        message: "Invalid gesture payload: missing spatial or behavioral data",
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

    // 4. FETCH USER
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // 5. PREVENT RE-ENROLLMENT (IMPORTANT)
    if (user.sfam && user.sfam.hash && user.sfam.hash.length > 0) {
      return res.status(409).json({
        success: false,
        message: "User is already enrolled in SFAM",
      });
    }

    // 6. CALL SFAM PYTHON SERVICE (ENROLL)
    const sfamResponse = await enrollSFAM({
      spatial: gesture.spatial,
      behavioral: gesture.behavioral,
    });

    /**
     * Expected SFAM response:
     * {
     *   sfam_hash: number[],
     *   seed: number,
     *   salt: string
     * }
     */
    const { sfam_hash, seed, salt } = sfamResponse;

    if (!sfam_hash || !seed || !salt) {
      throw new Error("Invalid response from SFAM enrollment service");
    }

    // 7. STORE CANCELABLE BIOMETRIC TEMPLATE
    user.sfam = {
      hash: sfam_hash,
      seed,
      salt,
      enrolledAt: new Date(),
    };

    await user.save();

    console.log(`✅ SFAM enrollment successful for ${username}`);

    // 8. RESPONSE (NO BIOMETRIC DATA LEAKED)
    res.json({
      success: true,
      message: "SFAM enrollment successful",
      enrolledAt: user.sfam.enrolledAt,
    });
  } catch (error) {
    console.error("❌ SFAM Enrollment Error:", error);
    res.status(500).json({
      success: false,
      message: "SFAM enrollment failed",
    });
  }
});

module.exports = router;
