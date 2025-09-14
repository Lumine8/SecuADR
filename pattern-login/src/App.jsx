import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import PatternCanvas from "./components/PatternCanvas";
import FallbackLogin from "./components/FallbackLogin";
import GestureRecognition from "./components/GestureRecognition";
// import DebugStatus from "./components/DebugStatus"; // REMOVED

function App() {
  return (
    <Router>
      <GestureRecognition />
      {/* <DebugStatus /> REMOVED - No more debug info */}

      <Routes>
        <Route path='/' element={<PatternCanvas />} />
        <Route path='/login' element={<PatternCanvas />} />
        <Route path='/enroll' element={<PatternCanvas />} />
        <Route path='/fallback/:token' element={<FallbackLogin />} />
        <Route path='*' element={<PatternCanvas />} />
      </Routes>
    </Router>
  );
}

export default App;
