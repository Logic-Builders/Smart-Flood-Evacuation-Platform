import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  getNetwork, getRoute, getActiveReports, submitReport,
  login, getPendingReports, approveReport, rejectReport,
} from './api';

const CENTER = [7.297, 81.672];

const startIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const endIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function FloodMap({ network, routeCoords, start, end, activeReports, pickMode, onPick }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const layersRef = useRef({ roads: [], route: null, start: null, end: null, hazards: [] });

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;
    mapInstance.current = L.map(mapRef.current).setView(CENTER, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
    }).addTo(mapInstance.current);

    mapInstance.current.on('click', (e) => {
      if (pickMode) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    });

    return () => {
      mapInstance.current?.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    const handler = (e) => {
      if (pickMode) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    };
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [pickMode, onPick]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    layersRef.current.roads.forEach((l) => map.removeLayer(l));
    layersRef.current.roads = (network.segments || []).map((s) =>
      L.polyline([s.start, s.end], { color: '#64748b', weight: 4, opacity: 0.7 }).addTo(map)
    );
  }, [network]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (layersRef.current.route) map.removeLayer(layersRef.current.route);
    if (routeCoords.length > 0) {
      layersRef.current.route = L.polyline(routeCoords, { color: '#22c55e', weight: 6 }).addTo(map);
    } else {
      layersRef.current.route = null;
    }
  }, [routeCoords]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (layersRef.current.start) map.removeLayer(layersRef.current.start);
    layersRef.current.start = start
      ? L.marker([start.lat, start.lng], { icon: startIcon }).addTo(map).bindPopup('Start')
      : null;
  }, [start]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    if (layersRef.current.end) map.removeLayer(layersRef.current.end);
    layersRef.current.end = end
      ? L.marker([end.lat, end.lng], { icon: endIcon }).addTo(map).bindPopup('End')
      : null;
  }, [end]);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;
    layersRef.current.hazards.forEach((m) => map.removeLayer(m));
    layersRef.current.hazards = activeReports.map((r) =>
      L.circleMarker([r.latitude, r.longitude], {
        radius: 10, color: '#ef4444', fillColor: '#f87171', fillOpacity: 0.8,
      }).addTo(map).bindPopup(`${r.report_type} (sev ${r.severity})`)
    );
  }, [activeReports]);

  return <div ref={mapRef} style={{ height: '100%', width: '100%' }} />;
}

