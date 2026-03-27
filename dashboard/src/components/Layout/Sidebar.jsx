import React from 'react';
import styles from './Sidebar.module.css';

export const Sidebar = ({ activeTab, onTabChange }) => {
  const navItems = [
    { id: 'overview', label: 'Overview', icon: '📊' },
    { id: 'reports', label: 'User Reports', icon: '📋', badge: 7 },
    { id: 'weather', label: 'Weather Data', icon: '🌧', badge: 2, badgeVariant: 'yellow' },
    { id: 'dams', label: 'Dam Warnings', icon: '🚧', badge: 1 },
    { id: 'map', label: 'Flood Map', icon: '🗺' },
  ];

  const systemItems = [
    { id: 'system', label: 'Architecture', icon: '⚙' },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.navSectionLabel}>Main</div>
      {navItems.map((item) => (
        <div
          key={item.id}
          className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          <span>{item.label}</span>
          {item.badge && (
            <span className={`${styles.navBadge} ${item.badgeVariant ? styles[item.badgeVariant] : ''}`}>
              {item.badge}
            </span>
          )}
        </div>
      ))}

      <div className={styles.navSectionLabel}>System</div>
      {systemItems.map((item) => (
        <div
          key={item.id}
          className={`${styles.navItem} ${activeTab === item.id ? styles.active : ''}`}
          onClick={() => onTabChange(item.id)}
        >
          <span className={styles.navIcon}>{item.icon}</span>
          <span>{item.label}</span>
        </div>
      ))}

      <div className={styles.sidebarFooter}>
        <div className={styles.statusPill}>
          <div className={styles.statusDot}></div>
          System Online
        </div>
      </div>
    </aside>
  );
};
