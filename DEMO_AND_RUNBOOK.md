# SecuADR MVP - Implementation & Demo Guide

**Version:** 1.0  
**Status:** Ready for Development  
**Date:** April 2026

---

## 🚀 QUICK START

### Prerequisites

- Node.js 16+
- Python 3.8+
- MongoDB 4.0+
- npm/yarn

### 1. Install Dependencies

**Backend:**

```bash
cd secuadr-api-server
npm install
```

**Frontend:**

```bash
cd ../pattern-login
npm install
```

**Python SFAM Service:**

```bash
cd ../sfam_service
pip install -r requirements.txt
# OR if using SFAM project reference:
pip install -e ../SFAM/sfam_project
```

### 2. Start Services (4 terminals)

**Terminal 1 - MongoDB:**

```bash
# Linux/Mac
mongod

# Windows
mongod.exe
```

**Terminal 2 - Python SFAM Service:**

```bash
cd sfam_service
python main.py
# Should show: Uvicorn running on http://127.0.0.1:8000
```

**Terminal 3 - Node.js Backend:**

```bash
cd secuadr-api-server
npm run dev
# Should show: SecuADR API Server running on http://localhost:5000
```

**Terminal 4 - React Frontend:**

```bash
cd pattern-login
npm start
# Should show: http://localhost:5173
```

---

## 🎬 DEMO FLOW (3 Scenarios)

### Scenario 1: Legitimate User - ACCEPTED ✅

**Setup:**

1. Go to http://localhost:5173
2. Create user: username="alice" email="alice@test.com"
3. Click "ENROLL" button
4. Draw your gesture 3 times (must be consistent)
5. System enrolls and creates behavioral baseline

**Actions:**

- Dashboard shows: ✅ Enrolled
- SFAM Hash: Recorded as baseline
- Risk Level: LOW (new user, clean baseline)

**Then authenticate:**

1. Click "LOGIN"
2. Draw the SAME gesture again
3. Watch the system process:
   - Input Layer: Gesture captured
   - SFAM Layer: Hash computed, compared to baseline
   - RLFS Layer: Hamming distance calculated (should be ~5-10%)
   - S-ADR Layer: Makes decision (ALLOW)
4. Result: ✅ **ALLOWED** - Token issued

**Dashboard shows:**

- ✅ Authentication Success
- Risk Level: LOW
- SFAM Hash Match: 90-95%
- All features normal
- All 5 layers green ✅

---

### Scenario 2: Same Shape, Different Behavior - REJECTED ❌

**Setup:**

- Use Same user "alice" from Scenario 1

**Actions:**

1. Click "LOGIN" for alice
2. But this time: Draw the pattern **FAST** (deliberately speed it up)
   - Shape is correct (same coordinates)
   - But timing is completely different
3. System processes:
   - Input Layer: Captures fast execution
   - SFAM Layer: Hash computed from gesture
   - **RLFS Layer ALERT**: Velocity spike detected! (Z-score > 3)
     - Gesture velocity: 500px/ms (vs baseline 100px/ms)
     - Gesture acceleration: Much higher than normal
   - **Anomaly Score: 0.65** (HIGH)
   - **S-ADR Layer**: Compares against threshold
     - Threshold for alice: 0.40
     - 0.65 > 0.40 + 0.35 = BLOCK
4. Result: ❌ **BLOCKED** - Access Denied

**Dashboard shows:**

- ❌ Authentication Failed
- Risk Level: CRITICAL
- Detected Anomalies: speed_spike, unusual_acceleration
- Feature Alerts: "Gesture executed faster than baseline"
- Alert Summary: **"Possible impostor mimicking shape but not behavior"**

---

### Scenario 3: Legitimate User with Variation - ALLOWED WITH WARNING ⚠️

**Setup:**

- Use Same user "alice" from Scenario 1
- Simulate: User has hand tremor (slight injury/stress)

**Actions:**

1. Click "LOGIN" for alice
2. Draw gesture but with SLIGHT variations:
   - Overall shape correct
   - But with noticeable jitter/tremor
   - Timestamp distribution slightly different
   - Take ~10% longer than baseline
