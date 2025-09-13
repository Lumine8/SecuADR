import React, { useRef } from "react";
import CanvasDraw from "react-canvas-draw";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import DollarRecognizer, { Point } from "../utils/dollarOneRecognizer";

function FallbackLogin() {
  const canvasRef = useRef(null);
  const { token } = useParams();
  const navigate = useNavigate();

  const extractPoints = () => {
    const raw = JSON.parse(canvasRef.current.getSaveData());
    return raw.lines.flatMap((line) =>
      line.points.map((pt) => new Point(pt.x, pt.y, 0))
    );
  };

  const handleLogin = async () => {
    const points = extractPoints();

    try {
      const res = await axios.post("http://localhost:5000/api/fallback-auth", {
        token,
        attempt: points,
      });

      if (res.data.success) {
        alert("✅ Fallback login successful!");
        navigate("/dashboard");
      } else {
        alert("❌ Login failed");
      }
    } catch (err) {
      console.error(err);
      alert("❌ Something went wrong. Try again.");
    }
  };

  return (
    <div style={{ padding: "1rem" }}>
      <h2>Fallback Pattern Login</h2>
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
      <div style={{ marginTop: "1rem" }}>
        <button onClick={handleLogin}>Submit Pattern</button>
      </div>
    </div>
  );
}

export default FallbackLogin;
