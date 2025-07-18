# ![SecuADR Logo](pattern-login/src/assets/logoRmvBg.png)

# SecuADR

![MIT License](https://img.shields.io/badge/license-MIT-green.svg)
![Node.js](https://img.shields.io/badge/Backend-Node.js-brightgreen)
![Express](https://img.shields.io/badge/Framework-Express-blue)
![MongoDB](https://img.shields.io/badge/Database-MongoDB-green)
![React](https://img.shields.io/badge/Frontend-React-blue)
![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)

A gesture-based authentication system with a fallback email login feature, built using:

**Frontend:** React (Canvas-based pattern drawing)

**Backend:** Node.js + Express + MongoDB

**Fallback:** Secure email token for backup login

---

## ✅ Features

- **Pattern Enrollment:** Users draw and save a gesture as their password.
- **Pattern Login:** Authenticate by matching the stored gesture with high accuracy.
- **Fallback Login:** Send a time-limited token to email for passwordless access.
- **Secure:** Pattern stored in DB, token expires in 10 minutes, single-use.

---

## 🛠 Tech Stack

**Frontend:**

- React + react-canvas-draw for pattern capture
- Axios for API calls

**Backend:**

- Node.js + Express
- MongoDB (via Mongoose)
- Nodemailer for sending fallback email
- Dollar One Recognizer algorithm for gesture matching

---

## 📂 Project Structure

```
SecuARD/
├── LICENSE
├── pattern-login/         # React frontend
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   └── PatternCanvas.jsx
│   │   └── utils/dollarOneRecognizer.js
│   └── package.json
├── server/                # Node.js backend
│   ├── routes/
│   │   ├── fallback.js           # Send fallback link
│   │   ├── fallback-auth.js      # Validate token & pattern
│   │   ├── save-pattern.js       # Save pattern
│   │   └── get-pattern.js        # Fetch saved pattern
│   ├── models/
│   │   ├── Pattern.js            # Stores username + pattern
│   │   └── Token.js              # Stores fallback tokens
│   ├── utils/mailer.js           # Nodemailer config
│   ├── index.js                  # Server entry point
│   └── .env                      # Env variables
└── ...
```

---

## ⚡ Setup & Installation

### 1. Clone the Repository

```sh
git clone https://github.com/Lumine8/SecuADR
cd SecuARD
```

### 2. Backend Setup

```sh
cd server
npm install
```

**Configure Environment**
Create a `.env` file in `server/`:

```ini
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/patternLogin
EMAIL_USER=your_email@gmail.com
EMAIL_PASS=your_app_password   # Use Gmail App Password
```

**Run server:**

```sh
npm start
```

### 3. Frontend Setup

```sh
cd ../pattern-login
npm install
npm run dev
```

The frontend will be available at `http://localhost:5173` (default Vite port).

---

## 🔗 API Endpoints

| Method | Endpoint               | Description               |
| ------ | ---------------------- | ------------------------- |
| POST   | /api/save-pattern      | Save user pattern         |
| GET    | /api/get-pattern/:user | Get pattern for username  |
| POST   | /api/send-fallback     | Send fallback login email |
| POST   | /api/fallback-auth     | Validate token + pattern  |

---

## 🖼 Screenshots

- Pattern Enrollment UI
- Login Screen
- Fallback Email Example

_(Add images later)_

---

## ✅ Features Completed

- ✔ Pattern enrollment & login
- ✔ Fallback token generation
- ✔ Email sending with token link
- ✔ Pattern matching via $1 recognizer

---

## 🚀 Upcoming

- Mobile App (React Native + Skia)
- JWT-based sessions
- UI Polish & Responsive Design
- Production Deployment

---

## 📜 License

This software is the exclusive property of Lumine8. Any use, copying, modification, or distribution requires express written permission from the author. See the LICENSE file for full terms.
