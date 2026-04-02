from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Any, Dict, List, Optional
import torch
import os
import numpy as np
from datetime import datetime, timezone

from rlfs import run_rlfs, FEATURE_NAMES
from sadr import run_sadr

# ✅ CRITICAL: Import Key Generation from Canonical Source
# This ensures strict cryptographic alignment with the training script.
from sfam.models.sfam_net import SFAM_Adaptive, generate_user_key

# ==========================================================
# 0. CONFIG & UTILS
# ==========================================================
HAMMING_THRESHOLD = 0.15
BEHAVIOR_TOLERANCE = 0.60
TORTUOSITY_TOLERANCE = 0.50
SHAPE_THRESHOLD = 0.25
SPEEDVAR_TOLERANCE = 0.85
CURVATURE_TOLERANCE = 0.85
RHYTHM_TOLERANCE = 0.45
SHAPE_STAT_TOLERANCE = 0.45
HASH_DIM = 256
BEHAVIORAL_DIM = 6  # (dx, dy, v, a, p, az)
IDENTITY_VECTOR_DIM = 6
BASELINE_WINDOW = 20
DEVICE = "cuda" if torch.cuda.is_available() else "cpu"

app = FastAPI(title="SFAM Authentication Service", version="1.4.0")

# Load model once using ASCII-only logs for Windows console compatibility.
print(f"[SFAM] Loading model on {DEVICE}...")
model = SFAM_Adaptive(behavioral_dim=BEHAVIORAL_DIM, secure_dim=HASH_DIM).to(DEVICE).eval()

# In-memory stores for baseline and audit history.
# In production, this should be replaced with persistent storage (Redis/Postgres/Mongo).
USER_VECTOR_HISTORY: Dict[str, List[List[float]]] = {}
SESSION_LOGS: List[Dict[str, Any]] = []

# ==========================================================
# 1. DATA MODELS
# ==========================================================
class EnrollmentPayload(BaseModel):
    spatial: List[List[List[float]]]    # [3, 224, 224]
    behavioral: List[List[float]]       # [64, 6]
    stats: Optional[Dict[str, float]] = None
    shape_signature: Optional[List[List[float]]] = None

class ReferenceData(BaseModel):
    sfam_hash: List[float]
    seed: int
    salt: str
    enrollment_stats: Optional[Dict[str, float]] = None
    shape_signature: Optional[List[List[float]]] = None

class VerifyPayload(BaseModel):
    spatial: List[List[List[float]]]
    behavioral: List[List[float]]
    stats: Optional[Dict[str, float]] = None
    shape_signature: Optional[List[List[float]]] = None
    reference: ReferenceData

class ProcessPayload(BaseModel):
    user_id: str
    identity_vector: List[float]

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


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    a = np.asarray(vec_a, dtype=np.float32)
    b = np.asarray(vec_b, dtype=np.float32)
    denom = float(np.linalg.norm(a) * np.linalg.norm(b))
    if denom == 0.0:
        return 0.0
    return _clamp01(float(np.dot(a, b) / denom))


def _mean_vector(vectors: List[List[float]]) -> List[float]:
    if not vectors:
        return [0.0] * IDENTITY_VECTOR_DIM
    arr = np.asarray(vectors, dtype=np.float32)
    return [float(x) for x in np.mean(arr, axis=0).tolist()]


def _validate_identity_vector(vector: List[float]) -> List[float]:
    if len(vector) != IDENTITY_VECTOR_DIM:
        raise HTTPException(
            status_code=400,
            detail=(
                f"identity_vector must have {IDENTITY_VECTOR_DIM} values: "
                f"{', '.join(FEATURE_NAMES)}"
            ),
        )

    cleaned = []
    for value in vector:
        n = float(value)
        if not np.isfinite(n):
            raise HTTPException(status_code=400, detail="identity_vector contains non-finite values")
        cleaned.append(n)
    return cleaned


