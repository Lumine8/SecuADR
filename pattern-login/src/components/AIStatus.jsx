import React, { useState, useEffect } from "react";
import axios from "axios";

const AIStatus = () => {
  const [status, setStatus] = useState("Checking AI engine status...");
  const [lastCheck, setLastCheck] = useState("Never");
  const [isConnected, setIsConnected] = useState(false);

  const checkStatus = async () => {
    try {
      console.log("🔍 AIStatus: Checking backend...");

      // FIXED: Use correct port 3000 and endpoint /api/v1/health
      const response = await axios.get("http://localhost:3000/api/v1/health", {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        timeout: 5000,
      });

      console.log("🔍 AIStatus: Response:", response.data);

      const data = response.data;

      // Check for your exact API response format
      if (data.status === "healthy" && data.ai_engine === "CNN Model Leading") {
        setStatus("🧠 AI Engine: ✅ CNN Model Leading Adaptive AI Engine");
        setIsConnected(true);
        console.log("✅ AIStatus: CNN detected and active");
      } else {
        setStatus(
          "🧠 AI Engine: ⚠️ $1 Recognizer Only (Adaptive AI Unavailable)"
        );
        setIsConnected(false);
        console.log("⚠️ AIStatus: CNN not detected, fallback mode");
      }

      setLastCheck(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("❌ AIStatus Error:", error);
      setStatus("❌ AI Engine: Connection Error - Check API Server");
      setIsConnected(false);
      setLastCheck(new Date().toLocaleTimeString() + " (ERROR)");
    }
  };

  useEffect(() => {
    console.log("🚀 AIStatus: Component mounted");
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div
      style={{
        padding: "16px",
        border: "3px solid " + (isConnected ? "#10b981" : "#ef4444"),
        borderRadius: "10px",
        backgroundColor: "#f9fafb",
        marginBottom: "20px",
        fontWeight: "bold",
        transition: "all 0.3s ease",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          marginBottom: "10px",
          color: isConnected ? "#10b981" : "#ef4444",
        }}
      >
        {status}
      </div>

      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        Last check: {lastCheck} | Connected: {isConnected ? "✅" : "❌"}
      </div>

      <button
        onClick={() => {
          console.log("🔄 Manual refresh triggered");
          checkStatus();
        }}
        style={{
          padding: "8px 16px",
          backgroundColor: "#3b82f6",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          fontSize: "14px",
        }}
      >
        🔄 Force Refresh
      </button>
    </div>
  );
};

export default AIStatus;
