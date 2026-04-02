# SecuADR Authentication Integration Test Guide

## System Architecture Overview

```
Frontend (PatternCanvas)
  ↓ Raw Gesture Points [{X,Y,ID}]
  ↓
Backend Routes
  ├→ POST /api/sfam/enroll (enrollSfam.js)
  └→ POST /api/authenticate (authenticate.js)
     ↓
Backend Transformation
  ├→ sfamClient.js (orchestrator)
  └→ gestureFeatures.js (transformGestureToSFAM)
     ├→ createSpatialRepresentation() [224×224 RGB]
     └→ extractBehavioralFeatures() [64×6 matrix]
        ↓
Python SFAM Service (http://localhost:8000)
  ├→ POST /sfam/enroll → {hash, seed, salt}
  └→ POST /sfam/verify → {is_match, hash_distance, confidence}
     ↓
MongoDB User Collection
  ├→ Store: {username, sfam: {hash, seed, salt, enrolledAt}}
  └→ Query: Find enrolled users and verify against baseline
```

## Frontend Data Format

All gesture data from frontend must follow this structure:

```javascript
{
  X: number,      // X coordinate (0-320)
  Y: number,      // Y coordinate (0-320)
  ID: number      // Pressure/intensity (0-255)
}
```

**Example gesture pattern:**

```javascript
[
  { X: 100, Y: 150, ID: 200 },
  { X: 105, Y: 155, ID: 205 },
  { X: 110, Y: 160, ID: 210 },
  // ... minimum 5 points required
];
```

## Backend Endpoints

### 1. Enrollment - POST /api/sfam/enroll

**Request:**

```json
{
  "username": "john.doe",
  "pattern": [
    { "X": 100, "Y": 150, "ID": 200 },
    { "X": 105, "Y": 155, "ID": 205 },
    { "X": 110, "Y": 160, "ID": 210 },
    { "X": 115, "Y": 165, "ID": 215 },
    { "X": 120, "Y": 170, "ID": 220 }
  ]
}
```

**Success Response (200):**

```json
{
  "success": true,
  "message": "SFAM enrollment successful",
  "enrolledAt": "2024-01-15T10:30:00.000Z",
  "userId": "507f1f77bcf86cd799439011"
}
```

**Failure Responses:**

- `400`: Invalid pattern (< 5 points, malformed points)
- `403`: User already enrolled
- `404`: User not found
- `503`: SFAM service unavailable

### 2. Authentication - POST /api/authenticate

**Request:**

```json
{
  "username": "john.doe",
  "pattern": [
    { "X": 102, "Y": 152, "ID": 205 },
    { "X": 107, "Y": 157, "ID": 210 },
    { "X": 112, "Y": 162, "ID": 215 },
    { "X": 117, "Y": 167, "ID": 220 },
    { "X": 122, "Y": 172, "ID": 225 }
  ],
  "sessionId": "optional-session-id",
  "deviceFingerprint": {
    "userAgent": "Mozilla/5.0...",
    "screen": "1920x1080",
    "timezone": "America/New_York"
  }
}
```

**Success Response (200):**

```json
{
  "success": true,
  "authenticated": true,
  "username": "john.doe",
  "token": "eyJhbGc...",
  "method": "SFAM Gesture Recognition",
  "confidence": 0.95,
  "message": "Authentication successful",
  "sessionId": "optional-session-id"
}
```

**Failure Response (401):**

```json
{
  "success": false,
  "authenticated": false,
  "username": "john.doe",
  "message": "Authentication failed: Gesture not recognized",
  "confidence": 0.15
}
```

## Data Transformation Pipeline

### Step 1: Raw Points Input

```javascript
const rawPoints = [
  { X: 100, Y: 150, ID: 200 },
  { X: 105, Y: 155, ID: 205 },
  // ...
];
```

### Step 2: Spatial Representation

- Generates a 224×224 RGB image (3 channels)
- Draws the gesture stroke using Bresenham's line algorithm
- Normalizes to bounding box
- Creates anti-aliasing effect with channel blending

**Output shape:** `[3][224][224]` = 3D array

### Step 3: Behavioral Features

- Calculates 6 features per frame for up to 64 frames
- Features: `[dx, dy, velocity, acceleration, pressure, azimuth]`
- Pads with zeros if < 64 frames
- Captures dynamic properties of the gesture

**Output shape:** `[64][6]` = 2D array

### Step 4: SFAM Processing

Sends to Python service:

```json
{
  "spatial": [3][224][224],
  "behavioral": [64][6],
  "reference": {"sfam_hash": [...], "seed": 12345, "salt": "abc123"}
}
```

Returns:

```json
{
  "is_match": true,
  "hamming_distance": 0.25,
  "auth_pass": true,
  "confidence": 0.75
}
```

## Testing Checklist

### Prerequisites

- [ ] MongoDB running and accessible
- [ ] Python SFAM service running at `http://localhost:8000`
- [ ] Backend API running at `http://localhost:5000`
- [ ] Frontend running at `http://localhost:5173` or `http://localhost:3001`
- [ ] Node.js dependencies installed: `npm install` in `secuadr-api-server/` and `pattern-login/`

### Enrollment Test

```javascript
// Step 1: Create user in MongoDB (or via frontend registration)
// Step 2: Draw pattern on canvas
// Step 3: Click "Enroll" button
// Expected console logs:
// ✅ "📝 SFAM enrollment request for user: john.doe"
// ✅ "🔐 Enrolling user john.doe with SFAM..."
// ✅ "✅ SFAM hash generated (length: 256, confidence: 0.98)"
// ✅ "✅ User john.doe enrolled in SFAM database"
```

