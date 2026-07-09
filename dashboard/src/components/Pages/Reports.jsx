import React from 'react';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './Reports.module.css';

const sevClass = (n) => (n >= 4 ? 'crit' : n === 3 ? 'warn' : 'watch');

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
      showToast('Failed to load reports', 'var(--crit)');
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
          action === 'approve' ? `Report ${id} approved` : `Report ${id} rejected`,
          action === 'approve' ? 'var(--safe)' : 'var(--crit)'
        );
      }
    } catch (err) {
      showToast('Action failed', 'var(--crit)');
    }
  };

  return (
    <div className={styles.reports}>
      <div className={styles.pageHeading}>
        <h1>Citizen Reports</h1>
        <span className={styles.updated}>{reports.length} pending review</span>
      </div>

      <div className={styles.panel}>
        {loading ? (
          <p className={styles.emptyState}>Loading reports…</p>
        ) : reports.length === 0 ? (
          <p className={styles.emptyState}>No pending reports.</p>
        ) : (
          <table className={styles.reportsTable}>
            <thead>
              <tr>
                <th>Type</th>
                <th>Severity</th>
                <th>Location</th>
                <th>Description</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((report) => (
                <tr key={report.id}>
                  <td className={styles.rtype}>{report.report_type}</td>
                  <td>
                    <span className={`${styles.sevChip} ${styles[sevClass(report.severity)]}`}>SEV {report.severity}</span>
                  </td>
                  <td className={styles.coord}>
                    {report.location?.latitude?.toFixed(4)}, {report.location?.longitude?.toFixed(4)}
                  </td>
                  <td className={styles.desc}>{report.description}</td>
                  <td>
                    <div className={styles.actionRow}>
                      <button className={`${styles.actionBtn} ${styles.primary}`} onClick={() => handleReport('approve', report.id)}>
                        Approve
                      </button>
                      <button className={`${styles.actionBtn} ${styles.reject}`} onClick={() => handleReport('reject', report.id)}>
                        Reject
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};