export default function App() {
  const [tab, setTab] = useState('route');
  const [network, setNetwork] = useState({ nodes: [], segments: [] });
  const [activeReports, setActiveReports] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [routeCoords, setRouteCoords] = useState([]);
  const [start, setStart] = useState(null);
  const [end, setEnd] = useState(null);
  const [pickMode, setPickMode] = useState(null);
  const [status, setStatus] = useState('');
  const [token, setToken] = useState(localStorage.getItem('adminToken') || '');
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  const [reportForm, setReportForm] = useState({
    latitude: 7.297, longitude: 81.672, report_type: 'FLOODED_ROAD', severity: 3, description: '',
  });

  const refresh = useCallback(async () => {
    try {
      const [net, reports] = await Promise.all([getNetwork(), getActiveReports()]);
      setNetwork(net);
      setActiveReports(reports);
    } catch {
      setStatus('Cannot reach API. Start backend: cd backend\\app && go run .\\cmd\\api\\main.go');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handlePick = useCallback((pt) => {
    if (pickMode === 'start') setStart(pt);
    if (pickMode === 'end') setEnd(pt);
    if (pickMode === 'report') setReportForm((f) => ({ ...f, latitude: pt.lat, longitude: pt.lng }));
    setPickMode(null);
    setStatus(pickMode === 'report' ? 'Report location set on map' : `${pickMode} point set`);
  }, [pickMode]);

  const calcRoute = async () => {
    if (!start || !end) { setStatus('Set start and end points first'); return; }
    try {
      const data = await getRoute(start, end);
      setRouteCoords(data.coordinates || []);
      setStatus(`Route found (cost ${data.total_cost?.toFixed(2)})`);
    } catch (e) {
      setStatus(e.response?.data?.error || 'Route failed');
      setRouteCoords([]);
    }
  };

  const sendReport = async () => {
    try {
      await submitReport(reportForm);
      setStatus('Report submitted — pending admin approval');
      refresh();
    } catch (e) {
      setStatus(e.response?.data?.error || 'Submit failed');
    }
  };

  const doLogin = async () => {
    try {
      const data = await login(loginForm.username, loginForm.password);
      setToken(data.token);
      localStorage.setItem('adminToken', data.token);
      setStatus('Admin logged in');
      setPendingReports(await getPendingReports(data.token));
    } catch {
      setStatus('Login failed');
    }
  };

  const loadPending = async () => {
    if (!token) return;
    setPendingReports(await getPendingReports(token));
  };

  const handleApprove = async (id) => {
    await approveReport(token, id);
    await loadPending();
    await refresh();
    setStatus('Report approved — affects routing');
  };

  const handleReject = async (id) => {
    await rejectReport(token, id);
    await loadPending();
    setStatus('Report rejected');
  };

  return (
    <div className="app">
      <aside className="sidebar">
        <h1>Safe Flood Evacuation</h1>
        <div className="tabs">
          <button className={tab === 'route' ? 'active' : ''} onClick={() => setTab('route')}>Route</button>
          <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Report</button>
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => { setTab('admin'); loadPending(); }}>Admin</button>
        </div>

        {tab === 'route' && (
          <div className="panel">
            <p className="hint">Click button then tap map to set points</p>
            <button className="secondary" onClick={() => setPickMode('start')}>Pick Start (green)</button>
            <button className="secondary" onClick={() => setPickMode('end')}>Pick End (red)</button>
            <div className="status">
              Start: {start ? `${start.lat.toFixed(4)}, ${start.lng.toFixed(4)}` : '—'}<br />
              End: {end ? `${end.lat.toFixed(4)}, ${end.lng.toFixed(4)}` : '—'}
            </div>
            <button className="primary" onClick={calcRoute}>Find Safest Route</button>
          </div>
        )}

        {tab === 'report' && (
          <div className="panel">
            <button className="secondary" onClick={() => setPickMode('report')}>Pick location on map</button>
            <div>
              <label>Type</label>
              <select value={reportForm.report_type} onChange={(e) => setReportForm({ ...reportForm, report_type: e.target.value })}>
                <option value="FLOODED_ROAD">Flooded Road</option>
                <option value="DAMAGED_BRIDGE">Damaged Bridge</option>
                <option value="BLOCKED_ROAD">Blocked Road</option>
              </select>
            </div>
            <div>
              <label>Severity (1-5)</label>
              <input type="number" min="1" max="5" value={reportForm.severity}
                onChange={(e) => setReportForm({ ...reportForm, severity: Number(e.target.value) })} />
            </div>
            <div>
              <label>Description</label>
              <textarea rows={3} value={reportForm.description}
                onChange={(e) => setReportForm({ ...reportForm, description: e.target.value })} />
            </div>
            <button className="primary" onClick={sendReport}>Submit Report</button>
          </div>
        )}

        {tab === 'admin' && (
          <div className="panel">
            {!token ? (
              <>
                <div><label>Username</label>
                  <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} /></div>
                <div><label>Password</label>
                  <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} /></div>
                <button className="primary" onClick={doLogin}>Login</button>
              </>
            ) : (
              <>
                <button className="secondary" onClick={loadPending}>Refresh pending</button>
                {pendingReports.length === 0 && <p>No pending reports</p>}
                {pendingReports.map((r) => (
                  <div key={r.id} className="report-card">
                    <h4>{r.report_type} — severity {r.severity}</h4>
                    <p>{r.description || 'No description'}</p>
                    <div className="report-actions">
                      <button className="success" onClick={() => handleApprove(r.id)}>Approve</button>
                      <button className="danger" onClick={() => handleReject(r.id)}>Reject</button>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

        {status && <p className="status" style={{ marginTop: '1rem' }}>{status}</p>}
      </aside>

      <main className="map-wrap">
        <FloodMap
          network={network}
          routeCoords={routeCoords}
          start={start}
          end={end}
          activeReports={activeReports}
          pickMode={pickMode}
          onPick={handlePick}
        />
      </main>
    </div>
  );
}
