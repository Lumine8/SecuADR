import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PatternCanvas from "./components/PatternCanvas";
import FallbackLogin from "./components/FallbackLogin";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<PatternCanvas />} />
        <Route path="/fallback/:token" element={<FallbackLogin />} />
      </Routes>
    </Router>
  );
}

export default App;
