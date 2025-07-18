import React, { useRef, useState, useEffect } from "react";
import CanvasDraw from "react-canvas-draw";
import axios from "axios";
import DollarRecognizer, { Point } from "../utils/dollarOneRecognizer";
import "./PatternCanvas.scss"; // Import SCSS
import logo from "../assets/logoRmvBg.png";
// import designLogo from "../assets/mainlogo.png";

function PatternCanvas() {
  const canvasRef = useRef(null);
  const recognizer = useRef(new DollarRecognizer());

  const [mode, setMode] = useState("enroll");
  const [fade, setFade] = useState(false);
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");

  // Load stored pattern (optional)
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
    setTimeout(() => setFade(true), 500);
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
    <div className="pattern-container">
      <img src={logo} alt="Logo" className="logo" style={{ width: "40%" }} />
      <div className="pattern-card">
        <h2>{mode === "enroll" ? "Enroll Pattern" : "Login with Pattern"}</h2>

        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Enter username"
        />

        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Enter email (for fallback)"
        />

        <div className={`canvas-wrapper ${fade ? "fade-out" : ""}`}>
          <CanvasDraw
            ref={canvasRef}
            canvasWidth={300}
            canvasHeight={300}
            brushRadius={2}
            brushColor="#007bff"
            lazyRadius={1}
            hideGrid
          />
        </div>

        <div className="button-group">
          <button
            className="primary-btn"
            onClick={mode === "enroll" ? enrollPattern : matchPattern}
          >
            {mode === "enroll" ? "Enroll" : "Login"}
          </button>

          <button onClick={handleClear}>Clear</button>

          <button
            onClick={() => setMode(mode === "enroll" ? "login" : "enroll")}
          >
            Switch to {mode === "enroll" ? "Login" : "Enroll"}
          </button>

          <button className="secondary-btn" onClick={sendFallbackLink}>
            Send Fallback Email
          </button>
        </div>
      </div>
    </div>
  );
}

export default PatternCanvas;
