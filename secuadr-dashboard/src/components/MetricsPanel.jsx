import React from "react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line, BarChart, Bar } from "recharts";

export default function MetricsPanel({ metrics = [] }) {
    const hasNonZeroAnomaly = metrics.some((m) => Number(m?.anomaly_score) > 0);
    const fallbackToHamming = !hasNonZeroAnomaly;

    const normalizedMetrics = metrics.map((m) => {
        const hamming = Number(m?.hamming_distance);
        const hammingNorm = Number.isFinite(hamming) ? Math.max(0, Math.min(1, hamming)) : 0;

        const anomaly = fallbackToHamming
            ? hammingNorm
            : Math.max(0, Math.min(1, Number(m?.anomaly_score) || 0));

        const trust = fallbackToHamming
            ? 1 - hammingNorm
            : Math.max(0, Math.min(1, Number(m?.trust_score) || (1 - anomaly)));

        return {
            ...m,
            anomaly_score: Number(anomaly.toFixed(3)),
            trust_score: Number(trust.toFixed(3)),
        };
    });

    return (
        <section className="card">
            <h2>Behavior Metrics</h2>
            <p className="panel-subtitle">Trust and anomaly trends from recent authentication sessions.</p>
            <div className="chart-grid">
                <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={normalizedMetrics}>
                        <CartesianGrid stroke="rgba(125,162,255,.22)" />
                        <XAxis dataKey="index" stroke="#9eb9ea" />
                        <YAxis domain={[0, 1]} stroke="#9eb9ea" />
                        <Tooltip />
                        <Line dataKey="trust_score" stroke="#33f4ab" strokeWidth={2.5} dot={false} />
                        <Line dataKey="anomaly_score" stroke="#ff6387" strokeWidth={2} dot={false} />
                    </LineChart>
                </ResponsiveContainer>
                <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={normalizedMetrics.slice(-10)}>
                        <CartesianGrid stroke="rgba(125,162,255,.22)" />
                        <XAxis dataKey="index" stroke="#9eb9ea" />
                        <YAxis stroke="#9eb9ea" />
                        <Tooltip />
                        <Bar dataKey="euclidean_distance" fill="#7b6dff" />
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
