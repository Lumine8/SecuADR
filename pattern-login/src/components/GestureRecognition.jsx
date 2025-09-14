import React, { useState, useEffect } from "react";
import axios from "axios";

const GestureRecognition = ({ username, onPatternComplete }) => {
  const [feedback, setFeedback] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [cnnStatus, setCnnStatus] = useState("checking");

  // Check CNN status on component mount
  useEffect(() => {
    const checkCNNStatus = async () => {
      try {
        const response = await axios.get(
          "http://localhost:5000/api/cnn-status"
        );
        if (
          response.data.success &&
          response.data.currentMode === "cnn_leading_adaptive_ai"
        ) {
          setCnnStatus("available");
          console.log("🧠 GestureRecognition: CNN AI engine available");
        } else {
          setCnnStatus("fallback");
          console.log("⚠️ GestureRecognition: Using fallback mode");
        }
      } catch (error) {
        console.error("❌ GestureRecognition: CNN status check failed:", error);
        setCnnStatus("offline");
      }
    };

    checkCNNStatus();
  }, []);

  const handlePatternComplete = async (points) => {
    setIsProcessing(true);

    const processingMessage =
      cnnStatus === "available"
        ? "🤖 Processing with CNN AI engine..."
        : "🔍 Processing with pattern recognition...";

    setFeedback(processingMessage);

    try {
      const payload = {
        username: username || "user",
        pattern: points.map((p) => ({
          X: p.x || p.X,
          Y: p.y || p.Y,
          ID: p.id || p.ID || 0,
        })),
      };

      console.log("🔍 Sending gesture data:", payload);

      // Use the main authentication endpoint instead of direct CNN predict
      const response = await axios.post(
        "http://localhost:5000/api/authenticate",
        payload
      );

      console.log("🔍 Authentication Response:", response.data);

      if (
        response.data &&
        response.data.success &&
        response.data.authenticated
      ) {
        const confidence = (response.data.confidence * 100).toFixed(1);
        const method = response.data.method || "Pattern Recognition";
        setFeedback(
          `✅ Authentication successful! ${method} - Confidence: ${confidence}%`
        );

        if (onPatternComplete) {
          onPatternComplete({
            success: true,
            confidence: response.data.confidence,
            method: response.data.method,
            authenticated: true,
          });
        }
      } else {
        const errorMessage =
          response.data.message || "Pattern not recognized. Please try again.";
        setFeedback(`❌ Authentication failed. ${errorMessage}`);

        if (onPatternComplete) {
          onPatternComplete({
            success: false,
            authenticated: false,
            message: errorMessage,
          });
        }
      }
    } catch (error) {
      console.error("❌ Authentication error:", error);
      const errorMessage =
        error.response?.data?.message ||
        "Connection error. Please check your connection.";
      setFeedback(`❌ ${errorMessage}`);

      if (onPatternComplete) {
        onPatternComplete({
          success: false,
          authenticated: false,
          error: errorMessage,
        });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // FIXED: Don't render PatternCanvas - just provide gesture recognition logic
  // This eliminates the double canvas issue
  return (
    <div className='gesture-recognition-service' style={{ display: "none" }}>
      {/* This component now only provides gesture recognition functionality */}
      {/* No visual canvas rendering - PatternCanvas handles that */}

      {/* Hidden status indicator for debugging */}
      <div className='hidden-status' data-cnn-status={cnnStatus}>
        CNN Status: {cnnStatus}
      </div>

      {/* CSS for spinner animation */}
      <style jsx>{`
        @keyframes spin {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }
      `}</style>
    </div>
  );
};

// Alternative: Pure service version (recommended)
const GestureRecognitionService = {
  async authenticatePattern(username, points) {
    try {
      const payload = {
        username: username || "user",
        pattern: points.map((p) => ({
          X: p.x || p.X,
          Y: p.y || p.Y,
          ID: p.id || p.ID || 0,
        })),
      };

      console.log("🔍 GestureRecognitionService: Authenticating pattern");

      const response = await axios.post(
        "http://localhost:5000/api/authenticate",
        payload
      );

      if (
        response.data &&
        response.data.success &&
        response.data.authenticated
      ) {
        return {
          success: true,
          confidence: response.data.confidence,
          method: response.data.method,
          authenticated: true,
        };
      } else {
        return {
          success: false,
          authenticated: false,
          message: response.data.message || "Authentication failed",
        };
      }
    } catch (error) {
      console.error(
        "❌ GestureRecognitionService: Authentication error:",
        error
      );
      return {
        success: false,
        authenticated: false,
        error: error.response?.data?.message || "Connection error",
      };
    }
  },

  async checkCNNStatus() {
    try {
      const response = await axios.get("http://localhost:5000/api/cnn-status");
      return {
        available:
          response.data.success &&
          response.data.currentMode === "cnn_leading_adaptive_ai",
        status: response.data.currentMode || "unknown",
        data: response.data,
      };
    } catch (error) {
      console.error(
        "❌ GestureRecognitionService: Status check failed:",
        error
      );
      return {
        available: false,
        status: "offline",
        error: error.message,
      };
    }
  },
};

// Export both the component and service
export default GestureRecognition;
export { GestureRecognitionService };