### Authentication Test

```javascript
// Step 1: User must be enrolled first
// Step 2: Draw pattern on canvas (should be similar to enrolled pattern)
// Step 3: Click "Authenticate" button
// Expected console logs:
// ✅ "📝 Auth attempt for user: john.doe"
// ✅ "✅ User found: john.doe, SFAM enrolled: true"
// ✅ "✅ SFAM Result: MATCH | Distance: 0.250 | Confidence: 0.750"
// ✅ "✅ Authentication SUCCEEDED for john.doe"
```

### Error Handling Test

```javascript
// Test 1: Non-existent user
// → Expected: 401 "Authentication failed"

// Test 2: User not enrolled
// → Expected: 401 "Authentication failed: User not enrolled in gesture authentication"

// Test 3: SFAM service down
// → Expected: 401 "Authentication failed: gesture not recognized"

// Test 4: Invalid gesture (< 5 points)
// → Expected: 400 "Invalid gesture pattern: minimum 5 points required"
```

## Console Log Indicators

### Expected Logs for Enroll

```
📝 SFAM enrollment request for user: [username]
🔌 SFAM Service Status: HEALTHY
🔐 Enrolling user [username] with SFAM...
✅ SFAM hash generated (length: 256, confidence: 0.98)
✅ User [username] enrolled in SFAM database
```

### Expected Logs for Auth

```
📝 Auth attempt for user: [username]
✅ User found: [username], SFAM enrolled: true
🔌 SFAM Service Status: HEALTHY
🔍 Running SFAM verification for [username]...
✅ SFAM Result: MATCH | Distance: 0.250 | Confidence: 0.750
✅ Authentication SUCCEEDED for [username]
```

### Error Logs

```
⚠️ SFAM Verification Error: [error message]
❌ User [username] not enrolled in SFAM
⚠️ SFAM service is unavailable
```

## Troubleshooting

### Issue: "SFAM service unavailable"

**Solution:**

1. Check if Python SFAM service is running on port 8000
2. Verify `SFAM_SERVICE_URL` in config matches service address
3. Check firewall/network connectivity
4. Review SFAM service logs for errors

### Issue: "User not found"

**Solution:**

1. Verify user exists in MongoDB `secuadr.users` collection
2. Check username spelling matches exactly
3. Ensure MongoDB is running and accessible

### Issue: "Invalid gesture pattern: minimum 5 points required"

**Solution:**

1. User must draw more points on the canvas
2. Each mouse move generates a new point
3. Ensure pattern is not too fast (should take 1-3 seconds)

### Issue: "Authentication failed: gesture not recognized" (False Reject)

**Possible causes:**

- User's gesture changed significantly from enrollment
- Drawing speed/pressure different from enrollment
- SFAM threshold too strict
  **Solution:**
- Ask user to re-enroll with cleaner gesture
- Adjust SFAM distance threshold if needed

### Issue: Endpoint not found (404)

**Solution:**

1. Verify frontend URL matches backend endpoint:
   - Enroll: `/api/sfam/enroll` (not `/api/save-pattern`)
   - Auth: `/api/authenticate`
2. Check backend server is running on correct port
3. Verify CORS configuration allows frontend origin

## Performance Expectations

| Operation           | Typical Time | Max Time   |
| ------------------- | ------------ | ---------- |
| Gesture drawing     | 1-3 seconds  | 10 seconds |
| Pattern validation  | < 100ms      | 500ms      |
| SFAM transformation | < 500ms      | 2 seconds  |
| SFAM verification   | 1-2 seconds  | 5 seconds  |
| Auth response       | 2-3 seconds  | 10 seconds |
| DB save             | < 200ms      | 1 second   |

## Security Considerations

1. **Never log raw gesture data** - Only log metadata and results
2. **Always validate input** - Minimum 5 points, correct structure
3. **Prevent user enumeration** - Return generic "Authentication failed" message
4. **Rate limiting** - Consider adding request throttling
5. **HTTPS in production** - Always use TLS for credential transmission
6. **SFAM hash protection** - Store only hash, seed, salt (never raw patterns)
7. **Token validation** - Verify JWT tokens on protected routes

## Sample Integration Code

### Frontend Enrollment

```javascript
const enrollGesture = async (username, pattern) => {
  const response = await fetch("http://localhost:5000/api/sfam/enroll", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, pattern }),
  });
  return response.json();
};
```

### Frontend Authentication

```javascript
const authenticateGesture = async (username, pattern) => {
  const response = await fetch("http://localhost:5000/api/authenticate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username,
      pattern,
      sessionId: generateSessionId(),
      deviceFingerprint: getDeviceFingerprint(),
    }),
  });
  return response.json();
};
```

## Next Steps

1. ✅ Test enrollment flow with sample user
2. ✅ Test authentication with same user
3. ✅ Test error cases (non-existent user, wrong gesture)
4. ✅ Monitor console logs for proper data flow
5. ✅ Verify SFAM service is receiving transformed data correctly
6. ✅ Validate token generation and storage
7. ✅ Test edge cases (very fast drawing, very slow drawing)
8. ⏳ Implement rate limiting on API endpoints
9. ⏳ Add logging/analytics for monitoring
10. ⏳ Prepare for production deployment
