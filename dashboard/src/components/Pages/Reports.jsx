import React from 'react';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import styles from './Reports.module.css';

const REPORTS_DATA = [
  { id: 'R001', loc: 'B205 Road, Ratnapura', desc: 'Road completely submerged. Water level approx 60cm. Vehicles unable to pass.', user: 'User #4821', time: '11 mins ago', sev: 'high', emoji: '🌊' },
  { id: 'R002', loc: 'Kelani River Bank, Kaduwela', desc: 'River bank overflow on north side. Nearby homes at risk.', user: 'User #3902', time: '34 mins ago', sev: 'high', emoji: '🏚' },
  { id: 'R003', loc: 'Wellampitiya Market Area', desc: 'Street flooding, knee-deep water in main market junction.', user: 'User #2241', time: '1h ago', sev: 'med', emoji: '🏪' },
  { id: 'R004', loc: 'Gampaha Town Centre', desc: 'Minor flooding near bus terminal. Water draining slowly.', user: 'User #5511', time: '2h ago', sev: 'low', emoji: '🚌' },
  { id: 'R005', loc: 'Moratuwa Beach Road', desc: 'Sea surge causing partial road flooding at high tide.', user: 'User #1087', time: '2h 15m ago', sev: 'med', emoji: '🌊' },
];

export const Reports = () => {
  const { showToast } = useToast();
  const [reports, setReports] = React.useState(REPORTS_DATA);

  const handleReport = (action, id) => {
    setReports((prev) => prev.filter((r) => r.id !== id));
    showToast(
      action === 'approve' ? `✅ Report ${id} approved & map updated` : `🗑 Report ${id} rejected`,
      action === 'approve' ? 'var(--accent)' : 'var(--danger)'
    );
  };

  return (
    <div className={styles.reports}>
      <div className={styles.pageHeader}>
        <h2>User Reports</h2>
        <p>Verify citizen-submitted flood reports with photo evidence</p>
      </div>
      <div className={styles.reportsList}>
        {reports.map((report) => (
          <div key={report.id} className={styles.reportCard}>
            <div className={styles.reportThumb}>{report.emoji}</div>
            <div className={styles.reportBody}>
              <div>
                <div className={styles.reportLoc}>
                  {report.loc}
                  <span className={`${styles.sevBadge} ${styles[`sev-${report.sev}`]}`}>
                    {report.sev.toUpperCase()}
                  </span>
                </div>
                <div className={styles.reportDesc}>{report.desc}</div>
                <div className={styles.reportMeta}>
                  <span>📋 {report.id}</span>
                  <span>👤 {report.user}</span>
                  <span>🕐 {report.time}</span>
                </div>
              </div>
            </div>
            <div className={styles.reportActions}>
              <Button
                variant="approve"
                size="sm"
                onClick={() => handleReport('approve', report.id)}
              >
                ✓ Approve
              </Button>
              <Button variant="reject" size="sm" onClick={() => handleReport('reject', report.id)}>
                ✗ Reject
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