3. System processes:
   - Input Layer: Captures shaky gesture
   - SFAM Layer: Hash computed
   - **RLFS Layer**: Detects jitter
     - Jerk Z-score elevated (2.5σ)
     - But velocity still reasonable
     - Anomaly Score: 0.28 (MEDIUM)
   - **S-ADR Layer**:
     - Alice has high trust history (enrolled + successful logins)
     - Adaptive threshold lowered to: 0.30
     - But also: is_after_hours=false, familiar_device=true
     - 0.28 < 0.30 = ALLOW
     - But 0.28 is > high confidence threshold
     - Decision: **ALLOW_WITH_WARNING**
4. Result: ✅ **ALLOWED** (with caution flag)

**Dashboard shows:**

- ✅ Authentication Success (with yellow warning icon)
- Risk Level: MEDIUM
- SFAM Hash Match: 87%
- Features: Some variation detected
- Message: **"Session authenticated but with slight behavioral variation. System monitoring for changes. If permanent, update profile."**

---

## 📊 EXPECTED OUTPUTS

### Authentication Response (Success)

```json
{
  "success": true,
  "decision": "ALLOW",
  "risk_level": "LOW",
  "confidence": 0.95,
  "token": "eyJhbG...",
  "message": "Anomaly score 0.08 below threshold 0.40. Access granted.",
  "requires_challenge": false,
  "session_id": "507f1f77bcf86cd799439011"
}
```

### Dashboard Session View

```json
{
  "session_id": "507f1f77bcf86cd799439011",
  "timestamp": "2026-04-01T14:30:00Z",
  "sfam_hash_distance": 0.08,
  "rlfs_anomaly_score": 0.08,
  "rlfs_confidence": "high",
  "detected_anomalies": [],
  "sadr_decision": "ALLOW",
  "risk_level": "LOW",
  "layers_status": {
    "input": "✅ 123 points captured",
    "sfam": "✅ Hash matched baseline",
    "behavioral_model": "✅ Profile loaded",
    "rlfs": "✅ No anomalies",
    "sadr": "✅ ALLOW decision"
  }
}
```

---

## 🧪 TESTING WITHOUT FRONTEND

Use curl or Postman:

### Test Enrollment

```bash
curl -X POST http://localhost:5000/api/auth/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice_001",
    "gesture": [
      {"x": 100, "y": 200, "timestamp": 0},
      {"x": 110, "y": 205, "timestamp": 50},
      {"x": 120, "y": 210, "timestamp": 100},
      {"x": 130, "y": 215, "timestamp": 150}
    ]
  }'
```

### Test Authentication (Normal)

```bash
curl -X POST http://localhost:5000/api/auth/gesture \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice_001",
    "gesture": [
      {"x": 100, "y": 200, "timestamp": 0},
      {"x": 110, "y": 205, "timestamp": 50},
      {"x": 120, "y": 210, "timestamp": 100},
      {"x": 130, "y": 215, "timestamp": 150}
    ],
    "device_context": {
      "is_new": false,
      "is_after_hours": false
    }
  }'
```

### Test Authentication (Fast - Attack)

```bash
# Same shape but 10x faster (timestamp /10)
curl -X POST http://localhost:5000/api/auth/gesture \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "alice_001",
    "gesture": [
      {"x": 100, "y": 200, "timestamp": 0},
      {"x": 110, "y": 205, "timestamp": 5},
      {"x": 120, "y": 210, "timestamp": 10},
      {"x": 130, "y": 215, "timestamp": 15}
    ]
  }'
```

---

## 🔍 SYSTEM INSPECTION

### Check Server Status

```bash
curl http://localhost:5000/health
curl http://localhost:5000/api/status
```

### Get Session History

```bash
curl "http://localhost:5000/api/dashboard/sessions?user_id=alice_001&limit=10"
```

### MongoDB Query (in mongo shell)

```javascript
// View user
db.users.findOne({ username: "alice" });

// View profile
db.behavioral_profiles.findOne({ username: "alice" });

// View sessions
db.sessions.find({ user_id: ObjectId("...") }).pretty();

// View risk logs
db.risk_logs.find({ severity: "critical" }).pretty();
```

---

## 🎯 KEY METRICS & THRESHOLDS

### Anomaly Scoring (RLFS)