def _get_user_baseline(user_id: str) -> Optional[List[float]]:
    history = USER_VECTOR_HISTORY.get(user_id, [])
    if not history:
        return None
    return _mean_vector(history)


def _append_user_vector(user_id: str, vector: List[float]) -> None:
    history = USER_VECTOR_HISTORY.setdefault(user_id, [])
    history.append(vector)
    if len(history) > BASELINE_WINDOW:
        del history[:-BASELINE_WINDOW]


@app.post("/process")
def process_identity(payload: ProcessPayload):
    if not payload.user_id.strip():
        raise HTTPException(status_code=400, detail="user_id is required")

    current_vector = _validate_identity_vector(payload.identity_vector)
    user_id = payload.user_id.strip()

    baseline_vector = _get_user_baseline(user_id)
    if baseline_vector is None:
        # Bootstrap path for first-time users.
        _append_user_vector(user_id, current_vector)
        response = {
            "trust_score": 1.0,
            "risk_level": "low",
            "decision": "warning",
            "anomaly_features": [],
            "failure_pattern": "baseline_bootstrap",
            "anomaly_score": 0.0,
            "cosine_similarity": 1.0,
            "deviation_vector": [0.0] * IDENTITY_VECTOR_DIM,
            "feature_contributions": {},
        }
        SESSION_LOGS.append(
            {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "user_id": user_id,
                "identity_vector": current_vector,
                "baseline_vector": current_vector,
                "response": response,
            }
        )
        return response

    cos_sim = cosine_similarity(current_vector, baseline_vector)
    rlfs_out = run_rlfs(current_vector, baseline_vector, FEATURE_NAMES)
    sadr_out = run_sadr(rlfs_out["anomaly_score"], cos_sim)

    feature_contributions = {
        item["feature"]: round(item["deviation"], 4)
        for item in rlfs_out["top_anomalies"]
    }

    response = {
        "trust_score": sadr_out["trust_score"],
        "risk_level": sadr_out["risk_level"],
        "decision": sadr_out["decision"],
        "anomaly_features": [item["feature"] for item in rlfs_out["top_anomalies"]],
        "failure_pattern": rlfs_out["failure_pattern"],
        "anomaly_score": rlfs_out["anomaly_score"],
        "cosine_similarity": round(cos_sim, 4),
        "deviation_vector": rlfs_out["deviation_vector"],
        "feature_contributions": feature_contributions,
    }

    # Do not adapt baseline for hard-block outcomes.
    if response["decision"] != "block":
        _append_user_vector(user_id, current_vector)

    SESSION_LOGS.append(
        {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": user_id,
            "identity_vector": current_vector,
            "baseline_vector": baseline_vector,
            "response": response,
        }
    )

    return response

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


def to_model_tensors(spatial_raw: List[List[List[float]]], behavioral_raw: List[List[float]]):
    spatial = torch.tensor(spatial_raw, dtype=torch.float32).to(DEVICE)
    if float(spatial.max().item()) > 1.0:
        spatial = spatial / 255.0
    if spatial.ndim == 3:
        spatial = spatial.unsqueeze(0)

    behavioral = torch.tensor(behavioral_raw, dtype=torch.float32).to(DEVICE)
    if behavioral.ndim == 2:
        behavioral = behavioral.unsqueeze(0)

    return spatial, behavioral


