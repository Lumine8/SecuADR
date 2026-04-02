import React from "react";

function eventCategory(item) {
    const attackFlag = Boolean(item?.possible_attack?.flag);
    const type = String(item?.event_type || "").toLowerCase();
    if (attackFlag) return "possible attack";
    if (type.includes("fraud")) return "fraud suspected";
    if (type.includes("challenge")) return "challenge event";
    return "anomaly";
}

function confidenceLabel(item) {
    const score = Number(item?.possible_attack?.score);
    if (Number.isFinite(score) && score >= 0.8) return "very high";
    if (Number.isFinite(score) && score >= 0.6) return "high";

    const anomaly = Number(item?.risk_indicators?.anomaly_score);
    if (Number.isFinite(anomaly) && anomaly >= 0.8) return "high";
    if (Number.isFinite(anomaly) && anomaly >= 0.6) return "medium";
    return "medium";
}

function buildReason(item) {
    const attackReasons = item?.possible_attack?.reasons || [];
    const baseReason = item?.reason || "";
    const features = item?.risk_indicators?.feature_alerts || [];
    const merged = [
        ...attackReasons,
        baseReason,
        ...features,
    ]
        .map((x) => String(x || "").trim())
        .filter(Boolean);

    const deduped = [...new Set(merged)];
    return deduped.slice(0, 2).join(" | ") || "Behavioral anomaly detected";
}

export default function FraudHighlightPanel({ flagged = [], users = [] }) {
    const userMap = users.reduce((acc, user) => {
        acc[String(user.id || user._id)] = user.username;
        return acc;
    }, {});

    return (
        <section className="card">
            <h2>Fraud Highlights</h2>
            <p className="panel-subtitle">Priority events with risk type, confidence, and targeted account context.</p>
            <div className="alerts">
                {flagged.length === 0 ? (
                    <p>No fraud highlights yet. New risky sessions will appear here in realtime.</p>
                ) : null}
                {flagged.slice(0, 8).map((f) => (
                    <div key={f._id || f.timestamp} className={`alert ${f.severity || "high"}`}>
                        <div className="alert-head">
                            <strong>{(f.severity || "high").toUpperCase()}</strong>
                            <span className="severity-pill">{eventCategory(f)}</span>
                            <span className="signal-pill">confidence: {confidenceLabel(f)}</span>
                            <small>{new Date(f.timestamp).toLocaleString()}</small>
                        </div>
                        <p>{buildReason(f)}</p>
                        <div className="alert-meta">
                            <span>
                                User: {
                                    f.username || userMap[String(f.user_id || "")] || "unknown"
                                }
                            </span>
                            <span>
                                Action: {String(f.action_taken || "review").toUpperCase()}
                            </span>
                            <span>
                                Attack Score: {Number(f?.possible_attack?.score || 0).toFixed(2)}
                            </span>
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
}
