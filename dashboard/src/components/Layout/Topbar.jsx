import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Button } from '../UI/Button';
import styles from './Topbar.module.css';

export const Topbar = () => {
  const { currentUser, logout } = useAuth();
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const avatar = currentUser ? currentUser.slice(0, 2).toUpperCase() : 'A';

  return (
    <div className={styles.topbar}>
      <div className={styles.topbarLogo}>
        <div className={styles.dot}></div>
        FloodGuard
      </div>
      <div className={styles.topbarAlert}>⚠ 3 Critical zones active</div>
      <div className={styles.topbarTime}>{time}</div>
      <div className={styles.topbarUser}>
        <div className={styles.topbarAvatar}>{avatar}</div>
        <Button
          variant="secondary"
          size="sm"
          onClick={logout}
          className={styles.logoutBtn}
        >
          Logout
        </Button>
      </div>
    </div>
  );
};
