import axios from "axios";
import API_BASE_URL from "../config/api";

class AuthService {
  /**
   * Enroll a new user
   */
  static async enrollUser(userId, gestureData) {
    try {
      const formattedGesture = gestureData.map((point) => ({
        x: Math.round(point.x || point.X || 0),
        y: Math.round(point.y || point.Y || 0),
        timestamp: point.timestamp || Date.now(),
      }));

      const response = await axios.post(`${API_BASE_URL}/api/auth/enroll`, {
        user_id: userId,
        gesture: formattedGesture,
      });

      return {
        success: response.data.success,
        message: response.data.message,
        profile: response.data.profile,
      };
    } catch (error) {
      console.error("Enrollment error:", error);
      return {
        success: false,
        message: error.response?.data?.message || error.message,
        error: error.message,
      };
    }
  }

  /**
   * Authenticate user with gesture
   */
  static async authenticate(userId, gestureData, deviceContext = {}) {
    try {
      const formattedGesture = gestureData.map((point) => ({
        x: Math.round(point.x || point.X || 0),
        y: Math.round(point.y || point.Y || 0),
        timestamp: point.timestamp || Date.now(),
      }));

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/gesture`,
        {
          user_id: userId,
          gesture: formattedGesture,
          device_context: {
            is_new: deviceContext.is_new || false,
            location_is_new: deviceContext.location_is_new || false,
            is_after_hours: deviceContext.is_after_hours || false,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      return {
        success: response.data.success,
        decision: response.data.decision,
        risk_level: response.data.risk_level,
        confidence: response.data.confidence,
        token: response.data.token,
        message: response.data.message,
        requires_challenge: response.data.requires_challenge,
        challenge_method: response.data.challenge_method,
        session_id: response.data.session_id,
      };
    } catch (error) {
      console.error("Authentication error:", error);
      return {
        success: false,
        decision: "BLOCK",
        message: error.response?.data?.message || error.message,
        error: error.message,
      };
    }
  }

  /**
   * Check API health
   */
  static async checkHealth() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`);
      return {
        status: response.data.status,
        database: response.data.services?.database,
        timestamp: response.data.timestamp,
      };
    } catch (error) {
      console.error("Health check error:", error);
      return {
        status: "unavailable",
        error: error.message,
      };
    }
  }

  /**
   * Get session details for dashboard
   */
  static async getSessions(userId, limit = 50) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/dashboard/sessions`,
        {
          params: { user_id: userId, limit },
        },
      );
      return response.data;
    } catch (error) {
      console.error("Get sessions error:", error);
      return { sessions: [], error: error.message };
    }
  }

  static async analyzeBehavior(payload) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/api/trust/analyze`,
        payload,
      );
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }

  static async getTrustTimeline(username, limit = 30) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/trust/timeline/${username}`,
        {
          params: { limit },
        },
      );
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
        timeline: [],
      };
    }
  }

  static async getScenarioMock(scenario) {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/api/trust/mock/${scenario}`,
      );
      return response.data;
    } catch (error) {
      return {
        success: false,
        message: error.response?.data?.message || error.message,
      };
    }
  }
}

export default AuthService;
