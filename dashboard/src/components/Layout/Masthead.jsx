import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { IconSignOut } from '../UI/Icons';
import styles from './Masthead.module.css';

export const Masthead = () => {
  const { currentUser, logout } = useAuth();
  const [time, setTime] = useState(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const initials = currentUser ? currentUser.slice(0, 2).toUpperCase() : 'AD';

  return (
    <header className={styles.masthead}>
      <div className={styles.seal}>FG</div>
      <div className={styles.agency}>
        <div className={styles.agencyName}>FloodGuard Evacuation Authority</div>
        <div className={styles.agencySub}>Ampara District &middot; Early Warning &amp; Response Centre</div>
      </div>
      <div className={styles.meta}>
        <span className={styles.clock}>{time}</span>
        <span className={styles.divider} />
        <div className={styles.userChip}>
          <div className={styles.avatar}>{initials}</div>
          <span>{currentUser || 'admin'}</span>
        </div>
        <button className={styles.signOut} onClick={logout}>
          <IconSignOut />
          Sign out
        </button>
      </div>
    </header>
  );
};
