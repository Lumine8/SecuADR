# SecuADR Quick Start Guide

## 🚀 Getting Started in 5 Minutes

### Prerequisites

- Node.js 16+
- Python 3.8+
- MongoDB (local or remote)
- Git

### Step 1: Clone and Install Dependencies

```bash
# Backend API
cd secuadr-api-server
npm install

# Frontend
cd ../pattern-login
npm install
```

### Step 2: Configure Environment Variables

Create `secuadr-api-server/.env`:

```
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/secuadr
JWT_SECRET=your-development-secret-key
SFAM_SERVICE_URL=http://localhost:8000
SFAM_TIMEOUT_MS=30000
CORS_ORIGIN=http://localhost:5173,http://localhost:3001
```

### Step 3: Start Services

**Terminal 1 - MongoDB:**

```bash
mongod
```

**Terminal 2 - Python SFAM Service:**

```bash
cd sfam_service
python main.py
# Server should start on http://localhost:8000
```

**Terminal 3 - Backend API:**

```bash
cd secuadr-api-server
npm start
# Server should start on http://localhost:5000
# Health check: http://localhost:5000/health
```

**Terminal 4 - Frontend:**

```bash
cd pattern-login
npm run dev
# Frontend should open at http://localhost:5173
```

### Step 4: Test the System

