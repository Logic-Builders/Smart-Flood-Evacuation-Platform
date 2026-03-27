import React, { useMemo } from 'react';
import { Card } from '../UI/Card';
import { Badge } from '../UI/Badge';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import styles from './Overview.module.css';

const ACTIVITY_FEED = [
  { id: 1, dot: 'red', text: 'Dam release warning: Mahaweli upper gate to open in 2h', time: '2 minutes ago · Dam Authority' },
  { id: 2, dot: 'yellow', text: 'User report: Flooding on B205 road, Ratnapura (photo attached)', time: '11 minutes ago · User #4821' },
  { id: 3, dot: 'green', text: 'Flood zone Kelaniya Zone-3 cleared — route re-enabled', time: '38 minutes ago · Admin' },
  { id: 4, dot: 'blue', text: 'MeteoGroup forecast updated — +120mm predicted next 6h', time: '1 hour ago · Weather Dept' },
  { id: 5, dot: 'red', text: 'New critical zone marked: Colombo Wellampitiya low-lying area', time: '1h 22m ago · Admin' },
];

const STATS = [
  { label: 'Critical Zones', value: 3, variant: 'red', sub: 'Immediate evacuation required', change: '↑ +2 from yesterday', changeType: 'up' },
  { label: 'Pending Reports', value: 7, variant: 'yellow', sub: 'Awaiting admin verification', change: '↑ 4 new since morning', changeType: 'up' },
  { label: 'Affected Areas', value: 12, variant: 'orange', sub: 'Marked on live map', change: '↑ +3 today', changeType: 'up' },
  { label: 'Safe Routes', value: 28, variant: 'green', sub: 'Actively maintained', change: '↓ -5 due to new floods', changeType: 'down' },
];

export const Overview = ({ onTabChange }) => {
  const { showToast } = useToast();

  const sparklineData = useMemo(() => {
    const vals = [3, 7, 5, 12, 9, 14, 7];
    const max = Math.max(...vals);
    return vals.map((v) => ({
      height: Math.round((v / max) * 100),
      color: v >= 12 ? 'c-red' : 'c-green',
      title: `${v} reports`,
    }));
  }, []);

  const handleMarkRisk = () => {
    showToast('📍 Mark risk mode activated', 'var(--danger)');
  };

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeader}>
        <h2>Command Overview</h2>
        <p>Real-time flood situation monitoring &amp; coordination hub</p>
      </div>

      <div className={styles.statsGrid}>
        {STATS.map((stat) => (
          <div key={stat.label} className={`${styles.statCard} ${styles[stat.variant]}`}>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={`${styles.statVal} ${styles[stat.variant]}`}>{stat.value}</div>
            <div className={styles.statSub}>{stat.sub}</div>
            <div className={`${styles.statChange} ${styles[stat.changeType]}`}>{stat.change}</div>
          </div>
        ))}
      </div>

      <div className={styles.twoCol}>
        <Card title="📡 Live Activity Feed" title_icon={<Badge variant="live">LIVE</Badge>}>
          <div className={styles.activityList}>
            {ACTIVITY_FEED.map((item) => (
              <div key={item.id} className={styles.activityItem}>
                <div className={`${styles.activityDot} ${styles[`dot-${item.dot}`]}`}></div>
                <div>
                  <div className={styles.activityText}>{item.text}</div>
                  <div className={styles.activityTime}>{item.time}</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card title="📈 Reports — Last 7 Days">
          <div className={styles.sparklineRow}>
            {sparklineData.map((bar, idx) => (
              <div
                key={idx}
                className={`${styles.sparkBar} ${styles[bar.color]}`}
                style={{ height: `${bar.height}%` }}
                title={bar.title}
              ></div>
            ))}
          </div>
          <div className={styles.dayLabels}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className={styles.quickActions}>
            <div style={{ fontFamily: "'Syne', sans-serif", fontWeight: 700, marginBottom: 12 }}>⚡ Quick Actions</div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Button variant="approve" onClick={() => onTabChange('reports')}>
                Review Reports
              </Button>
              <Button variant="secondary" onClick={() => onTabChange('map')}>
                Open Map
              </Button>
              <Button variant="reject" size="md" onClick={handleMarkRisk}>
                Mark Risk Zone
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};
