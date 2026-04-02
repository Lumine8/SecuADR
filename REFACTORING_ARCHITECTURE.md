# SecuADR MVP Refactoring - Complete Architecture Design

**Version:** 1.0  
**Date:** April 2026  
**Target:** Investor-ready behavioral authentication + fraud detection MVP

---

## 🎯 Executive Summary

SecuADR is being transformed into a **5-layer behavioral authentication system** that demonstrates how fraudsters are caught **even when credentials are correct** through behavioral intelligence. The system integrates SFAM (Secure Feature Abstraction Model) as the core feature extraction engine, surrounded by anomaly detection (RLFS) and adaptive security response (S-ADR).

---

## 🏗️ System Architecture: 5 Layers

```
┌───────────────────────────────────────────────────────────────────────┐
│                        USER INTERFACE                                   │
│         (Gesture Canvas + Simulated Typing/Touch Input)                │
└─────────────────────────┬───────────────────────────────────────────┘
                          │ Raw behavioral signals
                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│ LAYER 1: INPUT LAYER (Behavior Capture)                               │
│ ─────────────────────────────────────────────────────────────────────  │
│ • GestureInput: X,Y coordinates, timestamps → Raw gesture signal     │
│ • TypingInput: Keystroke timing, hold duration, intervals             │
│ • TouchInput: Pressure, area, multi-touch patterns (simulated)        │
│ • SessionInput: Time-of-day, device, location patterns               │
│                                                                        │
│ Output: RawBehaviorSignal { gesture, typing, touch, session }        │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│ LAYER 2: SFAM INTEGRATION LAYER (Feature Abstraction) ⭐ CRITICAL    │
│ ─────────────────────────────────────────────────────────────────────  │
│                                                                        │
│ Input: Raw behavioral signals                                         │
│                                                                        │
│ Processing:                                                            │
│  1. Gesture → Physics Extraction                                      │
│     └─ Velocity (vx, vy), Acceleration (ax, ay), Jerk (jx, jy)      │
│                                                                        │
│  2. Typing → Rhythm Features                                          │
│     └─ Dwell time, Flight time, Press duration distribution          │
│                                                                        │
│  3. Touch → Dynamics Features                                         │
│     └─ Pressure curve, Area pattern, Swipe velocity                  │
│                                                                        │
│  4. Session → Context Features                                        │
│     └─ Time-of-day profile, Location consistency, Device pattern     │
│                                                                        │
│  5. Neural Fusion (SFAM Core)                                         │
│     └─ GhostNet CNN + Bi-LSTM + Attention Fusion                    │
│                                                                        │
│ Output: NormalizedFeatures {                                          │
│   spatialEmbedding: 256D,           # CNN spatial features           │
│   temporalEmbedding: 256D,          # LSTM behavioral features       │
│   fusionWeights: [α_spatial, α_temporal],  # Attention weights       │
│   rawFeatureVector: 1024D           # All features concatenated      │
│ }                                                                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│ LAYER 3: BEHAVIORAL MODEL LAYER (Profile Building)                    │
│ ─────────────────────────────────────────────────────────────────────  │
│                                                                        │
│ Responsibilities:                                                      │
│  • Build user behavioral profile during enrollment                    │
│  • Store baseline features and SFAM biometric hash                    │
│  • Extract user-specific feature statistics                           │
│  • Maintain feature embedding database                                │
│                                                                        │
│ Database Schema: behavioral_profiles collection                        │
│  ├─ user_id: string                                                  │
│  ├─ enroll_date: timestamp                                           │
│  ├─ sfam_hash: 256-bit (binary encrypted)  ← Core biometric        │
│  ├─ feature_baseline: {                                              │
│  │   ├─ gesture_velocity_mean: float                                │
│  │   ├─ gesture_velocity_std: float                                 │
│  │   ├─ typing_dwell_time_mean: float                               │
│  │   ├─ typing_dwell_time_std: float                                │
│  │   ├─ touch_pressure_curve: [float]                               │
│  │   └─ session_time_distribution: histogram                        │
│  ├─ feature_history: [{timestamp, features, source}] (last 50)     │
│  └─ version: "1.0" (for A/B testing new models)                     │
│                                                                        │
│ Output: UserProfile {                                                 │
│   baselineHash: 256-bit,          # SFAM biometric                   │
│   baselineFeatures: {...},         # Statistical baseline            │
│   featureCovariance: matrix,       # Feature correlation             │
│   riskBaseline: float (0-1)        # Historical risk level          │
│ }                                                                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│ LAYER 4: RLFS MODULE (Anomaly Sensitivity Engine)                     │
│ ─────────────────────────────────────────────────────────────────────  │
│                                                                        │
│ RLFS = Representation-Level Failure Sensitivity                       │
│ (Refactored as: Anomaly Sensitivity Engine)                           │
│                                                                        │
│ Responsibilities:                                                      │
│  • Detect deviation between current & baseline                        │
│  • Track feature-level failure signals                                │
│  • Identify sudden shifts, inconsistencies, adversarial mimicry      │
│                                                                        │
│ Processing Pipeline:                                                  │
│                                                                        │
│  1. SFAM Hash Comparison (Primary Signal)                             │
│     └─ Hamming Distance(current_hash, baseline_hash)                 │
│        └─ norm_dist = dist / 256  # 0 = identical, 1 = opposite    │
│                                                                        │
│  2. Feature-Level Anomalies (Secondary Signals)                       │
│     ├─ Gesture Anomaly Score:                                        │
│     │   └─ Z-score = (current_vel - baseline_vel_mean) / std         │
│     │   └─ Detect: sudden speed/deceleration changes                 │
│     │                                                                  │
│     ├─ Typing Anomaly Score:                                         │
│     │   └─ Dwell time variance, flight time changes                  │
│     │   └─ Detect: rhythm disruption (nervousness, stress)           │
│     │                                                                  │
│     ├─ Touch Anomaly Score:                                          │
│     │   └─ Pressure curve changes, area pattern changes              │
│     │   └─ Detect: device/hand change (injury, age)                  │
│     │                                                                  │
│     └─ Session Anomaly Score:                                        │
│         └─ Time-of-day mismatch, location jump, device spoofing     │
│         └─ Detect: account takeover attempts                         │
│                                                                        │
│  3. Temporal Pattern Analysis                                         │
│     └─ Compare against historical window (last 50 sessions)          │
│     └─ Detect: gradual drift vs. sudden attack                       │
│     └─ Flag: first-use anomaly detection                             │
│                                                                        │
│  4. Adversarial Detection (Optional)                                  │
│     └─ Check for "copy attack": gesture looks right but feels wrong  │
│     └─ Jitter analysis: natural vs. synthesized motion               │
│                                                                        │
│ Anomaly Scoring:                                                      │
│   sfam_anomaly = norm_dist                    # 0-1, Hamming distance │
│   feature_anomaly = max(gesture, typing, touch, session) Z-scores    │
│   temporal_anomaly = drift_from_history       # 0-1                  │
│                                                                        │
│   RLFS_AnomalyScore = {                                              │
│     primary: sfam_anomaly,         # 0-1, most important             │
│     secondary: feature_anomaly,    # 0-1                             │
│     temporal: temporal_anomaly,    # 0-1                             │
│     combined: weighted_average,    # 0-1, final anomaly              │
│     feature_breakdown: {...}       # Per-feature scores              │
│   }                                                                    │
│                                                                        │
│ Confidence Levels:                                                     │
│   • High confidence: anomaly < 0.15                                   │
│   • Medium confidence: 0.15 ≤ anomaly < 0.40                          │
│   • Low confidence: 0.40 ≤ anomaly < 0.65                             │
│   • Anomaly detected: anomaly ≥ 0.65                                  │
│                                                                        │
│ Output: AnomalyReport {                                               │
│   anomaly_score: float (0-1),                                        │
│   confidence: string (high/medium/low),                              │
│   feature_breakdown: {gesture, typing, touch, session},              │
│   temporal_trend: string (stable/drifting/spiking),                 │
│   is_first_use: boolean,                                             │
│   detected_anomalies: [string]  # ["speed_spike", "rhythm_change"]  │
│ }                                                                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│ LAYER 5: S-ADR MODULE (Adaptive Security Response Engine)             │
│ ─────────────────────────────────────────────────────────────────────  │
│                                                                        │
│ S-ADR = Secure Adaptive Degradation Rejection                         │
│ (Refactored as: Adaptive Security Response Engine)                    │
│                                                                        │
│ Responsibilities:                                                      │
│  • Adjust thresholds dynamically based on risk signals                │
│  • Integrate historical trust and context                             │
│  • Decide final authentication action                                 │
│  • Enforce adaptive security response                                 │
│                                                                        │
│ Inputs:                                                                │
│  1. Primary Risk Indicators                                           │
│     ├─ rlfs_anomaly_score      # 0-1 from Layer 4                   │
│     ├─ user_risk_baseline      # 0-1 from behavioral profile        │
│     └─ system_security_state   # enum: normal/elevated/critical     │
│                                                                        │
│  2. Historical Trust Data                                             │
│     ├─ session_count_30d       # How many successful sessions       │
│     ├─ false_positive_rate     # Legitimate rejections              │
│     ├─ days_since_enroll       # How established is the profile     │
│     └─ recent_auth_failures    # Consecutive failed attempts        │
│                                                                        │
│  3. Contextual Factors                                                │
│     ├─ time_since_last_auth    # User's frequent login times       │
│     ├─ device_consistency      # Same device? New device?            │
│     ├─ location_consistency    # Known location? Travelled?          │
│     └─ ip_risk_score           # VPN? Datacenter? Suspicious IP?   │
│                                                                        │
│ Adaptive Threshold Calculation:                                        │
│                                                                        │
│   base_threshold = 0.40  # Default acceptance threshold              │
│                                                                        │
│   adjustments = {                                                      │
│     "trust_multiplier": {                                             │
│       "new_user": +0.15,        # New users must be verified        │
│       "high_history": -0.10,    # Trusted users get benefit         │
│       "failed_attempts": +0.20  # Protect against brute force       │
│     },                                                                 │
│     "context_penalty": {                                              │
│       "new_device": +0.15,      # Device change increases threshold │
│       "new_location": +0.10,    # Location jump increases threshold │
│       "after_hours": +0.05,     # Off-hours access                  │
│       "high_system_risk": +0.25 # When threats detected globally    │
│     }                                                                  │
│   }                                                                    │
│                                                                        │
│   adaptive_threshold = clamp(                                         │
│     base_threshold                                                    │
│     + trust_multiplier                                                │
│     + context_penalty,                                                │
│     min=0.20,                   # Never below this                   │
│     max=0.75                    # Never above this                   │
│   )                                                                    │
│                                                                        │
│ Decision Matrix:                                                       │
│                                                                        │
│   IF anomaly_score < adaptive_threshold:                              │
│     decision = "ALLOW"                                                │
│     confidence = high                                                  │
│     risk_level = "LOW"                                                │
│                                                                        │
│   ELIF anomaly_score < adaptive_threshold + 0.15:                     │
│     decision = "ALLOW WITH WARNING"                                   │
│     confidence = medium                                                │
│     risk_level = "MEDIUM"                                             │
│     action = "Log session, monitor for fraud patterns"               │
│                                                                        │
│   ELIF anomaly_score < adaptive_threshold + 0.35:                     │
│     decision = "CHALLENGE"                                            │
│     confidence = low                                                   │
│     risk_level = "HIGH"                                               │
│     action = "Request step-up auth (email OTP / SMS / security Q)"  │
│                                                                        │
│   ELSE (anomaly_score >= adaptive_threshold + 0.35):                  │
│     decision = "BLOCK"                                                │
│     confidence = anomalous                                            │
│     risk_level = "CRITICAL"                                           │
│     action = "Log security incident, notify user, trigger audit"     │
│                                                                        │
│ Output: SecurityDecision {                                            │
│   final_decision: enum (ALLOW, ALLOW_WITH_WARNING, CHALLENGE, BLOCK),│
│   risk_level: enum (LOW, MEDIUM, HIGH, CRITICAL),                    │
│   confidence: float (0-1),                                            │
│   adaptive_threshold: float,     # Threshold used                     │
│   anomaly_score: float,          # Input anomaly                      │
│   reason: string,                # Human-readable explanation         │
│   recommended_action: string,    # "allow", "log_warning", "challenge", "block" │
│   session_risk_metadata: {                                            │
│     trust_factors: [...],        # What increased/decreased risk      │
│     feature_alerts: [...],       # Which features were anomalous      │
│     suggested_monitor: [...]     # What to watch going forward       │
│   }                                                                    │
│ }                                                                      │
└─────────────────────────┬───────────────────────────────────────────┘
                          │
                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│                    SYSTEM ACTIONS & LOGGING                            │
│ ─────────────────────────────────────────────────────────────────────  │
│                                                                        │
│ Database Storage:                                                      │
│  • sessions collection: Store every authentication attempt            │
│  • risk_logs collection: Persistent audit trail                       │
│  • anomalies collection: Detailed feature-level breakdowns            │
│                                                                        │
│ API Response:                                                          │
│  ├─ ALLOW: Issue authentication token, return 200 OK                 │
│  ├─ ALLOW_WITH_WARNING: Return token + warning flag                  │
│  ├─ CHALLENGE: Return 401 with challenge method / send OTP           │
│  └─ BLOCK: Return 403 Forbidden + log security incident              │
│                                                                        │
│ Dashboard Updates:                                                     │
│  • Risk Monitor: Latest risk scores, trending                         │
│  • Drift Detection: Feature changes visualized                        │
│  • Session View: Detailed breakdown of latest auth                   │
│  • Feature Insights: Contribution of each signal                      │
└───────────────────────────────────────────────────────────────────────┘
```

