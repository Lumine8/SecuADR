const express = require('express');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const router = express.Router();

// In-memory storage (replace with Redis/MongoDB later)
const authCodes = new Map();
const sessions = new Map();

// Environment variables
const JWT_SECRET = process.env.JWT_SECRET || 'secuadr-secret-change-this';
const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';
const REACT_APP_URL = process.env.REACT_APP_URL || 'http://localhost:3001';

// OIDC Discovery Endpoint
router.get('/.well-known/openid-configuration', (req, res) => {
  console.log('📋 OIDC Discovery requested');
  res.json({
    issuer: BASE_URL,
    authorization_endpoint: `${BASE_URL}/api/oidc/authorize`,
    token_endpoint: `${BASE_URL}/api/oidc/token`,
    userinfo_endpoint: `${BASE_URL}/api/oidc/userinfo`,
    response_types_supported: ['code'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['HS256'],
  });
});

// Authorization Endpoint - Redirect to React App
router.get('/authorize', (req, res) => {
  console.log('🔐 OIDC Authorization Request:', req.query);
  
  const { client_id, redirect_uri, state, response_type, scope } = req.query;

  // Validate parameters
  if (!client_id || !redirect_uri || !state || response_type !== 'code') {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing or invalid required parameters'
    });
  }

  // Create session
  const sessionId = uuidv4();
  sessions.set(sessionId, {
    client_id,
    redirect_uri,
    state,
    scope,
    createdAt: Date.now()
  });

  // Auto-expire session in 5 minutes
  setTimeout(() => sessions.delete(sessionId), 300000);

  // Redirect to React app
  const authUrl = `${REACT_APP_URL}/gesture-auth?session=${sessionId}&redirect=${encodeURIComponent(redirect_uri)}&state=${state}`;
  
  console.log('🔀 Redirecting to React App:', authUrl);
  res.redirect(authUrl);
});

// Verify Gesture - Called from React App
router.post('/verify-gesture', async (req, res) => {
  console.log('🧠 Verifying gesture for OIDC...');
  
  const { sessionId, gestureData } = req.body;

  // Validate session
  const session = sessions.get(sessionId);
  if (!session) {
    return res.status(400).json({
      success: false,
      error: 'Invalid or expired session'
    });
  }

  // Validate gesture data
  if (!gestureData || !Array.isArray(gestureData) || gestureData.length < 3) {
    return res.json({
      success: false,
      error: 'Invalid gesture - please draw a valid pattern'
    });
  }

  // Use gesture validation logic
  const complexity = calculateComplexity(gestureData);
  const smoothness = calculateSmoothness(gestureData);
  const confidence = Math.min(0.98, Math.max(0.3, complexity * 0.6 + smoothness * 0.4));

  console.log(`🎯 Gesture: ${gestureData.length} points, confidence: ${(confidence * 100).toFixed(1)}%`);

  if (confidence < 0.65) {
    return res.json({
      success: false,
      error: 'Gesture authentication failed - confidence too low'
    });
  }

  // Generate authorization code
  const authCode = uuidv4();
  
  // TODO: Replace with real user lookup from your database
  const userId = 'demo-user-' + Date.now();
  const userEmail = 'demo@secuadr.com';

  authCodes.set(authCode, {
    userId,
    email: userEmail,
    confidence,
    sessionId,
    redirect_uri: session.redirect_uri,
    state: session.state,
    createdAt: Date.now()
  });

  // Auto-expire code in 60 seconds
  setTimeout(() => authCodes.delete(authCode), 60000);

  const redirectUrl = `${session.redirect_uri}?code=${authCode}&state=${session.state}`;
  
  console.log('✅ Gesture verified, auth code generated');

  res.json({
    success: true,
    redirectUrl
  });
});

