import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Card } from '../UI/Card';
import { Button } from '../UI/Button';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../context/AuthContext';
import { BASE_URL } from '../../config';
import styles from './Map.module.css';

// Matches the --crit/--warn/--watch/--safe design tokens in index.css —
// Leaflet needs real hex values, not CSS custom properties.
const SEVERITY_COLOR = {
  EXTREME: '#9e2b25',
  WARNING: '#96591a',
  WATCH: '#7c6a16',
  NORMAL: '#1f6b49',
};

const SEVERITIES = ['WATCH', 'WARNING', 'EXTREME'];
const DAM_COLOR = '#2c5f8a';
const DAM_ALERT_COLOR = '#9e2b25';

const damIcon = (alert) => L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;background:${alert ? DAM_ALERT_COLOR : DAM_COLOR};border:2px solid #fff;border-radius:3px;box-shadow:0 0 0 1px ${alert ? DAM_ALERT_COLOR : DAM_COLOR};transform:rotate(45deg);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Default view centers roughly over Sri Lanka so the map is useful even
// before real zone/report data has loaded.
const DEFAULT_CENTER = [7.5, 80.7];
const DEFAULT_ZOOM = 8;

export const FloodMap = () => {
  const { showToast } = useToast();
  const { token } = useAuth();
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const layerGroupRef = useRef(null);
  const previewCircleRef = useRef(null);
  const [counts, setCounts] = useState({ zones: 0, reports: 0, dams: 0, damAlerts: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const [placingZone, setPlacingZone] = useState(false);
  const placingZoneRef = useRef(false);
  const [pendingCenter, setPendingCenter] = useState(null);
  const [zoneName, setZoneName] = useState('');
  const [zoneSeverity, setZoneSeverity] = useState('WARNING');
  const [zoneRadius, setZoneRadius] = useState(5);
  const [creatingZone, setCreatingZone] = useState(false);

  useEffect(() => { placingZoneRef.current = placingZone; }, [placingZone]);

  useEffect(() => {
    if (!mapContainer.current) return undefined;

    const map = L.map(mapContainer.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

    map.on('click', (e) => {
      if (!placingZoneRef.current) return;
      setPendingCenter({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    let cancelled = false;
    loadLiveData(cancelled);

    return () => {
      cancelled = true;
      map.remove();
      mapRef.current = null;
      layerGroupRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live preview circle for the zone-in-progress (separate layer from
  // layerGroupRef so it survives loadLiveData's clearLayers() calls).
  useEffect(() => {
    if (previewCircleRef.current) {
      mapRef.current?.removeLayer(previewCircleRef.current);
      previewCircleRef.current = null;
    }
    if (pendingCenter && mapRef.current) {
      const color = SEVERITY_COLOR[zoneSeverity];
      previewCircleRef.current = L.circle([pendingCenter.lat, pendingCenter.lng], {
        radius: zoneRadius * 1000,
        color,
        fillColor: color,
        fillOpacity: 0.2,
        weight: 2,
        dashArray: '6 4',
      }).addTo(mapRef.current);
    }
  }, [pendingCenter, zoneRadius, zoneSeverity]);

  const buildPopup = (html, onRemove) => buildActionPopup(html, [{ label: 'Remove', onClick: onRemove }]);

  // actions: [{ label, onClick }] — rendered as buttons under the popup body.
  const buildActionPopup = (html, actions) => {
    const el = document.createElement('div');
    el.className = styles.popup;
    el.innerHTML = html;
    actions.forEach(({ label, onClick }) => {
      const btn = document.createElement('button');
      btn.textContent = label;
      btn.className = styles.popupRemove;
      btn.onclick = onClick;
      el.appendChild(btn);
    });
    return el;
  };

  const loadLiveData = async (cancelledAtStart) => {
    setLoading(true);
    try {
      const [zonesRes, reportsRes, damsRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v1/flood-zones`),
        fetch(`${BASE_URL}/api/v1/reports/active`),
        fetch(`${BASE_URL}/api/v1/dams`),
      ]);
      const zonesJson = await zonesRes.json();
      const reportsJson = await reportsRes.json();
      const damsJson = await damsRes.json();

      if (cancelledAtStart || !mapRef.current || !layerGroupRef.current) return;

      const zones = zonesJson.success ? zonesJson.data?.zones || [] : [];
      const reports = reportsJson.success ? reportsJson.data?.reports || [] : [];
      const dams = damsJson.success ? damsJson.data?.dams || [] : [];

      layerGroupRef.current.clearLayers();
      const bounds = L.latLngBounds([]);

      zones.forEach((zone) => {
        const latlngs = (zone.boundary?.coordinates || []).map((c) => [c.latitude, c.longitude]);
        if (latlngs.length < 3) return;
        const color = SEVERITY_COLOR[zone.severity] || SEVERITY_COLOR.NORMAL;
        const polygon = L.polygon(latlngs, { color, fillColor: color, fillOpacity: 0.22, weight: 2 });
        polygon.bindPopup(buildPopup(
          `<strong>${zone.gauge_id || zone.id}</strong><br/>${zone.severity}`,
          () => handleRemoveZone(zone.id, polygon),
        ));
        polygon.addTo(layerGroupRef.current);
        latlngs.forEach((ll) => bounds.extend(ll));
      });

      reports.forEach((report) => {
        const lat = report.location?.latitude;
        const lng = report.location?.longitude;
        if (lat == null || lng == null) return;
        const color = report.severity >= 4 ? SEVERITY_COLOR.EXTREME
          : report.severity === 3 ? SEVERITY_COLOR.WARNING
            : SEVERITY_COLOR.WATCH;
        const marker = L.circleMarker([lat, lng], { radius: 7, color, fillColor: color, fillOpacity: 0.85, weight: 1.5 });
        marker.bindPopup(buildPopup(
          `<strong>${report.report_type}</strong><br/>Severity ${report.severity}<br/>${report.description || ''}`,
          () => handleRemoveReport(report.id, marker),
        ));
        marker.addTo(layerGroupRef.current);
        bounds.extend([lat, lng]);
      });

      dams.forEach((dam) => {
        const lat = dam.location?.latitude;
        const lng = dam.location?.longitude;
        if (lat == null || lng == null) return;

        if (dam.downstream_alert) {
          const color = DAM_ALERT_COLOR;
          L.circle([lat, lng], {
            radius: (dam.alert_radius_km || 10) * 1000,
            color, fillColor: color, fillOpacity: 0.08, weight: 1.5, dashArray: '4 4',
          }).addTo(layerGroupRef.current);
        }

        const marker = L.marker([lat, lng], { icon: damIcon(dam.downstream_alert) });
        const body = `
          <strong>${dam.name}</strong><br/>
          ${dam.river_name || ''}<br/>
          Water level: ${dam.current_water_level}m — Gate: ${dam.gate_status}<br/>
          ${dam.downstream_alert ? `<span style="color:${DAM_ALERT_COLOR}">Downstream risk ACTIVE (${dam.alert_radius_km}km)</span>` : 'No active alert'}
        `;
        const action = dam.downstream_alert
          ? { label: 'Clear Downstream Risk', onClick: () => handleClearDamAlert(dam.id) }
          : { label: 'Mark Downstream Risk', onClick: () => handleSetDamAlert(dam.id, dam.alert_radius_km || 10) };
        marker.bindPopup(buildActionPopup(body, [action]));
        marker.addTo(layerGroupRef.current);
        bounds.extend([lat, lng]);
      });

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
      }

      const damAlerts = dams.filter((d) => d.downstream_alert).length;
      setCounts({ zones: zones.length, reports: reports.length, dams: dams.length, damAlerts });
      setLastUpdated(new Date());
    } catch (err) {
      if (!cancelledAtStart) showToast('Failed to load live map data', 'var(--crit)');
    } finally {
      if (!cancelledAtStart) setLoading(false);
    }
  };

  const handleRemoveZone = async (zoneId, layer) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/flood-zones/${zoneId}/deactivate`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error('request failed');
      layerGroupRef.current?.removeLayer(layer);
      setCounts((c) => ({ ...c, zones: Math.max(0, c.zones - 1) }));
      showToast(`Flood zone removed — ${json.data?.roads_reopened ?? 0} road(s) reopened`, 'var(--safe)');
    } catch {
      showToast('Failed to remove flood zone', 'var(--crit)');
    }
  };

  const handleRemoveReport = async (reportId, layer) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/reports/${reportId}/reject`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('request failed');
      layerGroupRef.current?.removeLayer(layer);
      setCounts((c) => ({ ...c, reports: Math.max(0, c.reports - 1) }));
      showToast('Report removed from map', 'var(--safe)');
    } catch {
      showToast('Failed to remove report', 'var(--crit)');
    }
  };

  const handleSetDamAlert = async (damId, radiusKm) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/dams/${damId}/alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ radius_km: radiusKm }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'request failed');
      showToast(`Downstream risk marked — ${json.data.roads_blocked} road(s) blocked`, 'var(--crit)');
      loadLiveData(false);
    } catch (err) {
      showToast(err.message || 'Failed to mark downstream risk', 'var(--crit)');
    }
  };

  const handleClearDamAlert = async (damId) => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/dams/${damId}/alert`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'request failed');
      showToast(`Alert cleared — ${json.data.roads_reopened} road(s) reopened`, 'var(--safe)');
      loadLiveData(false);
    } catch (err) {
      showToast(err.message || 'Failed to clear downstream risk', 'var(--crit)');
    }
  };

  const handleRefresh = () => loadLiveData(false);

  const startPlacingZone = () => {
    setPlacingZone(true);
    setPendingCenter(null);
    setZoneName('');
    setZoneSeverity('WARNING');
    setZoneRadius(5);
  };

  const cancelPlacingZone = () => {
    setPlacingZone(false);
    setPendingCenter(null);
  };

  const handleCreateZone = async () => {
    if (!pendingCenter) return showToast('Click the map to place the zone center first', 'var(--warn)');
    setCreatingZone(true);
    try {
      const res = await fetch(`${BASE_URL}/api/v1/admin/flood-zones`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          zone_name: zoneName || 'Manually Entered Zone',
          severity: zoneSeverity,
          latitude: pendingCenter.lat,
          longitude: pendingCenter.lng,
          radius_km: Number(zoneRadius),
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || 'Failed to create zone');

      showToast(`Flood zone created — ${json.data.roads_blocked} road(s) blocked`, 'var(--crit)');
      cancelPlacingZone();
      loadLiveData(false);
    } catch (err) {
      showToast(err.message || 'Failed to create flood zone', 'var(--crit)');
    } finally {
      setCreatingZone(false);
    }
  };

  return (
    <div className={styles.mapPage}>
      <div className={styles.pageHeading}>
        <h1>Flood Map</h1>
        <span className={styles.updated}>
          {lastUpdated ? `Last updated ${lastUpdated.toLocaleTimeString()}` : 'Loading…'}
        </span>
      </div>

      <div className={styles.twoCol}>
        <Card title="Map Status" className={styles.controlCard}>
          <div className={styles.statusRow}>
            <span>Active flood zones</span>
            <strong>{counts.zones}</strong>
          </div>
          <div className={styles.statusRow}>
            <span>Active hazard reports</span>
            <strong>{counts.reports}</strong>
          </div>
          <div className={styles.statusRow}>
            <span>Dam stations{counts.damAlerts > 0 ? ` (${counts.damAlerts} alert${counts.damAlerts > 1 ? 's' : ''})` : ''}</span>
            <strong style={counts.damAlerts > 0 ? { color: 'var(--crit)' } : undefined}>{counts.dams}</strong>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
            <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={loading}>
              {loading ? 'Refreshing…' : 'Refresh'}
            </Button>
            {!placingZone && (
              <Button variant="reject" size="sm" onClick={startPlacingZone}>
                New Flood Zone
              </Button>
            )}
          </div>
        </Card>

        {placingZone ? (
          <Card title="New Flood Zone" className={styles.legendCard}>
            <p className={styles.hint}>
              {pendingCenter ? 'Adjust details, then create.' : 'Click a point on the map to place the zone center.'}
            </p>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Zone name</label>
              <input
                className={styles.formInput}
                placeholder="e.g. Uva Flats"
                value={zoneName}
                onChange={(e) => setZoneName(e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Severity</label>
              <select className={styles.formSelect} value={zoneSeverity} onChange={(e) => setZoneSeverity(e.target.value)}>
                {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Radius (km)</label>
              <input
                className={styles.formInput}
                type="number"
                min="0.5"
                max="50"
                step="0.5"
                value={zoneRadius}
                onChange={(e) => setZoneRadius(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="primary" size="sm" onClick={handleCreateZone} disabled={creatingZone || !pendingCenter}>
                {creatingZone ? 'Creating…' : 'Create Zone'}
              </Button>
              <Button variant="secondary" size="sm" onClick={cancelPlacingZone} disabled={creatingZone}>
                Cancel
              </Button>
            </div>
          </Card>
        ) : (
          <Card title="Legend" className={styles.legendCard}>
            <div className={styles.legend}>
              <span><span className={`${styles.legendDot} ${styles.crit}`}></span>Extreme</span>
              <span><span className={`${styles.legendDot} ${styles.warn}`}></span>Warning</span>
              <span><span className={`${styles.legendDot} ${styles.watch}`}></span>Watch</span>
              <span><span className={styles.legendDot} style={{ background: DAM_COLOR, borderRadius: '2px', transform: 'rotate(45deg)' }}></span>Dam</span>
            </div>
            <p className={styles.hint}>Click a zone or marker on the map to remove it.</p>
          </Card>
        )}
      </div>

      <div className={styles.mapContainer} ref={mapContainer}></div>
    </div>
  );
};
