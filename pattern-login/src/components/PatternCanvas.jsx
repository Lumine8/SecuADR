import React, { useRef, useState, useEffect } from "react";
import CanvasDraw from "react-canvas-draw";
import axios from "axios";
import DollarRecognizer, { Point } from "../utils/dollarOneRecognizer";

function PatternCanvas() {
  const canvasRef = useRef(null);
  const recognizer = useRef(new DollarRecognizer());

  const [mode, setMode] = useState("enroll");
  const [fade, setFade] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // Load stored pattern (optional, for smoother login)
  useEffect(() => {
    const saved = localStorage.getItem("loginPattern");
    if (saved) {
      const parsed = JSON.parse(saved).map(
        (pt) => new Point(pt.X, pt.Y, pt.ID ?? 0)
      );
      recognizer.current.AddGesture("LoginPattern", parsed);
    }
  }, []);

  const triggerFade = () => {
    setFade(false);
    setTimeout(() => setFade(true), 1000);
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

    try {
      await axios.post("http://localhost:5000/api/save-pattern", {
        username,
        pattern: plainPoints,
      });

      alert("✅ Pattern enrolled!");
      localStorage.setItem("loginPattern", JSON.stringify(plainPoints));
      recognizer.current.AddGesture("LoginPattern", rawPoints);
      triggerFade();
    } catch (err) {
      alert("❌ Failed to enroll pattern");
      console.error(err);
    }
  };

  const matchPattern = async () => {
    const drawnPoints = extractPointsFromCanvas();

    try {
      const res = await axios.get(
        `http://localhost:5000/api/get-pattern/${username}`
      );

      const savedPattern = res.data.pattern.map(
        (pt) => new Point(pt.X, pt.Y, pt.ID ?? 0)
      );
      recognizer.current.AddGesture("LoginPattern", savedPattern);

      const result = recognizer.current.Recognize(drawnPoints);

      if (result.Name === "LoginPattern" && result.Score > 0.88) {
        alert("✅ Pattern matched!");
      } else {
        alert("❌ Incorrect pattern");
      }

      triggerFade();
    } catch (err) {
      alert("❌ Failed to fetch saved pattern");
      console.error(err);
    }
  };

  const sendFallbackLink = async () => {
    try {
      const res = await axios.post("http://localhost:5000/api/send-fallback", {
        username,
        email,
      });

      if (res.data.success) {
        alert("✅ Fallback link sent to email!");
      } else {
        alert("❌ Failed to send fallback link");
      }
    } catch (err) {
      console.error("❌ Fallback link error:", err);
      alert("❌ Server error");
    }
  };

  const handleClear = () => {
    canvasRef.current.clear();
    setFade(false);
  };

  return (
    <div style={{ marginTop: "1rem", maxWidth: 500, margin: "auto" }}>
      <h2>{mode === "enroll" ? "Enroll Pattern" : "Login with Pattern"}</h2>

      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="Enter username"
        style={{ marginBottom: "0.5rem", padding: "6px", width: "100%" }}
      />

      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Enter email (for fallback)"
        style={{ marginBottom: "1rem", padding: "6px", width: "100%" }}
      />

      <div className={fade ? "fade-out" : ""}>
        <CanvasDraw
          ref={canvasRef}
          canvasWidth={300}
          canvasHeight={300}
          brushRadius={2}
          brushColor="#007bff"
          lazyRadius={1}
          hideGrid
          style={{ border: "1px solid #ccc", borderRadius: "10px" }}
        />
      </div>

      <div style={{ marginTop: "1rem" }}>
        <button
          onClick={mode === "enroll" ? enrollPattern : matchPattern}
          style={{ marginRight: "0.5rem" }}
        >
          {mode === "enroll" ? "Enroll" : "Login"}
        </button>

        <button onClick={handleClear} style={{ marginRight: "0.5rem" }}>
          Clear
        </button>

        <button
          onClick={() => setMode(mode === "enroll" ? "login" : "enroll")}
          style={{ marginRight: "0.5rem" }}
        >
          Switch to {mode === "enroll" ? "Login" : "Enroll"}
        </button>

        <button onClick={sendFallbackLink}>Send Fallback Email</button>
      </div>
    </div>
  );
}

export default PatternCanvas;
