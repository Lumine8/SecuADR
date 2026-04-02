import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import PatternCanvas from "./components/PatternCanvas";
import FallbackLogin from "./components/FallbackLogin";
import GestureRecognition from "./components/GestureRecognition";
import OIDCGestureAuth from "./components/OIDCGestureAuth";
import Enrollment from "./components/Enrollment";
import BehaviorTrustDashboard from "./components/BehaviorTrustDashboard";
import AuthService from "./services/auth";

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already authenticated via token in localStorage
    const token = localStorage.getItem('auth_token');
    const user = localStorage.getItem('current_user');

    if (token && user) {
      setIsAuthenticated(true);
      setCurrentUser(user);
    }
    setLoading(false);
  }, []);

  const handleLoginSuccess = (userData) => {
    setIsAuthenticated(true);
    setCurrentUser(userData.username);
    localStorage.setItem('auth_token', userData.token);
    localStorage.setItem('current_user', userData.username);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentUser(null);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('current_user');
  };

  const handleEnrollmentComplete = (username) => {
    handleLoginSuccess({ username, token: 'enrollment-token' });
  };

  if (loading) {
    return <div className="app-loading">Loading...</div>;
  }

  return (
    <Router>
      <GestureRecognition />

      <Routes>
        {/* Public Routes */}
        <Route
          path='/'
          element={<PatternCanvas onLoginSuccess={handleLoginSuccess} />}
        />

        <Route
          path='/login'
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <PatternCanvas onLoginSuccess={handleLoginSuccess} />
            )
          }
        />

        <Route
          path='/enroll'
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Enrollment onEnrollmentComplete={handleEnrollmentComplete} />
            )
          }
        />

        <Route path='/fallback/:token' element={<FallbackLogin />} />
        <Route path='/gesture-auth' element={<OIDCGestureAuth />} />
        <Route path='/trust-lab' element={<BehaviorTrustDashboard />} />

        {/* Catch All */}
        <Route
          path='*'
          element={
            isAuthenticated ? (
              <Navigate to="/" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