def derive_stats_from_behavioral(behavioral_raw: List[List[float]]) -> Dict[str, float]:
    arr = np.asarray(behavioral_raw, dtype=np.float32)
    if arr.ndim != 2 or arr.shape[1] != BEHAVIORAL_DIM:
        return {
            "time": 0.0,
            "speed": 0.0,
            "speed_var": 0.0,
            "max_speed": 0.0,
            "accel": 0.0,
            "stability": 0.0,
            "duration": 0.0,
            "tortuosity": 1.0,
            "curvature": 0.0,
            "shape": 0.0,
            "rhythm": 0.0,
        }

    vel = arr[:, 2]
    accel = np.abs(arr[:, 3])
    dx = arr[:, 0]
    dy = arr[:, 1]
    az = arr[:, 5]

    path = float(np.sum(np.sqrt(np.square(dx) + np.square(dy))))
    total_dx = float(np.sum(dx))
    total_dy = float(np.sum(dy))
    euclidean = float(np.hypot(total_dx, total_dy))
    az_delta = np.abs(np.diff(az)) if az.size > 1 else np.asarray([0.0], dtype=np.float32)
    az_delta = np.minimum(az_delta, (2 * np.pi) - az_delta)

    speed_log = np.log1p(np.maximum(vel, 0.0))
    duration = float(arr.shape[0] / 60.0)
    tortuosity = float(path / (euclidean + 1e-5))
    curvature = float(np.mean(az_delta) / np.pi) if az_delta.size > 0 else 0.0
    speed_var = float(np.std(vel))
    rhythm = float(max(0.0, min(1.0, 1.0 - (np.std(vel) / (np.mean(vel) + 1e-5))))) if vel.size > 0 else 0.0
    shape = float(max(0.0, min(1.0, (curvature * 0.6) + (min(max((tortuosity - 1.0) / 3.0, 0.0), 1.0) * 0.4))))

    return {
        "time": duration,
        "speed": float(np.median(speed_log)),
        "speed_var": speed_var,
        "max_speed": float(np.max(speed_log)),
        "accel": float(np.log1p(np.mean(accel))) if accel.size > 0 else 0.0,
        "stability": float(np.std(speed_log)),
        "duration": duration,
        "tortuosity": tortuosity,
        "curvature": curvature,
        "shape": shape,
        "rhythm": rhythm,
    }


def shape_distance(current_sig: Optional[List[List[float]]], enrolled_sig: Optional[List[List[float]]]) -> Optional[float]:
    if not current_sig or not enrolled_sig:
        return None

    curr = np.asarray(current_sig, dtype=np.float32)
    enr = np.asarray(enrolled_sig, dtype=np.float32)

    if curr.ndim != 2 or enr.ndim != 2 or curr.shape[1] != 2 or enr.shape[1] != 2:
        return None

    n = min(curr.shape[0], enr.shape[0])
    if n < 2:
        return None

    c = curr[:n]
    e = enr[:n]

    d_forward = np.linalg.norm(c - e, axis=1)
    d_reverse = np.linalg.norm(c - np.flip(e, axis=0), axis=1)

    def strict_error(d):
        return (float(np.mean(d)) * 0.4) + (float(np.max(d)) * 0.6)

    return min(strict_error(d_forward), strict_error(d_reverse))


