const axios = require("axios");

// SFAM FastAPI base URL
const SFAM_BASE_URL = "http://127.0.0.1:8000";

/**
 * Quick Health Check
 * Pings the SFAM service to see if it's reachable.
 */
async function checkSFAMHealth() {
  try {
    // We send a tiny valid payload to /sfam/verify that we expect to fail auth
    // but pass network/schema validation. This confirms the engine is up.
    await axios.post(
      `${SFAM_BASE_URL}/sfam/verify`,
      {
        spatial: [[0]],
        behavioral: [0, 0, 0, 0, 0, 0],
        reference: { sfam_hash: [1], seed: 1, salt: "health_check" },
      },
      { timeout: 2000 },
    );
    return true; // If we get a response (even 401/false), the server is UP.
  } catch (error) {
    // If connection refused or timeout, server is DOWN.
    return false;
  }
}

async function enrollSFAM(gestureData) {
  try {
    const response = await axios.post(
      `${SFAM_BASE_URL}/sfam/enroll`,
      gestureData,
      { timeout: 10000 },
    );
    return response.data;
  } catch (error) {
    console.error("SFAM enroll error:", error.message);
    throw new Error("SFAM enrollment failed");
  }
}

async function verifySFAM(gestureData, referenceData) {
  try {
    const response = await axios.post(
      `${SFAM_BASE_URL}/sfam/verify`,
      {
        ...gestureData,
        reference: referenceData,
      },
      { timeout: 10000 },
    );
    return response.data;
  } catch (error) {
    console.error("SFAM verify error:", error.message);
    throw new Error("SFAM verification failed");
  }
}

module.exports = {
  checkSFAMHealth, // <--- Exporting the new function
  enrollSFAM,
  verifySFAM,
};
