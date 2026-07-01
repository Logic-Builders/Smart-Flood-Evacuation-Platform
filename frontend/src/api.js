import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'http://localhost:8080';

const client = axios.create({ baseURL: API });

export async function getNetwork() {
  const { data } = await client.get('/api/v1/network');
  return data.data;
}

export async function getRoute(start, end) {
  const { data } = await client.post('/api/v1/route', {
    start_lat: start.lat,
    start_lng: start.lng,
    end_lat: end.lat,
    end_lng: end.lng,
  });
  return data.data;
}

export async function getActiveReports() {
  const { data } = await client.get('/api/v1/reports/active');
  return data.data.reports || [];
}

export async function submitReport(report) {
  const { data } = await client.post('/api/v1/reports', report);
  return data;
}

export async function login(username, password) {
  const { data } = await client.post('/auth/login', { username, password });
  return data;
}

export async function getPendingReports(token) {
  const { data } = await client.get('/api/v1/admin/reports/pending', {
    headers: { Authorization: `Bearer ${token}` },
  });
  return data.data.reports || [];
}

export async function approveReport(token, id) {
  await client.patch(`/api/v1/admin/reports/${id}/approve`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function rejectReport(token, id) {
  await client.patch(`/api/v1/admin/reports/${id}/reject`, null, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
