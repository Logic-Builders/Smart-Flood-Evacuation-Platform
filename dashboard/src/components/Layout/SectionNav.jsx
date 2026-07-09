import React, { useEffect, useState } from 'react';
import {
  IconOverview, IconReports, IconWeather, IconDam, IconMap,
} from '../UI/Icons';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './SectionNav.module.css';

export const SectionNav = ({ activeTab, onTabChange }) => {
  const { token } = useAuth();
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const fetchPendingCount = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/v1/admin/reports/pending`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!cancelled && data.success) {
          setPendingCount((data.data.reports || []).length);
        }
      } catch {
        // leave count as-is on failure
      }
    };
    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const navItems = [
    { id: 'overview', label: 'Overview', Icon: IconOverview },
    { id: 'reports', label: 'Citizen Reports', Icon: IconReports, badge: pendingCount || null },
    { id: 'weather', label: 'Weather Data', Icon: IconWeather },
    { id: 'dams', label: 'Dam Monitoring', Icon: IconDam },
    { id: 'map', label: 'Flood Map', Icon: IconMap },
  ];

  return (
    <nav className={styles.nav}>
      {navItems.map((item) => (
        <button
          key={item.id}
          className={`${styles.tab} ${activeTab === item.id ? styles.active : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <item.Icon className={styles.tabIcon} />
          <span>{item.label}</span>
          {item.badge && <span className={styles.count}>{item.badge}</span>}
        </button>
      ))}
    </nav>
  );
};
