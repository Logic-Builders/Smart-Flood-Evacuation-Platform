import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import styles from './LoginScreen.module.css';

export const LoginScreen = () => {
  const { login, error } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = () => {
    setIsLoading(true);
    setTimeout(() => {
      login(email, password);
      setIsLoading(false);
    }, 200);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className={styles.loginScreen}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>
          <div className={styles.icon}>🌊</div>
          <div>
            <h1>FloodGuard</h1>
            <span>Admin Command Center</span>
          </div>
        </div>
        <div className={styles.loginLabel}>Username</div>
        <input
          className={styles.loginInput}
          type="text"
          placeholder="admin1"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          autoComplete="off"
        />
        <div className={styles.loginLabel}>Password</div>
        <input
          className={styles.loginInput}
          type="text"
          placeholder="admin@flood.lk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onKeyPress={handleKeyPress}
          autoComplete="off"
        />
        <button
          className={styles.loginBtn}
          onClick={handleLogin}
          disabled={isLoading}
        >
          {isLoading ? 'Authenticating...' : 'Authenticate →'}
        </button>
        <div className={styles.loginError}>{error}</div>
        <p className={styles.demoHint}>
          Demo: admin1 / admin123 &nbsp;|&nbsp; admin2 / flood2024
        </p>
      </div>
    </div>
  );
};