def behavior_consistency_gate(current_stats: Dict[str, float], enrolled_stats: Dict[str, float], current_sig=None, enrolled_sig=None):
    dur_diff = abs(current_stats.get("duration", 0.0) - enrolled_stats.get("duration", 0.0)) / (abs(enrolled_stats.get("duration", 0.0)) + 1e-5)
    spd_diff = abs(current_stats.get("speed", 0.0) - enrolled_stats.get("speed", 0.0)) / (abs(enrolled_stats.get("speed", 0.0)) + 1e-5)
    spv_diff = abs(current_stats.get("speed_var", 0.0) - enrolled_stats.get("speed_var", 0.0)) / (abs(enrolled_stats.get("speed_var", 0.0)) + 1e-5)
    tort_diff = abs(current_stats.get("tortuosity", 0.0) - enrolled_stats.get("tortuosity", 0.0)) / (abs(enrolled_stats.get("tortuosity", 0.0)) + 1e-5)
    curv_diff = abs(current_stats.get("curvature", 0.0) - enrolled_stats.get("curvature", 0.0)) / (abs(enrolled_stats.get("curvature", 0.0)) + 1e-5)
    rhythm_diff = abs(current_stats.get("rhythm", 0.0) - enrolled_stats.get("rhythm", 0.0))
    shape_stat_diff = abs(current_stats.get("shape", 0.0) - enrolled_stats.get("shape", 0.0))
    shp_diff = shape_distance(current_sig, enrolled_sig)

    metrics = {
        "dur_diff": float(dur_diff),
        "spd_diff": float(spd_diff),
        "spv_diff": float(spv_diff),
        "tort_diff": float(tort_diff),
        "curv_diff": float(curv_diff),
        "rhythm_diff": float(rhythm_diff),
        "shape_stat_diff": float(shape_stat_diff),
        "current": {
            "time": float(current_stats.get("time", current_stats.get("duration", 0.0))),
            "speed": float(current_stats.get("speed", 0.0)),
            "speed_var": float(current_stats.get("speed_var", 0.0)),
            "tortuosity": float(current_stats.get("tortuosity", 0.0)),
            "curvature": float(current_stats.get("curvature", 0.0)),
            "shape": float(current_stats.get("shape", 0.0)),
            "rhythm": float(current_stats.get("rhythm", 0.0)),
        },
        "enrolled": {
            "time": float(enrolled_stats.get("time", enrolled_stats.get("duration", 0.0))),
            "speed": float(enrolled_stats.get("speed", 0.0)),
            "speed_var": float(enrolled_stats.get("speed_var", 0.0)),
            "tortuosity": float(enrolled_stats.get("tortuosity", 0.0)),
            "curvature": float(enrolled_stats.get("curvature", 0.0)),
            "shape": float(enrolled_stats.get("shape", 0.0)),
            "rhythm": float(enrolled_stats.get("rhythm", 0.0)),
        },
    }
    if shp_diff is not None:
        metrics["shp_diff"] = float(shp_diff)

    exceeded = []
    if dur_diff > BEHAVIOR_TOLERANCE:
        exceeded.append(("Duration mismatch", dur_diff / (BEHAVIOR_TOLERANCE + 1e-5), dur_diff))
    if spd_diff > BEHAVIOR_TOLERANCE:
        exceeded.append(("Speed mismatch", spd_diff / (BEHAVIOR_TOLERANCE + 1e-5), spd_diff))
    if spv_diff > SPEEDVAR_TOLERANCE:
        exceeded.append(("Speed variance mismatch", spv_diff / (SPEEDVAR_TOLERANCE + 1e-5), spv_diff))
    if tort_diff > TORTUOSITY_TOLERANCE:
        exceeded.append(("Tortuosity mismatch", tort_diff / (TORTUOSITY_TOLERANCE + 1e-5), tort_diff))
    if curv_diff > CURVATURE_TOLERANCE:
        exceeded.append(("Curvature mismatch", curv_diff / (CURVATURE_TOLERANCE + 1e-5), curv_diff))
    if rhythm_diff > RHYTHM_TOLERANCE:
        exceeded.append(("Rhythm mismatch", rhythm_diff / (RHYTHM_TOLERANCE + 1e-5), rhythm_diff))
    if shape_stat_diff > SHAPE_STAT_TOLERANCE:
        exceeded.append(("Shape-stat mismatch", shape_stat_diff / (SHAPE_STAT_TOLERANCE + 1e-5), shape_stat_diff))
    if shp_diff is not None and shp_diff > SHAPE_THRESHOLD:
        exceeded.append(("Shape mismatch", shp_diff / (SHAPE_THRESHOLD + 1e-5), shp_diff))

    if exceeded:
        # Flag bot-like traces when variance/rhythm dominate instead of timing-only labels.
        bot_like = (spv_diff > SPEEDVAR_TOLERANCE * 0.8 and rhythm_diff > RHYTHM_TOLERANCE * 0.8)

        exceeded_sorted = sorted(exceeded, key=lambda item: item[1], reverse=True)
        primary_reason = "Bot-like behavioral signature" if bot_like else exceeded_sorted[0][0]
        metrics["top_mismatches"] = [
            {"reason": reason, "severity": float(round(severity, 4)), "delta": float(round(delta, 4))}
            for reason, severity, delta in exceeded_sorted[:3]
        ]
        return False, primary_reason, metrics

    return True, "Consistent", metrics


