import React, { useState, useEffect } from 'react';
import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import AuthService from '../services/auth.js';
import './Dashboard.css';

const Dashboard = ({ userId }) => {
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        loadSessions();
    }, [userId]);

    const loadSessions = async () => {
        setLoading(true);
        const response = await AuthService.getSessions(userId, 50);
        if (response.sessions) {
            setSessions(response.sessions);
        }
        setLoading(false);
    };

    if (loading) {
        return <div className="dashboard-loading">Loading sessions...</div>;
    }

    return (
        <div className="dashboard-container">
            <h1>🔐 SecuADR Dashboard</h1>
            <p className="user-info">User: <strong>{userId}</strong></p>

            <div className="dashboard-tabs">
                <button
                    className={`tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                    onClick={() => setActiveTab('overview')}
                >
                    📊 Overview
                </button>
                <button
                    className={`tab-btn ${activeTab === 'sessions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('sessions')}
                >
                    📝 Sessions
                </button>
                <button
                    className={`tab-btn ${activeTab === 'risk' ? 'active' : ''}`}
                    onClick={() => setActiveTab('risk')}
                >
                    🚨 Risk Monitor
                </button>
                <button
                    className={`tab-btn ${activeTab === 'drift' ? 'active' : ''}`}
                    onClick={() => setActiveTab('drift')}
                >
                    📈 Drift Detection
                </button>
            </div>

            {activeTab === 'overview' && <OverviewTab sessions={sessions} />}
            {activeTab === 'sessions' && <SessionsTab sessions={sessions} setSelectedSession={setSelectedSession} />}
            {activeTab === 'risk' && <RiskMonitorTab sessions={sessions} />}
            {activeTab === 'drift' && <DriftDetectionTab sessions={sessions} />}

            {selectedSession && (
                <SessionDetails session={selectedSession} onClose={() => setSelectedSession(null)} />
            )}
        </div>
    );
};

// ===== OVERVIEW TAB =====
const OverviewTab = ({ sessions }) => {
    const stats = {
        total: sessions.length,
        allowed: sessions.filter(s => s.sadr_decision === 'ALLOW').length,
        warned: sessions.filter(s => s.sadr_decision === 'ALLOW_WITH_WARNING').length,
        challenged: sessions.filter(s => s.sadr_decision === 'CHALLENGE').length,
        blocked: sessions.filter(s => s.sadr_decision === 'BLOCK').length,
    };

    const avgAnomalyScore = sessions.length > 0
        ? (sessions.reduce((sum, s) => sum + (s.rlfs_anomaly_score || 0), 0) / sessions.length).toFixed(2)
        : 0;

    const lowRisk = sessions.filter(s => s.risk_level === 'LOW').length;
    const mediumRisk = sessions.filter(s => s.risk_level === 'MEDIUM').length;
    const highRisk = sessions.filter(s => s.risk_level === 'HIGH').length;
    const criticalRisk = sessions.filter(s => s.risk_level === 'CRITICAL').length;

    const riskData = [
        { name: 'LOW', value: lowRisk },
        { name: 'MEDIUM', value: mediumRisk },
        { name: 'HIGH', value: highRisk },
        { name: 'CRITICAL', value: criticalRisk },
    ];

    const COLORS = ['#4CAF50', '#FFC107', '#FF9800', '#F44336'];

    const decisionData = [
        { name: 'ALLOW', value: stats.allowed, color: '#4CAF50' },
        { name: 'WARN', value: stats.warned, color: '#FFC107' },
        { name: 'CHALLENGE', value: stats.challenged, color: '#FF9800' },
        { name: 'BLOCK', value: stats.blocked, color: '#F44336' },
    ];

    return (
        <div className="tab-content">
            <div className="stats-grid">
                <div className="stat-card">
                    <h3>Total Sessions</h3>
                    <p className="stat-value">{stats.total}</p>
                </div>
                <div className="stat-card">
                    <h3>Avg Anomaly Score</h3>
                    <p className="stat-value">{avgAnomalyScore}</p>
                    <p className="stat-detail">0 = Normal, 1 = Anomalous</p>
                </div>
                <div className="stat-card">
                    <h3>✅ Allowed</h3>
                    <p className="stat-value" style={{ color: '#4CAF50' }}>{stats.allowed}</p>
                </div>
                <div className="stat-card">
                    <h3>❌ Blocked</h3>
                    <p className="stat-value" style={{ color: '#F44336' }}>{stats.blocked}</p>
                </div>
            </div>

            <div className="charts-grid">
                <div className="chart-container">
                    <h3>Risk Distribution</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={riskData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, value }) => `${name}: ${value}`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {COLORS.map((color, index) => (
                                    <Cell key={`cell-${index}`} fill={color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-container">
                    <h3>Authentication Decisions</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={decisionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="name" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="value" color="#8884d8">
                                {decisionData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};

// ===== SESSIONS TAB =====
const SessionsTab = ({ sessions, setSelectedSession }) => {
    return (
        <div className="tab-content">
            <div className="sessions-table">
                <table>
                    <thead>
                        <tr>
                            <th>Timestamp</th>
                            <th>SFAM Distance</th>
                            <th>Anomaly Score</th>
                            <th>Decision</th>
                            <th>Risk Level</th>
                            <th>Confidence</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map((session, idx) => (
                            <tr key={idx} className={`risk-${session.risk_level?.toLowerCase()}`}>
                                <td>{new Date(session.timestamp).toLocaleString()}</td>
                                <td>{(session.sfam_hash_distance || 0).toFixed(2)}</td>
                                <td className="anomaly-score">
                                    {(session.rlfs_anomaly_score || 0).toFixed(2)}
                                </td>
                                <td>
                                    <span className={`badge decision-${session.sadr_decision?.toLowerCase()}`}>
                                        {session.sadr_decision}
                                    </span>
                                </td>
                                <td>
                                    <span className={`badge risk-${session.risk_level?.toLowerCase()}`}>
                                        {session.risk_level}
                                    </span>
                                </td>
                                <td>{(session.sfam_confidence || 0).toFixed(0)}%</td>
                                <td>
                                    <button
                                        className="btn-small"
                                        onClick={() => setSelectedSession(session)}
                                    >
                                        Details
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

// ===== RISK MONITOR TAB =====
const RiskMonitorTab = ({ sessions }) => {
    const riskTrend = sessions.slice(-20).map((s, idx) => ({
        session: idx,
        anomaly: s.rlfs_anomaly_score || 0,
        sfam_distance: s.sfam_hash_distance || 0,
    }));

    return (
        <div className="tab-content">
            <div className="chart-container full-width">
                <h3>Anomaly Score Trend (Last 20 Sessions)</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={riskTrend}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="session" />
                        <YAxis domain={[0, 1]} />
                        <Tooltip />
                        <Legend />
                        <Line
                            type="monotone"
                            dataKey="anomaly"
                            stroke="#FF6B6B"
                            name="Anomaly Score"
                            dot={{ r: 4 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="sfam_distance"
                            stroke="#4ECDC4"
                            name="SFAM Distance"
                            dot={{ r: 3 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="risk-alerts">
                <h3>⚠️ Recent Alerts</h3>
                {sessions
                    .filter(s => s.risk_level === 'HIGH' || s.risk_level === 'CRITICAL')
                    .slice(0, 5)
                    .map((session, idx) => (
                        <div key={idx} className={`alert alert-${session.risk_level?.toLowerCase()}`}>
                            <p><strong>{session.risk_level}</strong> - {new Date(session.timestamp).toLocaleString()}</p>
                            <p>Decision: {session.sadr_decision}</p>
                        </div>
                    ))}
            </div>
        </div>
    );
};

// ===== DRIFT DETECTION TAB =====
const DriftDetectionTab = ({ sessions }) => {
    const featureDrift = sessions.slice(-15).map((s, idx) => ({
        session: idx,
        gesture: Math.random() * 0.3 + 0.2, // Simulated - would come from backend
        typing: Math.random() * 0.2 + 0.1,
        touch: Math.random() * 0.15 + 0.05,
    }));

    return (
        <div className="tab-content">
            <div className="chart-container full-width">
                <h3>Feature Drift Over Time</h3>
                <ResponsiveContainer width="100%" height={400}>
                    <LineChart data={featureDrift}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="session" />
                        <YAxis domain={[0, 1]} />
                        <Tooltip />
                        <Legend />
                        <Line type="monotone" dataKey="gesture" stroke="#8884d8" name="Gesture Drift" />
                        <Line type="monotone" dataKey="typing" stroke="#82ca9d" name="Typing Drift" />
                        <Line type="monotone" dataKey="touch" stroke="#ffc658" name="Touch Drift" />
                    </LineChart>
                </ResponsiveContainer>
            </div>

            <div className="drift-info">
                <p>📊 <strong>What is drift?</strong> Changes in your behavior over time (speed, pressure, timing, etc.)</p>
                <p>✅ <strong>Normal</strong>: Small drift is expected and profiles adapt</p>
                <p>🚨 <strong>Abnormal</strong>: Sudden large drift may indicate account takeover</p>
            </div>
        </div>
    );
};

// ===== SESSION DETAILS MODAL =====
const SessionDetails = ({ session, onClose }) => {
    if (!session) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="close-btn" onClick={onClose}>✕</button>
                <h2>Session Details</h2>

                <div className="details-grid">
                    <div className="detail-section">
                        <h3>🔐 SFAM Layer (Biometric)</h3>
                        <p><strong>Hash Distance:</strong> {(session.sfam_hash_distance || 0).toFixed(3)}</p>
                        <p><strong>Confidence:</strong> {(session.sfam_confidence || 0).toFixed(0)}%</p>
                        <p className="detail-note">Hamming distance between current and baseline hash</p>
                    </div>

                    <div className="detail-section">
                        <h3>🚨 RLFS Layer (Anomaly Detection)</h3>
                        <p><strong>Anomaly Score:</strong> {(session.rlfs_anomaly_score || 0).toFixed(2)}</p>
                        <p><strong>Confidence:</strong> {session.rlfs_confidence || 'N/A'}</p>
                        <p><strong>Detected Anomalies:</strong></p>
                        <ul>
                            {session.detected_anomalies?.length > 0 ? (
                                session.detected_anomalies.map((a, i) => <li key={i}>• {a}</li>)
                            ) : (
                                <li>No anomalies detected</li>
                            )}
                        </ul>
                    </div>

                    <div className="detail-section">
                        <h3>⚖️ S-ADR Layer (Security Decision)</h3>
                        <p><strong>Decision:</strong> <span className={`badge decision-${session.sadr_decision?.toLowerCase()}`}>{session.sadr_decision}</span></p>
                        <p><strong>Risk Level:</strong> <span className={`badge risk-${session.risk_level?.toLowerCase()}`}>{session.risk_level}</span></p>
                        <p><strong>Confidence:</strong> {(session.confidence || 0).toFixed(0)}%</p>
                    </div>

                    <div className="detail-section full-width">
                        <h3>📍 Session Context</h3>
                        <p><strong>Timestamp:</strong> {new Date(session.timestamp).toLocaleString()}</p>
                        <p><strong>Session ID:</strong> {session.session_id}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
