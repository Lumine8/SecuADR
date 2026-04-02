# SecuADR Testing & Validation Guide

## Complete Testing Workflow

This guide will walk you through manually testing all three demo scenarios and validating the 5-layer authentication system.

## Prerequisites

### Required Services Running

```bash
# Terminal 1: Start MongoDB (if using local)
mongod

# Terminal 2: Start Python SFAM service
cd sfam_service
python main.py
# Should see: "Uvicorn running on http://127.0.0.1:8000"

# Terminal 3: Start Node.js API Server
cd secuadr-api-server
npm install
npm start
# Should see: "✅ SecuADR API Server running on http://localhost:5000"

# Terminal 4: Start React Frontend
cd pattern-login
npm install
npm run dev
# Should see: "Local: http://localhost:5173" (or similar)
```

### Check Services

```bash
# SFAM Health (should return {"status": "healthy"})
curl http://localhost:8000/health

# SecuADR API Health (should return {"status": "healthy"})
curl http://localhost:5000/health
```

---

## Scenario 1: Normal User Enrollment and Authentication

### Objective

Verify that a new user can enroll with consistent gesture patterns and authenticate successfully through all 5 layers.

### Steps

#### A. Enrollment Phase

1. Open browser: `http://localhost:5173`
2. Click "Sign Up" → Go to `/enroll`
3. **Enter Account Info**:
   - Username: `demo_user_001`
   - Email: `demo@example.com`
   - Click "Continue to Gesture Setup"

4. **First Gesture Sample**:
   - On the canvas, draw a distinctive pattern (e.g., circle + zigzag)
   - Make it ~15-30 points, take ~2-3 seconds
   - Click "Confirm Sample 1"
   - Should see: "Baseline sample 1/3 captured"

5. **Second & Third Samples**:
   - Repeat the same gesture (try to be consistent)
   - Click "Confirm Sample 2"
   - Repeat again, click "Confirm Sample 3"

6. **Review & Confirm**:
   - Should show: 3 samples collected
   - Click "✓ Complete Enrollment"
   - Should see success message and redirect to dashboard

#### B. Immediate First Authentication

