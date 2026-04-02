# SecuADR Behavioral Fraud Detection MVP

## Pipeline

INPUT -> SFAM -> Identity Vector -> Baseline Model -> RLFS -> S-ADR -> Trust Score

## Folder Structure

- secuadr-api-server/lib/behaviorTrustEngine.js
- secuadr-api-server/routes/trustEngine.js
- secuadr-api-server/models/BehavioralProfile.js
- pattern-login/src/components/BehaviorCapturePad.jsx
- pattern-login/src/components/BehaviorTrustDashboard.jsx
- pattern-login/src/components/BehaviorTrustDashboard.css
- pattern-login/src/services/auth.js
- pattern-login/src/App.jsx

## API Endpoints

- POST /api/trust/analyze
  - Input: username, points[{x,y,t}], scenario(normal|variation|attacker)
  - Output: trust_score, risk_level, decision, explanation, rlfs, sadr

- GET /api/trust/timeline/:username
  - Output: historical trust trend + drift state

- GET /api/trust/mock/:scenario
  - Output: deterministic scenario payload for demo

## Scenarios

- normal: high trust score, decision allow
- variation: medium trust score, decision allow_with_warning
- attacker: low trust score, decision block

## UI Panels

- Live Session Panel
- Behavior Comparison Panel
- Risk Timeline
- Feature Insights
- Drift Detection

## Notes

- Identity vectors are normalized in [0,1]
- Baseline model keeps the last N vectors
- RLFS returns per-feature deviations and top anomalies
- S-ADR returns risk score and decision
