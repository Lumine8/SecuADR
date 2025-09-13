import React, { useState } from "react";
import axios from "axios";
import PatternCanvas from "./PatternCanvas";

const GestureRecognition = ({ username, onPatternComplete }) => {
  const [feedback, setFeedback] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePatternComplete = async (points) => {
    setIsProcessing(true);
    setFeedback("🤖 Processing with CNN AI engine...");

    try {
      const payload = {
        username: username || "user",
        gestureData: points.map((p) => ({ X: p.x, Y: p.y, ID: p.id || 0 })),
      };

      console.log("🔍 Sending gesture data to CNN:", payload);

      const response = await axios.post("/api/cnn-predict", payload);

      console.log("🔍 CNN Response:", response.data);

      if (response.data && response.data.success) {
        const confidence = (response.data.confidence * 100).toFixed(1);
        const method = response.data.method || "CNN";
        setFeedback(
          `✅ Authentication successful! ${method} Confidence: ${confidence}%`
        );

        if (onPatternComplete) {
          onPatternComplete({
            success: true,
            confidence: response.data.confidence,
            method: response.data.method,
          });
        }
      } else {
        setFeedback("❌ Authentication failed. Please try again.");

        if (onPatternComplete) {
          onPatternComplete({ success: false });
        }
      }
    } catch (error) {
      console.error("❌ Authentication error:", error);
      setFeedback("❌ Connection error. Please check your connection.");

      if (onPatternComplete) {
        onPatternComplete({ success: false, error: "Connection error" });
      }
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className='gesture-recognition'>
      <div className='canvas-container'>
        <PatternCanvas onPatternComplete={handlePatternComplete} />
        <div className='instructions'>
          <p>🖊️ Draw your gesture pattern on the canvas above</p>
          <p style={{ fontSize: "12px", color: "#6b7280" }}>
            Your pattern will be processed by the CNN AI engine
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`feedback ${
            feedback.includes("✅") ? "success" : "error"
          }`}
          style={{
            padding: "12px",
            borderRadius: "6px",
            marginTop: "16px",
            fontWeight: "500",
            backgroundColor: feedback.includes("✅") ? "#dcfce7" : "#fef2f2",
            color: feedback.includes("✅") ? "#166534" : "#dc2626",
            border: feedback.includes("✅")
              ? "1px solid #bbf7d0"
              : "1px solid #fecaca",
          }}
        >
          {feedback}
        </div>
      )}

      {isProcessing && (
        <div
          className='processing'
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "12px",
            marginTop: "16px",
            color: "#6b7280",
            fontSize: "14px",
          }}
        >
          <div
            className='spinner'
            style={{
              width: "16px",
              height: "16px",
              border: "2px solid #e5e7eb",
              borderTop: "2px solid #3b82f6",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
            }}
          ></div>
          <span>🧠 CNN AI engine processing...</span>
        </div>
      )}
    </div>
  );
};

export default GestureRecognition;