// Token Endpoint - Exchange code for JWT
router.post('/token', (req, res) => {
  console.log('🎫 Token Exchange Request');
  
  const { grant_type, code, redirect_uri, client_id, client_secret } = req.body;

  if (grant_type !== 'authorization_code') {
    return res.status(400).json({
      error: 'unsupported_grant_type',
      error_description: 'Only authorization_code is supported'
    });
  }

  if (!code) {
    return res.status(400).json({
      error: 'invalid_request',
      error_description: 'Missing authorization code'
    });
  }

  const authData = authCodes.get(code);
  
  if (!authData) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Invalid or expired authorization code'
    });
  }

  if (authData.redirect_uri !== redirect_uri) {
    return res.status(400).json({
      error: 'invalid_grant',
      error_description: 'Redirect URI mismatch'
    });
  }

  // Delete code (one-time use)
  authCodes.delete(code);

  // Generate JWT tokens
  const tokenPayload = {
    sub: authData.userId,
    preferred_username: authData.email,
    email: authData.email,
    iss: BASE_URL,
    aud: client_id,
    exp: Math.floor(Date.now() / 1000) + 3600,
    iat: Math.floor(Date.now() / 1000),
    auth_method: 'SecuADR_Gesture',
    confidence: authData.confidence
  };

  const access_token = jwt.sign(tokenPayload, JWT_SECRET);
  const id_token = jwt.sign(tokenPayload, JWT_SECRET);

  console.log('✅ Tokens generated for:', authData.email);

  res.json({
    access_token,
    id_token,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: 'openid profile email'
  });
});

// UserInfo Endpoint
router.get('/userinfo', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'invalid_token',
      error_description: 'Missing or invalid authorization header'
    });
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    res.json({
      sub: decoded.sub,
      preferred_username: decoded.preferred_username,
      email: decoded.email,
      auth_method: decoded.auth_method,
      confidence: decoded.confidence
    });
  } catch (error) {
    res.status(401).json({
      error: 'invalid_token',
      error_description: 'Token verification failed'
    });
  }
});

// Helper functions for gesture validation
function calculateComplexity(points) {
  if (!points || points.length < 3) return 0.3;
  
  let totalDistance = 0;
  let angleChanges = 0;
  
  for (let i = 1; i < points.length; i++) {
    const dx = points[i].x - points[i - 1].x;
    const dy = points[i].y - points[i - 1].y;
    totalDistance += Math.sqrt(dx * dx + dy * dy);
    
    if (i > 1) {
      const prevDx = points[i - 1].x - points[i - 2].x;
      const prevDy = points[i - 1].y - points[i - 2].y;
      const angle1 = Math.atan2(prevDy, prevDx);
      const angle2 = Math.atan2(dy, dx);
      angleChanges += Math.abs(angle2 - angle1);
    }
  }
  
  const avgDistance = totalDistance / points.length;
  const avgAngleChange = angleChanges / Math.max(points.length - 2, 1);
  
  return Math.min(1, (avgDistance / 30) * 0.5 + (avgAngleChange / Math.PI) * 0.5);
}

function calculateSmoothness(points) {
  if (!points || points.length < 5) return 0.5;
  
  let smoothness = 0;
  for (let i = 2; i < points.length - 2; i++) {
    const p1 = points[i - 2];
    const p2 = points[i - 1];
    const p3 = points[i];
    const p4 = points[i + 1];
    const p5 = points[i + 2];
    
    const accel1 = Math.abs(p3.x - 2 * p2.x + p1.x + (p3.y - 2 * p2.y + p1.y));
    const accel2 = Math.abs(p4.x - 2 * p3.x + p2.x + (p4.y - 2 * p3.y + p2.y));
    const accel3 = Math.abs(p5.x - 2 * p4.x + p3.x + (p5.y - 2 * p4.y + p3.y));
    
    smoothness += 1 / (1 + (accel1 + accel2 + accel3) / 3);
  }
  
  return smoothness / (points.length - 4);
}

module.exports = router;