---

## 📊 Data Models

### MongoDB Collections

#### **users**

```javascript
{
  _id: ObjectId,
  username: string,
  email: string,
  created_at: timestamp,
  profile: {
    first_name: string,
    last_name: string,
    organization: string
  }
}
```

#### **behavioral_profiles**

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,              // Reference to users
  enrollment_date: timestamp,
  sfam_hash: Buffer,              // 256-bit encrypted biometric
  sfam_salt: string,              // For SFAM key generation
  feature_baseline: {
    gesture_velocity_mean: float,
    gesture_velocity_std: float,
    gesture_acceleration_mean: float,
    typing_dwell_time_mean: float,
    typing_dwell_time_std: float,
    typing_flight_time_mean: float,
    touch_pressure_mean: float,
    touch_area_mean: float,
    session_time_distribution: [int],  // Histogram of 24 hours
    session_location_baseline: string   // Primary location
  },
  feature_history: [
    {
      timestamp: timestamp,
      features: {gesture_velocity, typing_dwell, ...},
      session_id: ObjectId,
      source: string  // "enrollment" | "authentication"
    }
  ],                              // Last 50 sessions max
  stats: {
    total_enrollments: int,
    total_authentications: int,
    successful_authentications: int,
    false_rejections_count: int
  },
  version: string                 // For model versioning
}
```

#### **sessions**

```javascript
{
  _id: ObjectId,
  user_id: ObjectId,
  timestamp: timestamp,

  // Input signals
  gesture_data: {
    raw_points: [{x, y, timestamp}],
    duration_ms: int,
    bounding_box: {min_x, min_y, max_x, max_y},
  },
  typing_data: {
    dwell_times: [int],             // Per key
    flight_times: [int],            // Inter-key intervals
    hold_duration: int
  },
  touch_data: {
    pressure_curve: [float],
    touch_area: [float],
    multi_touch: boolean
  },
  session_context: {
    timestamp: timestamp,
    ip_address: string,
    user_agent: string,
    device: {id, type, name},
    location: {lat, lon, accuracy}
  },

  // Layer outputs
  sfam_output: {
    hash_continuous: [float],       // 256D, real-valued
    hash_binary: Buffer,            // 256-bit binarized
    hamming_distance: float,        // Distance from baseline
    confidence: float
  },
  rlfs_output: {
    anomaly_score: float,
    confidence: string,
    feature_breakdown: {
      gesture: float,
      typing: float,
      touch: float,
      session: float
    },
    temporal_trend: string,
    detected_anomalies: [string],
    feature_alerts: [string]
  },
  sadr_output: {
    decision: enum,
    risk_level: string,
    confidence: float,
    adaptive_threshold: float,
    reason: string,
    recommended_action: string
  },

  // Final outcome
  authentication: {
    status: enum ("success" | "challenge_issued" | "failed"),
    token: string (if success),
    challenge_method: string (if challenge),
    error_message: string (if failed)
  },

  metadata: {
    processing_time_ms: int,
    api_version: string
  }
}
```

#### **risk_logs**

```javascript
{
  _id: ObjectId,
  timestamp: timestamp,
  user_id: ObjectId,
  session_id: ObjectId,

  event_type: enum ("authentication_success" | "authentication_failed" | "challenge_issued" | "fraud_suspected" | "profile_updated"),

  risk_indicators: {
    anomaly_score: float,
    trust_factors: [string],           // What increased/decreased trust
    feature_alerts: [string],          // Which features triggered
    context_changes: [string]          // Device, location, etc.
  },

  action_taken: enum,                 // ALLOW, CHALLENGE, BLOCK

  followup_actions: [string],         // Recommended monitoring

  resolved: boolean,
  resolution_time_ms: int,
  notes: string                       // Security team notes
}
```

---

## 🔄 Data Flow Examples

### Scenario 1: Legitimate User - Accepted

```
Alice draws her familiar pattern:
  ↓
