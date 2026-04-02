import React, { useEffect, useMemo, useState } from "react";
import AuthService from "../services/auth";
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid,
    BarChart,
    Bar,
    Cell,
} from "recharts";
import BehaviorCapturePad from "./BehaviorCapturePad";
import "./BehaviorTrustDashboard.css";

const FEATURE_LABELS = {
    timing: "Timing",
    avg_velocity: "Velocity",
    velocity_variance: "Rhythm",
    curvature: "Curvature",
    pause_pattern: "Pauses",
};

function scoreColor(score) {
    if (score >= 0.7) return "#37f3aa";
    if (score >= 0.4) return "#ffd66e";
    return "#ff637d";
}

function decisionBadge(decision) {
    const map = {
        allow: "ALLOW",
        allow_with_warning: "WARNING",
        step_up: "STEP-UP",
        block: "BLOCK",
    };
    return map[decision] || String(decision || "-").toUpperCase();
}

function generateBaseGesture() {
    const now = Date.now();
    return [
        { x: 42, y: 52, t: now + 0 },
        { x: 76, y: 90, t: now + 92 },
        { x: 106, y: 126, t: now + 178 },
        { x: 145, y: 108, t: now + 266 },
        { x: 181, y: 78, t: now + 352 },
        { x: 210, y: 96, t: now + 436 },
        { x: 246, y: 122, t: now + 530 },
        { x: 283, y: 98, t: now + 620 },
        { x: 304, y: 62, t: now + 712 },
    ];
}

