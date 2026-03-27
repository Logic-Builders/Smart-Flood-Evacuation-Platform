import React from 'react';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import styles from './Dams.module.css';

const DAMS_DATA = [
  { name: 'Mahaweli Upper Gate', level: 94, status: 'critical', flow: '12,400 m³/s', note: 'Open in 2h — downstream risk HIGH', districts: 'Kandy, Matale, Dambulla' },
  { name: 'Kotmale Reservoir', level: 78, status: 'warning', flow: '6,200 m³/s', note: 'Monitoring — may open if rainfall continues', districts: 'Kandy, Nuwara Eliya' },
  { name: 'Victoria Dam', level: 65, status: 'normal', flow: '3,100 m³/s', note: 'No immediate action required', districts: 'Kandy' },
];

export const Dams = () => {
  const { showToast } = useToast();

  const getColorClass = (status) => {
    const colors = { critical: 'red', warning: 'yellow', normal: 'green' };
    return colors[status] || 'green';
  };

  const handleMarkRisk = () => {
    showToast('📍 Downstream risk zones marked', 'var(--danger)');
  };

  return (
    <div className={styles.dams}>
      <div className={styles.pageHeader}>
        <h2>Dam Warnings</h2>
        <p>Monitor dam water levels and mark downstream flood risk zones</p>
      </div>

      <div className={styles.damsList}>
        {DAMS_DATA.map((dam) => {
          const colorClass = getColorClass(dam.status);
          return (
            <div key={dam.name} className={`${styles.damCard} ${styles[dam.status]}`}>
              <div className={styles.damHeader}>
                <div>
                  <div className={styles.damName}>{dam.name}</div>
                  <div className={styles.damNote}>⚠ {dam.note}</div>
                </div>
                <Button variant="reject" size="md" onClick={handleMarkRisk}>
                  Mark Downstream Risk
                </Button>
              </div>

              <div className={styles.damMeta}>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Water Level</div>
                  <div className={`${styles.metaVal} ${styles[colorClass]}`}>{dam.level}%</div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Flow Rate</div>
                  <div className={styles.metaVal}>{dam.flow}</div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>At-risk Districts</div>
                  <div className={styles.metaValSmall}>{dam.districts}</div>
                </div>
              </div>

              <div className={styles.progressBar}>
                <div
                  className={`${styles.progressFill} ${styles[colorClass]}`}
                  style={{ width: `${dam.level}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
