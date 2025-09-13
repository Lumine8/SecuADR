const mongoose = require("mongoose");

const UserAdaptiveProfileSchema = new mongoose.Schema({
  username: String,
  adaptiveMetrics: {
    avgCnnScore: { type: Number, default: 0.7 },
    avgDollarScore: { type: Number, default: 0.7 },
    successRate: { type: Number, default: 0.8 },
    totalAttempts: { type: Number, default: 0 },
    personalThresholds: {
      cnn: { type: Number, default: 0.75 },
      dollar: { type: Number, default: 0.8 },
      hybrid: { type: Number, default: 0.7 },
    },
    contextAwareness: {
      timeOfDayPerformance: { type: Map, default: new Map() },
      devicePerformance: { type: Map, default: new Map() },
      drawingSpeedOptimal: { type: Number, default: 100 },
    },
  },
  lastUpdated: { type: Date, default: Date.now },
});

class AdaptiveLearner {
  static async updateUserProfile(username, authData) {
    let profile =
      (await UserAdaptiveProfile.findOne({ username })) ||
      new UserAdaptiveProfile({ username });

    // Update rolling averages
    const alpha = 0.1; // Learning rate
    profile.adaptiveMetrics.avgCnnScore =
      alpha * authData.cnnScore +
      (1 - alpha) * profile.adaptiveMetrics.avgCnnScore;
    profile.adaptiveMetrics.avgDollarScore =
      alpha * authData.dollarScore +
      (1 - alpha) * profile.adaptiveMetrics.avgDollarScore;

    // Adaptive threshold adjustment
    if (authData.success) {
      profile.adaptiveMetrics.personalThresholds.cnn *= 0.99; // Gradually lower
      profile.adaptiveMetrics.personalThresholds.dollar *= 0.99;
    } else if (profile.adaptiveMetrics.successRate < 0.5) {
      profile.adaptiveMetrics.personalThresholds.cnn *= 1.01; // Gradually raise
    }

    await profile.save();
    return profile;
  }

  static async getPersonalizedThresholds(username, context) {
    const profile = await UserAdaptiveProfile.findOne({ username });
    if (!profile) return { cnn: 0.75, dollar: 0.8, hybrid: 0.7 };

    let thresholds = { ...profile.adaptiveMetrics.personalThresholds };

    // Context-based adjustments
    const hour = new Date().getHours();
    if (hour >= 22 || hour <= 6) thresholds.hybrid -= 0.05; // Night leniency
    if (context.knownDevice) thresholds.hybrid -= 0.03; // Device trust

    return thresholds;
  }
}

module.exports = AdaptiveLearner;