- **0.00 - 0.15**: High confidence (normal)
- **0.15 - 0.40**: Medium confidence (variation)
- **0.40 - 0.65**: Low confidence (suspicious)
- **0.65 - 1.00**: Anomalous (likely attack)

### Risk Levels (S-ADR)

- **LOW**: Anomaly < threshold, grant access
- **MEDIUM**: Anomaly slightly above threshold, warn user
- **HIGH**: Anomaly in challenge zone, request step-up auth
- **CRITICAL**: Anomaly far above, deny access + log incident

### Feature Thresholds

- **Gesture Velocity**: >3σ deviation = anomaly
- **Typing Rhythm**: >2σ deviation = anomaly
- **Session Time-of-Day**: Outside normal hours = +0.5 anomaly
- **Device/Location**: New = +0.15 adaptive threshold increase

---

## 📋 FEATURE CHECKLIST

### Layer 1: Input Layer ✅

- [x] Gesture point capture
- [x] Physics extraction (velocity, acceleration, jerk)
- [x] Typing dynamics (dwell time, flight time)
- [x] Touch input processing
- [x] Session context capture

### Layer 2: SFAM Integration ✅

- [x] SFAM client configured
- [x] Enrollment endpoint implemented
- [x] Verification against baseline
- [x] Hamming distance calculation
- [x] Hash storage in DB

### Layer 3: Behavioral Model ✅

- [x] User profile schema
- [x] Feature baseline tracking
- [x] Session history
- [x] Statistics accumulation

### Layer 4: RLFS Module ✅

- [x] Anomaly score calculation
- [x] Feature-level analysis
- [x] Temporal pattern detection
- [x] Adversarial signature detection
- [x] Confidence assessment

### Layer 5: S-ADR Module ✅

- [x] Adaptive threshold calculation
- [x] Trust factor analysis
- [x] Context-aware decision making
- [x] Risk level determination
- [x] Action recommendations

### Dashboard ⏳ (Next Phase)

- [ ] Session View component
- [ ] Risk Monitor component
- [ ] Drift Detection component
- [ ] Feature Insights component
- [ ] Real-time stats

### Security ⏳ (Next Phase)

- [ ] HTTPS/TLS configuration
- [ ] Rate limiting
- [ ] Input validation
- [ ] Audit logging
- [ ] CSRF protection

---

## 🐛 TROUBLESHOOTING

### "SFAM service unreachable"

- Check Python service is running on port 8000
- Verify SFAM url in .env: `SFAM_SERVICE_URL=http://localhost:8000`
- Test: `curl http://localhost:8000/health`

### "Database connection failed"

- Check MongoDB is running: `mongod --version`
- Check connection string in .env: `MONGODB_URI=mongodb://localhost:27017/secuadr`
- Test: `mongo mongodb://localhost:27017/secuadr`

### "Missing dependencies"

- Run: `npm install` in both secuadr-api-server and pattern-login
- Clear node_modules and reinstall if issues persist

### "CORS errors in browser"

- Check CORS_ORIGIN in .env includes your frontend URL
- Frontend at 3001: add `CORS_ORIGIN=http://localhost:3001,http://localhost:5173`
- Clear browser cache and try again

---

## 📈 PERFORMANCE TIPS

- SFAM verification: 2-3 seconds typically
- RLFS analysis: <100ms
- S-ADR decision: <50ms
- Total auth time: 3-4 seconds target
- Query database sessions in dashboard for latest 50 only

---

## 🔐 SECURITY NOTES

### For Production

1. Change JWT_SECRET in .env
2. Setup HTTPS/TLS
3. Use environment-based configuration
4. Enable rate limiting middleware
5. Add request validation
6. Implement audit logging
7. Use connection pools for MongoDB
8. Consider caching SFAM hashes

### For Demo

- All current setup is demo-safe
- No real user data collected
- Hardcoded secrets OK for internal testing

---

## 📞 NEXT STEPS

1. **Test the 3 scenarios above**
2. **Build React dashboard** (connects to /api/dashboard/\* endpoints)
3. **Add step-up authentication** (email OTP, SMS, security questions)
4. **Production deployment** (Docker, Kubernetes)
5. **Performance optimization** (caching, async workers)

---

**Questions?** Refer to architecture document: [REFACTORING_ARCHITECTURE.md](REFACTORING_ARCHITECTURE.md)
