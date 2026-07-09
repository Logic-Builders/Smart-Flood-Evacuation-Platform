import React, { useEffect, useState } from 'react';
import { IconWarning } from '../UI/Icons';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './Overview.module.css';

// No backend source exists yet for shelters/reroute tracking — left static
// until those features exist.
const DAMS = [
  { name: 'Inginiyagala Reservoir', level: '87.4%', dot: 'warn' },
  { name: 'Namal Oya Dam', level: '54.1%', dot: 'safe' },
];

const sevClass = (n) => (n >= 4 ? 'crit' : n === 3 ? 'warn' : 'watch');
const zoneDot = (severity) => (severity === 'EXTREME' ? 'crit' : severity === 'WARNING' ? 'warn' : 'watch');

const timeAgo = (isoString) => {
  if (!isoString) return '—';
  const diffMs = Date.now() - new Date(isoString).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const hours = Math.floor(mins / 60);
  const rem = mins % 60;
  return `${hours}h ${rem.toString().padStart(2, '0')}m ago`;
};

export const Overview = ({ onTabChange }) => {
  const { token } = useAuth();
  const [pendingReports, setPendingReports] = useState([]);
  const [zones, setZones] = useState([]);
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const [reportsRes, zonesRes] = await Promise.all([
          fetch(`${BASE_URL}/api/v1/admin/reports/pending`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${BASE_URL}/api/v1/flood-zones`),
        ]);
        const reportsData = await reportsRes.json();
        const zonesData = await zonesRes.json();
        if (cancelled) return;
        if (reportsData.success) setPendingReports(reportsData.data.reports || []);
        if (zonesData.success) setZones(zonesData.data.zones || []);
        setLastSynced(new Date());
      } catch {
        // leave previous state on failure
      }
    };

    load();
    const interval = setInterval(load, 30000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [token]);

  const worstZone = zones.find((z) => z.severity === 'EXTREME') || zones.find((z) => z.severity === 'WARNING');
  const extremeCount = zones.filter((z) => z.severity === 'EXTREME').length;

  const stats = [
    {
      label: 'Active Flood Zones', value: zones.length, stripe: zones.length ? 'crit' : 'neutral',
      sub: extremeCount ? `${extremeCount} extreme` : 'none extreme',
    },
    {
      label: 'Pending Reports', value: pendingReports.length, stripe: pendingReports.length ? 'warn' : 'neutral',
      sub: 'awaiting review',
    },
    { label: 'Shelters Open', value: 6, stripe: 'safe', sub: 'of 9 registered' },
    { label: 'Routes Rerouted', value: 3, stripe: 'neutral', sub: 'past 24h' },
  ];

  return (
    <div className={styles.overview}>
      <div className={styles.pageHeading}>
        <h1>Situational Overview</h1>
        <span className={styles.updated}>{lastSynced ? `Last synced ${lastSynced.toLocaleTimeString()}` : 'Syncing…'}</span>
      </div>

      {worstZone ? (
        <div className={styles.advisory}>
          <IconWarning className={styles.advisoryIcon} />
          <div>
            <div className={styles.advisoryTitle}>FLOOD {worstZone.severity} — {worstZone.gauge_id}</div>
            <div className={styles.advisoryDesc}>
              {zones.length} zone{zones.length === 1 ? '' : 's'} currently active. Review the flood map for full extent.
            </div>
          </div>
        </div>
      ) : (
        <div className={`${styles.advisory} ${styles.calm}`}>
          <IconWarning className={styles.advisoryIcon} />
          <div>
            <div className={styles.advisoryTitle}>No active flood warnings</div>
            <div className={styles.advisoryDesc}>All monitored zones are currently within normal range.</div>
          </div>
        </div>
      )}

      <div className={styles.statGrid}>
        {stats.map((stat) => (
          <div key={stat.label} className={styles.statPanel}>
            <div className={styles.statLabel}>{stat.label}</div>
            <div className={styles.statValueRow}>
              <span className={`${styles.statValue} ${styles[stat.stripe]}`}>{stat.value}</span>
              <span className={styles.statSub}>{stat.sub}</span>
            </div>
            <div className={`${styles.stripe} ${styles[stat.stripe]}`}></div>
          </div>
        ))}
      </div>

      <div className={styles.cols}>
        <div className={styles.panel}>
          <div className={styles.panelHead}>
            <h2>Recent Citizen Reports</h2>
            <button className={styles.link} onClick={() => onTabChange('reports')}>Review all →</button>
          </div>
          <table className={styles.reportsTable}>
            <thead>
              <tr><th>Type</th><th>Severity</th><th>Location</th><th>Submitted</th></tr>
            </thead>
            <tbody>
              {pendingReports.length === 0 ? (
                <tr><td colSpan={4} className={styles.emptyRow}>No pending reports.</td></tr>
              ) : (
                pendingReports.slice(0, 5).map((r) => (
                  <tr key={r.id}>
                    <td className={styles.rtype}>{r.report_type}</td>
                    <td><span className={`${styles.sevChip} ${styles[sevClass(r.severity)]}`}>SEV {r.severity}</span></td>
                    <td className={styles.coord}>{r.location?.latitude?.toFixed(4)}, {r.location?.longitude?.toFixed(4)}</td>
                    <td className={styles.time}>{timeAgo(r.submitted_at)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className={styles.sideCol}>
          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Flood Risk Zones</h2>
              <button className={styles.link} onClick={() => onTabChange('map')}>View map →</button>
            </div>
            <div className={styles.statusList}>
              {zones.length === 0 ? (
                <div className={styles.emptyState}>No active zones.</div>
              ) : (
                zones.map((z) => (
                  <div key={z.id} className={styles.statusRow}>
                    <div className={`${styles.statusDot} ${styles[zoneDot(z.severity)]}`}></div>
                    <div className={styles.statusName}>{z.gauge_id || z.id}</div>
                    <div className={styles.statusMeta}>{z.severity}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <div className={styles.panelHead}>
              <h2>Dam Monitoring</h2>
              <button className={styles.link} onClick={() => onTabChange('dams')}>Details →</button>
            </div>
            <div className={styles.statusList}>
              {DAMS.map((d) => (
                <div key={d.name} className={styles.statusRow}>
                  <div className={`${styles.statusDot} ${styles[d.dot]}`}></div>
                  <div className={styles.statusName}>{d.name}</div>
                  <div className={styles.statusMeta}>{d.level}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.legend}>
        <span>Severity key:</span>
        <span className={styles.legendItem}><span className={`${styles.sw} ${styles.crit}`}></span>Critical / Extreme</span>
        <span className={styles.legendItem}><span className={`${styles.sw} ${styles.warn}`}></span>Warning</span>
        <span className={styles.legendItem}><span className={`${styles.sw} ${styles.watch}`}></span>Watch</span>
        <span className={styles.legendItem}><span className={`${styles.sw} ${styles.safe}`}></span>Normal / Resolved</span>
      </div>
    </div>
  );
};