export default function BehaviorTrustDashboard() {
    const [username, setUsername] = useState("demo_user");
    const [points, setPoints] = useState(generateBaseGesture());
    const [baselinePoints, setBaselinePoints] = useState(generateBaseGesture());
    const [timeline, setTimeline] = useState([]);
    const [result, setResult] = useState(null);
    const [running, setRunning] = useState(false);
    const [liveScore, setLiveScore] = useState(0.5);
    const [scenario, setScenario] = useState("normal");
    const [error, setError] = useState("");

    useEffect(() => {
        if (!result) return;

        const target = result.trust_score || 0;
        const handle = setInterval(() => {
            setLiveScore((prev) => {
                const next = prev + (target - prev) * 0.15;
                if (Math.abs(next - target) < 0.01) return target;
                return next;
            });
        }, 35);

        return () => clearInterval(handle);
    }, [result]);

    async function refreshTimeline(activeUser = username) {
        try {
            const response = await AuthService.getTrustTimeline(activeUser, 30);
            setTimeline(response.timeline || []);
        } catch (e) {
            setTimeline([]);
        }
    }

    async function runScenario(runScenarioName = scenario) {
        setRunning(true);
        setError("");

        try {
            const payload = {
                username,
                scenario: runScenarioName,
                points,
                enroll: runScenarioName === "normal" && (!result || !timeline.length),
            };
            const response = await AuthService.analyzeBehavior(payload);
            if (!response.success) {
                throw new Error(response.message || "Trust analysis failed");
            }
            setResult(response);
            await refreshTimeline(username);
        } catch (e) {
            setError(e?.response?.data?.message || e.message || "Analysis failed");
        } finally {
            setRunning(false);
        }
    }

    async function runMock(runScenarioName) {
        setRunning(true);
        setError("");

        try {
            const response = await AuthService.getScenarioMock(runScenarioName);
            if (!response.success) {
                throw new Error(response.message || "Scenario mock failed");
            }
            const data = {
                ...response,
                drift: { state: runScenarioName === "attacker" ? "sudden" : runScenarioName === "variation" ? "gradual" : "stable" },
            };
            setResult(data);

            setTimeline((prev) => {
                const next = [
                    ...prev,
                    {
                        index: prev.length + 1,
                        timestamp: new Date().toISOString(),
                        trust_score: data.trust_score,
                        anomaly_score: data.rlfs?.anomaly_score || 0,
                        decision: data.decision,
                        risk_level: data.risk_level,
                    },
                ];
                return next.slice(-30);
            });
        } catch (e) {
            setError("Failed to load scenario");
        } finally {
            setRunning(false);
        }
    }

    const featureBars = useMemo(() => {
        const vector = result?.rlfs?.deviation_vector || [0, 0, 0, 0, 0];
        const keys = ["timing", "avg_velocity", "velocity_variance", "curvature", "pause_pattern"];
        return keys.map((key, i) => ({
            feature: FEATURE_LABELS[key],
            value: Number(vector[i] || 0),
            color: vector[i] > 0.65 ? "#ff607c" : vector[i] > 0.35 ? "#ffd66e" : "#36f1a3",
        }));
    }, [result]);

    const trendData = timeline.map((row) => ({
        idx: row.index,
        trust: row.trust_score,
        anomaly: row.anomaly_score,
    }));

    const decision = result?.decision || "allow";
    const trustScore = result?.trust_score ?? liveScore;

    return (
        <div className="trust-shell">
            <div className="trust-bg" />

            <header className="trust-header glass-panel">
                <div>
                    <h1>SecuADR Behavioral Trust Engine</h1>
                    <p>Behavior-aware fraud detection that explains every risk decision.</p>
                </div>

                <div className="control-row">
                    <input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        placeholder="username"
                    />
                    <button onClick={() => refreshTimeline()} className="ghost-btn">
                        Load Timeline
                    </button>
                </div>
            </header>

            <section className="scenario-row glass-panel">
                <h3>Demo Scenarios</h3>
                <div className="scenario-buttons">
                    <button disabled={running} onClick={() => { setScenario("normal"); runScenario("normal"); }}>
                        Scenario 1: Normal User
                    </button>
                    <button disabled={running} onClick={() => { setScenario("variation"); runScenario("variation"); }}>
                        Scenario 2: Natural Variation
                    </button>
                    <button disabled={running} onClick={() => { setScenario("attacker"); runScenario("attacker"); }}>
                        Scenario 3: Attacker
                    </button>
                    <button disabled={running} onClick={() => runMock(scenario)} className="ghost-btn">
                        Run Mock {scenario}
                    </button>
                </div>
            </section>

            <section className="top-grid">
                <article className="glass-panel">
                    <div className="panel-title-row">
                        <h2>Live Session Panel</h2>
                        <span className={`decision-pill ${decision}`}>{decisionBadge(decision)}</span>
                    </div>

                    <BehaviorCapturePad points={points} onPointsChange={setPoints} accent="#34dbff" />

                    <div className="score-row">
                        <div className="score-ring" style={{ "--score": trustScore, "--tone": scoreColor(trustScore) }}>
                            <div>{Math.round(trustScore * 100)}</div>
                            <small>Trust</small>
                        </div>
                        <div className="score-details">
                            <p><strong>Risk:</strong> {(result?.risk_level || "low").toUpperCase()}</p>
                            <p><strong>Decision:</strong> {decisionBadge(decision)}</p>
                            <p><strong>Why:</strong> {(result?.explanation || ["Awaiting session"]).join(", ")}</p>
                        </div>
                    </div>
                </article>

                <article className="glass-panel">
                    <h2>Behavior Comparison Panel</h2>
                    <div className="compare-grid">
                        <div>
                            <p>Baseline Gesture</p>
                            <BehaviorCapturePad points={baselinePoints} replay accent="#37f3aa" />
                        </div>
                        <div>
                            <p>Current Gesture</p>
                            <BehaviorCapturePad points={points} replay accent="#34dbff" />
                        </div>
                    </div>

                    <div className="delta-note">
                        {(result?.explanation || []).length
                            ? `Flagged differences: ${(result?.explanation || []).join(", ")}`
                            : "No significant differences detected yet."}
                    </div>
                </article>
            </section>

            <section className="bottom-grid">
                <article className="glass-panel">
                    <h2>Risk Timeline</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={trendData}>
                            <CartesianGrid stroke="rgba(130,170,255,0.18)" strokeDasharray="4 4" />
                            <XAxis dataKey="idx" stroke="#9bb7ff" />
                            <YAxis domain={[0, 1]} stroke="#9bb7ff" />
                            <Tooltip />
                            <Line dataKey="trust" stroke="#35f6b2" strokeWidth={2.5} dot={false} />
                            <Line dataKey="anomaly" stroke="#ff6a8f" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                </article>

                <article className="glass-panel">
                    <h2>Feature Insights</h2>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={featureBars}>
                            <CartesianGrid stroke="rgba(130,170,255,0.18)" strokeDasharray="4 4" />
                            <XAxis dataKey="feature" stroke="#9bb7ff" />
                            <YAxis domain={[0, 1]} stroke="#9bb7ff" />
                            <Tooltip />
                            <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                                {featureBars.map((entry) => (
                                    <Cell key={entry.feature} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </article>
            </section>

            <section className="drift-panel glass-panel">
                <h2>Drift Detection</h2>
                <p>
                    Behavior drift is currently <strong>{(result?.drift?.state || "stable").toUpperCase()}</strong>.
                    Gradual drift reflects natural evolution; sudden drift signals potential takeover behavior.
                </p>
            </section>

            {error ? <div className="error-banner">{error}</div> : null}
        </div>
    );
}
