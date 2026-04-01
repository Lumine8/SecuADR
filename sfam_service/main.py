from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import torch
import os

# ✅ CRITICAL: Import Key Generation from Canonical Source
# This ensures strict cryptographic alignment with the training script.
from sfam.models.sfam_net import SFAM_Adaptive, generate_user_key

# ==========================================================
# 0. CONFIG & UTILS
# ==========================================================
HAMMING_THRESHOLD = 0.15
HASH_DIM = 256
BEHAVIORAL_DIM = 6  # (dx, dy, v, a, p, az)
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI(title="SFAM Authentication Service", version="1.4.0")

# Load Model Once (Global)
print(f"🚀 Loading SFAM Model on {DEVICE}...")
model = SFAM_Adaptive(behavioral_dim=BEHAVIORAL_DIM, secure_dim=HASH_DIM).to(DEVICE).eval()

# ==========================================================
# 1. DATA MODELS
# ==========================================================
class EnrollmentPayload(BaseModel):
    spatial: List[List[List[float]]]    # [3, 224, 224]
    behavioral: List[List[float]]       # [64, 6]

class ReferenceData(BaseModel):
    sfam_hash: List[float]
    seed: int
    salt: str 

class VerifyPayload(BaseModel):
    spatial: List[List[List[float]]]
    behavioral: List[List[float]]
    reference: ReferenceData

# ==========================================================
# 2. SYSTEM ROUTES
# ==========================================================

@app.get("/health")
def health():
    """Liveness check for Docker/K8s"""
    return {"status": "operational", "device": DEVICE}

@app.get("/version")
def version():
    """Configuration check for Client/Server alignment"""
    return {
        "service": "SFAM-API",
        "version": "1.4.0",
        "model_config": {
            "type": "SFAM_Adaptive",
            "hash_dim": HASH_DIM,
            "behavioral_dim": BEHAVIORAL_DIM,
            "threshold": HAMMING_THRESHOLD
        }
    }

# ==========================================================
# 3. CORE LOGIC
# ==========================================================

def validate_dimensions(behavioral: List[List[float]]):
    """Micro-improvement: Enforce feature consistency"""
    if not behavioral:
        raise HTTPException(status_code=400, detail="Behavioral data is empty")
    
    # Check first frame to ensure the client is sending 6 features
    if len(behavioral[0]) != BEHAVIORAL_DIM:
        raise HTTPException(
            status_code=400, 
            detail=f"Feature dimension mismatch. Expected {BEHAVIORAL_DIM}, got {len(behavioral[0])}"
        )

@app.post("/sfam/enroll")
def enroll(payload: EnrollmentPayload):
    try:
        # 1. Validation
        validate_dimensions(payload.behavioral)

        # 2. Tensor Conversion & Normalization
        spatial = torch.tensor(payload.spatial, dtype=torch.float32).to(DEVICE)
        if spatial.max() > 1.0: spatial = spatial / 255.0
        if spatial.ndim == 3: spatial = spatial.unsqueeze(0) 

        behavioral = torch.tensor(payload.behavioral, dtype=torch.float32).to(DEVICE)
        if behavioral.ndim == 2: behavioral = behavioral.unsqueeze(0)

        # 3. Generate Credentials (Canonical)
        seed = int(os.urandom(4).hex(), 16) % 100000 
        salt = os.urandom(16)
        
        # Canonical generation ensures projection matrix matches training
        user_key = generate_user_key(seed, salt).to(DEVICE)

        # 4. Inference
        with torch.no_grad():
            sfam_hash = model(spatial, behavioral, user_key)
        
        return {
            "sfam_hash": sfam_hash.view(-1).cpu().tolist(),
            "seed": seed,
            "salt": salt.hex(),
            "created_at": "2024-05-20"
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Enrollment Error: {e}")
        raise HTTPException(status_code=500, detail="Internal processing error")

@app.post("/sfam/verify")
def verify(payload: VerifyPayload):
    try:
        ref = payload.reference

        # 1. Security Validations
        if len(ref.sfam_hash) != HASH_DIM:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid hash dimension. Expected {HASH_DIM}, got {len(ref.sfam_hash)}"
            )
        
        validate_dimensions(payload.behavioral)

        # 2. Reconstruct Inputs
        spatial = torch.tensor(payload.spatial, dtype=torch.float32).to(DEVICE)
        if spatial.max() > 1.0: spatial = spatial / 255.0
        if spatial.ndim == 3: spatial = spatial.unsqueeze(0)

        behavioral = torch.tensor(payload.behavioral, dtype=torch.float32).to(DEVICE)
        if behavioral.ndim == 2: behavioral = behavioral.unsqueeze(0)

        # 3. Reconstruct Key (Canonical)
        try:
            salt_bytes = bytes.fromhex(ref.salt)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid salt format")

        user_key = generate_user_key(ref.seed, salt_bytes).to(DEVICE)
        
        # 4. Load Enrolled Hash
        enrolled_tensor = torch.tensor(ref.sfam_hash, dtype=torch.float32).to(DEVICE)

        # 5. Inference
        with torch.no_grad():
            live_hash = model(spatial, behavioral, user_key).view(-1)

        # 6. Calculate Hamming Distance (Signed BioHash Logic)
        agreement_vector = (live_hash * enrolled_tensor) > 0 
        error_rate = 1.0 - (torch.sum(agreement_vector).item() / HASH_DIM)

        return {
            "hamming_distance": round(error_rate, 4),
            "auth_pass": error_rate < HAMMING_THRESHOLD,
            "threshold": HAMMING_THRESHOLD
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        raise HTTPException(status_code=500, detail="Internal verification error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)