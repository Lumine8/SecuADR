import React from "react";

export default function UserListPanel({ users = [], selectedUserId, onSelectUser }) {
    return (
        <section className="card user-list">
            <h2>Users</h2>
            <p className="panel-subtitle">Select an identity to inspect profile, sessions, and drift.</p>
            <div className="list-scroll">
                {users.length === 0 ? <p className="empty-state">No users available.</p> : null}
                {users.map((u) => (
                    <button
                        key={u.id}
                        className={`user-row ${selectedUserId === u.id ? "active" : ""}`}
                        onClick={() => onSelectUser(u.id)}
                    >
                        <div>
                            <strong>{u.username}</strong>
                            <small>{new Date(u.last_activity).toLocaleString()}</small>
                        </div>
                        <div className="meta">
                            <span className={`pill ${u.risk_level}`}>{u.risk_level}</span>
                            <span>{Math.round((u.avg_trust_score || 0) * 100)}%</span>
                        </div>
                    </button>
                ))}
            </div>
        </section>
    );
}
