import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Polyline, Marker, Popup, CircleMarker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import {
  getNetwork, getRoute, getActiveReports, submitReport,
  login, getPendingReports, approveReport, rejectReport,
} from './api';

const CENTER = [7.297, 81.672];

const startIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-green.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});
const endIcon = new L.Icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
  iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34], shadowSize: [41, 41],
});

function MapClickHandler({ mode, onPick }) {
  useMapEvents({
    click(e) {
      if (mode) onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
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

  const roadLines = useMemo(() =>
    (network.segments || []).map((s, i) => ({
      key: i,
      positions: [s.start, s.end],
    })), [network]);

  const refresh = useCallback(async () => {
    try {
      const [net, reports] = await Promise.all([getNetwork(), getActiveReports()]);
      setNetwork(net);
      setActiveReports(reports);
    } catch (e) {
      setStatus('Cannot reach API. Start backend on :8080');
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const handlePick = (pt) => {
    if (pickMode === 'start') setStart(pt);
    if (pickMode === 'end') setEnd(pt);
    if (pickMode === 'report') setReportForm((f) => ({ ...f, latitude: pt.lat, longitude: pt.lng }));
    setPickMode(null);
    setStatus(pickMode === 'report' ? 'Report location set on map' : `${pickMode} point set`);
  };

  const calcRoute = async () => {
    if (!start || !end) {
      setStatus('Set start and end points first');
      return;
    }
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
      const pending = await getPendingReports(data.token);
      setPendingReports(pending);
    } catch {
      setStatus('Login failed');
    }
  };

  const loadPending = async () => {
    if (!token) return;
    const pending = await getPendingReports(token);
    setPendingReports(pending);
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
        <p>MVP demo — Ampara District</p>

        <div className="tabs">
          <button className={tab === 'route' ? 'active' : ''} onClick={() => setTab('route')}>Route</button>
          <button className={tab === 'report' ? 'active' : ''} onClick={() => setTab('report')}>Report</button>
          <button className={tab === 'admin' ? 'active' : ''} onClick={() => { setTab('admin'); loadPending(); }}>Admin</button>
        </div>

        {tab === 'route' && (
          <div className="panel">
            <p className="hint">Click buttons then tap map to set points</p>
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
            <div className="status">Lat: {reportForm.latitude.toFixed(4)}, Lng: {reportForm.longitude.toFixed(4)}</div>
            <button className="primary" onClick={sendReport}>Submit Report</button>
          </div>
        )}

        {tab === 'admin' && (
          <div className="panel">
            {!token ? (
              <>
                <div>
                  <label>Username</label>
                  <input value={loginForm.username} onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })} />
                </div>
                <div>
                  <label>Password</label>
                  <input type="password" value={loginForm.password} onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })} />
                </div>
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
                    <small>{r.latitude.toFixed(4)}, {r.longitude.toFixed(4)}</small>
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
        <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '1rem' }}>
          Active hazards on map: {activeReports.length}
        </p>
      </aside>

      <main className="map-wrap">
        <MapContainer center={CENTER} zoom={13} style={{ height: '100%', width: '100%' }}>
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          <MapClickHandler mode={pickMode} onPick={handlePick} />
          {roadLines.map((line) => (
            <Polyline key={line.key} positions={line.positions} color="#64748b" weight={4} opacity={0.7} />
          ))}
          {routeCoords.length > 0 && (
            <Polyline positions={routeCoords} color="#22c55e" weight={6} />
          )}
          {start && <Marker position={[start.lat, start.lng]} icon={startIcon}><Popup>Start</Popup></Marker>}
          {end && <Marker position={[end.lat, end.lng]} icon={endIcon}><Popup>End</Popup></Marker>}
          {activeReports.map((r) => (
            <CircleMarker key={r.id} center={[r.latitude, r.longitude]} radius={10} color="#ef4444" fillColor="#f87171" fillOpacity={0.8}>
              <Popup>{r.report_type} (sev {r.severity})</Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}
