import React, { useEffect, useMemo, useState } from "react";
import {
    fetchUsers,
    fetchUserDetail,
    fetchSessions,
    fetchMetrics,
    fetchRisk,
    subscribeRealtime,
    getActiveBase,
} from "./services/api";
import UserListPanel from "./components/UserListPanel";
import UserDetailView from "./components/UserDetailView";
import MetricsPanel from "./components/MetricsPanel";
import SimilarityPanel from "./components/SimilarityPanel";
import SessionAnalysisPanel from "./components/SessionAnalysisPanel";
import FraudHighlightPanel from "./components/FraudHighlightPanel";
import RecentAuthAttemptsPanel from "./components/RecentAuthAttemptsPanel";

export default function App() {
    const [users, setUsers] = useState([]);
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [detail, setDetail] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [metrics, setMetrics] = useState([]);
    const [risk, setRisk] = useState([]);
    const [flagged, setFlagged] = useState([]);
    const [streamStatus, setStreamStatus] = useState("connecting");
    const [dataSource, setDataSource] = useState("loading");
    const [apiBase, setApiBase] = useState("");

    async function refreshDetailFor(userId) {
        if (!userId) {
            setDetail(null);
            return;
        }
        const detailRes = await fetchUserDetail(userId);
        setDetail(detailRes);
    }

    useEffect(() => {
        async function load() {
            const [usersRes, sessionsRes, metricsRes, riskRes] = await Promise.all([
                fetchUsers(),
                fetchSessions(),
                fetchMetrics(),
                fetchRisk(),
            ]);

            const list = usersRes.users || [];
            setUsers(list);
            const initialUserId = list[0]?.id || null;
            setSelectedUserId(initialUserId);
            setSessions(sessionsRes.sessions || []);
            setMetrics(metricsRes.metrics || []);
            setRisk(riskRes.risk || []);
            setFlagged(riskRes.flagged_sessions || []);
            setDataSource(usersRes._source || "mock");
            setApiBase(usersRes._base || getActiveBase() || "");
            await refreshDetailFor(initialUserId);
        }

        load();

        let refreshTimer = null;
        const unsubscribe = subscribeRealtime(
            () => {
                setStreamStatus("live");
                if (refreshTimer) return;
                refreshTimer = setTimeout(async () => {
                    refreshTimer = null;
                    const [usersRes, sessionsRes, metricsRes, riskRes] = await Promise.all([
                        fetchUsers(),
                        fetchSessions(),
                        fetchMetrics(),
                        fetchRisk(),
                    ]);

                    const list = usersRes.users || [];
                    setUsers(list);
                    setSessions(sessionsRes.sessions || []);
                    setMetrics(metricsRes.metrics || []);
                    setRisk(riskRes.risk || []);
                    setFlagged(riskRes.flagged_sessions || []);
                    setDataSource(usersRes._source || "mock");
                    setApiBase(usersRes._base || getActiveBase() || "");

                    const selectedStillExists = list.some((u) => u.id === selectedUserId);
                    const activeUserId = selectedStillExists ? selectedUserId : (list[0]?.id || null);
                    if (activeUserId !== selectedUserId) {
                        setSelectedUserId(activeUserId);
                    }
                    await refreshDetailFor(activeUserId);
                }, 350);
            },
            () => {
                setStreamStatus("offline");
            },
        );

        return () => {
            if (refreshTimer) {
                clearTimeout(refreshTimer);
            }
            unsubscribe?.();
        };
    }, []);

    useEffect(() => {
        refreshDetailFor(selectedUserId);
    }, [selectedUserId]);

    const summary = useMemo(() => {
        const avgTrust = users.length
            ? users.reduce((sum, u) => sum + (u.avg_trust_score || 0), 0) / users.length
            : 0;
        const highRisk = users.filter((u) => ["high", "critical"].includes((u.risk_level || "").toLowerCase())).length;
        return { avgTrust, highRisk };
    }, [users]);

    const lastSessionTime = useMemo(() => {
        const ts = sessions?.[0]?.timestamp;
        if (!ts) return "-";
        return new Date(ts).toLocaleTimeString();
    }, [sessions]);

    return (
        <div className="dashboard-shell">
            <div className="ambient-grid" />
            <header className="hero card">
                <div className="hero-copy">
                    <p className="eyebrow">Adaptive Risk Console</p>
                    <h1>SecuADR Cyber Behavioral Intelligence</h1>
                    <p className="hero-subtitle">Behavior-aware fraud monitoring across all users and sessions.</p>
                </div>
                <div className="hero-metrics">
                    <div className={`metric-tile ${streamStatus === "live" ? "ok" : "warn"}`}>
                        <small>Realtime</small>
                        <strong>{streamStatus}</strong>
                    </div>
                    <div className="metric-tile">
                        <small>Data</small>
                        <strong>{dataSource}</strong>
                    </div>
                    <div className="metric-tile api-base">
                        <small>API</small>
                        <strong>{apiBase || "proxy"}</strong>
                    </div>
                    <div className="metric-tile">
                        <small>Users</small>
                        <strong>{users.length}</strong>
                    </div>
                    <div className="metric-tile">
                        <small>Avg Trust</small>
                        <strong>{Math.round(summary.avgTrust * 100)}%</strong>
                    </div>
                    <div className="metric-tile danger">
                        <small>High Risk</small>
                        <strong>{summary.highRisk}</strong>
                    </div>
                    <div className="metric-tile">
                        <small>Last Session</small>
                        <strong>{lastSessionTime}</strong>
                    </div>
                </div>
            </header>

            <main className="layout-grid">
                <UserListPanel users={users} selectedUserId={selectedUserId} onSelectUser={setSelectedUserId} />
                <UserDetailView detail={detail} />
                <MetricsPanel metrics={metrics} />
                <SimilarityPanel metrics={metrics} />
                <SessionAnalysisPanel sessions={sessions} />
                <RecentAuthAttemptsPanel sessions={sessions} users={users} selectedUserId={selectedUserId} />
                <FraudHighlightPanel flagged={flagged.length ? flagged : risk} users={users} />
            </main>
        </div>
    );
}