def detect_suspicious_match(metrics: Dict[str, Any], error_rate: float) -> Dict[str, Any]:
    reasons: List[str] = []
    score = 0.0

    dur_diff = float(metrics.get("dur_diff", 0.0) or 0.0)
    spd_diff = float(metrics.get("spd_diff", 0.0) or 0.0)
    spv_diff = float(metrics.get("spv_diff", 0.0) or 0.0)
    tort_diff = float(metrics.get("tort_diff", 0.0) or 0.0)
    curv_diff = float(metrics.get("curv_diff", 0.0) or 0.0)
    rhythm_diff = float(metrics.get("rhythm_diff", 0.0) or 0.0)
    shape_diff = float(metrics.get("shape_stat_diff", 0.0) or 0.0)

    avg_delta = (dur_diff + spd_diff + spv_diff + tort_diff + curv_diff + rhythm_diff + shape_diff) / 7.0

    if error_rate < 0.02 and avg_delta < 0.03:
        reasons.append("sfam_suspicion: too_perfect_match")
        score += 0.5

    if spv_diff > SPEEDVAR_TOLERANCE * 0.8 and rhythm_diff > RHYTHM_TOLERANCE * 0.8:
        reasons.append("sfam_suspicion: bot_like_motion_pattern")
        score += 0.35

    if shape_diff > SHAPE_STAT_TOLERANCE * 0.9 and curv_diff > CURVATURE_TOLERANCE * 0.7:
        reasons.append("sfam_suspicion: geometric_imitation_shift")
        score += 0.2

    return {
        "flag": bool(reasons),
        "score": float(min(1.0, round(score, 4))),
        "reasons": reasons,
    }

@app.post("/sfam/enroll")
def enroll(payload: EnrollmentPayload):
    try:
        # 1. Validation
        validate_dimensions(payload.behavioral)

        # 2. Tensor Conversion & Normalization
        spatial, behavioral = to_model_tensors(payload.spatial, payload.behavioral)

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
            "stats": payload.stats or derive_stats_from_behavioral(payload.behavioral),
            "shape_signature": payload.shape_signature,
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
        spatial, behavioral = to_model_tensors(payload.spatial, payload.behavioral)

        current_stats = payload.stats or derive_stats_from_behavioral(payload.behavioral)
        enrolled_stats = ref.enrollment_stats
        gate_metrics = {
            "current": current_stats,
            "enrolled": enrolled_stats or {},
        }
        gate_reason = "No enrollment stats provided"
        if enrolled_stats:
            gate_ok, gate_reason, gate_metrics = behavior_consistency_gate(
                current_stats,
                enrolled_stats,
                payload.shape_signature,
                ref.shape_signature,
            )
            if not gate_ok:
                return {
                    "hamming_distance": 1.0,
                    "auth_pass": False,
                    "threshold": HAMMING_THRESHOLD,
                    "reason": gate_reason,
                    "metrics": gate_metrics,
                }

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
        suspicion = detect_suspicious_match(gate_metrics, error_rate)

        return {
            "hamming_distance": round(error_rate, 4),
            "auth_pass": error_rate < HAMMING_THRESHOLD,
            "threshold": HAMMING_THRESHOLD,
            "reason": "Hash match" if error_rate < HAMMING_THRESHOLD else "Hash distance too high",
            "metrics": gate_metrics,
            "gate_reason": gate_reason,
            "possible_attack": suspicion,
        }

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"Verification Error: {e}")
        raise HTTPException(status_code=500, detail="Internal verification error")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)