INPUT LAYER: Captures gesture coordinates & timing
  ↓
SFAM LAYER: Extracts physics (velocity, acceleration, jerk)
  → GhostNet processes spatial features
  → Bi-LSTM processes temporal features
  → Attention fusion weights them
  → Outputs 256-bit hash
  ↓
BEHAVIORAL MODEL: Loads Alice's baseline hash
  ↓
RLFS LAYER: Compares hashes
  → Hamming distance = 8/256 (3%)
  → All feature anomaly scores low (Z-score < 1.5)
  → No temporal anomalies
  → anomaly_score = 0.08
  ↓
S-ADR LAYER: Evaluates risk
  → Alice has 500 successful logins
  → Logging in from known device, home location
  → Time: 2pm (her normal work hours)
  → adaptive_threshold = 0.45
  → Decision: 0.08 < 0.45 → ALLOW
  ↓
OUTPUT: ✅ Authentication Success
  → Issue JWT token
  → Log to sessions collection
  → Update feature history

Dashboard shows: Low risk, high confidence, hash match 97%
```

### Scenario 2: Same Shape, Different Behavior - Rejected

```
Attacker copies Alice's pattern shape (from recording) but:
  → Types it fast (Alice is slow and deliberate)
  → Presses harder (different device)
  → At unusual time (3am instead of 2pm)

