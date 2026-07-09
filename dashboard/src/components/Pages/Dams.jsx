import React from 'react';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import styles from './Dams.module.css';

const DAMS_DATA = [
  { name: 'Mahaweli Upper Gate', level: 94, status: 'crit', flow: '12,400 m³/s', note: 'Open in 2h — downstream risk HIGH', districts: 'Kandy, Matale, Dambulla' },
  { name: 'Kotmale Reservoir', level: 78, status: 'warn', flow: '6,200 m³/s', note: 'Monitoring — may open if rainfall continues', districts: 'Kandy, Nuwara Eliya' },
  { name: 'Victoria Dam', level: 65, status: 'safe', flow: '3,100 m³/s', note: 'No immediate action required', districts: 'Kandy' },
];

export const Dams = () => {
  const { showToast } = useToast();

  const handleMarkRisk = () => {
    showToast('Downstream risk zones marked', 'var(--crit)');
  };

  return (
    <div className={styles.dams}>
      <div className={styles.pageHeading}>
        <h1>Dam Monitoring</h1>
        <span className={styles.updated}>Water levels &amp; downstream flood risk</span>
      </div>

      <div className={styles.damsList}>
        {DAMS_DATA.map((dam) => (
          <div key={dam.name} className={`${styles.damPanel} ${styles[dam.status]}`}>
            <div className={styles.damHeader}>
              <div>
                <div className={styles.damName}>{dam.name}</div>
                <div className={styles.damNote}>{dam.note}</div>
              </div>
              <Button variant="reject" size="md" onClick={handleMarkRisk}>
                Mark Downstream Risk
              </Button>
            </div>

            <div className={styles.damMeta}>
              <div className={styles.metaItem}>
                <div className={styles.metaLabel}>Water Level</div>
                <div className={`${styles.metaVal} ${styles[dam.status]}`}>{dam.level}%</div>
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
                className={`${styles.progressFill} ${styles[dam.status]}`}
                style={{ width: `${dam.level}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
