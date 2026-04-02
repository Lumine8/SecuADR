import React from "react";
import GestureReplayCanvas from "./GestureReplayCanvas";

function getSessionReason(session) {
    return (
        session?.sadr_output?.reason ||
        session?.sfam_output?.reason ||
        (session?.rlfs_output?.feature_alerts || []).join(", ") ||
        (session?.rlfs_output?.detected_anomalies || []).join(", ") ||
        "baseline aligned"
    );
}

function getSessionVector(session) {
    const current = session?.sfam_output?.behavior_metrics?.current;
    if (current) {
        return [
            current.time,
            current.speed,
            current.speed_var,
            current.tortuosity,
            current.curvature,
            current.shape,
            current.rhythm,
        ].filter((v) => Number.isFinite(v));
    }
    return session?.metadata?.identity_vector || [];
}

function getSessionAnomaly(session) {
    const topLevel = Number(session?.anomaly_score);
    if (Number.isFinite(topLevel)) return topLevel;

    const rlfs = Number(session?.rlfs_output?.anomaly_score);
    if (Number.isFinite(rlfs)) return rlfs;

    return 0;
}

export default function SessionAnalysisPanel({ sessions = [] }) {
    const rows = sessions.slice(0, 8);
    const [selected, setSelected] = React.useState(rows[0] || null);

    React.useEffect(() => {
        setSelected(rows[0] || null);
    }, [sessions]);

    return (
        <section className="card">
            <h2>Session Analysis</h2>
            <p className="panel-subtitle">Inspect recent sessions, decisions, replay, and feature vector deviations.</p>
            <div className="table-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Anomaly</th>
                            <th>Decision</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((s) => (
                            <tr
                                key={s._id || s.timestamp}
                                onClick={() => setSelected(s)}
                                className={`session-row ${(selected?._id || selected?.timestamp) === (s._id || s.timestamp) ? "selected" : ""}`}
                            >
                                <td>{new Date(s.timestamp).toLocaleString()}</td>
                                <td>{getSessionAnomaly(s).toFixed(2)}</td>
                                <td>{s.sadr_output?.recommended_action || "allow"}</td>
                                <td className="reason-cell">{getSessionReason(s)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className="session-detail">
                <h3>Replay + Vector</h3>
                <GestureReplayCanvas points={selected?.input?.gesture?.raw_points || []} />
                <p>
                    <strong>Feature Vector:</strong>{" "}
                    {getSessionVector(selected).length
                        ? JSON.stringify(getSessionVector(selected))
                        : "not available"}
                </p>
                <p>
                    <strong>Deviations:</strong>{" "}
                    {(selected?.rlfs_output?.feature_alerts || []).join(", ") || "none"}
                </p>
            </div>
        </section>
    );
}
