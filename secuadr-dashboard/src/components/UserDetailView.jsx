import React from "react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from "recharts";

const labels = ["Time", "Speed", "SpeedVar", "Tortuosity", "Curvature", "Shape", "Rhythm"];

function clamp01(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(1, n));
}

function statsToRadarVector(stats = {}) {
    if (!stats || typeof stats !== "object") return [];

    const values = [
        clamp01((stats.time ?? stats.duration ?? 0) / 3.0),
        clamp01((stats.speed ?? 0) / 3.0),
        clamp01(stats.speed_var ?? stats.stability ?? 0),
        clamp01(((stats.tortuosity ?? 1) - 1.0) / 4.0),
        clamp01(stats.curvature ?? 0),
        clamp01(stats.shape ?? 0),
        clamp01(stats.rhythm ?? 0),
    ];

    return values;
}

function vectorFromRawPoints(rawPoints = []) {
    if (!Array.isArray(rawPoints) || rawPoints.length < 3) return [];

    const points = rawPoints
        .map((p, idx) => ({
            x: Number(p.x),
            y: Number(p.y),
            t: Number(p.timestamp ?? idx),
        }))
        .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y))
        .sort((a, b) => a.t - b.t);

    if (points.length < 3) return [];

    const mean = (arr) => (arr.length ? arr.reduce((sum, v) => sum + v, 0) / arr.length : 0);
    const std = (arr) => {
        if (!arr.length) return 0;
        const m = mean(arr);
        return Math.sqrt(mean(arr.map((v) => (v - m) ** 2)));
    };

    const velocities = [];
    const intervals = [];
    const headings = [];
    let pathLength = 0;

    for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const dist = Math.hypot(dx, dy);
        const dt = Math.max(p2.t - p1.t, 1);

        velocities.push(dist / dt);
        intervals.push(dt);
        headings.push(Math.atan2(dy, dx));
        pathLength += dist;
    }

    if (!velocities.length) return [];

    const headingDelta = [];
    for (let i = 1; i < headings.length; i++) {
        let d = Math.abs(headings[i] - headings[i - 1]);
        if (d > Math.PI) d = 2 * Math.PI - d;
        headingDelta.push(d);
    }

    const start = points[0];
    const end = points[points.length - 1];
    const euclidean = Math.hypot(end.x - start.x, end.y - start.y);
    const tortuosity = pathLength / (euclidean + 1e-5);
    const curvature = headingDelta.length ? mean(headingDelta) / Math.PI : 0;
    const rhythm = clamp01(1 - std(intervals) / (mean(intervals) + 1e-5));
    const shape = clamp01(curvature * 0.6 + clamp01((tortuosity - 1.0) / 3.0) * 0.4);
    const durationSec = Math.max((points[points.length - 1].t - points[0].t) / 1000, 0.01);

    return [
        clamp01(durationSec / 3.0),
        clamp01(mean(velocities) * 200),
        clamp01(std(velocities) * 200),
        clamp01((tortuosity - 1.0) / 4.0),
        clamp01(curvature),
        clamp01(shape),
        clamp01(rhythm),
    ];
}

export default function UserDetailView({ detail }) {
    const baseline = detail?.user?.baseline_vector || [];
    const fallbackStats =
        detail?.sessions?.[0]?.sfam_output?.behavior_metrics?.current ||
        detail?.sessions?.[0]?.sfam_output?.behavior_metrics?.enrolled ||
        null;
    const fallbackRawPoints = detail?.sessions?.[0]?.input?.gesture?.raw_points || [];

    const vector = baseline.length >= 7
        ? baseline
        : (fallbackStats
            ? statsToRadarVector(fallbackStats)
            : vectorFromRawPoints(fallbackRawPoints));

    const vectorSource = detail?.user?.vector_source ||
        (fallbackStats
            ? "session_behavior_metrics"
            : (fallbackRawPoints.length >= 3 ? "raw_points_computed" : "unavailable"));
    const radarData = labels.map((label, i) => ({ subject: label, value: vector[i] || 0 }));

    return (
        <section className="card">
            <h2>User Detail</h2>
            <p className="panel-subtitle">Behavior profile baseline and drift posture for the selected user.</p>
            {!detail?.user ? <p>Select a user.</p> : (
                <>
                    <div className="detail-headline">
                        <strong>{detail.user.username}</strong>
                        <span className="pill-tag">Drift: <span className="accent">{detail.user.drift_state}</span></span>
                        <span className="pill-tag">Vector: {vectorSource}</span>
                    </div>
                    <ResponsiveContainer width="100%" height={220}>
                        <RadarChart data={radarData}>
                            <PolarGrid stroke="rgba(139,171,255,.25)" />
                            <PolarAngleAxis dataKey="subject" stroke="#b7cdff" />
                            <PolarRadiusAxis domain={[0, 1]} stroke="#89a5dd" />
                            <Radar dataKey="value" stroke="#2fe1ff" fill="#2fe1ff" fillOpacity={0.38} />
                        </RadarChart>
                    </ResponsiveContainer>
                </>
            )}
        </section>
    );
}
