// dashboard/src/components/Auth/LoginScreen.jsx
// Uses default export — App.jsx imports it as: import LoginScreen from './components/Auth/LoginScreen'
import React, { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import styles from "./LoginScreen.module.css";

export default function LoginScreen() {
  const { login, error, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = () => {
    if (email.trim() && password.trim()) {
      login(email.trim(), password.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className={styles.loginWrapper}>
      <div className={styles.loginCard}>
        <div className={styles.logo}>⚡ FloodGuard</div>
        <h2 className={styles.title}>Admin Dashboard</h2>
        <p className={styles.subtitle}>Smart Flood Evacuation Platform</p>

        <input
          className={styles.input}
          type="email"
          placeholder="Admin email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="email"
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={handleKeyDown}
          autoComplete="current-password"
        />

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.loginBtn}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Signing in…" : "Sign In"}
        </button>

        <div className={styles.demoCredentials}>
          <p>Demo credentials:</p>
          <code>admin@floodevac.lk / adminpassword</code>
        </div>
      </div>
    </div>
  );
}
