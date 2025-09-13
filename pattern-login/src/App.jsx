import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PatternCanvas from "./components/PatternCanvas";
import FallbackLogin from "./components/FallbackLogin";
import GestureRecognition from "./components/GestureRecognition";
import DebugStatus from "./components/DebugStatus";

function App() {
  return (
    <Router>
      <GestureRecognition /> {/* ✅ This will render on all pages */}
      <DebugStatus /> {/* ✅ This will render on all pages */}
      <Routes>
        <Route path='/' element={<PatternCanvas />} />
        <Route path='/fallback/:token' element={<FallbackLogin />} />
      </Routes>
    </Router>
  );
}

export default App;