INPUT LAYER: Captures gesture
  ↓
SFAM LAYER: Extracts features
  → GhostNet sees: spatial shape matches but with artifacts
  → Bi-LSTM sees: velocity profile completely different
  → Attention: "temporal doesn't match spatial"
  → Hash: 89/256 bits differ (35% mismatch)
  ↓
RLFS LAYER: Anomaly detection
  → Hamming distance = 0.35
  → Gesture: velocity spike detected (Z-score = 3.8) ⚠️
  → Gesture: acceleration pattern wrong (Z-score = 2.9) ⚠️
  → Session: time-of-day anomaly (3am vs 2pm routine)
  → anomaly_score = 0.52 (HIGH)
  ↓
S-ADR LAYER: Adaptive response
  → Recent system-wide threat detected (security_state = "elevated")
  → adaptive_threshold = 0.30 (lowered due to threats)
  → 0.52 > 0.30 + 0.35 threshold range
  → Decision: BLOCK (high confidence in fraud)
  ↓
OUTPUT: ❌ Authentication Blocked
  → Return 403 Forbidden
  → Log security incident
  → Alert security team
  → Send email to Alice: "Unusual login attempt blocked"

Dashboard shows: Critical risk, clear fraud signature, multiple feature alerts
```

### Scenario 3: Slight Variation - Allowed with Warning

```
Alice's hand shakes (stress or injury) but still logs in:

