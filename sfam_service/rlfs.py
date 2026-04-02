from typing import Dict, List

FEATURE_NAMES = [
    "time_norm",
    "avg_speed",
    "speed_variance",
    "tortuosity",
    "curvature",
    "rhythm",
]

# Feature-aware normalization caps keep deviation scores in a stable 0..1 band.
NORMALIZATION_CAPS = {
    "time_norm": 0.6,
    "avg_speed": 0.6,
    "speed_variance": 0.5,
    "tortuosity": 0.8,
    "curvature": 0.7,
    "rhythm": 0.6,
}


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def compute_feature_deviation(current: List[float], baseline: List[float]) -> List[float]:
    return [abs(float(c) - float(b)) for c, b in zip(current, baseline)]


def normalize_deviation(raw_deviation: List[float], feature_names: List[str]) -> List[float]:
    normalized: List[float] = []
    for idx, dev in enumerate(raw_deviation):
        feature = feature_names[idx]
        cap = NORMALIZATION_CAPS.get(feature, 1.0)
        normalized.append(_clamp01(dev / (cap + 1e-9)))
    return normalized


def top_anomalies(deviation_vector: List[float], feature_names: List[str], top_k: int = 3) -> List[Dict[str, float]]:
    ranked = sorted(
        [
            {"feature": feature_names[i], "deviation": float(deviation_vector[i])}
            for i in range(len(deviation_vector))
        ],
        key=lambda item: item["deviation"],
        reverse=True,
    )
    return ranked[:top_k]


def detect_failure_pattern(current: List[float], baseline: List[float], feature_names: List[str], deviation_vector: List[float]) -> str:
    feature_to_dev = {feature_names[i]: deviation_vector[i] for i in range(len(feature_names))}
    feature_to_curr = {feature_names[i]: float(current[i]) for i in range(len(feature_names))}
    feature_to_base = {feature_names[i]: float(baseline[i]) for i in range(len(feature_names))}

    if feature_to_dev.get("time_norm", 0.0) > 0.6:
        return "timing_drift"

    if feature_to_dev.get("speed_variance", 0.0) > 0.6:
        return "velocity_instability"

    if feature_to_dev.get("tortuosity", 0.0) > 0.6:
        return "path_irregularity"

    # Low variance + high rhythm often indicates scripted/replay-like consistency.
    if (
        feature_to_curr.get("speed_variance", 1.0) < 0.08
        and feature_to_curr.get("rhythm", 0.0) > 0.92
        and feature_to_dev.get("avg_speed", 0.0) > 0.45
    ):
        return "scripted_replay_signature"

    # Strong speed/curvature shift can indicate imitation by another actor.
    if (
        feature_to_dev.get("avg_speed", 0.0) > 0.55
        and feature_to_dev.get("curvature", 0.0) > 0.5
        and feature_to_curr.get("avg_speed", 0.0) != feature_to_base.get("avg_speed", 0.0)
    ):
        return "imitation_pattern_shift"

    return "baseline_aligned"


def run_rlfs(current_vector: List[float], baseline_vector: List[float], feature_names: List[str] = FEATURE_NAMES) -> Dict[str, object]:
    if len(current_vector) != len(feature_names) or len(baseline_vector) != len(feature_names):
        raise ValueError("Vector dimension mismatch for RLFS")

    raw_deviation = compute_feature_deviation(current_vector, baseline_vector)
    deviation_vector = normalize_deviation(raw_deviation, feature_names)
    anomalies = top_anomalies(deviation_vector, feature_names, top_k=3)
    anomaly_score = float(sum(deviation_vector) / len(deviation_vector)) if deviation_vector else 0.0
    failure_pattern = detect_failure_pattern(current_vector, baseline_vector, feature_names, deviation_vector)

    return {
        "anomaly_score": round(anomaly_score, 4),
        "top_anomalies": anomalies,
        "deviation_vector": [round(x, 4) for x in deviation_vector],
        "failure_pattern": failure_pattern,
    }
