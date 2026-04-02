# SecuADR Dashboard Guide

## Overview

The SecuADR Dashboard provides real-time visualization of your behavioral authentication system's security metrics, risk scores, and session history. It's designed for investors, administrators, and power users to understand the 5-layer authentication architecture in action.

## Features

### 1. 📊 Overview Tab

Displays high-level statistics and metrics:

- **Total Sessions**: Count of all authentication attempts
- **Avg Anomaly Score**: Average behavioral anomaly score (0 = normal, 1 = anomalous)
- **Risk Distribution**: Pie chart showing LOW/MEDIUM/HIGH/CRITICAL risk breakdown
- **Authentication Decisions**: Bar chart of ALLOW/WARN/CHALLENGE/BLOCK decisions

### 2. 📝 Sessions Tab

View detailed records of authentication attempts:

- **Timestamp**: When the authentication occurred
- **SFAM Distance**: Hamming distance from your baseline biometric hash (lower = better match)
- **Anomaly Score**: RLFS module's computed anomaly score (0-1 scale)
- **Decision**: Final S-ADR decision (ALLOW/WARN/CHALLENGE/BLOCK)
- **Risk Level**: Security classification (LOW/MEDIUM/HIGH/CRITICAL)
- **Details**: Click to view complete 5-layer breakdown

### 3. 🚨 Risk Monitor Tab

Track trends in anomaly scores over time:

- **Anomaly Trend**: Line chart showing anomaly scores for last 20 sessions
- **SFAM Distance Trend**: Hamming distance changes over time
- **Recent Alerts**: High/Critical risk authentication attempts with details

### 4. 📈 Drift Detection Tab

Monitor changes in behavioral features:

- **Gesture Drift**: Changes in gesture velocity, acceleration, timing
- **Typing Drift**: Changes in keystroke dynamics (dwell time, flight time)
- **Touch Drift**: Changes in touch pressure and contact area
- **Interpretation Guide**: What drift means for account security

## Understanding the 5-Layer Architecture

When you view session details, you'll see outputs from all 5 layers:

### Layer 1: Input Layer 🎨

Captures raw biometric inputs:

- Gesture points (x, y coordinates)
- Typing rhythm (dwell time, flight time)
- Touch dynamics (pressure, contact area)
- Device context (browser, resolution)

### Layer 2: SFAM Biometric Layer 🔐

Creates irreversible biometric hash:

- **Hash Distance**: Hamming distance between current and baseline (0-256)
- **Confidence**: How confident SFAM is in the match (0-100%)
- Lower distance = better match, higher confidence = more reliable

### Layer 3: RLFS Anomaly Detection 🚨

Analyzes behavior for anomalies:

- **Anomaly Score**: 0-1 scale representing how unusual the session is
- **Confidence**: Low/Medium/High/Anomalous
- **Detected Anomalies**: Specific behaviors that triggered alerts
- 4 signal types: SFAM hash distance, z-score analysis, temporal drift, adversarial patterns

### Layer 4: S-ADR Adaptive Security ⚖️

Makes final authentication decision:

- **Decision**: ALLOW/ALLOW_WITH_WARNING/CHALLENGE/BLOCK
- **Risk Level**: LOW/MEDIUM/HIGH/CRITICAL
- **Threshold**: Adaptive threshold adjusted for your profile (new user: higher, trusted history: lower)
- **Trust Factors**: What influenced the decision

### Layer 5: Session Recording 📋

Stores complete audit trail in MongoDB:

- All 5-layer outputs captured
- Processing times recorded
- Service health metrics stored
- Available for compliance and forensics

## Color Coding

### Risk Levels

- 🟢 **GREEN (LOW)**: Normal authentication, trusted pattern
- 🟡 **YELLOW (MEDIUM)**: Slightly unusual, may need verification
- 🟠 **ORANGE (HIGH)**: Suspicious, challenge may be triggered
- 🔴 **RED (CRITICAL)**: Highly anomalous, likely blocked

### Decisions

- ✅ **ALLOW**: Proceed without additional verification
- ⚠️ **ALLOW_WITH_WARNING**: Allowed but flagged for monitoring
- 🔐 **CHALLENGE**: Request additional verification (OTP, security questions)
- ❌ **BLOCK**: Reject authentication, possible account takeover attempt

## Key Metrics Explained

### SFAM Hash Distance

- **Range**: 0-256 (Hamming distance between 256-bit hashes)
- **Good**: < 40 (highly similar to baseline)
- **OK**: 40-80 (some variance, normal)
- **Unusual**: 80-120 (significant change, investigate)
- **Anomalous**: > 120 (major difference, suspicious)

### Anomaly Score

