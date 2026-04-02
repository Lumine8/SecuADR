import React, { useMemo, useState } from "react";

function getSessionUserKey(session) {
    return String(session?.user_id || session?.username || "");
}

function getResult(session) {
    const explicitBool = session?.authenticated;
    if (typeof explicitBool === "boolean") {
        return explicitBool ? "SUCCESS" : "FAIL";
    }

    const status = String(session?.status || session?.result || "").toLowerCase();
    if (["success", "authenticated", "pass", "allowed"].includes(status)) {
        return "SUCCESS";
    }
    if (["fail", "failed", "rejected", "blocked", "deny"].includes(status)) {
        return "FAIL";
    }

    const action = String(session?.sadr_output?.recommended_action || "allow").toLowerCase();
    if (["block", "step_up", "deny", "warning"].includes(action)) {
        return "FAIL";
    }
    return "SUCCESS";
}

function getMethod(session) {
    if (session?.method) return session.method;
    if (session?.sfam_output) return "SFAM";
    return "Behavioral";
}

function getReason(session) {
    return (
        session?.sadr_output?.reason ||
        session?.sfam_output?.reason ||
        (session?.rlfs_output?.feature_alerts || []).join(", ") ||
        "baseline aligned"
    );
}

function getDistance(session) {
    const d = Number(
        session?.sfam_output?.hash_distance ??
        session?.sfam_output?.hamming_distance ??
        session?.hamming_distance
    );
    return Number.isFinite(d) ? d.toFixed(3) : "-";
}

function getPossibleAttack(session) {
    const p = session?.possible_attack || session?.metadata?.possible_attack;
    return {
        flag: Boolean(p?.flag),
        score: Number(p?.score || 0),
        reasons: Array.isArray(p?.reasons) ? p.reasons : [],
    };
}

export default function RecentAuthAttemptsPanel({ sessions = [], users = [], selectedUserId = null }) {
    const [filterUser, setFilterUser] = useState("selected");

    const userById = useMemo(() => {
        const map = new Map();
        users.forEach((u) => map.set(String(u.id), u));
        return map;
    }, [users]);

    const selectedUser = selectedUserId ? userById.get(String(selectedUserId)) : null;

    const effectiveFilter = useMemo(() => {
        if (filterUser === "selected") {
            return selectedUserId ? String(selectedUserId) : "all";
        }
        return filterUser;
    }, [filterUser, selectedUserId]);

    const rows = useMemo(() => {
        if (effectiveFilter === "all") return sessions.slice(0, 12);

        const selectedUsername = userById.get(String(effectiveFilter))?.username;
        return sessions
            .filter((session) => {
                const key = getSessionUserKey(session);
                return key === String(effectiveFilter) || (selectedUsername && key === selectedUsername);
            })
            .slice(0, 12);
    }, [sessions, effectiveFilter, userById]);

    return (
        <section className="card">
            <div className="panel-head-inline">
                <h2>Recent Auth Attempts</h2>
                <label className="attempt-filter">
                    <span>User:</span>
                    <select value={filterUser} onChange={(e) => setFilterUser(e.target.value)}>
                        <option value="selected">
                            Selected {selectedUser?.username ? `(${selectedUser.username})` : "(none)"}
                        </option>
                        <option value="all">All Users</option>
                        {users.map((u) => (
                            <option key={u.id} value={String(u.id)}>{u.username}</option>
                        ))}
                    </select>
                </label>
            </div>
            <p className="panel-subtitle">Latest authentication outcomes across users and attack simulations.</p>
            <div className="table-wrap auth-attempts-wrap">
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>User</th>
                            <th>Result</th>
                            <th>Method</th>
                            <th>Attack Flag</th>
                            <th>Distance</th>
                            <th>Reason</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.length === 0 ? (
                            <tr>
                                <td colSpan={7}>No recent attempts found.</td>
                            </tr>
                        ) : rows.map((session) => {
                            const possibleAttack = getPossibleAttack(session);
                            const result = getResult(session);
                            return (
                                <tr key={session._id || session.timestamp + String(session.user_id || "")}>
                                    <td>{new Date(session.timestamp).toLocaleString()}</td>
                                    <td>{session.username || session.user_id || "unknown"}</td>
                                    <td>
                                        <span className={`attempt-badge ${result === "SUCCESS" ? "success" : "fail"}`}>
                                            {result}
                                        </span>
                                    </td>
                                    <td>{getMethod(session)}</td>
                                    <td>
                                        {possibleAttack.flag ? (
                                            <span className="attempt-badge attack-flag" title={(possibleAttack.reasons || []).join(", ") || "possible attack"}>
                                                POSSIBLE ({Math.round(possibleAttack.score * 100)}%)
                                            </span>
                                        ) : (
                                            <span className="attempt-badge success">No</span>
                                        )}
                                    </td>
                                    <td>{getDistance(session)}</td>
                                    <td className="reason-cell">{getReason(session)}</td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
