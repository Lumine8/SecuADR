import React, { useRef, useState, useEffect, useMemo } from "react";
import GesturePad from "./GesturePad";
import axios from "axios";
import AuthService from "../services/auth";
import API_BASE_URL from "../config/api";
import "./PatternCanvas.scss";
import logo from "../assets/logoRmvBg.png";

const API_TIMEOUT_MS = 45000;

function PatternCanvas({ onLoginSuccess }) {
  const canvasRef = useRef(null);

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
  const [attackRunning, setAttackRunning] = useState(false);
  const [attackStatus, setAttackStatus] = useState("");

  // Generate session ID
  useEffect(() => {
    setSessionId(generateSessionId());
  }, []);

  // Since we're using SFAM-only authentication, SFAM service status is assumed available
  useEffect(() => {
    setServerCnnStatus("available");
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
      const baseTs = Date.now();
      return raw.lines.flatMap((line) =>
        line.points.map((pt, idx) => ({
          X: pt.x,
          Y: pt.y,
          ID: 0,
          T: Number.isFinite(pt.time)
            ? pt.time
            : Number.isFinite(pt.timestamp)
              ? pt.timestamp
              : baseTs + idx,
        }))
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

  const metricLabelMap = {
    dur_diff: "timing",
    spd_diff: "speed",
    spv_diff: "speed variance",
    tort_diff: "tortuosity",
    curv_diff: "curvature",
    rhythm_diff: "rhythm",
    shape_stat_diff: "shape",
    shp_diff: "shape path",
  };

  const buildMetricTips = (metrics) => {
    if (!metrics || typeof metrics !== "object") return [];

    const diffKeys = Object.keys(metricLabelMap)
      .filter((k) => Number.isFinite(metrics[k]))
      .map((k) => ({ key: k, label: metricLabelMap[k], value: Number(metrics[k]) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 3)
      .filter((item) => item.value > 0.2);

    return diffKeys.map(
      (item) =>
        `Improve ${item.label} consistency (delta ${(item.value * 100).toFixed(1)}%)`
    );
  };

  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  const normalizePointIds = (points) =>
    points.map((pt, idx) => ({
      X: Number(pt.X),
      Y: Number(pt.Y),
      ID: idx,
      T: Number(pt.T),
    }));

  const toPointPayload = (points) =>
    points.map((pt) => ({ X: pt.X, Y: pt.Y, ID: pt.ID, T: pt.T }));

  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
  const randomRange = (min, max) => min + Math.random() * (max - min);
  const sample = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const canvasW = 320;
  const canvasH = 320;

  const jitterAttack = (points, intensity = 1) => {
    if (!points.length) return [];
    return normalizePointIds(
      points.map((pt, idx) => ({
        X: pt.X + Math.sin(idx * 0.8) * 16 * intensity,
        Y: pt.Y + Math.cos(idx * 0.75) * 14 * intensity,
        T: pt.T,
      }))
    );
  };

  const replayTimingAttack = (points) => {
    if (!points.length) return [];
    return normalizePointIds(
      points.map((pt, idx) => ({
        X: pt.X,
        Y: pt.Y,
        T: points[0].T + idx * 6,
      }))
    );
  };

  const mirrorAttack = (points) => {
    if (!points.length) return [];
    return normalizePointIds(
      points.map((pt, idx) => ({
        X: clamp(canvasW - pt.X, 0, canvasW),
        Y: pt.Y,
        T: pt.T,
      }))
    );
  };

  const scaleTranslateAttack = (points, scale = 0.72) => {
    if (!points.length) return [];
    const centerX = canvasW / 2;
    const centerY = canvasH / 2;
    return normalizePointIds(
      points.map((pt, idx) => ({
        X: clamp(centerX + (pt.X - centerX) * scale + 20, 0, canvasW),
        Y: clamp(centerY + (pt.Y - centerY) * scale - 18, 0, canvasH),
        T: pt.T,
      }))
    );
  };

  const shoulderSurfingAttack = (points) => {
    if (!points.length) return [];
    return normalizePointIds(
      points.map((pt, idx) => ({
        X: clamp(pt.X + (idx % 2 === 0 ? 8 : -6), 0, canvasW),
        Y: clamp(pt.Y + (idx % 3 === 0 ? -10 : 9), 0, canvasH),
        T: pt.T + (idx % 5 === 0 ? 35 : -20),
      }))
    );
  };

  const randomBruteForceAttack = (points) => {
    const len = Math.max(points.length, 24);
    const startT = points[0]?.T || Date.now();
    return normalizePointIds(
      new Array(len).fill(null).map((_, idx) => ({
        X: Math.random() * canvasW,
        Y: Math.random() * canvasH,
        T: startT + idx * 12,
      }))
    );
  };

  const scriptedLineAttack = (points) => {
    if (points.length < 2) return [];

    const start = points[0];
    const end = points[points.length - 1];
    const length = points.length;

    return normalizePointIds(
      new Array(length).fill(null).map((_, idx) => {
        const t = idx / Math.max(length - 1, 1);
        return {
          X: clamp(start.X + (end.X - start.X) * t, 0, 320),
          Y: clamp(start.Y + (end.Y - start.Y) * t, 0, 320),
          T: points[0].T + idx * 14,
        };
      })
    );
  };

  const reversedStrokeAttack = (points) => {
    if (!points.length) return [];
    const reversed = [...points].reverse();
    return normalizePointIds(
      reversed.map((pt, idx) => ({
        X: pt.X,
        Y: pt.Y,
        T: points[0].T + idx * 22,
      }))
    );
  };

  const segmentedBotAttack = (points) => {
    if (points.length < 8) return scriptedLineAttack(points);

    const chunks = 4;
    const size = Math.floor(points.length / chunks);
    const out = [];
    for (let c = 0; c < chunks; c += 1) {
      const start = c * size;
      const end = c === chunks - 1 ? points.length - 1 : (start + size);
      const p1 = points[start];
      const p2 = points[end];
      for (let i = 0; i <= 5; i += 1) {
        const t = i / 5;
        out.push({
          X: clamp(p1.X + (p2.X - p1.X) * t, 0, canvasW),
          Y: clamp(p1.Y + (p2.Y - p1.Y) * t, 0, canvasH),
          T: (out.length === 0 ? points[0].T : out[out.length - 1].T) + sample([6, 40, 8, 35, 7]),
        });
      }
    }

    return normalizePointIds(out);
  };

  const hybridImitationAttack = (points) => {
    const scale = randomRange(0.78, 0.92);
    const translated = scaleTranslateAttack(points, scale);
    return jitterAttack(translated, randomRange(0.6, 1.1));
  };

  const submitAttackAttempt = async (label, attackPoints) => {
    const result = await axios.post(
      `${API_BASE_URL}/api/authenticate`,
      {
        username: username.trim(),
        pattern: toPointPayload(attackPoints),
        sessionId: `${sessionId}-${label.toLowerCase().replace(/\s+/g, "-")}`,
        deviceFingerprint: {
          ...getDeviceFingerprint(),
          attackSimulation: true,
          attackType: label,
        },
      },
      { timeout: API_TIMEOUT_MS }
    );

    const sfamInfo = result.data?.sfam || {};
    const possibleAttack = result.data?.possible_attack || sfamInfo?.possible_attack;
    const success = Boolean(result.data?.success && result.data?.authenticated);
    const score = Number(result.data?.confidence || 0);

    setAuthHistory((prev) => [
      {
        timestamp: new Date().toLocaleTimeString(),
        method: `Attack: ${label}`,
        score,
        result: success ? "SUCCESS" : "FAIL",
        distance: sfamInfo.hash_distance,
        reason: possibleAttack?.flag
          ? `${sfamInfo.reason || result.data?.message || "simulation result"} | possible attack`
          : sfamInfo.reason || result.data?.message || "simulation result",
      },
      ...prev.slice(0, 7),
    ]);

    if (possibleAttack?.flag) {
      showNotification(
        `Possible attack detected (${label}): ${(possibleAttack.reasons || []).slice(0, 2).join(", ") || "behavioral risk"}`,
        "error",
        2600
      );
    }

    return success;
  };

  const animateAttackDraw = async (attackPoints) => {
    if (canvasRef.current?.playPath) {
      await canvasRef.current.playPath(
        attackPoints.map((pt) => ({ x: pt.X, y: pt.Y, T: pt.T })),
        12
      );
      return;
    }
    await delay(400);
  };

  const simulateAttacks = async () => {
    if (!username.trim()) {
      showNotification("Enter username before running attack simulation", "error");
      return;
    }

    const livePoints = extractPointsFromCanvas();
    const stored = localStorage.getItem("loginPattern");
    let storedPoints = [];
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        storedPoints = Array.isArray(parsed) ? parsed : [];
      } catch {
        storedPoints = [];
      }
    }
    const sourcePoints = livePoints.length >= 5 ? livePoints : storedPoints;

    if (!Array.isArray(sourcePoints) || sourcePoints.length < 5) {
      showNotification(
        "Draw or enroll a pattern first. Simulation needs a baseline gesture.",
        "error"
      );
      return;
    }

    const baseline = normalizePointIds(sourcePoints);
    const attackFamilies = [
      {
        label: "Replay Timing",
        attempts: 3,
        generate: () => replayTimingAttack(baseline),
      },
      {
        label: "Imitation Drift",
        attempts: 3,
        generate: () => jitterAttack(baseline, randomRange(0.6, 1.4)),
      },
      {
        label: "Hybrid Imitation",
        attempts: 3,
        generate: () => hybridImitationAttack(baseline),
      },
      {
        label: "Scripted Bot",
        attempts: 2,
        generate: () => scriptedLineAttack(baseline),
      },
      {
        label: "Segmented Bot",
        attempts: 2,
        generate: () => segmentedBotAttack(baseline),
      },
      {
        label: "Mirror Pattern",
        attempts: 2,
        generate: () => mirrorAttack(baseline),
      },
      {
        label: "Scaled Translation",
        attempts: 2,
        generate: () => scaleTranslateAttack(baseline, randomRange(0.65, 0.9)),
      },
      {
        label: "Shoulder Surfing",
        attempts: 2,
        generate: () => shoulderSurfingAttack(baseline),
      },
      {
        label: "Reversed Stroke",
        attempts: 2,
        generate: () => reversedStrokeAttack(baseline),
      },
      {
        label: "Brute Force Random",
        attempts: 2,
        generate: () => randomBruteForceAttack(baseline),
      },
    ];

    setAttackRunning(true);
    setLoading(true);
    showNotification("Launching adversarial robustness simulation...", "info", 2500);

    let blockedCount = 0;
    let totalCount = 0;
    try {
      for (const family of attackFamilies) {
        for (let i = 0; i < family.attempts; i += 1) {
          totalCount += 1;
          const points = family.generate();
          setAttackStatus(`Running ${family.label} (${i + 1}/${family.attempts})...`);
          await animateAttackDraw(points);
          const success = await submitAttackAttempt(`${family.label} #${i + 1}`, points);
          if (!success) blockedCount += 1;
          await delay(240);
        }
      }

      setAttackStatus("Simulation complete");
      showNotification(
        `Simulation complete: ${blockedCount}/${totalCount} attack attempts rejected`,
        blockedCount >= Math.ceil(totalCount * 0.5) ? "success" : "info",
        5000
      );
    } catch (error) {
      console.error("❌ Attack simulation error:", error);
      const errorMessage =
        error.response?.data?.message || error.message || "Network error";
      setAttackStatus("Simulation failed");
      showNotification(`Attack simulation failed: ${errorMessage}`, "error", 5000);
    } finally {
      setAttackRunning(false);
      setLoading(false);
      setTimeout(() => setAttackStatus(""), 2200);
    }
  };

  const enrollPattern = async () => {
    const rawPoints = extractPointsFromCanvas();
    const plainPoints = rawPoints.map((pt) => ({
      X: pt.X,
      Y: pt.Y,
      ID: pt.ID,
      T: pt.T,
    }));

    if (plainPoints.length === 0) {
      showNotification("Please draw a pattern first", "error");
      return;
    }

    if (plainPoints.length < 5) {
      showNotification(
        "Please draw a more complex pattern (minimum 5 points)",
        "error"
      );
      return;
    }

    if (!username.trim()) {
      showNotification("Please enter a username", "error");
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(
        `${API_BASE_URL}/api/sfam/enroll`,
        {
          username: username.trim(),
          pattern: plainPoints,
        },
        { timeout: API_TIMEOUT_MS }
      );

      if (response.data.success) {
        showNotification(
          `Pattern enrolled successfully! You're now registered.`,
          "success"
        );
        localStorage.setItem("loginPattern", JSON.stringify(plainPoints));
        triggerFade();
      } else {
        showNotification(
          `Failed to enroll pattern: ${response.data.message || "Unknown error"
          }`,
          "error"
        );
      }
    } catch (err) {
      console.error("❌ Enrollment error:", err);
      if (err.code === "ECONNABORTED") {
        showNotification(
          "Enrollment timed out. SFAM may still be warming up. Please try again in a few seconds.",
          "error"
        );
        return;
      }
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
        `${API_BASE_URL}/api/authenticate`,
        {
          username,
          pattern: drawnPoints.map((pt) => ({
            X: pt.X,
            Y: pt.Y,
            ID: pt.ID,
            T: pt.T,
          })),
          sessionId,
          deviceFingerprint: getDeviceFingerprint(),
        },
        { timeout: API_TIMEOUT_MS }
      );

      if (result.data.success && result.data.authenticated) {
        const confidence = Math.round((result.data.confidence || 0) * 100);
        const method = result.data.method || "AI Pattern Analysis";
        const sfamInfo = result.data.sfam || {};
        const possibleAttack = result.data.possible_attack || sfamInfo.possible_attack;

        // Update history
        const historyEntry = {
          timestamp: new Date().toLocaleTimeString(),
          method: method,
          score: result.data.confidence || 0,
          result: "SUCCESS",
          distance: sfamInfo.hash_distance,
          reason: possibleAttack?.flag
            ? `${sfamInfo.reason || "Hash match"} | possible attack`
            : sfamInfo.reason,
        };
        setAuthHistory((prev) => [historyEntry, ...prev.slice(0, 4)]);

        if (possibleAttack?.flag) {
          showNotification(
            `Authentication passed with warning: possible attack (${(possibleAttack.reasons || []).slice(0, 2).join(", ") || "behavioral risk"})`,
            "error",
            5200
          );
        } else {
          showNotification(
            `Authentication successful! Method: ${method} - Confidence: ${confidence}%`,
            "success"
          );
        }
        triggerFade();
        setImprovementTips([]);

        // Call the onLoginSuccess callback if provided
        if (onLoginSuccess) {
          setTimeout(() => {
            onLoginSuccess({
              username,
              token: result.data.token || 'auth-token',
              confidence
            });
          }, 1000);
        }
      } else {
        const sfamInfo = result.data.sfam || {};
        const possibleAttack = result.data.possible_attack || sfamInfo.possible_attack;
        const metricTips = buildMetricTips(sfamInfo.metrics);

        setImprovementTips(metricTips.length > 0 ? metricTips : [
          "Try drawing your pattern more slowly",
          "Ensure your pattern has distinct angles and curves",
          "Draw with consistent pressure and speed",
          "Make sure your pattern is large enough to capture details",
        ]);

        const historyEntry = {
          timestamp: new Date().toLocaleTimeString(),
          method: result.data.method || "SFAM Gesture Recognition",
          score: result.data.confidence || 0,
          result: "FAIL",
          distance: sfamInfo.hash_distance,
          reason: possibleAttack?.flag
            ? `${sfamInfo.reason || "failed"} | possible attack`
            : sfamInfo.reason,
        };
        setAuthHistory((prev) => [historyEntry, ...prev.slice(0, 4)]);

        showNotification(
          `Authentication failed. ${result.data.message || "Pattern not recognized. Try again!"
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
        `${API_BASE_URL}/api/fallback`,
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
          `Failed to send fallback link: ${res.data.message || "Unknown error"
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
          text: "✅ SFAM Behavioral Authentication Ready",
          icon: "🧠",
        };
      default:
        return {
          color: "#6b7280",
          bg: "linear-gradient(135deg, #f9fafb 0%, #e5e7eb 100%)",
          text: "🔄 Checking Authentication Status...",
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
  const attackEntries = useMemo(
    () => authHistory.filter((entry) => String(entry.method || "").startsWith("Attack: ")),
    [authHistory]
  );

  const attackReport = useMemo(() => {
    const byType = {};

    attackEntries.forEach((entry) => {
      const type = String(entry.method || "Attack: Unknown").replace("Attack: ", "");
      if (!byType[type]) {
        byType[type] = { attempts: 0, blocked: 0, allowed: 0 };
      }

      byType[type].attempts += 1;
      if (entry.result === "FAIL") {
        byType[type].blocked += 1;
      } else {
        byType[type].allowed += 1;
      }
    });

    const totalAttempts = attackEntries.length;
    const totalBlocked = attackEntries.filter((entry) => entry.result === "FAIL").length;
    const totalAllowed = totalAttempts - totalBlocked;
    const successRate = totalAttempts ? Math.round((totalAllowed / totalAttempts) * 100) : 0;

    const recent = attackEntries.slice(0, 10).reverse();
    const trendPoints = recent.map((_, index) => {
      const window = recent.slice(Math.max(0, index - 2), index + 1);
      const winAllowed = window.filter((entry) => entry.result === "SUCCESS").length;
      return Math.round((winAllowed / Math.max(window.length, 1)) * 100);
    });

    const half = Math.floor(trendPoints.length / 2);
    const left = trendPoints.slice(0, Math.max(half, 1));
    const right = trendPoints.slice(Math.max(half, 1));
    const avg = (arr) =>
      arr.length ? arr.reduce((sum, value) => sum + value, 0) / arr.length : 0;
    const trendDirection = avg(right) - avg(left);

    return {
      byType,
      totalAttempts,
      totalBlocked,
      totalAllowed,
      successRate,
      trendPoints,
      trendDirection,
    };
  }, [attackEntries]);

  const switchModeLabel = mode === "enroll" ? "Authenticate" : "Enroll";
  const modeMeta =
    mode === "enroll"
      ? {
        title: "Enroll Gesture Profile",
        subtitle:
          "Create your personal gesture signature. SecuADR learns both geometry and behavior.",
        cta: "Enroll Pattern",
      }
      : {
        title: "Behavioral Verification",
        subtitle:
          "Reproduce your enrolled pattern. Timing, speed, and rhythm are checked in real time.",
        cta: "Authenticate",
      };

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
          <h2>{modeMeta.title}</h2>
          <p className='mode-subtitle'>{modeMeta.subtitle}</p>
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
            Connected to SecuADR backend | Status:{" "}
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
          <GesturePad
            ref={canvasRef}
            canvasWidth={320}
            canvasHeight={320}
            brushRadius={3}
            brushColor='#3b82f6'
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
            ) : (
              modeMeta.cta
            )}
          </button>

          <button
            onClick={handleClear}
            disabled={loading}
            className='modern-btn clear-btn secondary-btn'
            aria-label='Clear pattern canvas'
            title='Clear pattern canvas'
          >
            Clear Canvas
          </button>

          <button
            onClick={() => setMode(mode === "enroll" ? "login" : "enroll")}
            disabled={loading}
            className='modern-btn switch-btn secondary-btn'
            aria-label='Switch mode'
            title='Switch mode'
          >
            {switchModeLabel}
          </button>

          <button
            onClick={sendFallbackLink}
            disabled={loading || attackRunning}
            className='modern-btn fallback-btn secondary-btn'
            aria-label='Send fallback link'
            title='Send fallback link'
          >
            Fallback
          </button>

          <button
            onClick={simulateAttacks}
            disabled={loading || attackRunning}
            className='modern-btn attack-btn secondary-btn'
            aria-label='Simulate attacks for this user'
            title='Simulate attacks for this user'
          >
            {attackRunning ? "Simulating..." : "Simulate Attacks"}
          </button>
        </div>

        <div className='action-hints'>
          <span>Draw continuously for best results</span>
          <span>Use the same size and pace each attempt</span>
          {attackStatus ? <span>{attackStatus}</span> : null}
        </div>

        {attackReport.totalAttempts > 0 && (
          <div className='attack-report'>
            <h4 className='report-header'>Attack Report</h4>
            <div className='report-summary'>
              <span>Blocked: {attackReport.totalBlocked}</span>
              <span>Allowed: {attackReport.totalAllowed}</span>
              <span>Success Rate: {attackReport.successRate}%</span>
            </div>

            <div className='attack-type-grid'>
              {Object.entries(attackReport.byType).map(([type, stats]) => (
                <div key={type} className='attack-type-row'>
                  <div className='type-name'>{type}</div>
                  <div className='type-stats'>
                    <span className='blocked'>Blocked {stats.blocked}</span>
                    <span className='attempts'>/{stats.attempts} attempts</span>
                  </div>
                </div>
              ))}
            </div>

            <div className='trend-block'>
              <div className='trend-label'>
                Success Rate Trend (rolling)
                <strong>
                  {attackReport.trendDirection > 3
                    ? " Improving"
                    : attackReport.trendDirection < -3
                      ? " Dropping"
                      : " Stable"}
                </strong>
              </div>
              <div className='trend-bars'>
                {attackReport.trendPoints.map((point, index) => (
                  <div key={index} className='trend-bar-wrap'>
                    <div
                      className='trend-bar'
                      style={{ height: `${Math.max(point, 6)}%` }}
                      title={`${point}%`}
                    />
                  </div>
                ))}
              </div>
            </div>
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
