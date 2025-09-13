const mongoose = require("mongoose");

// 📊 User authentication analytics
const UserProfileSchema = new mongoose.Schema({
  username: String,
  avgAccuracy: { type: Number, default: 0.85 },
  totalAttempts: { type: Number, default: 0 },
  successRate: { type: Number, default: 0.85 },
  weights: {
    cnn: { type: Number, default: 0.4 },
    dollar: { type: Number, default: 0.3 },
    behavioral: { type: Number, default: 0.15 },
    temporal: { type: Number, default: 0.1 },
    device: { type: Number, default: 0.05 },
  },
  primaryDevice: String,
  createdAt: { type: Date, default: Date.now },
  lastUpdated: { type: Date, default: Date.now },
});

const UserProfile = mongoose.model("UserProfile", UserProfileSchema);

class AuthAnalytics {
  static async getUserProfile(username) {
    let profile = await UserProfile.findOne({ username });

    if (!profile) {
      profile = new UserProfile({ username });
      await profile.save();
    }

    return profile;
  }

  static async updateUserProfile(username, authData) {
    const profile = await this.getUserProfile(username);

    // 📈 Update success rate
    profile.totalAttempts += 1;
    if (authData.result) {
      profile.successRate =
        (profile.successRate * (profile.totalAttempts - 1) + 1) /
        profile.totalAttempts;
    } else {
      profile.successRate =
        (profile.successRate * (profile.totalAttempts - 1)) /
        profile.totalAttempts;
    }

    // 🧠 Adaptive weight learning
    if (authData.result && authData.scores.cnn > 0.9) {
      profile.weights.cnn = Math.min(0.5, profile.weights.cnn + 0.01);
    }

    if (authData.result && authData.scores.dollar > 0.92) {
      profile.weights.dollar = Math.min(0.4, profile.weights.dollar + 0.01);
    }

    profile.lastUpdated = Date.now();
    await profile.save();

    return profile;
  }
}

module.exports = AuthAnalytics;
