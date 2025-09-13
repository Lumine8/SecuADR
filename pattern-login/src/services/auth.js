import axios from "axios";

// FIXED: Use correct port 3000 for API server
const API_BASE_URL = "http://localhost:3000/api/v1";
const API_KEY = "demo";

class AuthService {
  // Quick authentication using the new API
  static async quickAuthenticate(gestureData) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/quick-auth`,
        {
          gestureData: gestureData.map((point) => ({
            x: Math.round(point.x || point.X || 0),
            y: Math.round(point.y || point.Y || 0),
            timestamp: point.timestamp || Date.now(),
          })),
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Auth Service Error:", error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Full authentication with user management
  static async authenticate(userId, gestureData, metadata = {}) {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/auth/authenticate`,
        {
          userId,
          gestureData: gestureData.map((point) => ({
            x: Math.round(point.x || point.X || 0),
            y: Math.round(point.y || point.Y || 0),
            timestamp: point.timestamp || Date.now(),
          })),
          metadata: {
            platform: "web",
            deviceType: "desktop",
            ...metadata,
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
            "X-API-Key": API_KEY,
          },
        }
      );

      return response.data;
    } catch (error) {
      console.error("Auth Service Error:", error);
      throw new Error(`Authentication failed: ${error.message}`);
    }
  }

  // Check API health
  static async checkHealth() {
    try {
      const response = await axios.get(`${API_BASE_URL}/health`, {
        headers: { "X-API-Key": API_KEY },
      });
      return response.data;
    } catch (error) {
      console.error("Health Check Error:", error);
      return { status: "unhealthy", error: error.message };
    }
  }
}

export default AuthService;
