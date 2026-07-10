import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './Weather.module.css';

const RISK_LABELS = ['Low', 'Medium', 'High', 'Critical'];
// UI-friendly labels map onto the backend's flood_severity enum.
const RISK_TO_SEVERITY = { Low: 'NORMAL', Medium: 'WATCH', High: 'WARNING', Critical: 'EXTREME' };
const SEVERITY_TO_RISK = { NORMAL: 'Low', WATCH: 'Medium', WARNING: 'High', EXTREME: 'Critical' };

const DISTRICTS = ['Ampara', 'Colombo', 'Gampaha', 'Kalutara', 'Kandy', 'Ratnapura', 'Matara'];
const SOURCES = ['MeteoGroup Sri Lanka', 'DMC', 'Local Authority', 'CEB Hydro'];

export const Weather = () => {
  const { showToast } = useToast();
  const { token } = useAuth();
  const [weatherList, setWeatherList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [source, setSource] = useState(SOURCES[0]);
  const [district, setDistrict] = useState(DISTRICTS[0]);
  const [rainfall, setRainfall] = useState('');
  const [risk, setRisk] = useState('Low');
  const [notes, setNotes] = useState('');

  const loadReadings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/weather`);
      const json = await res.json();
      if (json.success) setWeatherList(json.data?.readings || []);
    } catch {
      showToast('Failed to load weather data', 'var(--crit)');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadReadings(); }, [loadReadings]);

  const handleSubmit = async () => {
    if (!rainfall) return showToast('Enter a rainfall value', 'var(--warn)');
    setSubmitting(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/weather`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          source,
          district,
          rainfall_mm: parseFloat(rainfall),
          risk_level: RISK_TO_SEVERITY[risk],
          notes,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Submission failed');

      showToast('Weather data recorded', 'var(--safe)');
      setRainfall(''); setNotes(''); setRisk('Low');
      loadReadings();
    } catch (err) {
      showToast(err.message || 'Failed to record weather data', 'var(--crit)');
    } finally {
      setSubmitting(false);
    }
  };

  const getRiskClass = (risk) => {
    const map = { Critical: 'crit', High: 'warn', Medium: 'warn', Low: 'watch' };
    return map[risk] || 'watch';
  };

  return (
    <div className={styles.weather}>
      <div className={styles.pageHeading}>
        <h1>Weather &amp; Authority Data</h1>
        <span className={styles.updated}>Official meteorological &amp; local authority feeds</span>
      </div>

      <div className={styles.twoCol}>
        <Card title="Add New Data Point">
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Source</label>
              <select className={styles.formSelect} value={source} onChange={(e) => setSource(e.target.value)}>
                {SOURCES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>District</label>
              <select className={styles.formSelect} value={district} onChange={(e) => setDistrict(e.target.value)}>
                {DISTRICTS.map((d) => <option key={d}>{d}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Rainfall (mm/hr)</label>
              <input
                className={styles.formInput}
                type="number"
                placeholder="e.g. 85"
                value={rainfall}
                onChange={(e) => setRainfall(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Risk Level</label>
              <select className={styles.formSelect} value={risk} onChange={(e) => setRisk(e.target.value)}>
                {RISK_LABELS.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
            <label className={styles.formLabel}>Notes</label>
            <textarea
              className={styles.formTextarea}
              placeholder="Additional observations..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            ></textarea>
          </div>
          <Button variant="primary" onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Data'}
          </Button>
        </Card>

        <Card title="Summary">
          <div className={styles.conditionsGrid}>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>Entries logged</div>
              <div className={styles.condVal}>{weatherList.length}</div>
            </div>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>Latest rainfall</div>
              <div className={styles.condVal}>{weatherList[0] ? `${weatherList[0].rainfall_mm}mm/hr` : '—'}</div>
            </div>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>Latest district</div>
              <div className={styles.condVal}>{weatherList[0]?.district || '—'}</div>
            </div>
            <div className={styles.conditionItem}>
              <div className={`${styles.condVal} ${styles[getRiskClass(SEVERITY_TO_RISK[weatherList[0]?.risk_level] || 'Low')]}`}>
                {SEVERITY_TO_RISK[weatherList[0]?.risk_level] || '—'}
              </div>
              <div className={styles.condLabel}>Latest risk level</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Recent Data Entries">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>District</th>
              <th>Rainfall</th>
              <th>Risk</th>
              <th>Time</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={5} className={styles.time}>Loading…</td></tr>
            )}
            {!loading && weatherList.length === 0 && (
              <tr><td colSpan={5} className={styles.time}>No data points recorded yet.</td></tr>
            )}
            {weatherList.map((w) => {
              const riskLabel = SEVERITY_TO_RISK[w.risk_level] || 'Low';
              return (
                <tr key={w.id}>
                  <td><span className={styles.sourceTag}>{w.source}</span></td>
                  <td>{w.district || '—'}</td>
                  <td className={styles.mono}>{w.rainfall_mm}mm/hr</td>
                  <td><span className={`${styles.sevChip} ${styles[getRiskClass(riskLabel)]}`}>{riskLabel}</span></td>
                  <td className={styles.time}>{new Date(w.recorded_at).toLocaleTimeString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
