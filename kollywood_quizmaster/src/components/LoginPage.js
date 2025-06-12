import React, { useState } from "react";

import BackButton from "./BackButton";

// PUBLIC_INTERFACE
function LoginPage({ onLogin }) {
  const [username, setUsername] = useState("");
  const [err, setErr] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    if (username.trim().length < 2) {
      setErr("Please enter a valid username.");
      return;
    }
    setErr("");
    onLogin(username.trim());
  }

  return (
    <div style={{ position: "relative" }}>
      <BackButton />
      <div className="kq-login-panel">
        <div className="kq-login-title">
          <span style={{ fontSize: "2.0rem", marginRight: "8px" }}>🎬</span>
          Kollywood QuizMaster
        </div>
        <form autoComplete="off" onSubmit={handleSubmit}>
        <label>
          Username
          <input
            type="text"
            className="kq-input"
            placeholder="Enter your Kollywood nickname"
            maxLength={20}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            autoFocus
          />
        </label>
        {err && (
          <div style={{ color: "#f604c2", fontSize: "1.03rem" }}>{err}</div>
        )}
        <button type="submit" className="kq-btn" style={{ width: "100%", marginTop: 16 }}>
          Start Playing!
        </button>
      </form>
      <div style={{ color: "#222", opacity: 0.62, textAlign: "center", fontSize: "1.04rem" }}>
        Challenge yourself on Kollywood trivia across 6 quiz games!
      </div>
    </div>
  );
}

export default LoginPage;
