# SecuADR SFAM Setup & Startup Guide

## 🚀 Quick Start

### 1. Backend API Server (Node.js)

Already running on port 5000. MongoDB Atlas is configured in `.env`.

### 2. SFAM Service (Python) - Port 8000

#### Prerequisites

- Python 3.8+ installed
- CUDA-capable GPU (optional but recommended):
  - If GPU available: SFAM uses `cuda` automatically
  - If no GPU: Falls back to CPU (slower)

#### Setup Instructions

```bash
# 1. Navigate to SFAM service directory
cd sfam_service

# 2. Create Python virtual environment (recommended)
python -m venv venv

# 3. Activate virtual environment
# On Windows:
venv\Scripts\activate

# On macOS/Linux:
source venv/bin/activate

# 4. Install dependencies
pip install -r requirements.txt

# 5. Start SFAM service
python main.py
```

You should see:

```
🚀 Loading SFAM Model on cuda...
INFO:     Uvicorn running on http://0.0.0.0:8000
```

### 3. Frontend (React) - Port 5173

Already running. Make sure you have:

```bash
cd pattern-login
npm install
npm run dev
```

## 📋 System Architecture

```
┌─────────────────────────────────────────────┐
│         React Frontend (Port 5173)          │
│      - Pattern Canvas for gesture input     │
│      - Raw gesture points (X, Y)            │
└────────────────┬────────────────────────────┘
                 │ HTTP /api/authenticate
                 │ /api/sfam/enroll
                 ▼
┌─────────────────────────────────────────────┐
│    Node.js/Express Backend (Port 5000)      │
│      - Gesture Feature Extraction           │
│      - MongoDB Atlas Connection             │
│      - Authentication Logic                 │
└────────────────┬────────────────────────────┘
                 │ HTTP POST /sfam/enroll
                 │ HTTP POST /sfam/verify
                 ▼
┌─────────────────────────────────────────────┐
│    Python FastAPI SFAM (Port 8000)          │
│      - Spatial Image Generation             │
│      - Behavioral Feature Processing        │
│      - Biometric Hashing (256-bit)          │
│      - Hamming Distance Verification        │
└─────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────┐
│     PyTorch SFAM_Adaptive Model             │
│      - Neural Network inference             │
│      - GPU/CPU acceleration                 │
└─────────────────────────────────────────────┘
```

## 🔧 Configuration

### Environment Variables (.env)

```
# MongoDB Atlas (already configured)
MONGODB_URI=mongodb+srv://sankargopan1_db_user:BTfqHovhZh0qhH5W@cluster0.kxfxkdr.mongodb.net/?appName=Cluster0

# SFAM Service
SFAM_SERVICE_URL=http://localhost:8000
SFAM_TIMEOUT_MS=30000
```

### Feature Extraction

The backend automatically transforms raw gesture points into:

1. **Spatial Features**: 224×224×3 image representation
   - Red channel: Primary stroke
   - Green/Blue channels: Anti-aliasing effect
2. **Behavioral Features**: 64 frames × 6 metrics
   - dx, dy: Displacement
   - velocity: Speed of motion
   - acceleration: Change in speed
   - pressure: Touch intensity
   - azimuth: Angle of motion

## ✅ Verification

Check if all components are running:

```bash
# Backend health
curl http://localhost:5000/health

# SFAM health
curl http://localhost:8000/health

# Service versions
curl http://localhost:8000/version
```

## 🔐 Enrollment & Authentication Flow

### Enrollment (First Time)

1. User draws gesture on canvas
2. Frontend extracts raw points (X, Y, ID)
3. Backend transforms to spatial/behavioral features
4. SFAM generates:
   - 256-bit biometric hash
   - Random seed & salt
   - Hash stored in MongoDB

### Authentication (Subsequent)

1. User draws gesture again
2. Frontend extracts raw points
3. Backend transforms to spatial/behavioral features
4. SFAM computes:
   - Live 256-bit hash
   - Hamming distance from enrolled hash
   - Distance < 0.15 = authenticated ✓

## 🐛 Troubleshooting

### SFAM Service Won't Start

```bash
# Check Python installation
python --version

# Check PyTorch with GPU support
python -c "import torch; print(torch.cuda.is_available())"

# (if False, SFAM will run on CPU)
```

### Connection Refused (Backend → SFAM)

- Make sure SFAM service is running on localhost:8000
- Check firewall allows localhost connections
- Verify SFAM_SERVICE_URL in .env

### MongoDB Connection Issues

- Check MongoDB Atlas connection string in .env
- Verify IP whitelist allows your machine
- Test: `mongo "mongodb+srv://..." --username sankargopan1_db_user`

### Authentication Failures

- Gesture must be at least 5 points
- Pattern should be distinct and repeatable
- Ensure gesture is drawn at consistent speed/pressure

## 📊 Performance Tips

1. **GPU Acceleration**
   - SFAM automatically uses CUDA if available
   - First inference triggers model compilation (~30s)
   - Subsequent verifications: <100ms

2. **Gesture Quality**
   - Longer gestures = more features = better accuracy
   - Consistent drawing speed reduces variability
   - Avoid rapid speed changes

3. **Enrollment Strategy**
   - Enroll 2-3 times with slight variations
   - Helps SFAM adapt to natural variation
   - Increases successful authentication rates

## 📝 Log Monitoring

Watch all three services:

```bash
# Terminal 1: Node.js API
cd secuadr-api-server && npm start

# Terminal 2: Python SFAM
cd sfam_service && python main.py

# Terminal 3: React
cd pattern-login && npm run dev

# Terminal 4: Monitor logs
tail -f secuadr-api-server/logs/*.log
```

## 🎯 Next Steps

1. ✅ Set up Python environment
2. ✅ Install SFAM dependencies
3. ✅ Start SFAM service (Python)
4. ✅ Verify connections with curl commands
5. ✅ Test enrollment in React UI
6. ✅ Test authentication flow

## 📚 Resources

- FastAPI: https://fastapi.tiangolo.com
- PyTorch: https://pytorch.org
- MongoDB Atlas: https://www.mongodb.com/cloud/atlas
- SecuADR Docs: See REFACTORING_ARCHITECTURE.md
