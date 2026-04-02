# Run SecuADR + Dashboard

## 1) API server

From secuadr-api-server:

npm install
node index.js

Default port: 5000

## 2) Main gesture app

From pattern-login:

npm install
npm run dev

Default port: 3001

## 3) Separate analytics dashboard

From secuadr-dashboard:

npm install
npm run dev

Default port: 3010

---

## Key APIs

- POST /api/trust/analyze
- GET /users
- GET /users/:id
- GET /sessions
- GET /metrics
- GET /risk
- GET /stream (SSE realtime updates from MongoDB change streams)

## Notes

- Dashboard app automatically falls back to mock multi-user dataset when backend APIs are unavailable.
- If MongoDB is unavailable, analytics endpoints return 503 with a clear message.
- When MongoDB is connected, dashboard panels update in near real-time through `/stream`.
