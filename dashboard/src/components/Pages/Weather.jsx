import React, { useState } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import styles from './Weather.module.css';

const WEATHER_DATA = [
  { source: 'MeteoGroup', district: 'Ratnapura', rainfall: '85mm/hr', risk: 'Critical', time: '08:12' },
  { source: 'DMC', district: 'Colombo', rainfall: '42mm/hr', risk: 'High', time: '08:45' },
  { source: 'Local Authority', district: 'Gampaha', rainfall: '28mm/hr', risk: 'Medium', time: '09:10' },
  { source: 'MeteoGroup', district: 'Kandy', rainfall: '15mm/hr', risk: 'Low', time: '09:32' },
];

export const Weather = () => {
  const { showToast } = useToast();
  const [weatherList] = useState(WEATHER_DATA);

  const handleSubmit = () => {
    showToast('✅ Weather data recorded', 'var(--accent)');
  };

  const handleUpdateMap = () => {
    showToast('📍 Area updated on map', 'var(--info)');
  };

  const getRiskClass = (risk) => {
    const map = { Critical: 'sev-high', High: 'sev-med', Medium: 'sev-med', Low: 'sev-low' };
    return map[risk] || 'sev-low';
  };

  return (
    <div className={styles.weather}>
      <div className={styles.pageHeader}>
        <h2>Weather &amp; Authority Data</h2>
        <p>Official data from meteorological departments and local authorities</p>
      </div>

      <div className={styles.twoCol} style={{ marginBottom: '22px' }}>
        <Card title="➕ Add New Data Point">
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Source</label>
              <select className={styles.formSelect}>
                <option>MeteoGroup Sri Lanka</option>
                <option>DMC</option>
                <option>Local Authority</option>
                <option>CEB Hydro</option>
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>District</label>
              <select className={styles.formSelect}>
                <option>Colombo</option>
                <option>Gampaha</option>
                <option>Kalutara</option>
                <option>Kandy</option>
                <option>Ratnapura</option>
                <option>Matara</option>
              </select>
            </div>
          </div>
          <div className={styles.formRow}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Rainfall (mm/hr)</label>
              <input className={styles.formInput} type="number" placeholder="e.g. 85" />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Risk Level</label>
              <select className={styles.formSelect}>
                <option>Low</option>
                <option>Medium</option>
                <option>High</option>
                <option>Critical</option>
              </select>
            </div>
          </div>
          <div className={styles.formGroup} style={{ marginBottom: '14px' }}>
            <label className={styles.formLabel}>Notes</label>
            <textarea className={styles.formTextarea} placeholder="Additional observations..."></textarea>
          </div>
          <Button variant="primary" onClick={handleSubmit}>
            Submit Data
          </Button>
        </Card>

        <Card title="🌡 Current Conditions">
          <div className={styles.conditionsGrid}>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>Rainfall 24h</div>
              <div className={`${styles.condVal} ${styles.red}`}>148mm</div>
            </div>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>Wind Speed</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: '#f7c948' }}>62 km/h</div>
            </div>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>River Level</div>
              <div className={`${styles.condVal} ${styles.red}`}>+2.4m</div>
            </div>
            <div className={styles.conditionItem}>
              <div className={styles.condLabel}>Forecast 6h</div>
              <div style={{ fontFamily: "'Syne', sans-serif", fontSize: '1.1rem', fontWeight: 700, marginTop: '4px', color: '#f7c948' }}>+120mm</div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="📋 Recent Data Entries">
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>District</th>
              <th>Rainfall</th>
              <th>Risk</th>
              <th>Time</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {weatherList.map((w, idx) => (
              <tr key={idx}>
                <td>
                  <span className={styles.sourceTag}>{w.source}</span>
                </td>
                <td>{w.district}</td>
                <td style={{ fontFamily: "'DM Mono', monospace" }}>{w.rainfall}</td>
                <td>
                  <span className={`${styles.sevBadge} ${styles[getRiskClass(w.risk)]}`}>{w.risk}</span>
                </td>
                <td style={{ fontFamily: "'DM Mono', monospace", color: '#6b7a99' }}>{w.time}</td>
                <td>
                  <Button variant="secondary" size="sm" onClick={handleUpdateMap}>
                    Update Map
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
};