1. User should be logged in automatically
2. Go to `/dashboard`
3. **Verify Dashboard**:
   - Shows "Total Sessions: 0" (enrollment didn't create session)
   - Risk Distribution is empty

#### C. First Authentication Attempt

1. Go back to `/login`
2. Enter username: `demo_user_001`
3. Draw the **exact same gesture** you just enrolled
4. Should see: SUCCESS ✅
   - Message: "Authentication successful!"
   - SFAM Distance should be LOW (< 50)
   - Anomaly Score should be LOW (< 0.3)
   - Decision: ALLOW, Risk: LOW

#### D. Verify in Dashboard

1. After login, go to `/dashboard`
2. **Overview Tab**:
   - "Total Sessions: 1"
   - "Avg Anomaly Score: ~0.15"
   - Risk shows: 1 LOW
   - Decision shows: 1 ALLOW

3. **Sessions Tab**:
   - See one row with:
     - Timestamp: current time
     - SFAM Distance: small number
     - Anomaly Score: < 0.3
     - Decision: ALLOW
     - Risk: LOW

4. **Click "Details"**:
   - Verify Layer outputs:
     - **SFAM**: Low hash distance (high confidence)
     - **RLFS**: Low anomaly score
     - **S-ADR**: ALLOW decision, LOW risk

### Expected Results

✅ User enrolls successfully
✅ First auth succeeds  
✅ Dashboard shows LOW risk
✅ All 5 layers operate correctly

### API Calls Made

```
POST /api/auth/enroll        ← Enrollment
POST /api/auth/gesture       ← Authentication
GET  /api/dashboard/sessions ← Dashboard load
```

---

## Scenario 2: Behavioral Anomaly Detection (High SFAM Distance)

### Objective

Simulate a user whose gesture behavior has changed significantly, triggering RLFS anomaly detection and S-ADR security response.

### Steps

#### A. Use Previously Enrolled User

1. Go to `/login`
2. Enter username: `demo_user_001` (from Scenario 1)

#### B. Deliberately Draw Different Gesture

1. Instead of the consistent pattern, draw something **noticeably different**:
   - Much faster (1-2 seconds instead of 2-3)
   - Different shape or magnitude
   - Different pressure
2. Click authenticate

#### C. Expected Behavior (Check Response)

The system should:

- ❌ Show **FAILED** message
- Report: "Pattern not recognized"
- SFAM Distance: HIGH (> 100)
- Anomaly Score: MEDIUM-HIGH (0.4-0.6)
- Decision: Should be CHALLENGE or BLOCK (depending on threshold)
- Risk: HIGH or CRITICAL

#### D. Verify in Dashboard

1. Go to `/dashboard`
2. **Sessions Tab**:
   - See two rows now
   - Latest one should show:
     - High SFAM Distance
     - High Anomaly Score
     - Decision: CHALLENGE or BLOCK
     - Risk: HIGH

3. **Risk Monitor Tab**:
   - Chart shows spike in anomaly score
   - See alert for HIGH/CRITICAL risk session

4. **Click "Details"** on anomalous session:
   - **RLFS**: Anomaly score > 0.5
   - **S-ADR**: Threshold exceeded, decision to CHALLENGE/BLOCK

#### E. Re-Authenticate with Correct Gesture

1. Go back to `/login`
2. Enter `demo_user_001`
3. Draw the **correct gesture again** (like in Scenario 1)
4. Should see: **SUCCESS** ✅
   - Anomaly score drops back to LOW
   - Decision: ALLOW
   - Risk: LOW

### Expected Results

✅ Changed gesture is detected as anomalous
✅ RLFS correctly identifies high anomaly
✅ S-ADR makes CHALLENGE/BLOCK decision
✅ Correct gesture is recognized
✅ Dashboard shows risk spike and recovery

### Key Observations

- **SFAM**: Is very sensitive to pattern changes (compare distances)
- **RLFS**: Combines multiple signals to compute anomaly
- **S-ADR**: Adapts threshold based on history (first anomaly is more concerning)
- **Drift**: System shows temporary spike, then recovery

---

## Scenario 3: Multi-Session Learning and Profile Adaptation

### Objective

Demonstrate that the system learns from multiple authentic sessions and adapts the user's behavioral profile over time.

### Steps

#### A. Create New User for Clean History

1. Go to `/enroll`
2. **Account Info**:
   - Username: `demo_user_adaptive`
   - Email: `adaptive@example.com`

3. **Enrollment Samples**:
   - Draw baseline gesture 3 times (be consistent)
   - Slightly vary each one (e.g., 5% different timing)
   - This simulates natural variation

#### B. Perform 5 Authentication Attempts (Normal Behavior)

1. Go to `/login`, authenticate as `demo_user_adaptive`
2. Each time, draw gesture with **slight natural variation**:
   - Attempt 1: Draw normally
   - Attempt 2: Draw 10% faster
   - Attempt 3: Draw with slightly more pressure
   - Attempt 4: Draw normally again
   - Attempt 5: Draw normally

3. All should succeed (ALLOW) but watch SFAM distances:
   - Session 1: High distance (baseline match)
   - Session 2: Slightly higher (speed variance)
   - Session 3: Moderate (pressure variance)
   - Session 4-5: Should normalize lower as profile adapts

#### C. Observe Dashboard Evolution

1. Go to `/dashboard` (refresh after each auth)

2. **After 1st Auth**:
   - 1 session
   - Average anomaly: ~0.2

3. **After 3rd Auth**:
   - 3 sessions
   - Note SFAM distances for each
   - Observe slight increases as behavior varies

4. **After 5th Auth**:
   - 5 sessions
   - Anomaly scores should stabilize lower
   - System has learned normal variations

5. **Sessions Tab**:
   - All should show ALLOW decision
   - Risk levels: all LOW
   - SFAM distances trending down (profile refining)

6. **Risk Monitor Tab**:
   - Anomaly trend chart shows:
     - Initial variation (sessions 1-3)
     - Convergence back to baseline (sessions 4-5)
     - System is adaptable

#### D. Now Draw Different Gesture on 6th Attempt

1. Authenticate again but draw something **different**
2. Should trigger anomaly:
   - SFAM Distance: VERY HIGH
   - Anomaly Score: HIGH
   - Decision: CHALLENGE/BLOCK

3. In Dashboard:
   - Clear spike visible in Risk Monitor
   - Contrast with previous 5 normal sessions
   - Demonstrates the system distinguishes normal variation from anomalies

### Expected Results

✅ Multiple authentications succeed
✅ Profile adapts over sessions
✅ Anomaly scores stabilize for consistent gestures
✅ Different gesture is clearly detected despite normal variation
✅ Dashboard shows learning progression

### Key Observations

- **SFAM**: Captures subtle gesture differences as variations
- **RLFS**: Distinguishes natural variation from anomalies
- **Behavioral Model**: Profiles update with session history
- **Adaptation**: Thresholds adjust based on user's pattern
- **Statistical Significance**: After ~5 sessions, baseline is solid

---

## Automated Testing (Optional)

### Using curl for API Testing

#### 1. Check API Status

```bash
curl http://localhost:5000/health
```

#### 2. Enroll User

```bash
curl -X POST http://localhost:5000/api/auth/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "username": "curl_user",
    "email": "curl@test.com",
    "baselineSamples": [
      {
        "timestamp": '$(date +%s)',
        "points": [
          {"x": 100, "y": 100},
          {"x": 150, "y": 150},
          {"x": 200, "y": 100},
          {"x": 250, "y": 150}
        ]
      }
    ]
  }'
```

#### 3. Authenticate User

```bash
curl -X POST http://localhost:5000/api/auth/gesture \
  -H "Content-Type: application/json" \
  -d '{
    "username": "curl_user",
    "gesture": {
      "points": [
        {"x": 100, "y": 100},
        {"x": 150, "y": 150},
        {"x": 200, "y": 100},
        {"x": 250, "y": 150}
      ]
    }
  }'
```

#### 4. Get Sessions

```bash
curl http://localhost:5000/api/dashboard/sessions?user=curl_user
```

---

## Validation Checklist

### ✅ Enrollment Works

- [ ] User can create account
- [ ] Gesture baseline captured (3 samples)
- [ ] Profile created in MongoDB

### ✅ Authentication Works

- [ ] Correct gesture: ALLOW
- [ ] Wrong gesture: CHALLENGE/BLOCK
- [ ] Error handling graceful

### ✅ 5-Layer Pipeline

- [ ] Input Layer: Gesture captured (points count correct)
- [ ] SFAM Layer: Hash computed, distance calculated
- [ ] RLFS Layer: Anomaly score generated
- [ ] S-ADR Layer: Decision made & logged
- [ ] Session Recording: All data saved to MongoDB

### ✅ Dashboard Works

- [ ] Sessions appear after auth
- [ ] Risk data displays correctly
- [ ] Charts render without errors
- [ ] Session details show all 5 layers
- [ ] Realtime updates on new auth

### ✅ Error Handling

- [ ] Invalid username: error message shown
- [ ] Short gesture: rejected with guidance
- [ ] Server down: graceful fallback
- [ ] Network error: user feedback

### ✅ Security

- [ ] Passwords not logged
- [ ] Gestures not stored plaintext
- [ ] SFAM hashes are irreversible
- [ ] Sessions logged for audit trail
- [ ] Proper CORS headers

---

## Performance Testing

### Check Response Times

```bash
# Test authentication performance
time curl -X POST http://localhost:5000/api/auth/gesture \
  -H "Content-Type: application/json" \
  -d '{"username": "test", "gesture": {"points": [...]}}'
```

**Expected**: < 1000ms total

- Input processing: 10-50ms
- SFAM communication: 100-200ms
- RLFS analysis: 50-100ms
- S-ADR decision: 10-50ms
- Database save: 50-100ms

### Load Testing (Optional)

```bash
# Using Apache Bench
ab -n 100 -c 10 http://localhost:5000/health

# Or using wrk
wrk -t4 -c100 -d30s http://localhost:5000/health
```

---

## Debugging Tips

### Check Logs

```bash
# API Server logs (Terminal 3)
# Look for: 🔍, ✅, ⚠️, ❌ emoji prefixes

# Frontend console (Browser DevTools F12)
# Network tab: watch API calls
# Console tab: check for JavaScript errors

# Python SFAM logs (Terminal 2)
# Should see SFAM activity on each auth
```

### Database Inspection

```bash
# Connect to MongoDB
mongosh

# Switch to SecuADR database
use secuadr

# View collections
show collections

# Check sessions
db.sessions.find().pretty()

# Check behavioral profiles
db.behavioral_profiles.find().pretty()

# Count records
db.sessions.countDocuments()
```

### Environment Debugging

```bash
# Check config is loaded correctly
curl http://localhost:5000/api/status | jq

# Verify SFAM is healthy
curl http://localhost:8000/health

# Check MongoDB connection
# Should see in API server startup logs
```

---

## Success Criteria

A successful complete test run includes:

1. **Scenario 1 Passed**: User enrolls, authenticates normally, dashboard shows all data
2. **Scenario 2 Passed**: Anomaly detected, blocked, then correct gesture succeeds
3. **Scenario 3 Passed**: Multiple sessions, profile adaptation visible, clear anomaly detection
4. **All Checklist Items**: Marked complete
5. **No Errors**: Clean console/terminal logs
6. **Full 5-Layer Pipeline**: Each layer produces expected outputs

## Next Steps for Production

Once testing is complete:

1. **Load Testing**: Run with 100+ concurrent users
2. **Security Audit**: Review all data flows, encryption
3. **Compliance**: Verify GDPR/biometric compliance
4. **Monitoring**: Set up alerts for high-risk sessions
5. **Deployment**: Docker, Kubernetes, cloud setup
6. **Documentation**: Investor/customer facing docs

---

**Need help?** Check:

- `IMPLEMENTATION_STATUS.md` - Technical architecture details
- `DASHBOARD_GUIDE.md` - Dashboard interpretation
- `REFACTORING_ARCHITECTURE.md` - 5-layer architecture overview
