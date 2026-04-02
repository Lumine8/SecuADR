# SecuADR Dashboard

Separate admin analytics dashboard for behavior-aware fraud monitoring.

## Run

1. Install dependencies:

npm install

2. Start dashboard:

npm run dev

The app runs on http://localhost:3010 and reads APIs from backend http://localhost:5000.

## Features

- User list with risk and trust summary
- User detail with baseline radar profile
- Behavior metrics trends
- Similarity/distance panel
- Session analysis table
- Fraud highlight feed

If backend APIs are unavailable, dashboard falls back to built-in mock multi-user dataset.
