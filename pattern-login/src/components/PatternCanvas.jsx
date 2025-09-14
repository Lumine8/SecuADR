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
  const [notification, setNotification] = useState(null);

  // Generate session ID
  useEffect(() => {
    setSessionId(generateSessionId());
  }, []);

  // Check server CNN availability on mount
  useEffect(() => {
    async function checkServerCNN() {
      try {
        console.log("🔍 PatternCanvas: Checking CNN status...");

        const response = await axios.get(
          `http://localhost:5000/api/cnn-status?t=${Date.now()}`,
          {
            headers: {
              "Cache-Control": "no-cache, no-store, must-revalidate",
              Pragma: "no-cache",
              Expires: "0",
            },
            timeout: 5000,
          }
        );

        console.log("🔍 PatternCanvas: CNN Status Response:", response.data);
        const data = response.data;

        if (data.success && data.currentMode === "cnn_leading_adaptive_ai") {
          console.log("✅ PatternCanvas: CNN is available and active");
          setServerCnnStatus("available");
        } else if (data.success) {
          console.log("⚠️ PatternCanvas: Service connected but using fallback");
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
    const statusInterval = setInterval(checkServerCNN, 10000); // Reduced frequency

    // Load stored pattern
    const saved = localStorage.getItem("loginPattern");
    if (saved) {
      try {
        const parsed = JSON.parse(saved).map(
          (pt) => new Point(pt.X, pt.Y, pt.ID ?? 0)
        );
        recognizer.current.AddGesture("LoginPattern", parsed);
        console.log("✅ Loaded stored pattern from localStorage");
      } catch (error) {
        console.error("❌ Failed to load stored pattern:", error);
        localStorage.removeItem("loginPattern");
      }
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
    try {
      const raw = JSON.parse(canvasRef.current.getSaveData());
      return raw.lines.flatMap((line) =>
        line.points.map((pt) => new Point(pt.x, pt.y, 0))
      );
    } catch (error) {
      console.error("❌ Failed to extract points from canvas:", error);
      return [];
    }
  };

  // Enhanced notification system
  const showNotification = (message, type = "info", duration = 4000) => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), duration);
  };

  const enrollPattern = async () => {
    const rawPoints = extractPointsFromCanvas();
    const plainPoints = rawPoints.map((pt) => ({
      X: pt.X,
      Y: pt.Y,
      ID: pt.ID,
    }));

    if (plainPoints.length === 0) {
      showNotification("Please draw a pattern first", "error");
      return;
    }

    if (!username.trim()) {
      showNotification("Please enter a username", "error");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        "http://localhost:5000/api/save-pattern",
        {
          username,
          pattern: plainPoints,
          metadata: {
            canvasSize: { width: 320, height: 320 },
            deviceType: "desktop",
            drawingTime: Date.now() - (drawingStartTime || Date.now()),
            pointCount: plainPoints.length,
            complexity: calculatePatternComplexity(rawPoints),
            deviceFingerprint: getDeviceFingerprint(),
            sessionId,
          },
        },
        { timeout: 10000 }
      );

      if (response.data.success) {
        const sampleCount = response.data.sampleCount || 1;
        showNotification(
          `Pattern enrolled successfully! You have ${sampleCount} samples.`,
          "success"
        );
        localStorage.setItem("loginPattern", JSON.stringify(plainPoints));
        recognizer.current.AddGesture("LoginPattern", rawPoints);
        triggerFade();
      } else {
        showNotification(
          `Failed to enroll pattern: ${
            response.data.message || "Unknown error"
          }`,
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Enrollment error:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Network error";
      showNotification(`Failed to enroll pattern: ${errorMessage}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const matchPattern = async () => {
    const drawnPoints = extractPointsFromCanvas();

    if (drawnPoints.length === 0) {
      showNotification("Please draw a pattern first", "error");
      return;
    }

    if (drawnPoints.length < 5) {
      showNotification(
        "Please draw a more complex pattern (minimum 5 points)",
        "error"
      );
      return;
    }

    if (!username.trim()) {
      showNotification("Please enter your username", "error");
      return;
    }

    setLoading(true);

    try {
      console.log("🧠 Using SecuADR API for authentication...");

      const result = await axios.post(
        "http://localhost:5000/api/authenticate",
        {
          username,
          pattern: drawnPoints.map((pt) => ({ X: pt.X, Y: pt.Y, ID: pt.ID })),
          sessionId,
          deviceFingerprint: getDeviceFingerprint(),
        },
        { timeout: 10000 }
      );

      if (result.data.success && result.data.authenticated) {
        const confidence = Math.round((result.data.confidence || 0) * 100);
        const method = result.data.method || "AI Pattern Analysis";

        // Update history
        const historyEntry = {
          timestamp: new Date().toLocaleTimeString(),
          method: method,
          score: result.data.confidence || 0,
          result: "SUCCESS",
        };
        setAuthHistory((prev) => [historyEntry, ...prev.slice(0, 4)]);

        showNotification(
          `Authentication successful! Method: ${method} - Confidence: ${confidence}%`,
          "success"
        );
        triggerFade();
        setImprovementTips([]);
      } else {
        setImprovementTips([
          "Try drawing your pattern more slowly",
          "Ensure your pattern has distinct angles and curves",
          "Draw with consistent pressure and speed",
          "Make sure your pattern is large enough to capture details",
        ]);

        showNotification(
          `Authentication failed. ${
            result.data.message || "Pattern not recognized. Try again!"
          }`,
          "error"
        );
      }
    } catch (error) {
      console.error("💥 Authentication error:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Network error";
      showNotification(`Authentication error: ${errorMessage}`, "error");
    } finally {
      setLoading(false);
    }
  };

  const sendFallbackLink = async () => {
    if (!username.trim() || !email.trim()) {
      showNotification("Please enter both username and email", "error");
      return;
    }

    try {
      setLoading(true);

      const res = await axios.post(
        "http://localhost:5000/api/fallback",
        {
          username,
          email,
        },
        { timeout: 10000 }
      );

      if (res.data.success) {
        showNotification(
          "Fallback authentication link sent to your email!",
          "success"
        );
      } else {
        showNotification(
          `Failed to send fallback link: ${
            res.data.message || "Unknown error"
          }`,
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Fallback link error:", err);
      const errorMessage =
        err.response?.data?.message || err.message || "Network error";
      showNotification(
        `Server error - could not send fallback link: ${errorMessage}`,
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const getModelStatus = () => {
    switch (serverCnnStatus) {
      case "available":
        return {
          color: "#10b981",
          bg: "linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)",
          text: "✅ CNN Model Leading Adaptive AI Engine",
          icon: "🧠",
        };
      case "fallback":
        return {
          color: "#f59e0b",
          bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
          text: "⚠️ $1 Recognizer Only (Adaptive AI Unavailable)",
          icon: "🔄",
        };
      default:
        return {
          color: "#6b7280",
          bg: "linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)",
          text: "🔄 Checking Adaptive AI Status...",
          icon: "🔍",
        };
    }
  };

  const triggerFade = () => {
    setFade(true);
    setTimeout(() => setFade(false), 1000);
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
      {/* Notification System */}
      {notification && (
        <div className={`notification notification-${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Logo with animation */}
      <div className='logo-container'>
        <img src={logo} alt='SecuADR Logo' className='logo' />
      </div>

      <div className='pattern-card'>
        {/* Mode Header */}
        <div className='mode-header'>
          <h2>
            {mode === "enroll"
              ? "🎯 Enroll Your Pattern"
              : "🔐 AI Authentication"}
          </h2>
        </div>

        {/* Enhanced AI Status Display */}
        <div
          className='model-status'
          style={{
            background: modelStatus.bg,
            borderColor: modelStatus.color,
            color: modelStatus.color,
          }}
        >
          <div className='status-content'>
            <span className='status-icon'>{modelStatus.icon}</span>
            <span>{modelStatus.text}</span>
          </div>
        </div>

        {/* Server Connection Indicator */}
        {serverCnnStatus === "available" && (
          <div className='server-status'>
            🌐 Connected to SecuADR Server | Status:{" "}
            <span className='online-indicator'>●</span> Online
          </div>
        )}

        {/* Improvement Tips */}
        {improvementTips.length > 0 && (
          <div className='improvement-tips'>
            <div className='tips-header'>
              <span className='tips-icon'>💡</span>
              <strong>Tips for better recognition:</strong>
            </div>
            <ul>
              {improvementTips.map((tip, index) => (
                <li key={index}>{tip}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Enhanced Input Fields */}
        <div className='input-group'>
          <input
            type='text'
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder='Enter username'
            disabled={loading}
            className='modern-input'
          />

          <input
            type='email'
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder='Enter email (for fallback)'
            disabled={loading}
            className='modern-input'
          />
        </div>

        {/* FIXED Enhanced Canvas */}
        <div className={`canvas-wrapper ${fade ? "fade-out" : ""}`}>
          <CanvasDraw
            ref={canvasRef}
            canvasWidth={320}
            canvasHeight={320}
            brushRadius={3}
            brushColor='#3b82f6'
            lazyRadius={1}
            hideGrid={true}
            onChange={handleCanvasStart}
          />
        </div>

        {/* Enhanced Action Buttons */}
        <div className='button-group'>
          <button
            className='primary-btn modern-btn'
            onClick={mode === "enroll" ? enrollPattern : matchPattern}
            disabled={loading}
          >
            {loading ? (
              <span className='loading-content'>
                <div className='spinner' />
                Processing...
              </span>
            ) : mode === "enroll" ? (
              "📝 Enroll Pattern"
            ) : (
              "🔐 Authenticate"
            )}
          </button>

          <button
            onClick={handleClear}
            disabled={loading}
            className='modern-btn clear-btn'
          >
            🗑️
          </button>

          <button
            onClick={() => setMode(mode === "enroll" ? "login" : "enroll")}
            disabled={loading}
            className='modern-btn switch-btn'
          >
            🔄
          </button>

          <button
            onClick={sendFallbackLink}
            disabled={loading}
            className='modern-btn fallback-btn'
          >
            📧
          </button>
        </div>

        {/* Enhanced Authentication History */}
        {authHistory.length > 0 && (
          <div className='auth-history'>
            <h4 className='history-header'>
              📊 Recent Authentication Attempts
            </h4>
            {authHistory.map((entry, index) => (
              <div
                key={index}
                className={`history-entry ${
                  entry.result === "SUCCESS" ? "success" : "failure"
                }`}
              >
                <strong>{entry.timestamp}:</strong> {entry.method} -{" "}
                {(entry.score * 100).toFixed(1)}%
                <span className='result-badge'>({entry.result})</span>
              </div>
            ))}
          </div>
        )}

        {/* Enhanced Help Text */}
        <div className='help-text'>
          <div className='help-icon'>{mode === "enroll" ? "🎨" : "🔐"}</div>
          <p>
            {mode === "enroll"
              ? "Draw your unique pattern above and click 'Enroll Pattern'. The Adaptive AI will learn your drawing style."
              : "Draw your enrolled pattern above. Adaptive AI analyzes your drawing style, timing, and geometric accuracy with personalized thresholds."}
          </p>
        </div>

        {/* Enhanced Session Info */}
        <div className='session-info'>
          Session: {sessionId.substr(0, 8)}... | Device: Desktop | AI Engine:
          v3.1 | Server:{" "}
          {serverCnnStatus === "available" ? (
            <span className='server-online'>🟢 Online</span>
          ) : (
            <span className='server-fallback'>🟡 Fallback</span>
          )}
        </div>
      </div>
    </div>
  );
}

export default PatternCanvas;
