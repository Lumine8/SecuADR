import React, { useRef, useState, useEffect } from "react";
import CanvasDraw from "react-canvas-draw";
import axios from "axios";
import DollarRecognizer, { Point } from "../utils/dollarOneRecognizer";
import AuthService from "../services/auth";
import "./PatternCanvas.scss";
import logo from "../assets/logoRmvBg.png";

function PatternCanvas() {
  const canvasRef = useRef(null);
  const recognizer = useRef(new DollarRecognizer());

  const [mode, setMode] = useState("enroll");
  const [fade, setFade] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [serverCnnStatus, setServerCnnStatus] = useState("checking");
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [drawingStartTime, setDrawingStartTime] = useState(null);
  const [authHistory, setAuthHistory] = useState([]);
  const [improvementTips, setImprovementTips] = useState([]);

  // Generate session ID
  useEffect(() => {
    setSessionId(generateSessionId());
  }, []);

  // Check server CNN availability on mount - FIXED PORT AND ENDPOINT
  useEffect(() => {
    async function checkServerCNN() {
      try {
        console.log("🔍 PatternCanvas: Checking CNN status...");

        // FIXED: Use port 3000 and correct endpoint /api/v1/health
        const response = await axios.get(
          `http://localhost:3000/api/v1/health?t=${Date.now()}`,
          {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
          }
        );

        console.log("🔍 PatternCanvas: CNN Status Response:", response.data);

        // Check for correct response structure
        if (
          response.data.status === "healthy" &&
          response.data.ai_engine === "CNN Model Leading"
        ) {
          console.log("✅ PatternCanvas: CNN is available and loaded");
          setServerCnnStatus("available");
        } else {
          console.log("⚠️ PatternCanvas: CNN not available, using fallback");
          setServerCnnStatus("fallback");
        }
      } catch (error) {
        console.error("❌ PatternCanvas: CNN status check failed:", error);
        setServerCnnStatus("fallback");
      }
    }

    checkServerCNN();

    // Poll for status updates every 3 seconds
    const statusInterval = setInterval(checkServerCNN, 3000);

    // Load stored pattern
    const saved = localStorage.getItem("loginPattern");
    if (saved) {
      const parsed = JSON.parse(saved).map(
        (pt) => new Point(pt.X, pt.Y, pt.ID ?? 0)
      );
      recognizer.current.AddGesture("LoginPattern", parsed);
      console.log("✅ Loaded stored pattern from localStorage");
    }

    return () => clearInterval(statusInterval);
  }, []);

  // Helper functions
  const generateSessionId = () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  };

  const getDeviceFingerprint = () => {
    return {
      userAgent: navigator.userAgent,
      screen: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onlineStatus: navigator.onLine,
    };
  };

  const calculatePatternComplexity = (points) => {
    if (points.length < 3) return 0;

    let totalAngleChange = 0;
    for (let i = 1; i < points.length - 1; i++) {
      const v1 = {
        x: points[i].X - points[i - 1].X,
        y: points[i].Y - points[i - 1].Y,
      };
      const v2 = {
        x: points[i + 1].X - points[i].X,
        y: points[i + 1].Y - points[i].Y,
      };

      const angle = Math.atan2(v2.y, v2.x) - Math.atan2(v1.y, v1.x);
      totalAngleChange += Math.abs(angle);
    }

    return totalAngleChange / points.length;
  };

  const extractPointsFromCanvas = () => {
    const raw = JSON.parse(canvasRef.current.getSaveData());
    return raw.lines.flatMap((line) =>
      line.points.map((pt) => new Point(pt.x, pt.y, 0))
    );
  };

  const enrollPattern = async () => {
    const rawPoints = extractPointsFromCanvas();
    const plainPoints = rawPoints.map((pt) => ({
      X: pt.X,
      Y: pt.Y,
      ID: pt.ID,
    }));

    if (plainPoints.length === 0) {
      alert("❌ Please draw a pattern first");
      return;
    }

    if (!username.trim()) {
      alert("❌ Please enter a username");
      return;
    }

    try {
      setLoading(true);

      // Use correct API endpoint with port 3000
      const response = await axios.post(
        "http://localhost:3000/api/v1/patterns/enroll",
        {
          username,
          pattern: plainPoints,
          metadata: {
            canvasSize: { width: 300, height: 300 },
            deviceType: "desktop",
            drawingTime: Date.now() - (drawingStartTime || Date.now()),
            pointCount: plainPoints.length,
            complexity: calculatePatternComplexity(rawPoints),
            deviceFingerprint: getDeviceFingerprint(),
            sessionId,
          },
        }
      );

      if (response.data.success) {
        const sampleCount = response.data.sampleCount || 1;
        alert(`✅ Pattern enrolled! You have ${sampleCount} samples.`);
        localStorage.setItem("loginPattern", JSON.stringify(plainPoints));
        recognizer.current.AddGesture("LoginPattern", rawPoints);
        triggerFade();
      } else {
        alert("❌ Failed to enroll pattern");
      }
    } catch (err) {
      console.error("❌ Enrollment error:", err);
      alert(
        `❌ Failed to enroll pattern: ${
          err.response?.data?.message || err.message
        }`
      );
    } finally {
      setLoading(false);
    }
  };

  const matchPattern = async () => {
    const drawnPoints = extractPointsFromCanvas();

    if (drawnPoints.length === 0) {
      alert("❌ Please draw a pattern first");
      return;
    }

    if (drawnPoints.length < 5) {
      alert("❌ Please draw a more complex pattern");
      return;
    }

    setLoading(true);

    try {
      console.log("🧠 Using SecuADR API for authentication...");

      // Use AuthService which now has the correct endpoints
      const result = await AuthService.quickAuthenticate(drawnPoints);

      if (result.success && result.data.success) {
        const confidence = Math.round(result.data.confidence * 100);
        const method = result.data.method || "AI Pattern Analysis";

        // Update history
        const historyEntry = {
          timestamp: new Date().toLocaleTimeString(),
          method: method,
          score: result.data.confidence,
          result: "SUCCESS",
        };
        setAuthHistory((prev) => [historyEntry, ...prev.slice(0, 4)]);

        alert(
          `✅ Authenticated!\nMethod: ${method}\nConfidence: ${confidence}%`
        );
        triggerFade();
      } else {
        alert(`❌ Authentication failed.\nTry drawing a more unique pattern.`);
      }
    } catch (error) {
      console.error("💥 Authentication error:", error);
      alert(`❌ Authentication error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const sendFallbackLink = async () => {
    if (!username.trim() || !email.trim()) {
      alert("❌ Please enter both username and email");
      return;
    }

    try {
      setLoading(true);
      const res = await axios.post(
        "http://localhost:3000/api/v1/send-fallback",
        {
          username,
          email,
        }
      );

      if (res.data.success) {
        alert("✅ Fallback authentication link sent to your email!");
      } else {
        alert("❌ Failed to send fallback link");
      }
    } catch (err) {
      console.error("❌ Fallback link error:", err);
      alert("❌ Server error - could not send fallback link");
    } finally {
      setLoading(false);
    }
  };

  const getModelStatus = () => {
    switch (serverCnnStatus) {
      case "available":
        return {
          color: "#28a745",
          bg: "#e6f7e6",
          text: "✅ CNN Model Leading Adaptive AI Engine",
        };
      case "fallback":
        return {
          color: "#ffc107",
          bg: "#fff3cd",
          text: "⚠️ $1 Recognizer Only (Adaptive AI Unavailable)",
        };
      default:
        return {
          color: "#6c757d",
          bg: "#f8f9fa",
          text: "🔄 Checking Adaptive AI Status...",
        };
    }
  };

  const triggerFade = () => {
    setFade(false);
    setTimeout(() => setFade(true), 500);
  };

  const handleClear = () => {
    canvasRef.current.clear();
    setFade(false);
    setDrawingStartTime(Date.now());
    setImprovementTips([]);
  };

  const handleCanvasStart = () => {
    if (!drawingStartTime) {
      setDrawingStartTime(Date.now());
    }
  };

  const modelStatus = getModelStatus();

  return (
    <div className='pattern-container'>
      <img
        src={logo}
        alt='SecuADR Logo'
        className='logo'
        style={{ width: "40%" }}
      />

      <div className='pattern-card'>
        <h2>
          {mode === "enroll"
            ? "🎯 Enroll Your Pattern"
            : "🔐 Adaptive AI Authentication"}
        </h2>

        {/* Adaptive AI Status */}
        <div
          className='model-status'
          style={{
            padding: "12px",
            borderRadius: "8px",
            backgroundColor: modelStatus.bg,
            border: `2px solid ${modelStatus.color}`,
            marginBottom: "1.5rem",
            color: modelStatus.color,
            fontWeight: "600",
            textAlign: "center",
            fontSize: "0.9rem",
            transition: "all 0.3s ease",
          }}
        >
          🧠 AI Engine: {modelStatus.text}
        </div>

        {/* Improvement Tips */}
        {improvementTips.length > 0 && (
          <div
            style={{
              padding: "10px",
              backgroundColor: "#fff3cd",
              border: "1px solid #ffc107",
              borderRadius: "6px",
              marginBottom: "1rem",
              fontSize: "0.9rem",
            }}
          >
            <strong>💡 Tips for better recognition:</strong>
            <ul style={{ margin: "5px 0", paddingLeft: "20px" }}>
              {improvementTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        <input
          type='text'
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder='Enter username'
          disabled={loading}
          style={{
            marginBottom: "1rem",
            padding: "10px",
            borderRadius: "6px",
            border: "2px solid #dee2e6",
            fontSize: "16px",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        <input
          type='email'
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder='Enter email (for fallback authentication)'
          disabled={loading}
          style={{
            marginBottom: "1.5rem",
            padding: "10px",
            borderRadius: "6px",
            border: "2px solid #dee2e6",
            fontSize: "16px",
            width: "100%",
            boxSizing: "border-box",
          }}
        />

        {/* Enhanced Canvas */}
        <div className={`canvas-wrapper ${fade ? "fade-out" : ""}`}>
          <CanvasDraw
            ref={canvasRef}
            canvasWidth={300}
            canvasHeight={300}
            brushRadius={2}
            brushColor='#007bff'
            lazyRadius={1}
            hideGrid
            onChange={handleCanvasStart}
            style={{
              border: "3px solid #dee2e6",
              borderRadius: "8px",
              boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
            }}
          />
        </div>

        {/* Action Buttons */}
        <div
          className='button-group'
          style={{
            marginTop: "1.5rem",
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <button
            className='primary-btn'
            onClick={mode === "enroll" ? enrollPattern : matchPattern}
            disabled={loading}
            style={{
              backgroundColor: loading ? "#6c757d" : "#007bff",
              cursor: loading ? "not-allowed" : "pointer",
              padding: "12px 20px",
              fontSize: "16px",
              fontWeight: "600",
              borderRadius: "6px",
              border: "none",
              color: "white",
              flex: "1",
              minWidth: "150px",
            }}
          >
            {loading
              ? "⏳ Processing..."
              : mode === "enroll"
              ? "📝 Enroll Pattern"
              : "🔐 Authenticate"}
          </button>

          <button
            onClick={handleClear}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "6px",
              border: "2px solid #6c757d",
              backgroundColor: "white",
              color: "#6c757d",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            🗑️ Clear
          </button>

          <button
            onClick={() => setMode(mode === "enroll" ? "login" : "enroll")}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "6px",
              border: "2px solid #28a745",
              backgroundColor: "white",
              color: "#28a745",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            🔄 Switch to {mode === "enroll" ? "Login" : "Enroll"}
          </button>

          <button
            className='secondary-btn'
            onClick={sendFallbackLink}
            disabled={loading}
            style={{
              padding: "12px 16px",
              borderRadius: "6px",
              border: "2px solid #ffc107",
              backgroundColor: "#ffc107",
              color: "white",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            📧 Email Fallback
          </button>
        </div>

        {/* Authentication History */}
        {authHistory.length > 0 && (
          <div
            style={{
              marginTop: "2rem",
              padding: "15px",
              backgroundColor: "#f8f9fa",
              borderRadius: "8px",
              border: "1px solid #dee2e6",
            }}
          >
            <h4
              style={{
                margin: "0 0 10px 0",
                color: "#495057",
                fontSize: "14px",
              }}
            >
              📊 Recent Authentication Attempts
            </h4>
            {authHistory.map((entry, index) => (
              <div
                key={index}
                style={{
                  fontSize: "12px",
                  color: entry.result === "SUCCESS" ? "#28a745" : "#dc3545",
                  marginBottom: "5px",
                }}
              >
                {entry.timestamp}: {entry.method} -{" "}
                {(entry.score * 100).toFixed(1)}% ({entry.result})
              </div>
            ))}
          </div>
        )}

        {/* Help Text */}
        <div
          style={{
            marginTop: "1.5rem",
            fontSize: "0.9rem",
            color: "#6c757d",
            textAlign: "center",
            lineHeight: "1.4",
          }}
        >
          {mode === "enroll"
            ? "🎨 Draw your unique pattern above and click 'Enroll Pattern'. The Adaptive AI will learn your drawing style."
            : "🔐 Draw your enrolled pattern above. Adaptive AI analyzes your drawing style, timing, and geometric accuracy with personalized thresholds."}
        </div>

        {/* Session Info */}
        <div
          style={{
            marginTop: "1rem",
            fontSize: "0.8rem",
            color: "#adb5bd",
            textAlign: "center",
          }}
        >
          Session: {sessionId.substr(0, 8)}... | Device: Desktop | Adaptive AI
          Engine: v3.0
        </div>
      </div>
    </div>
  );
}

export default PatternCanvas;
