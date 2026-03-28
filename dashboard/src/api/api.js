// ============================================================
// src/api/api.js — Central API service for FloodGuard Admin Dashboard
// Base URL: http://localhost:8080
// All admin endpoints require a Bearer token with ADMIN role
// ============================================================

const BASE_URL = "http://localhost:8080";

// --------------- Token helpers ---------------

export const getToken = () => localStorage.getItem("adminToken");

// --------------- Generic request wrapper ---------------

async function request(method, path, body = null) {
  const headers = {
    Authorization: `Bearer ${getToken()}`,
  };
  if (body) headers["Content-Type"] = "application/json";

  const options = { method, headers };
  if (body) options.body = JSON.stringify(body);

  const res = await fetch(`${BASE_URL}${path}`, options);
  const data = await res.json();

  if (!res.ok) {
    const msg =
      data?.message || data?.error || `Error ${res.status}: ${res.statusText}`;
    throw new Error(msg);
  }

  return data;
}

// ================================================================
// 1. AUTH
// ================================================================

/**
 * Login with admin credentials.
 * POST /api/v1/auth/login
 * Stores the JWT token in localStorage automatically.
 */
export async function login(email, password) {
  const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.message || "Login failed");
  }

  const token = data?.data?.token || data?.token;
  if (token) localStorage.setItem("adminToken", token);

  return token;
}

/**
 * Clear stored token (logout).
 */
export function logout() {
  localStorage.removeItem("adminToken");
}

// ================================================================
// 2. REPORT MANAGEMENT
// ================================================================

/** GET /api/v1/admin/reports/pending */
export async function getPendingReports() {
  const data = await request("GET", "/api/v1/admin/reports/pending");
  return data?.data?.reports ?? [];
}

/** PATCH /api/v1/admin/reports/:id/approve */
export async function approveReport(reportId) {
  return request("PATCH", `/api/v1/admin/reports/${reportId}/approve`);
}

/** PATCH /api/v1/admin/reports/:id/reject */
export async function rejectReport(reportId) {
  return request("PATCH", `/api/v1/admin/reports/${reportId}/reject`);
}

// ================================================================
// 3. FLOOD ZONE MANAGEMENT
// ================================================================

/** GET /api/v1/flood-zones */
export async function getFloodZones() {
  const data = await request("GET", "/api/v1/flood-zones");
  return data?.data?.zones ?? data?.data ?? [];
}

/**
 * POST /api/v1/admin/flag-area
 * @param {string} severity    - "WATCH" | "WARNING" | "EXTREME"
 * @param {string} reason      - Human-readable reason
 * @param {Array}  coordinates - Array of { latitude, longitude }
 */
export async function flagArea(severity, reason, coordinates) {
  return request("POST", "/api/v1/admin/flag-area", {
    severity,
    reason,
    boundary: { coordinates },
  });
}

// ================================================================
// 4. ALERT BROADCASTING
// ================================================================

/**
 * POST /api/v1/admin/alerts
 * @param {string} message     - Alert message text
 * @param {string} severity    - "WATCH" | "WARNING" | "EXTREME"
 * @param {Array}  coordinates - Region polygon as { latitude, longitude }[]
 */
export async function broadcastAlert(message, severity, coordinates) {
  return request("POST", "/api/v1/admin/alerts", {
    message,
    severity,
    region: { coordinates },
  });
}

// ================================================================
// 5. USER MANAGEMENT
// ================================================================

/** GET /api/v1/admin/users */
export async function getUsers() {
  const data = await request("GET", "/api/v1/admin/users");
  return data?.data?.users ?? data?.data ?? [];
}