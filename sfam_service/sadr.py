from typing import Dict


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def _decision_from_risk(risk_score: float) -> str:
    if risk_score < 0.3:
        return "allow"
    if risk_score < 0.6:
        return "warning"
    if risk_score < 0.8:
        return "step_up"
    return "block"


def _risk_level_from_score(risk_score: float) -> str:
    if risk_score < 0.3:
        return "low"
    if risk_score < 0.6:
        return "medium"
    return "high"


def run_sadr(anomaly_score: float, cosine_similarity: float) -> Dict[str, object]:
    anomaly_score = _clamp01(anomaly_score)
    cosine_similarity = _clamp01(cosine_similarity)

    risk_score = (0.5 * anomaly_score) + (0.5 * (1.0 - cosine_similarity))
    risk_score = _clamp01(risk_score)

    decision = _decision_from_risk(risk_score)
    trust_score = 1.0 - risk_score

    return {
        "trust_score": round(trust_score, 4),
        "risk_level": _risk_level_from_score(risk_score),
        "decision": decision,
        "risk_score": round(risk_score, 4),
    }
