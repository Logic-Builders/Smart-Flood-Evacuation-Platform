// dashboard/src/components/Pages/Map.jsx
import React, { useEffect, useState } from "react";
import { Card, Badge, Button } from "../UI";
import { useToast } from "../../context/ToastContext";
import { getFloodZones, flagArea, broadcastAlert } from "../../api/api"; // ← fixed path
import styles from "./Map.module.css";

const SEVERITY_COLOR = {
  NORMAL:  "var(--accent)",
  WATCH:   "var(--accent3)",
  WARNING: "#ff9500",
  EXTREME: "var(--danger)",
};

const SEVERITY_BADGE = {
  NORMAL:  "default",
  WATCH:   "yellow",
  WARNING: "yellow",
  EXTREME: "red",
};

export default function FloodMap() {
  const { showToast } = useToast();

  const [zones, setZones] = useState([]);
  const [zonesLoading, setZonesLoading] = useState(true);
  const [zonesError, setZonesError] = useState("");

  const [flagSeverity, setFlagSeverity] = useState("WARNING");
  const [flagReason, setFlagReason] = useState("");
  const [flagCoords, setFlagCoords] = useState(
    '[{"latitude":7.8731,"longitude":80.7718}]'
  );
  const [flagging, setFlagging] = useState(false);

  const [alertMessage, setAlertMessage] = useState("");
  const [alertSeverity, setAlertSeverity] = useState("WARNING");
  const [alertCoords, setAlertCoords] = useState(
    '[{"latitude":7.8731,"longitude":80.7718}]'
  );
  const [broadcasting, setBroadcasting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setZonesLoading(true);
        const data = await getFloodZones();
        if (!cancelled) setZones(data);
      } catch (err) {
        if (!cancelled) setZonesError(err.message || "Failed to load flood zones.");
      } finally {
        if (!cancelled) setZonesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const handleFlagArea = async () => {
    if (!flagReason.trim()) {
      showToast("⚠️ Please enter a reason", "var(--accent3)");
      return;
    }
    let parsedCoords;
    try {
      parsedCoords = JSON.parse(flagCoords);
    } catch {
      showToast("❌ Coordinates JSON is invalid", "var(--danger)");
      return;
    }
    setFlagging(true);
    try {
      await flagArea(flagSeverity, flagReason.trim(), parsedCoords);
      showToast("✅ Area flagged successfully", "var(--accent)");
      setFlagReason("");
    } catch (err) {
      showToast(`❌ ${err.message || "Flag area failed"}`, "var(--danger)");
    } finally {
      setFlagging(false);
    }
  };

  const handleBroadcast = async () => {
    if (!alertMessage.trim()) {
      showToast("⚠️ Please enter an alert message", "var(--accent3)");
      return;
    }
    let parsedCoords;
    try {
      parsedCoords = JSON.parse(alertCoords);
    } catch {
      showToast("❌ Region coordinates JSON is invalid", "var(--danger)");
      return;
    }
    setBroadcasting(true);
    try {
      await broadcastAlert(alertMessage.trim(), alertSeverity, parsedCoords);
      showToast("📢 Alert broadcasted!", "var(--danger)");
      setAlertMessage("");
    } catch (err) {
      showToast(`❌ ${err.message || "Broadcast failed"}`, "var(--danger)");
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>Flood Zone Map</h2>

      <Card title="Live Map" title_icon="🗺️">
        <div className={styles.mapContainer} id="leaflet-map">
          <p className={styles.mapPlaceholder}>
            Map renders here — initialise Leaflet and plot zone polygons from the list below.
          </p>
        </div>
      </Card>

      <Card title="Active Flood Zones" title_icon="🌊">
        {zonesLoading && <p className={styles.status}>Loading zones…</p>}
        {zonesError   && <p className={styles.errorMsg}>{zonesError}</p>}
        {!zonesLoading && !zonesError && zones.length === 0 && (
          <p className={styles.status}>No active flood zones reported.</p>
        )}
        {zones.map((zone, i) => (
          <div
            key={zone.id ?? i}
            className={styles.zoneRow}
            style={{ borderLeftColor: SEVERITY_COLOR[zone.severity] ?? "var(--accent)" }}
          >
            <div className={styles.zoneInfo}>
              <span className={styles.zoneName}>{zone.name ?? `Zone ${i + 1}`}</span>
              <Badge variant={SEVERITY_BADGE[zone.severity] ?? "default"}>
                {zone.severity}
              </Badge>
            </div>
            {zone.description && (
              <p className={styles.zoneDesc}>{zone.description}</p>
            )}
          </div>
        ))}
      </Card>

      <Card title="Flag an Area" title_icon="🚩">
        <div className={styles.formGrid}>
          <label className={styles.label}>Severity</label>
          <select
            className={styles.select}
            value={flagSeverity}
            onChange={(e) => setFlagSeverity(e.target.value)}
          >
            <option value="WATCH">WATCH</option>
            <option value="WARNING">WARNING</option>
            <option value="EXTREME">EXTREME</option>
          </select>

          <label className={styles.label}>Reason</label>
          <input
            className={styles.input}
            placeholder="e.g. Dam water release expected at 14:00"
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
          />

          <label className={styles.label}>Boundary Coordinates (JSON)</label>
          <textarea
            className={styles.textarea}
            rows={3}
            value={flagCoords}
            onChange={(e) => setFlagCoords(e.target.value)}
          />
        </div>
        <Button variant="primary" onClick={handleFlagArea} disabled={flagging}>
          {flagging ? "Flagging…" : "🚩 Flag Area"}
        </Button>
      </Card>

      <Card title="Broadcast Alert" title_icon="📢">
        <div className={styles.formGrid}>
          <label className={styles.label}>Message</label>
          <input
            className={styles.input}
            placeholder="e.g. Evacuate immediately — flood imminent"
            value={alertMessage}
            onChange={(e) => setAlertMessage(e.target.value)}
          />

          <label className={styles.label}>Severity</label>
          <select
            className={styles.select}
            value={alertSeverity}
            onChange={(e) => setAlertSeverity(e.target.value)}
          >
            <option value="WATCH">WATCH</option>
            <option value="WARNING">WARNING</option>
            <option value="EXTREME">EXTREME</option>
          </select>

          <label className={styles.label}>Region Coordinates (JSON)</label>
          <textarea
            className={styles.textarea}
            rows={3}
            value={alertCoords}
            onChange={(e) => setAlertCoords(e.target.value)}
          />
        </div>
        <Button variant="reject" onClick={handleBroadcast} disabled={broadcasting}>
          {broadcasting ? "Broadcasting…" : "📢 Broadcast Alert"}
        </Button>
      </Card>
    </div>
  );
}
