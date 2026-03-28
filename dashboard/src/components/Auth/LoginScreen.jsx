// dashboard/src/components/Auth/LoginScreen.jsx
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

        <div className={styles.logoRow}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="40" height="40">
              <rect width="40" height="40" rx="10" fill="url(#grad)" />
              <path d="M20 8 C14 14 10 18 10 23 a10 10 0 0 0 20 0 C30 18 26 14 20 8Z" fill="white" opacity="0.9"/>
              <path d="M15 26 Q17.5 23 20 26 Q22.5 29 25 26" stroke="white" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="40" y2="40">
                  <stop offset="0%" stopColor="#00c9a7"/>
                  <stop offset="100%" stopColor="#0088cc"/>
                </linearGradient>
              </defs>
            </svg>
          </div>
          <div>
            <div className={styles.brandName}>FloodGuard</div>
            <div className={styles.brandSub}>ADMIN COMMAND CENTER</div>
          </div>
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>USERNAME</label>
          <input
            className={styles.input}
            type="email"
            placeholder="admin@floodevac.lk"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="email"
          />
        </div>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>PASSWORD</label>
          <input
            className={styles.input}
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={handleKeyDown}
            autoComplete="current-password"
          />
        </div>

        {error && <div className={styles.error}>{error}</div>}

        <button
          className={styles.loginBtn}
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? "Authenticating…" : "Authenticate →"}
        </button>

        <div className={styles.demoCredentials}>
          Demo: admin@floodevac.lk / adminpassword
        </div>
      </div>
    </div>
  );
}