INPUT LAYER: Gesture with tremor
  ↓
SFAM LAYER:
  → Spatial: Shape still correct
  → Temporal: Jerk values elevated (shaking causes acceleration changes)
  → Hash distance = 32/256 (12%)
  ↓
RLFS LAYER:
  → Hamming distance = 0.12 (acceptable)
  → Gesture jitter detected but within expected variance
  → Session context normal (Alice's device, home, afternoon)
  → anomaly_score = 0.28 (MEDIUM)
  ↓
S-ADR LAYER:
  → Alice is trusted (1000+ successful logins)
  → adaptive_threshold = 0.35 (lowered for trusted users)
  → 0.28 < 0.35 → ALLOW
  → But 0.28 is in "medium confidence" range
  → Decision: ALLOW_WITH_WARNING
  ↓
OUTPUT: ✅ Authentication Success (with caution)
  → Issue JWT token (full access)
  → Flag session as "medium_confidence"
  → Log to dashboard: "Session with tremor detected"
  → Monitor for repeated pattern (might indicate injury or stress)
  → Suggest: "Consider updating profile if behavior changes permanently"

Dashboard shows: Medium risk, legitimate variation, recommend profile refresh
```

---

## 🛠️ API Endpoints (Unified)

### Authentication Flow

```
POST /api/auth/gesture
  Required: { user_id, gesture_data }
  Optional: { typing_data, touch_data, device_context }
  Response: { decision, token, risk_metadata }
```

### Dashboard APIs

```
GET /api/dashboard/sessions?user_id=X&limit=50
  Returns: Last 50 sessions with full breakdowns

GET /api/dashboard/risk?user_id=X&timeframe=30d
  Returns: Risk scores over time, trends, alerts

GET /api/dashboard/drift?user_id=X
  Returns: Feature evolution, baseline comparisons

GET /api/dashboard/features?session_id=Y
  Returns: Feature-level breakdown for specific session

POST /api/dashboard/profile/update
  Refreshes baseline after detected legitimate change
```

---

## 🎬 Demo Scenarios

Three key scenarios demonstrating fraud detection:

1. **Legitimate User**: Pattern accepted ✅
2. **Impostor with Same Shape**: Rejected via behavior ❌
3. **Legitimate User with Variation**: Accepted with warning ⚠️

---

## 📋 Implementation Checklist

### Phase 1: Foundation

- [x] Architecture design (this document)
- [ ] Fix critical npm dependencies
- [ ] Setup MongoDB connection
- [ ] Create .env configuration
- [ ] Align API endpoints

### Phase 2: Core Processing Layers

- [ ] Implement Input Layer
- [ ] Implement SFAM Integration
- [ ] Implement Behavioral Model Layer
- [ ] Implement RLFS Module
- [ ] Implement S-ADR Module

### Phase 3: Storage & Logging

- [ ] Create MongoDB collections
- [ ] Implement session logging
- [ ] Implement risk logging
- [ ] Add audit trail

### Phase 4: Dashboard

- [ ] Session View component
- [ ] Risk Monitor component
- [ ] Drift Detection component
- [ ] Feature Insights component
- [ ] Connect to backend APIs

### Phase 5: Demo & Polish

- [ ] Test all three scenarios
- [ ] Create demo data
- [ ] Performance optimization
- [ ] Security hardening
- [ ] Documentation

---

**Next Step:** Begin Phase 1 implementation with dependency fixes and configuration setup.
