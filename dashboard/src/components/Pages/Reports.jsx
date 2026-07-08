import React from 'react';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './Reports.module.css';

export const Reports = () => {
  const { showToast } = useToast();
  const { token } = useAuth();
  const [reports, setReports] = React.useState([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/reports/pending`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setReports(data.data.reports || []);
      }
    } catch (err) {
      showToast('Failed to load reports', 'var(--danger)');
    } finally {
      setLoading(false);
    }
  };

  const handleReport = async (action, id) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/reports/${id}/${action}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
        showToast(
          action === 'approve' ? `✅ Report ${id} approved` : `🗑 Report ${id} rejected`,
          action === 'approve' ? 'var(--accent)' : 'var(--danger)'
        );
      }
    } catch (err) {
      showToast('Action failed', 'var(--danger)');
    }
  };

  if (loading) return <div className={styles.reports}><p>Loading reports...</p></div>;

  return (
    <div className={styles.reports}>
      <div className={styles.pageHeader}>
        <h2>User Reports</h2>
        <p>Verify citizen-submitted flood reports with photo evidence</p>
      </div>
      <div className={styles.reportsList}>
        {reports.length === 0 ? (
          <p>No pending reports.</p>
        ) : (
          reports.map((report) => (
            <div key={report.id} className={styles.reportCard}>
              <div className={styles.reportBody}>
                <div>
                  <div className={styles.reportLoc}>
                    {report.report_type}
                    <span className={styles.sevBadge}>SEV {report.severity}</span>
                  </div>
                  <div className={styles.reportDesc}>{report.description}</div>
                  <div className={styles.reportMeta}>
                    <span>📋 {report.id}</span>
                    <span>📍 {report.location?.latitude?.toFixed(4)}, {report.location?.longitude?.toFixed(4)}</span>
                  </div>
                </div>
              </div>
              <div className={styles.reportActions}>
                <Button variant="approve" size="sm" onClick={() => handleReport('approve', report.id)}>
                  ✓ Approve
                </Button>
                <Button variant="reject" size="sm" onClick={() => handleReport('reject', report.id)}>
                  ✗ Reject
                </Button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};