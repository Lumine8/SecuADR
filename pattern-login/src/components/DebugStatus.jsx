import React, { useState } from "react";
import axios from "axios";

const DebugStatus = () => {
  const [rawResponse, setRawResponse] = useState("Not checked yet");
  const [lastCheck, setLastCheck] = useState("Never");

  const checkRawStatus = async () => {
    try {
      console.log("🔥 DEBUG: Making raw API call...");

      const response = await axios.get(`/api/cnn-status?debug=${Date.now()}`, {
        headers: {
          "Cache-Control": "no-cache, no-store, must-revalidate",
          Pragma: "no-cache",
        },
      });

      console.log("🔥 DEBUG: Raw response:", response.data);

      setRawResponse(JSON.stringify(response.data, null, 2));
      setLastCheck(new Date().toLocaleTimeString());
    } catch (error) {
      console.error("🔥 DEBUG ERROR:", error);
      setRawResponse(`ERROR: ${error.message}`);
      setLastCheck(new Date().toLocaleTimeString());
    }
  };

  return (
    <div
      style={{
        padding: "20px",
        margin: "20px 0",
        border: "3px solid #dc2626",
        borderRadius: "8px",
        backgroundColor: "#fef2f2",
        fontFamily: "monospace",
      }}
    >
      <h3 style={{ color: "#dc2626", margin: "0 0 15px 0" }}>
        🔥 DEBUG: Raw Backend Response
      </h3>

      <button
        onClick={checkRawStatus}
        style={{
          padding: "10px 20px",
          backgroundColor: "#dc2626",
          color: "white",
          border: "none",
          borderRadius: "4px",
          cursor: "pointer",
          fontWeight: "bold",
          marginBottom: "15px",
        }}
      >
        🔥 CHECK BACKEND NOW
      </button>

      <div style={{ marginBottom: "10px", fontSize: "12px", color: "#666" }}>
        Last check: {lastCheck}
      </div>

      <pre
        style={{
          backgroundColor: "#1f2937",
          color: "#10b981",
          padding: "15px",
          borderRadius: "4px",
          overflow: "auto",
          fontSize: "12px",
          maxHeight: "300px",
        }}
      >
        {rawResponse}
      </pre>

      <div
        style={{
          marginTop: "15px",
          padding: "10px",
          backgroundColor: "#fff3cd",
          borderRadius: "4px",
          fontSize: "14px",
        }}
      >
        <strong>Expected:</strong> Look for `"currentMode":
        "cnn_leading_adaptive_ai"`
      </div>
    </div>
  );
};

export default DebugStatus;
