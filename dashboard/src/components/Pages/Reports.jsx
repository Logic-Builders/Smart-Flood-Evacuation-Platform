// dashboard/src/components/Pages/Reports.jsx
import React, { useEffect, useState } from "react";
import { Card, Badge, Button } from "../UI";
import { useToast } from "../../context/ToastContext";
import { getPendingReports, approveReport, rejectReport } from "../../api/api"; // ← fixed path
import styles from "./Reports.module.css";

function severityVariant(severity) {
  if (typeof severity === "number") {
    if (severity >= 4) return "red";
    if (severity >= 2) return "yellow";
    return "default";
  }
  const s = String(severity).toLowerCase();
  if (s === "high" || s === "extreme") return "red";
  if (s === "medium" || s === "warning" || s === "watch") return "yellow";
  return "default";
}

function severityLabel(severity) {
  if (typeof severity === "number") {
    if (severity >= 4) return "High";
    if (severity >= 2) return "Medium";
    return "Low";
  }
  return severity;
}

export default function Reports() {
  const { showToast } = useToast();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        setError("");
        const data = await getPendingReports();
        if (!cancelled) setReports(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Failed to load reports.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleApprove = async (reportId) => {
    setActioningId(reportId);
    try {
      await approveReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showToast("✅ Report approved successfully", "var(--accent)");
    } catch (err) {
      showToast(`❌ ${err.message || "Approve failed"}`, "var(--danger)");
    } finally {
      setActioningId(null);
    }
  };

  const handleReject = async (reportId) => {
    setActioningId(reportId);
    try {
      await rejectReport(reportId);
      setReports((prev) => prev.filter((r) => r.id !== reportId));
      showToast("🗑️ Report rejected", "var(--accent3)");
    } catch (err) {
      showToast(`❌ ${err.message || "Reject failed"}`, "var(--danger)");
    } finally {
      setActioningId(null);
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.statusMessage}>Loading pending reports…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.page}>
        <div className={styles.errorMessage}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>
        Report Verification
        <span className={styles.count}>{reports.length} pending</span>
      </h2>

      {reports.length === 0 ? (
        <Card>
          <p className={styles.emptyMessage}>✅ No pending reports — all clear!</p>
        </Card>
      ) : (
        reports.map((report) => {
          const isActioning = actioningId === report.id;
          return (
            <Card key={report.id} className={styles.reportCard}>
              <div className={styles.reportHeader}>
                <div>
                  <span className={styles.reportType}>{report.report_type}</span>
                  <Badge variant={severityVariant(report.severity)}>
                    {severityLabel(report.severity)}
                  </Badge>
                </div>
                <span className={styles.timestamp}>
                  {new Date(report.created_at).toLocaleString()}
                </span>
              </div>

              <p className={styles.description}>{report.description}</p>

              <div className={styles.meta}>
                {report.location && (
                  <span className={styles.metaItem}>
                    📍 {report.location.latitude?.toFixed(4)},{" "}
                    {report.location.longitude?.toFixed(4)}
                  </span>
                )}
                {report.reporter_id && (
                  <span className={styles.metaItem}>
                    👤 {report.reporter_id.slice(0, 8)}…
                  </span>
                )}
                <span className={styles.metaItem}>🔖 {report.status}</span>
              </div>

              <div className={styles.actions}>
                <Button
                  variant="approve"
                  size="sm"
                  onClick={() => handleApprove(report.id)}
                  disabled={isActioning}
                >
                  {isActioning ? "…" : "✓ Approve"}
                </Button>
                <Button
                  variant="reject"
                  size="sm"
                  onClick={() => handleReject(report.id)}
                  disabled={isActioning}
                >
                  {isActioning ? "…" : "✗ Reject"}
                </Button>
              </div>
            </Card>
          );
        })
      )}
    </div>
  );
}