- **0.0-0.2**: Normal behavior, very similar to baseline
- **0.2-0.4**: Slight variations, expected as behavior evolves
- **0.4-0.6**: Moderate anomalies, approaching challenge threshold
- **0.6-0.8**: High anomalies, very unusual
- **0.8-1.0**: Extreme anomalies, account takeover likely

### Confidence

- **High**: Algorithm is very confident in its assessment
- **Medium**: Reasonable confidence, with some uncertainty
- **Low**: Uncertain assessment, may want additional checks
- **Anomalous**: Specifically flagged as suspicious behavior

## Responding to Alerts

### If you see HIGH or CRITICAL risk:

1. **Check the timestamp** - When did this happen?
2. **Review the decision** - Was it BLOCK, CHALLENGE, or ALLOW_WITH_WARNING?
3. **Check detected anomalies** - What specifically was unusual?
4. **If it was you**:
   - System is learning your behavior patterns
   - Your gesture might have changed (different device, hand, lighting)
   - Continue authenticating - profiles adapt over time
5. **If it wasn't you**:
   - Contact support immediately
   - Consider changing your gesture pattern
   - Review account access logs

## Drift Detection

### What is Drift?

Drift is natural and expected changes in your behavioral patterns over time:

- You might draw faster or slower on different days
- Typing speed changes with fatigue
- Touch pressure changes with device/mood
- All are normal and systems adapt

### When to Worry About Drift:

- **Sudden large changes** - Not gradual, but sudden shift
- **Multiple anomalies in sequence** - Not isolated incidents
- **Off-hours authentications** - Attempting access at unusual times
- **New devices combined with drift** - Multiple risk factors

## Tips for Consistent Authentication

To maintain low anomaly scores and smooth authentication:

1. **Be Consistent** 🎯
   - Draw your gesture the same way each time
   - Use consistent pressure and speed
   - Same hand, similar positions

2. **Use the Same Device** 💻
   - Different devices = higher anomaly risk
   - If you do use different devices, authenticate normally to help system adapt

3. **Similar Lighting/Positioning** 💡
   - Major environmental changes can shift touch dynamics
   - Try to authenticate in similar conditions

4. **Account for Changes** 🔄
   - If you know you've changed behavior (new input device, injury), your next auth might fail
   - Keep authenticating normally - profiles adapt within a few sessions

5. **Avoid Rushing** ⏱️
   - Don't rush gestures or typing
   - Unnatural speed triggers anomaly detection

## API & Integration

The dashboard fetches data from SecuADR's backend API:

```bash
# Get session history (last 50)
GET /api/dashboard/sessions?user=<username>&limit=50

# Get risk metrics
GET /api/dashboard/risk?user=<username>

# Get drift analysis
GET /api/dashboard/drift?user=<username>
```

## Screenshots & Video Walkthrough

### Enrollment Flow

1. Click "Sign Up" on login page
2. Enter username and email
3. Draw your gesture 3 times to create baseline
4. Review and confirm
5. Account ready to use!

### Authentication Flow

1. Enter username
2. Draw your gesture once
3. System analyzes through 5 layers
4. Decision: ALLOW, CHALLENGE, or BLOCK

### Dashboard Navigation

1. After login, click "Dashboard" or go to `/dashboard`
2. Use tabs to switch between Overview/Sessions/Risk/Drift
3. Click session rows to view 5-layer details
4. Return to login page to authenticate again

## Troubleshooting

### Dashboard won't load

- Check that backend is running: `npm start` in `secuadr-api-server/`
- Check MongoDB is connected
- Check browser console for errors

### Sessions not appearing

- Make sure you've authenticated at least once
- Refresh the page
- Check that API endpoint is correct in auth.js

### Risk scores seem wrong

- First few sessions establish baseline (may show higher anomaly)
- Profile needs 3-5 normal authentications to stabilize
- Check if you changed your gesture recently

### Can't authenticate

- Gesture too short (must be > 20 points)
- Drawing too fast or too slow
- Device or hand changed significantly
- Try the gesture a few more times - system adapts

## Security Notes

⚠️ **Important Security Reminders**:

- Your gesture is your password - never share it with anyone
- The dashboard shows authentication records - keep it secure
- SFAM hash is irreversible - cannot be reversed to recreate your gesture
- If you suspect unauthorized access, immediately change your gesture
- All sessions are logged for audit/compliance purposes

## Next Steps

- **Enhance Security**: Add step-up authentication (OTP, security questions)
- **Add Device Fingerprinting**: Bind patterns to specific devices
- **Geographic Checks**: Alert on unusual location changes
- **Machine Learning**: Use session history to improve anomaly detection
- **Behavioral Insurance**: Score your overall account risk

---

**Questions?** Check `IMPLEMENTATION_STATUS.md` for technical details or `DEMO_AND_RUNBOOK.md` for step-by-step testing.
