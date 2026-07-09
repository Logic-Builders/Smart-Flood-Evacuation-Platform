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
  const [counts, setCounts] = useState({ zones: 0, reports: 0 });
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!mapContainer.current) return undefined;

    const map = L.map(mapContainer.current).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 18,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    mapRef.current = map;
    layerGroupRef.current = L.layerGroup().addTo(map);

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

  const buildPopup = (html, onRemove) => {
    const el = document.createElement('div');
    el.className = styles.popup;
    el.innerHTML = html;
    const btn = document.createElement('button');
    btn.textContent = 'Remove';
    btn.className = styles.popupRemove;
    btn.onclick = onRemove;
    el.appendChild(btn);
    return el;
  };

  const loadLiveData = async (cancelledAtStart) => {
    setLoading(true);
    try {
      const [zonesRes, reportsRes] = await Promise.all([
        fetch(`${BASE_URL}/api/v1/flood-zones`),
        fetch(`${BASE_URL}/api/v1/reports/active`),
      ]);
      const zonesJson = await zonesRes.json();
      const reportsJson = await reportsRes.json();

      if (cancelledAtStart || !mapRef.current || !layerGroupRef.current) return;

      const zones = zonesJson.success ? zonesJson.data?.zones || [] : [];
      const reports = reportsJson.success ? reportsJson.data?.reports || [] : [];

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

      if (bounds.isValid()) {
        mapRef.current.fitBounds(bounds, { padding: [32, 32], maxZoom: 13 });
      }

      setCounts({ zones: zones.length, reports: reports.length });
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
      if (!res.ok) throw new Error('request failed');
      layerGroupRef.current?.removeLayer(layer);
      setCounts((c) => ({ ...c, zones: Math.max(0, c.zones - 1) }));
      showToast('Flood zone removed', 'var(--safe)');
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

  const handleRefresh = () => loadLiveData(false);

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
          <Button variant="secondary" size="sm" onClick={handleRefresh} disabled={loading}>
            {loading ? 'Refreshing…' : 'Refresh'}
          </Button>
        </Card>

        <Card title="Legend" className={styles.legendCard}>
          <div className={styles.legend}>
            <span><span className={`${styles.legendDot} ${styles.crit}`}></span>Extreme</span>
            <span><span className={`${styles.legendDot} ${styles.warn}`}></span>Warning</span>
            <span><span className={`${styles.legendDot} ${styles.watch}`}></span>Watch</span>
          </div>
          <p className={styles.hint}>Click a zone or marker on the map to remove it.</p>
        </Card>
      </div>

      <div className={styles.mapContainer} ref={mapContainer}></div>
    </div>
  );
};
