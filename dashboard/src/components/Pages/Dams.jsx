import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './Dams.module.css';

const GATE_STATUSES = ['CLOSED', 'PARTIALLY_OPEN', 'OPEN', 'EMERGENCY_OPEN'];

const EMPTY_FORM = {
  name: '', river_name: '', latitude: '', longitude: '',
  current_water_level: '', max_capacity_m3: '',
  alert_level_m: '', minor_flood_level_m: '', major_flood_level_m: '',
  gate_status: 'CLOSED', discharge_rate_m3s: '',
};

const statusFor = (dam) => {
  if (dam.downstream_alert) return 'crit';
  if (dam.risk_ratio >= 0.85) return 'warn';
  return 'safe';
};

const noteFor = (dam) => {
  if (dam.downstream_alert) return `Downstream risk ACTIVE — roads within ${dam.alert_radius_km}km auto-blocked`;
  if (dam.risk_ratio >= 0.85) return 'Elevated water level — monitor closely';
  return 'No immediate action required';
};

export const Dams = () => {
  const { showToast } = useToast();
  const { token } = useAuth();
  const [dams, setDams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  // formMode: null | 'add' | dam.id (editing that dam)
  const [formMode, setFormMode] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const loadDams = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/dams`);
      const json = await res.json();
      if (json.success) setDams(json.data?.dams || []);
    } catch {
      showToast('Failed to load dam data', 'var(--crit)');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { loadDams(); }, [loadDams]);

  const handleMarkRisk = async (dam) => {
    setBusyId(dam.id);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/dams/${dam.id}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ radius_km: dam.alert_radius_km || 10 }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to set alert');
      showToast(`Downstream risk marked — ${json.data.roads_blocked} road(s) blocked`, 'var(--crit)');
      loadDams();
    } catch (err) {
      showToast(err.message || 'Failed to mark downstream risk', 'var(--crit)');
    } finally {
      setBusyId(null);
    }
  };

  const handleClearRisk = async (dam) => {
    setBusyId(dam.id);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/dams/${dam.id}/alert`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to clear alert');
      showToast(`Alert cleared — ${json.data.roads_reopened} road(s) reopened`, 'var(--safe)');
      loadDams();
    } catch (err) {
      showToast(err.message || 'Failed to clear downstream risk', 'var(--crit)');
    } finally {
      setBusyId(null);
    }
  };

  const openAddForm = () => {
    setForm(EMPTY_FORM);
    setFormMode('add');
  };

  const openEditForm = (dam) => {
    setForm({
      name: dam.name, river_name: dam.river_name,
      latitude: dam.location.latitude, longitude: dam.location.longitude,
      current_water_level: dam.current_water_level, max_capacity_m3: dam.max_capacity_m3,
      alert_level_m: dam.alert_level_m, minor_flood_level_m: dam.minor_flood_level_m,
      major_flood_level_m: dam.major_flood_level_m, gate_status: dam.gate_status,
      discharge_rate_m3s: dam.discharge_rate_m3s,
    });
    setFormMode(dam.id);
  };

  const closeForm = () => setFormMode(null);

  const setField = (field) => (e) => setForm((f) => ({ ...f, [field]: e.target.value }));

  const handleSaveForm = async () => {
    if (!form.name || !form.latitude || !form.longitude) {
      return showToast('Name, latitude and longitude are required', 'var(--warn)');
    }
    setSaving(true);
    const isEdit = formMode !== 'add';
    const url = isEdit ? `${BASE_URL}/api/v1/admin/dams/${formMode}` : `${BASE_URL}/api/v1/admin/dams`;
    try {
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: form.name,
          river_name: form.river_name,
          latitude: Number(form.latitude),
          longitude: Number(form.longitude),
          current_water_level: Number(form.current_water_level) || 0,
          max_capacity_m3: Number(form.max_capacity_m3) || 0,
          alert_level_m: Number(form.alert_level_m),
          minor_flood_level_m: Number(form.minor_flood_level_m),
          major_flood_level_m: Number(form.major_flood_level_m),
          gate_status: form.gate_status,
          discharge_rate_m3s: Number(form.discharge_rate_m3s) || 0,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Save failed');
      showToast(isEdit ? 'Dam station updated' : 'Dam station added', 'var(--safe)');
      closeForm();
      loadDams();
    } catch (err) {
      showToast(err.message || 'Failed to save dam station', 'var(--crit)');
    } finally {
      setSaving(false);
    }
  };

  const renderForm = () => (
    <Card title={formMode === 'add' ? 'Add Dam Station' : 'Edit Dam Station'} className={styles.formCard}>
      <div className={styles.formGrid}>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Name</label>
          <input className={styles.formInput} value={form.name} onChange={setField('name')} placeholder="e.g. Senanayake Samudra" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>River</label>
          <input className={styles.formInput} value={form.river_name} onChange={setField('river_name')} placeholder="e.g. Gal Oya" />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Gate Status</label>
          <select className={styles.formSelect} value={form.gate_status} onChange={setField('gate_status')}>
            {GATE_STATUSES.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Latitude</label>
          <input className={styles.formInput} type="number" step="any" value={form.latitude} onChange={setField('latitude')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Longitude</label>
          <input className={styles.formInput} type="number" step="any" value={form.longitude} onChange={setField('longitude')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Discharge Rate (m³/s)</label>
          <input className={styles.formInput} type="number" step="any" value={form.discharge_rate_m3s} onChange={setField('discharge_rate_m3s')} />
        </div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Current Water Level (m)</label>
          <input className={styles.formInput} type="number" step="any" value={form.current_water_level} onChange={setField('current_water_level')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Max Capacity (m³)</label>
          <input className={styles.formInput} type="number" step="any" value={form.max_capacity_m3} onChange={setField('max_capacity_m3')} />
        </div>
        <div></div>

        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Alert Level (m)</label>
          <input className={styles.formInput} type="number" step="any" value={form.alert_level_m} onChange={setField('alert_level_m')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Minor Flood Level (m)</label>
          <input className={styles.formInput} type="number" step="any" value={form.minor_flood_level_m} onChange={setField('minor_flood_level_m')} />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.formLabel}>Major Flood Level (m)</label>
          <input className={styles.formInput} type="number" step="any" value={form.major_flood_level_m} onChange={setField('major_flood_level_m')} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px' }}>
        <Button variant="primary" size="sm" onClick={handleSaveForm} disabled={saving}>
          {saving ? 'Saving…' : formMode === 'add' ? 'Add Dam' : 'Save Changes'}
        </Button>
        <Button variant="secondary" size="sm" onClick={closeForm} disabled={saving}>
          Cancel
        </Button>
      </div>
    </Card>
  );

  return (
    <div className={styles.dams}>
      <div className={styles.pageHeading}>
        <div>
          <h1>Dam Monitoring</h1>
          <span className={styles.updated}>Water levels &amp; downstream flood risk</span>
        </div>
        {formMode === null && (
          <Button variant="primary" size="sm" onClick={openAddForm}>
            Add Dam
          </Button>
        )}
      </div>

      {formMode !== null && renderForm()}

      {loading && <div className={styles.updated}>Loading dam stations…</div>}
      {!loading && dams.length === 0 && <div className={styles.updated}>No dam stations found.</div>}

      <div className={styles.damsList}>
        {dams.map((dam) => {
          const status = statusFor(dam);
          const levelPct = Math.min(100, Math.round((dam.risk_ratio || 0) * 100));
          return (
            <div key={dam.id} className={`${styles.damPanel} ${styles[status]}`}>
              <div className={styles.damHeader}>
                <div>
                  <div className={styles.damName}>{dam.name}</div>
                  <div className={styles.damNote}>{noteFor(dam)}</div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button variant="secondary" size="md" onClick={() => openEditForm(dam)}>
                    Edit
                  </Button>
                  {dam.downstream_alert ? (
                    <Button variant="secondary" size="md" onClick={() => handleClearRisk(dam)} disabled={busyId === dam.id}>
                      {busyId === dam.id ? 'Clearing…' : 'Clear Downstream Risk'}
                    </Button>
                  ) : (
                    <Button variant="reject" size="md" onClick={() => handleMarkRisk(dam)} disabled={busyId === dam.id}>
                      {busyId === dam.id ? 'Marking…' : 'Mark Downstream Risk'}
                    </Button>
                  )}
                </div>
              </div>

              <div className={styles.damMeta}>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Water Level</div>
                  <div className={`${styles.metaVal} ${styles[status]}`}>
                    {dam.current_water_level}m ({levelPct}% of major flood level)
                  </div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>Discharge Rate</div>
                  <div className={styles.metaVal}>{dam.discharge_rate_m3s} m³/s</div>
                </div>
                <div className={styles.metaItem}>
                  <div className={styles.metaLabel}>River / Gate Status</div>
                  <div className={styles.metaValSmall}>{dam.river_name} — {dam.gate_status}</div>
                </div>
              </div>

              <div className={styles.progressBar}>
                <div
                  className={`${styles.progressFill} ${styles[status]}`}
                  style={{ width: `${levelPct}%` }}
                ></div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