1. **Enrollment:**
   - Go to frontend (http://localhost:5173)
   - Enter username: `testuser`
   - Click "Enroll" tab
   - Draw a gesture pattern (5+ points, 1-3 seconds)
   - Click "Enroll Pattern"
   - Expected: Success notification

2. **Authentication:**
   - Click "Authenticate" tab
   - Enter same username: `testuser`
   - Draw the same gesture pattern again
   - Click "Authenticate"
   - Expected: Success message with JWT token

3. **Monitor Console:**
   - Backend console should show:
     - `📝 SFAM enrollment/auth attempt...`
     - `✅ SFAM Result: MATCH | Distance: 0.XXX`
     - `✅ Authentication SUCCEEDED`

---

## 📊 System Health Check

### Check All Services Are Running

```bash
# Check Backend API
curl http://localhost:5000/health
# Expected: {"status":"healthy",...}

# Check SFAM Service
curl http://localhost:8000/health
# Expected: {"status":"ok",...}

# Check MongoDB
mongosh
> db.adminCommand('ping')
# Expected: { ok: 1 }
```

### View API Status

```bash
curl http://localhost:5000/api/status
# Expected: {"status":"ok","service":"SecuADR",...}
```

---

## 🧪 Testing Different Scenarios

### Scenario 1: Successful Enrollment & Auth

```javascript
// Enrollment: Draw smooth, clear gesture
// Auth: Draw very similar gesture (slight variations ok)
// Expected: Success on both
```

### Scenario 2: Auth with Different Gesture

```javascript
// Enrollment: Draw gesture pattern A
// Auth: Draw completely different gesture pattern B
// Expected: Enrollment succeeds, auth fails with 401
```

### Scenario 3: Non-Existent User

```javascript
// Enrollment: Username = "new_user_123"
// Auth: Username = "nonexistent"
// Expected: Auth fails with generic "Authentication failed" message
```

### Scenario 4: SFAM Service Down

```bash
# Stop the Python SFAM service
# Try to authenticate
# Expected: Graceful failure with "Authentication failed" message
# Check backend logs: "⚠️ SFAM service is unavailable"
```

---

## 📝 Console Log Reference

### Enrollment Success Indicators

```
📝 SFAM enrollment request for user: testuser
🔌 SFAM Service Status: HEALTHY
🔐 Enrolling user testuser with SFAM...
✅ SFAM hash generated (length: 256, confidence: 0.98)
✅ User testuser enrolled in SFAM database
```

### Authentication Success Indicators

```
📝 Auth attempt for user: testuser
✅ User found: testuser, SFAM enrolled: true
🔌 SFAM Service Status: HEALTHY
🔍 Running SFAM verification for testuser...
✅ SFAM Result: MATCH | Distance: 0.250 | Confidence: 0.750
✅ Authentication SUCCEEDED for testuser
```

### Error Indicators

```
❌ Critical Authentication Error: [error message]
⚠️ SFAM Verification Error: [error message]
❌ User testuser not enrolled in SFAM
```

---

## 🔧 Troubleshooting

### Port Already in Use

```bash
# Find process using port
lsof -i :5000  # Backend
lsof -i :3000  # Frontend
lsof -i :8000  # SFAM

# Kill process (replace PID with actual process ID)
kill -9 <PID>
```

### MongoDB Connection Failed

```bash
# Check MongoDB is running
mongosh

# If not running, start it
mongod --dbpath /path/to/db/data

# Verify connection string in .env
MONGODB_URI=mongodb://localhost:27017/secuadr
```

### SFAM Service Not Found

```bash
# Check Python service is running
curl http://localhost:8000/health

# If not responding, check:
# 1. Python process is running: ps aux | grep python
# 2. Port 8000 is available: lsof -i :8000
# 3. SFAM error logs in sfam_service/
```

### "Invalid gesture pattern: minimum 5 points required"

```javascript
// Make sure you:
// 1. Draw more points on canvas (mouse movement creates points)
// 2. Don't draw too fast (takes 1-3 seconds)
// 3. Make it visible on screen (clear gesture)
```

---

## 📱 API Quick Reference

### Enroll a User

```bash
curl -X POST http://localhost:5000/api/sfam/enroll \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "pattern": [
      {"X": 100, "Y": 150, "ID": 200},
      {"X": 105, "Y": 155, "ID": 205},
      {"X": 110, "Y": 160, "ID": 210},
      {"X": 115, "Y": 165, "ID": 215},
      {"X": 120, "Y": 170, "ID": 220}
    ]
  }'
```

### Authenticate a User

```bash
curl -X POST http://localhost:5000/api/authenticate \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser",
    "pattern": [
      {"X": 102, "Y": 152, "ID": 205},
      {"X": 107, "Y": 157, "ID": 210},
      {"X": 112, "Y": 162, "ID": 215},
      {"X": 117, "Y": 167, "ID": 220},
      {"X": 122, "Y": 172, "ID": 225}
    ],
    "sessionId": "optional-session-id",
    "deviceFingerprint": {
      "userAgent": "curl/7.68.0",
      "screen": "1920x1080",
      "timezone": "UTC"
    }
  }'
```

---

## 🔐 Security Quick Tips

1. **Never Log Raw Gesture Data**
   - Always log metadata only
   - Use emoji indicators (✅ ❌ 🔍)

2. **Protect User Information**
   - Return generic error messages
   - Don't reveal if user exists or not

3. **Validate All Input**
   - Check type: `typeof x === "number"`
   - Check range: `x >= 0 && x <= 255`
   - Check structure: `pattern.every(p => p.X && p.Y && p.ID)`

4. **Handle Service Failures Gracefully**
   - If SFAM is down, return 401 not 503 to users
   - Log actual errors backend-side
   - Frontend sees generic messages

---

## 📚 Documentation

- **INTEGRATION_TEST_GUIDE.md** - Comprehensive testing procedures
- **INTEGRATION_SUMMARY.md** - Architecture and changes overview
- **VERIFICATION_CHECKLIST.md** - Verification of all changes
- **FINAL_COMPLETION_REPORT.md** - Detailed completion status

---

## ✅ Healthy System Indicators

When everything is working correctly:

- ✅ Backend returns 200 status codes on success
- ✅ Frontend shows success notifications
- ✅ Console logs show ✅ emoji indicators
- ✅ JWT token present in response
- ✅ MongoDB shows stored user with sfam field
- ✅ Less than 5 second total auth time

---

## 🚨 Quick Debugging

**If enrollment fails:**

1. Check SFAM service is running: `curl http://localhost:8000/health`
2. Check MongoDB is running: `mongosh`
3. Check backend logs for `❌` indicators
4. Verify gesture has 5+ points

**If authentication fails:**

1. Verify user is enrolled: Check MongoDB for user.sfam.hash
2. Try different gesture (closer to enrolled pattern)
3. Check SFAM service logs
4. Check backend logs for SFAM verification errors

**If frontend won't load:**

1. Check backend is running: `curl http://localhost:5000/health`
2. Check CORS settings in `.env`
3. Try incognito/private browser window
4. Check browser console for errors (F12)

---

## 🎯 Next Steps

1. ✅ Get system running with this guide
2. ✅ Test enrollment and authentication
3. ✅ Review INTEGRATION_TEST_GUIDE.md for detailed procedures
4. ✅ Check FINAL_COMPLETION_REPORT.md for full system status
5. ✅ For production, review deployment section

**System is ready to use!**
