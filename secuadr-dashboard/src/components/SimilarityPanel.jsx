import React from "react";
import { ResponsiveContainer, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Line } from "recharts";

export default function SimilarityPanel({ metrics = [] }) {
    return (
        <section className="card">
            <h2>Similarity / Distance</h2>
            <p className="panel-subtitle">Comparison quality across cosine, hamming, and anomaly trajectories.</p>
            <ResponsiveContainer width="100%" height={220}>
                <LineChart data={metrics}>
                    <CartesianGrid stroke="rgba(125,162,255,.22)" />
                    <XAxis dataKey="index" stroke="#9eb9ea" />
                    <YAxis domain={[0, 1.2]} stroke="#9eb9ea" />
                    <Tooltip />
                    <Line dataKey="cosine_similarity" stroke="#35f2b0" strokeWidth={2.4} dot={false} />
                    <Line dataKey="hamming_distance" stroke="#ffd66f" strokeWidth={2} dot={false} />
                    <Line dataKey="anomaly_score" stroke="#ff6387" strokeWidth={2} dot={false} />
                </LineChart>
            </ResponsiveContainer>
        </section>
    );
}
