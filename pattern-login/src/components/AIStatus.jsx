import React, { useState, useEffect } from "react";
import axios from "axios";

const AIStatus = () => {
  const [status, setStatus] = useState("Checking AI engine status...");
  const [lastCheck, setLastCheck] = useState("Never");
  const [isConnected, setIsConnected] = useState(false);
  const [aiDetails, setAiDetails] = useState({});
  const [retryCount, setRetryCount] = useState(0);

  const checkStatus = async () => {
    try {
      console.log("🔍 AIStatus: Checking backend...");

      // FIXED: Use correct port 5000 and endpoint /api/cnn-status
      const response = await axios.get("http://localhost:5000/api/cnn-status", {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
        timeout: 8000, // Increased timeout
      });

      console.log("🔍 AIStatus: Response:", response.data);

      const data = response.data;

      // Check for your exact API response format based on server logs
      if (
        data.mode === "cnn_leading_adaptive_ai" &&
        data.available === "connected"
      ) {
        setStatus("🧠 AI Engine: ✅ CNN Model Leading Adaptive AI Engine");
        setIsConnected(true);
        setAiDetails({
          mode: data.mode,
          modelLoaded: data.modelLoaded,
          service: data.service || "CNN Service Active",
          type: data.type || "production",
        });
        setRetryCount(0);
        console.log("✅ AIStatus: CNN detected and active");
      } else if (data.available === "connected") {
        setStatus("🧠 AI Engine: ⚠️ Fallback Mode (CNN Loading or Mock Mode)");
        setIsConnected(true);
        setAiDetails({
          mode: data.mode || "fallback",
          modelLoaded: data.modelLoaded || false,
          service: data.service || "Fallback Service",
          type: data.type || "development",
        });
        setRetryCount(0);
        console.log("⚠️ AIStatus: Connected but in fallback/mock mode");
      } else {
        setStatus(
          "🧠 AI Engine: ⚠️ $1 Recognizer Only (Adaptive AI Unavailable)"
        );
        setIsConnected(false);
        setAiDetails({});
        console.log("⚠️ AIStatus: AI not available, using fallback");
      }

      setLastCheck(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("❌ AIStatus Error:", error);

      // Increment retry count
      setRetryCount((prev) => prev + 1);

      // Different error messages based on error type
      if (
        error.code === "ECONNREFUSED" ||
        error.message.includes("ERR_CONNECTION_REFUSED")
      ) {
        setStatus(
          "❌ AI Engine: Server Not Running - Start SecuADR API Server"
        );
      } else if (error.code === "ECONNABORTED") {
        setStatus("❌ AI Engine: Connection Timeout - Server Slow Response");
      } else if (error.response?.status === 404) {
        setStatus("❌ AI Engine: Endpoint Not Found - Check API Routes");
      } else {
        setStatus("❌ AI Engine: Connection Error - Check API Server");
      }

      setIsConnected(false);
      setAiDetails({});
      setLastCheck(new Date().toLocaleTimeString() + " (ERROR)");
    }
  };

  // Alternative health check using the /health endpoint
  const checkHealthEndpoint = async () => {
    try {
      console.log("🔍 AIStatus: Checking /health endpoint...");

      const response = await axios.get("http://localhost:5000/health", {
        timeout: 5000,
      });

      console.log("🔍 AIStatus: Health Response:", response.data);

      if (response.status === 200) {
        setStatus("🧠 AI Engine: ✅ Server Connected (Basic Health Check)");
        setIsConnected(true);
        setLastCheck(new Date().toLocaleTimeString() + " (Health)");

        // After health check succeeds, try the CNN status
        setTimeout(checkStatus, 1000);
      }
    } catch (error) {
      console.error("❌ Health check failed:", error);
      setStatus(
        "❌ AI Engine: Server Offline - Check if SecuADR server is running"
      );
      setIsConnected(false);
    }
  };

  useEffect(() => {
    console.log("🚀 AIStatus: Component mounted");

    // Try health check first, then CNN status
    checkHealthEndpoint();

    // Set up polling interval (every 5 seconds instead of 3)
    const interval = setInterval(() => {
      if (retryCount < 3) {
        checkStatus();
      } else {
        // After 3 failed attempts, try health endpoint
        checkHealthEndpoint();
        setRetryCount(0);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [retryCount]);

  // Manual refresh function
  const handleManualRefresh = () => {
    console.log("🔄 Manual refresh triggered");
    setRetryCount(0);
    setStatus("🔄 Refreshing AI engine status...");
    checkStatus();
  };

  // Get status color
  const getStatusColor = () => {
    if (isConnected) {
      if (status.includes("CNN Model Leading")) {
        return "#10b981"; // Green for full AI
      } else {
        return "#f59e0b"; // Amber for fallback/mock
      }
    }
    return "#ef4444"; // Red for error
  };

  const statusColor = getStatusColor();

  return (
    <div
      style={{
        padding: "16px",
        border: `3px solid ${statusColor}`,
        borderRadius: "10px",
        backgroundColor: "#f9fafb",
        marginBottom: "20px",
        fontWeight: "bold",
        transition: "all 0.3s ease",
        boxShadow: isConnected ? "0 4px 6px rgba(0, 0, 0, 0.1)" : "none",
      }}
    >
      <div
        style={{
          fontSize: "16px",
          marginBottom: "10px",
          color: statusColor,
        }}
      >
        {status}
      </div>

      {/* AI Details */}
      {Object.keys(aiDetails).length > 0 && (
        <div
          style={{
            fontSize: "12px",
            color: "#4b5563",
            marginBottom: "8px",
            padding: "8px",
            backgroundColor: "#f3f4f6",
            borderRadius: "4px",
            fontFamily: "monospace",
          }}
        >
          <div>Mode: {aiDetails.mode}</div>
          <div>Model Loaded: {aiDetails.modelLoaded ? "✅" : "❌"}</div>
          <div>Service: {aiDetails.service}</div>
          <div>Type: {aiDetails.type}</div>
        </div>
      )}

      <div
        style={{
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "10px",
        }}
      >
        Last check: {lastCheck} | Connected: {isConnected ? "✅" : "❌"}
        {retryCount > 0 && ` | Retries: ${retryCount}/3`}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <button
          onClick={handleManualRefresh}
          disabled={status.includes("Refreshing")}
          style={{
            padding: "8px 16px",
            backgroundColor: status.includes("Refreshing")
              ? "#9ca3af"
              : "#3b82f6",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: status.includes("Refreshing") ? "not-allowed" : "pointer",
            fontWeight: "bold",
            fontSize: "14px",
            transition: "background-color 0.2s",
          }}
        >
          {status.includes("Refreshing")
            ? "🔄 Checking..."
            : "🔄 Force Refresh"}
        </button>

        {!isConnected && (
          <button
            onClick={checkHealthEndpoint}
            style={{
              padding: "8px 16px",
              backgroundColor: "#10b981",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            🏥 Health Check
          </button>
        )}

        <div
          style={{
            padding: "8px 12px",
            backgroundColor: isConnected ? "#dcfce7" : "#fee2e2",
            color: isConnected ? "#166534" : "#991b1b",
            borderRadius: "4px",
            fontSize: "12px",
            fontWeight: "bold",
          }}
        >
          Port: 5000 | API: {isConnected ? "ONLINE" : "OFFLINE"}
        </div>
      </div>

      {/* Connection Instructions */}
      {!isConnected && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px",
            backgroundColor: "#fef3c7",
            border: "1px solid #f59e0b",
            borderRadius: "6px",
            fontSize: "12px",
            color: "#92400e",
          }}
        >
          <strong>💡 Troubleshooting:</strong>
          <br />
          1. Make sure SecuADR server is running on port 5000
          <br />
          2. Run: <code>cd server && npm start</code>
          <br />
          3. Check server logs for errors
          <br />
          4. Verify API endpoints are accessible
        </div>
      )}
    </div>
  );
};

export default AIStatus;
