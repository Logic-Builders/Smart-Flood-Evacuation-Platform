import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, Alert,
  ActivityIndicator, StyleSheet, Animated, Platform,
  StatusBar, Modal, ScrollView, Vibration,
} from "react-native";
import MapView, { Marker, Polygon, Polyline, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";
import * as Speech from "expo-speech";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Coord = { latitude: number; longitude: number };

type FloodZone = {
  id: string; gauge_id: string;
  severity: "NORMAL" | "WATCH" | "WARNING" | "EXTREME";
  boundary: { coordinates: Coord[] };
};

type HazardReport = {
  id: string; location: Coord;
  report_type: "FLOODED_ROAD" | "DAMAGED_BRIDGE" | "BLOCKED_ROAD";
  severity: number; description: string; expires_at: string;
};

type NavStep = {
  maneuver: { instruction: string; location: [number, number] };
  distance: number; duration: number;
};

type RouteSegment = { coords: Coord[]; risk: "safe" | "watch" | "warning" | "extreme" };

type RouteOption = {
  label: string; tag: "fastest" | "safest";
  coords: Coord[]; segments: RouteSegment[];
  steps: NavStep[];
  distance: number; duration: number;
  zonesHit: string[];   // gauge_ids of zones this route passes through
  detoured: boolean;    // true = detour waypoints were used
  color: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const BASE_URL      = "http://localhost:8080";
const GOOGLE_BLUE   = "#1a73e8";
const GOOGLE_RED    = "#ea4335";
const GOOGLE_GREEN  = "#34a853";
const GOOGLE_ORANGE = "#ff6d00";
const REFRESH_INTERVAL = 60;
const DETOUR_OFFSET_DEG = 0.008;   // ≈ 800 m in lat/lon degrees
const PROXIMITY_M = 200;           // segment colour proximity to zone boundary

const ZONE_FILL: Record<string, string> = {
  NORMAL: "rgba(52,168,83,0.15)", WATCH: "rgba(251,188,4,0.20)",
  WARNING: "rgba(255,109,0,0.25)", EXTREME: "rgba(234,67,53,0.32)",
};
const ZONE_STROKE: Record<string, string> = {
  NORMAL: "#34a853", WATCH: "#fbbc04", WARNING: "#ff6d00", EXTREME: "#ea4335",
};
const ZONE_LABEL: Record<string, string> = {
  NORMAL: "No Risk", WATCH: "Watch", WARNING: "Warning", EXTREME: "Extreme",
};
const ZONE_BADGE_BG: Record<string, string> = {
  NORMAL: "#e6f4ea", WATCH: "#fef7e0", WARNING: "#fff3e0", EXTREME: "#fce8e6",
};
const ZONE_BADGE_TEXT: Record<string, string> = {
  NORMAL: "#137333", WATCH: "#7d4a00", WARNING: "#b34a00", EXTREME: "#b31412",
};
const SEGMENT_COLOR: Record<RouteSegment["risk"], string> = {
  safe: "#34a853", watch: "#fbbc04", warning: "#ff6d00", extreme: "#ea4335",
};
const HAZARD_ICON:  Record<string, string> = { FLOODED_ROAD: "🌊", DAMAGED_BRIDGE: "🌉", BLOCKED_ROAD: "⚠️" };
const HAZARD_LABEL: Record<string, string> = { FLOODED_ROAD: "Flooded Road", DAMAGED_BRIDGE: "Damaged Bridge", BLOCKED_ROAD: "Blocked Road" };
const HAZARD_COLOR: Record<string, string> = { FLOODED_ROAD: "#1a73e8", DAMAGED_BRIDGE: "#ff6d00", BLOCKED_ROAD: "#ea4335" };
const SEVERITY_ALERT: Record<string, { title: string; message: string; icon: string; bg: string; tc: string }> = {
  WATCH:   { title: "⚡ Flood Watch Active",  message: "Flood conditions are possible. Monitor and be prepared to evacuate.", icon: "👁",  bg: "#fef7e0", tc: "#7d4a00" },
  WARNING: { title: "🚨 Flood Warning",        message: "Flooding expected. Avoid flood-prone areas and move to higher ground.", icon: "🚨", bg: "#fff3e0", tc: "#b34a00" },
  EXTREME: { title: "🆘 EXTREME FLOOD ALERT", message: "Life-threatening flooding. EVACUATE IMMEDIATELY. Do not drive through floodwaters.", icon: "🆘", bg: "#fce8e6", tc: "#b31412" },
};

// ─────────────────────────────────────────────────────────────────────────────
// Mock data
// ─────────────────────────────────────────────────────────────────────────────

const MOCK_ZONES: FloodZone[] = [
  { id: "z1", gauge_id: "LK_KELANI_001", severity: "WARNING",
    boundary: { coordinates: [{ latitude: 7.2870, longitude: 80.6370 }, { latitude: 7.3050, longitude: 80.6370 }, { latitude: 7.3050, longitude: 80.6550 }, { latitude: 7.2870, longitude: 80.6550 }, { latitude: 7.2870, longitude: 80.6370 }] } },
  { id: "z2", gauge_id: "LK_KALU_002", severity: "EXTREME",
    boundary: { coordinates: [{ latitude: 6.9200, longitude: 79.8600 }, { latitude: 6.9380, longitude: 79.8600 }, { latitude: 6.9380, longitude: 79.8780 }, { latitude: 6.9200, longitude: 79.8780 }, { latitude: 6.9200, longitude: 79.8600 }] } },
  { id: "z3", gauge_id: "LK_MAHA_003", severity: "WATCH",
    boundary: { coordinates: [{ latitude: 7.4800, longitude: 80.3600 }, { latitude: 7.4980, longitude: 80.3600 }, { latitude: 7.4980, longitude: 80.3780 }, { latitude: 7.4800, longitude: 80.3780 }, { latitude: 7.4800, longitude: 80.3600 }] } },
];
const MOCK_REPORTS: HazardReport[] = [];

// ─────────────────────────────────────────────────────────────────────────────
// Geometry utilities
// ─────────────────────────────────────────────────────────────────────────────

/** Ray-casting point-in-polygon — handles concave polygons correctly */
function pointInPolygon(pt: Coord, polygon: Coord[]): boolean {
  const { latitude: py, longitude: px } = pt;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const { latitude: yi, longitude: xi } = polygon[i];
    const { latitude: yj, longitude: xj } = polygon[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi)
      inside = !inside;
  }
  return inside;
}

/** Haversine distance in metres */
function distM(a: Coord, b: Coord): number {
  const R = 6_371_000;
  const dLat = ((b.latitude  - a.latitude)  * Math.PI) / 180;
  const dLon = ((b.longitude - a.longitude) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 +
    Math.cos((a.latitude  * Math.PI) / 180) *
    Math.cos((b.latitude  * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

/** Min distance from point to any zone-boundary vertex */
function minDistToZone(pt: Coord, zone: FloodZone): number {
  return Math.min(...zone.boundary.coordinates.map(c => distM(pt, c)));
}

/** All zones whose boundary or interior this route intersects */
function routeIntersectsZones(coords: Coord[], zones: FloodZone[]): FloodZone[] {
  const hits = new Map<string, FloodZone>();
  for (const pt of coords) {
    for (const z of zones) {
      if (z.severity === "NORMAL" || hits.has(z.id)) continue;
      if (pointInPolygon(pt, z.boundary.coordinates)) hits.set(z.id, z);
    }
  }
  return Array.from(hits.values());
}

function computeDetourWaypoints(coords: Coord[], zone: FloodZone): Coord[] {
  const poly = zone.boundary.coordinates;
  let entryIdx = -1, exitIdx = -1;
  for (let i = 0; i < coords.length; i++) {
    if (pointInPolygon(coords[i], poly)) {
      if (entryIdx === -1) entryIdx = i;
      exitIdx = i;
    }
  }
  if (entryIdx === -1) return [];

  const centLat = poly.reduce((s, c) => s + c.latitude,  0) / poly.length;
  const centLon = poly.reduce((s, c) => s + c.longitude, 0) / poly.length;
  const midLat  = (coords[entryIdx].latitude  + coords[exitIdx].latitude)  / 2;
  const midLon  = (coords[entryIdx].longitude + coords[exitIdx].longitude) / 2;
  const dLat = midLat - centLat, dLon = midLon - centLon;
  const len  = Math.sqrt(dLat * dLat + dLon * dLon) || 0.001;
  const norm = { lat: dLat / len, lon: dLon / len };

  const lats = poly.map(c => c.latitude);
  const lons = poly.map(c => c.longitude);
  const halfDiag = Math.sqrt(
    (Math.max(...lats) - Math.min(...lats)) ** 2 +
    (Math.max(...lons) - Math.min(...lons)) ** 2
  ) / 2;
  const offset = halfDiag + DETOUR_OFFSET_DEG;
  const px = -norm.lon, py = norm.lat; // perpendicular

  return [
    { latitude: centLat + norm.lat * offset + px * offset * 0.6, longitude: centLon + norm.lon * offset + py * offset * 0.6 },
    { latitude: centLat + norm.lat * offset - px * offset * 0.6, longitude: centLon + norm.lon * offset - py * offset * 0.6 },
  ];
}

/** Colour each polyline segment by its flood risk */
function colorSegments(coords: Coord[], zones: FloodZone[]): RouteSegment[] {
  if (coords.length < 2) return [];
  const segs: RouteSegment[] = [];
  const riskOrder: Record<string, number> = { safe: 0, watch: 1, warning: 2, extreme: 3 };

  for (let i = 0; i < coords.length - 1; i++) {
    const mid: Coord = {
      latitude:  (coords[i].latitude  + coords[i + 1].latitude)  / 2,
      longitude: (coords[i].longitude + coords[i + 1].longitude) / 2,
    };
    let risk: RouteSegment["risk"] = "safe";
    for (const z of zones) {
      if (z.severity === "NORMAL") continue;
      const r = z.severity.toLowerCase() as RouteSegment["risk"];
      if (pointInPolygon(mid, z.boundary.coordinates) || minDistToZone(mid, z) < PROXIMITY_M) {
        if (riskOrder[r] > riskOrder[risk]) risk = r;
      }
    }
    if (segs.length && segs[segs.length - 1].risk === risk)
      segs[segs.length - 1].coords.push(coords[i + 1]);
    else
      segs.push({ coords: [coords[i], coords[i + 1]], risk });
  }
  return segs;
}

// ─────────────────────────────────────────────────────────────────────────────
// OSRM + safe route builder
// ─────────────────────────────────────────────────────────────────────────────

async function fetchOSRM(waypoints: Coord[]): Promise<any> {
  const wStr = waypoints.map(w => `${w.longitude},${w.latitude}`).join(";");
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${wStr}?overview=full&geometries=geojson&steps=true&alternatives=true`,
    { signal: AbortSignal.timeout(12_000) }
  );
  return res.json();
}

async function buildSafeRoute(
  start: Coord, end: Coord, zones: FloodZone[]
): Promise<{ safest: RouteOption; fastest: RouteOption }> {
  const raw = await fetchOSRM([start, end]);
  if (!raw.routes?.length) throw new Error("No route found. Check your locations.");

  const rawRoute = raw.routes[0];
  const rawCoords: Coord[] = rawRoute.geometry.coordinates.map(
    ([lng, lat]: number[]) => ({ latitude: lat, longitude: lng })
  );

  const hitZones = routeIntersectsZones(rawCoords, zones);

  let safestCoords = rawCoords;
  let safestSteps: NavStep[] = rawRoute.legs[0].steps;
  let safestDist  = rawRoute.distance as number;
  let safestDur   = rawRoute.duration as number;
  let didDetour   = false;

  if (hitZones.length > 0) {
    // Gather all detour waypoints
    const rawDetour: Coord[] = [];
    for (const z of hitZones) rawDetour.push(...computeDetourWaypoints(rawCoords, z));

    // Deduplicate (avoid waypoints within 300 m of each other)
    const deduped: Coord[] = [];
    for (const wp of rawDetour)
      if (!deduped.some(d => distM(d, wp) < 300)) deduped.push(wp);

    try {
      const detoured = await fetchOSRM([start, ...deduped, end]);
      if (detoured.routes?.length) {
        const dr = detoured.routes[0];
        safestCoords = dr.geometry.coordinates.map(([lng, lat]: number[]) => ({ latitude: lat, longitude: lng }));
        safestSteps  = dr.legs.flatMap((l: any) => l.steps);
        safestDist   = dr.distance;
        safestDur    = dr.duration;
        didDetour    = true;
      }
    } catch (_) { /* fall back to raw */ }
  }

  const safestHits = routeIntersectsZones(safestCoords, zones);

  const safest: RouteOption = {
    label: didDetour ? "Flood-Avoiding Route" : "Safe Route",
    tag: "safest", color: GOOGLE_GREEN,
    coords: safestCoords, segments: colorSegments(safestCoords, zones),
    steps: safestSteps, distance: safestDist, duration: safestDur,
    zonesHit: safestHits.map(z => z.gauge_id), detoured: didDetour,
  };

  const fastest: RouteOption = {
    label: "Fastest Route", tag: "fastest",
    color: hitZones.length ? GOOGLE_ORANGE : GOOGLE_BLUE,
    coords: rawCoords, segments: colorSegments(rawCoords, zones),
    steps: rawRoute.legs[0].steps, distance: rawRoute.distance, duration: rawRoute.duration,
    zonesHit: hitZones.map(z => z.gauge_id), detoured: false,
  };

  return { safest, fastest };
}

// Helpers
const fmtDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
const fmtTime = (s: number) => { const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60); return h > 0 ? `${h}h ${m}m` : `${m} min`; };
const sevColor = (n: number) => n >= 5 ? "#ea4335" : n >= 4 ? "#ff6d00" : n >= 3 ? "#fbbc04" : "#34a853";

// ─────────────────────────────────────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────────────────────────────────────

const SearchModal = React.memo(({ visible, onClose, startText, endText, onStartChange, onEndChange, onGetRoute, loadingRoute }: {
  visible: boolean; onClose: () => void; startText: string; endText: string;
  onStartChange: (t: string) => void; onEndChange: (t: string) => void;
  onGetRoute: () => void; loadingRoute: boolean;
}) => {
  const [activeField, setActiveField] = useState<"start" | "end">("end");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const debRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<TextInput>(null);
  const endRef   = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setTimeout(() => endRef.current?.focus(), 280);
    else setSuggestions([]);
  }, [visible]);

  const query = useCallback((text: string, field: "start" | "end") => {
    if (debRef.current) clearTimeout(debRef.current);
    if (text.length < 2) { setSuggestions([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=lk&limit=6`,
          { headers: { "User-Agent": "FloodEvacApp/1.0" } }
        );
        setSuggestions((await r.json()).map((s: any) => ({ ...s, _field: field })));
      } catch {}
    }, 300);
  }, []);

  const pick = (item: any) => {
    setSuggestions([]);
    if (item._field === "start") onStartChange(item.display_name);
    else onEndChange(item.display_name);
  };

  if (!visible) return null;
  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <View style={sm.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <View style={sm.header}>
          <TouchableOpacity style={sm.backBtn} onPress={onClose}><Text style={sm.backIcon}>←</Text></TouchableOpacity>
          <Text style={sm.headerTitle}>Plan Safe Route</Text>
        </View>
        <View style={sm.fieldsCard}>
          <View style={sm.connectorCol}>
            <View style={sm.dotA} /><View style={sm.connLine} /><View style={sm.dotB} />
          </View>
          <View style={sm.fieldsCol}>
            <TouchableOpacity style={[sm.field, activeField === "start" && sm.fieldActive]} activeOpacity={1}
              onPress={() => { setActiveField("start"); startRef.current?.focus(); }}>
              <TextInput ref={startRef} style={sm.fieldInput} placeholder="Starting point" placeholderTextColor="#adb5bd"
                value={startText} onFocus={() => { setActiveField("start"); setSuggestions([]); }}
                onChangeText={(t: string) => { onStartChange(t); query(t, "start"); }}
                returnKeyType="next" onSubmitEditing={() => endRef.current?.focus()} />
              {startText.length > 0 && <TouchableOpacity onPress={() => { onStartChange(""); setSuggestions([]); }} hitSlop={{ top:10,bottom:10,left:10,right:10 }}><Text style={sm.clearIcon}>✕</Text></TouchableOpacity>}
            </TouchableOpacity>
            <View style={sm.fieldGap} />
            <TouchableOpacity style={[sm.field, activeField === "end" && sm.fieldActive]} activeOpacity={1}
              onPress={() => { setActiveField("end"); endRef.current?.focus(); }}>
              <TextInput ref={endRef} style={sm.fieldInput} placeholder="Destination" placeholderTextColor="#adb5bd"
                value={endText} onFocus={() => { setActiveField("end"); setSuggestions([]); }}
                onChangeText={(t: string) => { onEndChange(t); query(t, "end"); }}
                returnKeyType="search" onSubmitEditing={() => { onClose(); onGetRoute(); }} />
              {endText.length > 0 && <TouchableOpacity onPress={() => { onEndChange(""); setSuggestions([]); }} hitSlop={{ top:10,bottom:10,left:10,right:10 }}><Text style={sm.clearIcon}>✕</Text></TouchableOpacity>}
            </TouchableOpacity>
          </View>
        </View>
        <ScrollView style={sm.suggList} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {suggestions.length > 0 ? (
            <View style={sm.suggSection}>
              <Text style={sm.suggLabel}>{activeField === "start" ? "📍 Start" : "🏁 Destination"} suggestions</Text>
              {suggestions.slice(0, 6).map((item: any, idx: number) => (
                <TouchableOpacity key={item.place_id ?? idx} style={sm.suggRow} onPress={() => pick(item)} activeOpacity={0.7}>
                  <View style={sm.suggIcon}><Text style={{ fontSize: 15 }}>{item._field === "start" ? "🔵" : "🔴"}</Text></View>
                  <View style={sm.suggTextCol}>
                    <Text style={sm.suggMain} numberOfLines={1}>{item.display_name.split(",")[0]}</Text>
                    <Text style={sm.suggSub}  numberOfLines={1}>{item.display_name.split(",").slice(1).join(",").trim()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={sm.quickActions}>
              <Text style={sm.quickLabel}>QUICK SELECT</Text>
              {[
                { icon: "🏥", label: "Nearest Hospital",  val: "Hospital Colombo" },
                { icon: "🏫", label: "Emergency Shelter", val: "Emergency Shelter Sri Lanka" },
                { icon: "🚒", label: "Fire Station",       val: "Fire Station Colombo" },
                { icon: "🏛",  label: "Police Station",    val: "Police Station Colombo" },
              ].map(q => (
                <TouchableOpacity key={q.label} style={sm.quickRow} onPress={() => onEndChange(q.val)} activeOpacity={0.7}>
                  <View style={sm.quickIconBox}><Text style={{ fontSize: 20 }}>{q.icon}</Text></View>
                  <Text style={sm.quickText}>{q.label}</Text>
                  <Text style={sm.quickArrow}>›</Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
        <View style={sm.footer}>
          <TouchableOpacity style={[sm.routeBtn, (!startText || !endText || loadingRoute) && sm.routeBtnDisabled]}
            onPress={() => { onClose(); onGetRoute(); }} disabled={!startText || !endText || loadingRoute}>
            {loadingRoute ? <ActivityIndicator color="#fff" size="small" /> :
              <><Text style={sm.routeBtnIcon}>🛡</Text><Text style={sm.routeBtnText}>Get Safe Route</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

const RouteAlternativesSheet = ({ visible, options, selectedIdx, onSelect, onConfirm, onClose }: {
  visible: boolean; options: RouteOption[]; selectedIdx: number;
  onSelect: (i: number) => void; onConfirm: () => void; onClose: () => void;
}) => {
  const slideY = useRef(new Animated.Value(500)).current;
  useEffect(() => {
    Animated.spring(slideY, { toValue: visible ? 0 : 500, useNativeDriver: true, tension: 68, friction: 12 }).start();
  }, [visible]);
  return (
    <Animated.View style={[ra.sheet, { transform: [{ translateY: slideY }] }]}>
      <View style={ra.handle} />
      <Text style={ra.title}>Choose Your Route</Text>
      {options.map((opt, i) => (
        <TouchableOpacity key={`${opt.tag}-${i}`}
          style={[ra.card, selectedIdx === i && { borderColor: opt.color, borderWidth: 2.5 }]}
          onPress={() => onSelect(i)} activeOpacity={0.85}>
          <View style={[ra.cardTag, { backgroundColor: opt.color }]}>
            <Text style={ra.cardTagText}>
              {opt.tag === "safest" ? "🛡 SAFEST" : opt.zonesHit.length ? "⚡ FASTEST (RISK)" : "⚡ FASTEST"}
            </Text>
          </View>
          <View style={ra.cardBody}>
            <View style={ra.cardStats}>
              <View style={ra.cardStat}><Text style={ra.cardStatVal}>{fmtTime(opt.duration)}</Text><Text style={ra.cardStatLbl}>ETA</Text></View>
              <View style={ra.cardDivider} />
              <View style={ra.cardStat}><Text style={ra.cardStatVal}>{fmtDist(opt.distance)}</Text><Text style={ra.cardStatLbl}>Distance</Text></View>
              <View style={ra.cardDivider} />
              <View style={ra.cardStat}>
                <Text style={[ra.cardStatVal, { color: opt.zonesHit.length ? "#ea4335" : "#34a853" }]}>{opt.zonesHit.length}</Text>
                <Text style={ra.cardStatLbl}>Flood zones</Text>
              </View>
            </View>
            {opt.detoured && <View style={[ra.badge, { backgroundColor: "#e6f4ea" }]}><Text style={[ra.badgeTxt, { color: "#137333" }]}>🛡 Rerouted around {options.find(o => o.tag === "fastest")?.zonesHit.length ?? 0} flood zone(s)</Text></View>}
            {!opt.detoured && opt.zonesHit.length > 0 && <View style={[ra.badge, { backgroundColor: "#fce8e6" }]}><Text style={[ra.badgeTxt, { color: "#b31412" }]}>⚠️ Passes through {opt.zonesHit.length} flood zone(s)</Text></View>}
          </View>
          {selectedIdx === i && <View style={[ra.selectedDot, { backgroundColor: opt.color }]}><Text style={{ color: "#fff", fontSize: 11, fontWeight: "800" }}>✓</Text></View>}
        </TouchableOpacity>
      ))}
      <View style={ra.footer}>
        <TouchableOpacity style={ra.cancelBtn} onPress={onClose}><Text style={ra.cancelTxt}>Cancel</Text></TouchableOpacity>
        <TouchableOpacity style={ra.confirmBtn} onPress={onConfirm}><Text style={ra.confirmTxt}>▶ Start This Route</Text></TouchableOpacity>
      </View>
    </Animated.View>
  );
};

const FloodAlertPopup = ({ zone, onDismiss }: { zone: FloodZone | null; onDismiss: () => void }) => {
  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (zone) {
      Animated.parallel([
        Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      if (zone.severity === "EXTREME") Vibration.vibrate([0, 200, 100, 200, 100, 300]);
    } else { scale.setValue(0.85); opacity.setValue(0); }
  }, [zone]);
  if (!zone || zone.severity === "NORMAL") return null;
  const cfg = SEVERITY_ALERT[zone.severity];
  return (
    <Modal transparent visible animationType="none">
      <View style={ap.overlay}>
        <Animated.View style={[ap.card, { backgroundColor: cfg.bg, opacity, transform: [{ scale }] }]}>
          <Text style={ap.icon}>{cfg.icon}</Text>
          <Text style={[ap.title, { color: cfg.tc }]}>{cfg.title}</Text>
          <Text style={[ap.message, { color: cfg.tc }]}>{cfg.message}</Text>
          <View style={ap.meta}><Text style={[ap.metaTxt, { color: cfg.tc }]}>Gauge: {zone.gauge_id}</Text></View>
          <TouchableOpacity style={[ap.btn, { borderColor: cfg.tc }]} onPress={onDismiss}>
            <Text style={[ap.btnTxt, { color: cfg.tc }]}>I Understand</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

const ReroutingOverlay = ({ visible }: { visible: boolean }) => {
  if (!visible) return null;
  return (
    <View style={ov.overlay}>
      <View style={ov.card}>
        <ActivityIndicator size="large" color={GOOGLE_BLUE} />
        <Text style={ov.title}>Rerouting…</Text>
        <Text style={ov.sub}>Flood zone detected ahead. Finding a safe path.</Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main MapScreen
// ─────────────────────────────────────────────────────────────────────────────

const TOP = Platform.OS === "ios" ? 54 : 38;

export default function MapScreen() {
  const [startText, setStartText]         = useState("");
  const [endText, setEndText]             = useState("");
  const [searchOpen, setSearchOpen]       = useState(false);
  const [floodZones, setFloodZones]       = useState<FloodZone[]>([]);
  const [hazardReports, setHazardReports] = useState<HazardReport[]>([]);
  const [userCoord, setUserCoord]         = useState<Coord | null>(null);
  const [loadingRoute, setLoadingRoute]   = useState(false);
  const [rerouting, setRerouting]         = useState(false);
  const [routeOptions, setRouteOptions]   = useState<RouteOption[]>([]);
  const [selectedIdx, setSelectedIdx]     = useState(0);
  const [showAlts, setShowAlts]           = useState(false);
  const [activeOption, setActiveOption]   = useState<RouteOption | null>(null);
  const [steps, setSteps]                 = useState<NavStep[]>([]);
  const [stepIdx, setStepIdx]             = useState(0);
  const [navigating, setNavigating]       = useState(false);
  const [voiceEnabled, setVoiceEnabled]   = useState(true);
  const [activeReport, setActiveReport]   = useState<HazardReport | null>(null);
  const [legendOpen, setLegendOpen]       = useState(false);
  const [alertZone, setAlertZone]         = useState<FloodZone | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL);

  const mapRef       = useRef<MapView>(null);
  const navRef       = useRef(false);
  const stepRef      = useRef(0);
  const spokenStep   = useRef(-1);
  const endCoordRef  = useRef<Coord | null>(null);
  const zonesRef     = useRef<FloodZone[]>([]);
  const rerouteGuard = useRef(false);

  const [region, setRegion] = useState({ latitude: 7.8731, longitude: 80.7718, latitudeDelta: 0.8, longitudeDelta: 0.8 });

  const sheetY   = useRef(new Animated.Value(440)).current;
  const navBarY  = useRef(new Animated.Value(-160)).current;
  const cardY    = useRef(new Animated.Value(440)).current;
  const legendOp = useRef(new Animated.Value(0)).current;
  const legendY  = useRef(new Animated.Value(10)).current;

  useEffect(() => { zonesRef.current = floodZones; }, [floodZones]);

  useEffect(() => { bootLocation(); loadFloodZones(); loadHazardReports(); }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setRefreshCountdown((p: number) => { if (p <= 1) { loadFloodZones(); loadHazardReports(); return REFRESH_INTERVAL; } return p - 1; });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const severe = floodZones.find((z: FloodZone) => z.severity === "EXTREME" || z.severity === "WARNING");
    if (severe) setTimeout(() => setAlertZone(severe), 1200);
  }, [floodZones]);

  useEffect(() => { Animated.spring(sheetY, { toValue: activeOption && !showAlts ? 0 : 440, useNativeDriver: true, tension: 68, friction: 11 }).start(); }, [activeOption, showAlts]);
  useEffect(() => { Animated.spring(navBarY, { toValue: navigating ? 0 : -160, useNativeDriver: true, tension: 68, friction: 11 }).start(); }, [navigating]);
  useEffect(() => { Animated.spring(cardY, { toValue: activeReport ? 0 : 440, useNativeDriver: true, tension: 68, friction: 11 }).start(); }, [activeReport]);
  useEffect(() => {
    Animated.parallel([
      Animated.timing(legendOp, { toValue: legendOpen ? 1 : 0, duration: 180, useNativeDriver: true }),
      Animated.spring(legendY,  { toValue: legendOpen ? 0 : 10, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, [legendOpen]);

  useEffect(() => { stepRef.current = stepIdx; }, [stepIdx]);
  useEffect(() => { navRef.current  = navigating; }, [navigating]);

  // ── Location watcher ──────────────────────────────────────────────────────
  const bootLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") { Alert.alert("Permission needed", "Enable location for safe routing."); return; }
    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const c: Coord = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
    setUserCoord(c);
    setRegion({ ...c, latitudeDelta: 0.08, longitudeDelta: 0.08 });

    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 8 }, async (loc: Location.LocationObject) => {
      const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserCoord(coord);
      if (!navRef.current) return;

      mapRef.current?.animateCamera({ center: coord, zoom: 17, heading: loc.coords.heading ?? 0, pitch: 45 }, { duration: 700 });

      setSteps((prev: NavStep[]) => {
        if (!prev.length) return prev;
        const i = stepRef.current;
        const st = prev[i];
        if (!st) return prev;
        const nxt: Coord = { latitude: st.maneuver.location[1], longitude: st.maneuver.location[0] };
        if (distM(coord, nxt) < 50 && i < prev.length - 1) {
          const ni = i + 1;
          stepRef.current = ni; setStepIdx(ni);
          if (voiceEnabled && spokenStep.current !== ni) {
            spokenStep.current = ni;
            const instr = prev[ni]?.maneuver?.instruction;
            if (instr) Speech.speak(instr, { language: "en", rate: 0.9, pitch: 1.0 });
          }
        }
        if (i === prev.length - 1 && distM(coord, nxt) < 30) {
          Speech.speak("You have arrived at your destination. Stay safe!", { language: "en" });
          Alert.alert("🎉 Arrived!", "You reached your destination safely.");
          navRef.current = false; setNavigating(false); setActiveOption(null); setSteps([]);
        }
        return prev;
      });

      // ── Live flood detection & auto-reroute ──────────────────────────
      if (rerouteGuard.current || !endCoordRef.current) return;
      const zones = zonesRef.current;
      const inFlood = zones.some((z: FloodZone) => z.severity !== "NORMAL" && pointInPolygon(coord, z.boundary.coordinates));
      if (inFlood) {
        rerouteGuard.current = true;
        setRerouting(true);
        if (voiceEnabled) Speech.speak("Flood zone detected. Rerouting to a safer path.", { language: "en" });
        try {
          const { safest } = await buildSafeRoute(coord, endCoordRef.current, zones);
          setActiveOption(safest); setSteps(safest.steps); setStepIdx(0);
          stepRef.current = 0; spokenStep.current = -1;
          mapRef.current?.fitToCoordinates(safest.coords, { edgePadding: { top: 160, right: 40, bottom: 380, left: 40 }, animated: true });
        } catch (_) { Alert.alert("Reroute failed", "Could not find a safe alternative route."); }
        setRerouting(false);
        setTimeout(() => { rerouteGuard.current = false; }, 30_000);
      }
    });
  };

  // ── API ───────────────────────────────────────────────────────────────────
  const loadFloodZones = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/v1/flood-zones`, { signal: AbortSignal.timeout(5000) });
      const json = await res.json();
      if (json.success && json.data?.zones?.length) { setFloodZones(json.data.zones); setRefreshCountdown(REFRESH_INTERVAL); return; }
    } catch (_) {}
    setFloodZones(MOCK_ZONES); setRefreshCountdown(REFRESH_INTERVAL);
  };

  const loadHazardReports = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/v1/reports/active`, { signal: AbortSignal.timeout(5000) });
      const json = await res.json();
      if (json.success && json.data?.reports?.length) { setHazardReports(json.data.reports); return; }
    } catch (_) {}
    setHazardReports(MOCK_REPORTS);
  };

  // ── Route planning ────────────────────────────────────────────────────────
  const getRoute = async () => {
    if (!startText || !endText) return Alert.alert("Incomplete", "Enter both start and destination.");
    setLoadingRoute(true); setSearchOpen(false);
    try {
      const [sArr, eArr] = await Promise.all([Location.geocodeAsync(startText), Location.geocodeAsync(endText)]);
      if (!sArr.length || !eArr.length) throw new Error("Locations not found.");
      const startC: Coord = { latitude: sArr[0].latitude, longitude: sArr[0].longitude };
      const endC:   Coord = { latitude: eArr[0].latitude, longitude: eArr[0].longitude };
      endCoordRef.current = endC;
      const { safest, fastest } = await buildSafeRoute(startC, endC, floodZones);
      setRouteOptions([safest, fastest]);
      setSelectedIdx(0); setShowAlts(true); setActiveOption(safest);
      mapRef.current?.fitToCoordinates(safest.coords, { edgePadding: { top: 160, right: 40, bottom: 480, left: 40 }, animated: true });
    } catch (e: any) { Alert.alert("Route Error", e.message ?? "Could not get route."); }
    setLoadingRoute(false);
  };

  const previewRoute = (i: number) => {
    setSelectedIdx(i);
    const opt = routeOptions[i]; if (!opt) return;
    setActiveOption(opt);
    mapRef.current?.fitToCoordinates(opt.coords, { edgePadding: { top: 160, right: 40, bottom: 480, left: 40 }, animated: true });
  };

  const confirmRoute = () => {
    const opt = routeOptions[selectedIdx]; if (!opt) return;
    setActiveOption(opt); setSteps(opt.steps); setStepIdx(0); stepRef.current = 0;
    setShowAlts(false); setNavigating(false);
    mapRef.current?.fitToCoordinates(opt.coords, { edgePadding: { top: 160, right: 40, bottom: 400, left: 40 }, animated: true });
  };

  const startNav = () => {
    if (!userCoord) { Alert.alert("No GPS", "Waiting for location."); return; }
    spokenStep.current = -1; rerouteGuard.current = false;
    navRef.current = true; setNavigating(true);
    mapRef.current?.animateCamera({ center: userCoord, zoom: 17, pitch: 45 }, { duration: 900 });
    if (voiceEnabled && steps[0]) Speech.speak(`Starting navigation. ${steps[0].maneuver.instruction}`, { language: "en", rate: 0.9 });
  };

  const stopNav = () => {
    navRef.current = false; setNavigating(false); Speech.stop();
    if (activeOption?.coords.length)
      mapRef.current?.fitToCoordinates(activeOption.coords, { edgePadding: { top: 160, right: 40, bottom: 400, left: 40 }, animated: true });
  };

  const clearAll = () => {
    setActiveOption(null); setSteps([]); navRef.current = false; setNavigating(false);
    stepRef.current = 0; setStepIdx(0); setStartText(""); setEndText("");
    setRouteOptions([]); setShowAlts(false); endCoordRef.current = null; Speech.stop();
  };

  const goToUser = () => { if (userCoord) mapRef.current?.animateCamera({ center: userCoord, zoom: 16 }, { duration: 600 }); };

  const curInstruction = steps[stepIdx]?.maneuver?.instruction ?? "Follow the route";
  const nxtInstruction = steps[stepIdx + 1]?.maneuver?.instruction ?? "";
  const progress = steps.length ? (stepIdx + 1) / steps.length : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={g.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      <MapView ref={mapRef} style={StyleSheet.absoluteFill} provider={PROVIDER_DEFAULT}
        region={region} onRegionChangeComplete={setRegion}
        showsUserLocation showsCompass={false} showsMyLocationButton={false}
        onPress={() => { setActiveReport(null); setLegendOpen(false); }}>
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />

        {/* Flood zone polygons */}
        {floodZones.map((z: FloodZone) => (
          <Polygon key={z.id} coordinates={z.boundary.coordinates}
            fillColor={ZONE_FILL[z.severity]} strokeColor={ZONE_STROKE[z.severity]} strokeWidth={2.5} />
        ))}

        {/* Dim inactive route alternatives */}
        {showAlts && routeOptions.map((opt: RouteOption, i: number) =>
          i !== selectedIdx && opt.coords.length > 0 ? (
            <Polyline key={`dim-${i}`} coordinates={opt.coords}
              strokeColor="rgba(130,130,130,0.28)" strokeWidth={5} lineCap="round" />
          ) : null
        )}

        {/* Active route — colour-coded segments */}
        {activeOption?.segments.map((seg: RouteSegment, i: number) => (
          <React.Fragment key={`seg-${i}`}>
            <Polyline coordinates={seg.coords} strokeColor={`${SEGMENT_COLOR[seg.risk]}28`} strokeWidth={18} lineCap="round" />
            <Polyline coordinates={seg.coords} strokeColor={SEGMENT_COLOR[seg.risk]} strokeWidth={6} lineCap="round" lineJoin="round" />
          </React.Fragment>
        ))}

        {/* Hazard pins */}
        {hazardReports.map((r: HazardReport) => (
          <Marker key={r.id} coordinate={r.location} anchor={{ x: 0.5, y: 1 }} onPress={() => setActiveReport(r)}>
            <View style={[g.hazPin, { borderColor: HAZARD_COLOR[r.report_type] }]}>
              <Text style={g.hazPinIcon}>{HAZARD_ICON[r.report_type]}</Text>
              <View style={[g.hazPinTail, { backgroundColor: HAZARD_COLOR[r.report_type] }]} />
            </View>
          </Marker>
        ))}
      </MapView>

      <ReroutingOverlay visible={rerouting} />

      {/* Navigation top bar */}
      <Animated.View style={[g.navBar, { transform: [{ translateY: navBarY }] }]}>
        <View style={g.navBarInner}>
          <View style={g.navDirBox}><Text style={g.navDirArrow}>↑</Text></View>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={g.navInstText} numberOfLines={1}>{curInstruction}</Text>
            {!!nxtInstruction && <Text style={g.navNextText} numberOfLines={1}>then: {nxtInstruction}</Text>}
          </View>
          <TouchableOpacity style={g.voiceBtn} onPress={() => { setVoiceEnabled((v: boolean) => !v); if (voiceEnabled) Speech.stop(); }}>
            <Text style={g.voiceBtnIcon}>{voiceEnabled ? "🔊" : "🔇"}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={g.navExitBtn} onPress={stopNav}>
            <Text style={g.navExitIcon}>✕</Text>
          </TouchableOpacity>
        </View>
        <View style={g.navProgress}><View style={[g.navProgressFill, { width: `${Math.round(progress * 100)}%` as any }]} /></View>
      </Animated.View>

      {/* Top search / route bar */}
      {!navigating && (
        <View style={g.topBar} pointerEvents="box-none">
          {!activeOption && !showAlts ? (
            <TouchableOpacity style={g.searchPill} onPress={() => setSearchOpen(true)} activeOpacity={0.92}>
              <View style={g.searchPillIcon}><Text style={{ fontSize: 16 }}>🔍</Text></View>
              <Text style={g.searchPillText}>Where to?</Text>
              {userCoord && <View style={g.gpsDot} />}
            </TouchableOpacity>
          ) : (
            <View style={g.routeBar}>
              <View style={g.routeBarLeft}>
                <Text style={g.routeBarDest} numberOfLines={1}>{endText}</Text>
                <Text style={g.routeBarMeta}>{activeOption ? `${fmtTime(activeOption.duration)}  ·  ${fmtDist(activeOption.distance)}` : "Calculating…"}</Text>
              </View>
              <TouchableOpacity style={g.routeBarClear} onPress={clearAll}><Text style={g.routeBarClearTxt}>✕ Clear</Text></TouchableOpacity>
            </View>
          )}
          <View style={g.refreshChip} pointerEvents="none">
            <View style={[g.refreshDot, { backgroundColor: refreshCountdown > 10 ? GOOGLE_GREEN : GOOGLE_ORANGE }]} />
            <Text style={g.refreshTxt}>Refresh in {refreshCountdown}s</Text>
          </View>
        </View>
      )}

      <SearchModal visible={searchOpen} onClose={() => setSearchOpen(false)}
        startText={startText} endText={endText}
        onStartChange={setStartText} onEndChange={setEndText}
        onGetRoute={getRoute} loadingRoute={loadingRoute} />

      <RouteAlternativesSheet visible={showAlts} options={routeOptions}
        selectedIdx={selectedIdx} onSelect={previewRoute}
        onConfirm={confirmRoute} onClose={() => { setShowAlts(false); clearAll(); }} />

      <FloodAlertPopup zone={alertZone} onDismiss={() => setAlertZone(null)} />

      {!navigating && (
        <View style={g.fabs}>
          <TouchableOpacity style={g.fab} onPress={() => setLegendOpen(!legendOpen)}><Text style={g.fabIcon}>🗂</Text></TouchableOpacity>
          <TouchableOpacity style={g.fab} onPress={goToUser}><Text style={[g.fabIcon, { color: GOOGLE_BLUE, fontSize: 24 }]}>◎</Text></TouchableOpacity>
        </View>
      )}

      <Animated.View style={[g.legend, { opacity: legendOp, transform: [{ translateY: legendY }] }]} pointerEvents={legendOpen ? "auto" : "none"}>
        <Text style={g.legendHeader}>FLOOD ZONES</Text>
        {Object.entries(ZONE_LABEL).map(([k, v]) => (
          <View key={k} style={g.legendRow}>
            <View style={[g.legendDot, { backgroundColor: ZONE_STROKE[k] }]} />
            <Text style={g.legendTxt}>{v}</Text>
            <View style={[g.legendChip, { backgroundColor: ZONE_BADGE_BG[k] }]}><Text style={[g.legendChipTxt, { color: ZONE_BADGE_TEXT[k] }]}>{k}</Text></View>
          </View>
        ))}
        <View style={g.legendSep} />
        <Text style={g.legendHeader}>ROUTE COLOUR</Text>
        {(Object.entries(SEGMENT_COLOR) as [RouteSegment["risk"], string][]).map(([k, col]) => (
          <View key={k} style={g.legendRow}>
            <View style={[g.legendDot, { backgroundColor: col, borderRadius: 2 }]} />
            <Text style={g.legendTxt}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
          </View>
        ))}
        <View style={g.legendSep} />
        <Text style={g.legendHeader}>HAZARDS</Text>
        {Object.entries(HAZARD_ICON).map(([k, ic]) => (
          <View key={k} style={g.legendRow}>
            <Text style={{ fontSize: 15, width: 22 }}>{ic}</Text>
            <Text style={g.legendTxt}>{HAZARD_LABEL[k]}</Text>
          </View>
        ))}
      </Animated.View>

      {/* Bottom sheet */}
      <Animated.View style={[g.sheet, { transform: [{ translateY: sheetY }] }]}>
        {activeOption && !showAlts && (<>
          <View style={g.sheetHandle} />
          {activeOption.detoured ? (
            <View style={[g.statusBanner, { backgroundColor: "#e6f4ea" }]}>
              <Text style={g.statusIcon}>🛡</Text>
              <Text style={[g.statusText, { color: "#137333" }]}>Flood-safe route — avoids {routeOptions.find((o: RouteOption) => o.tag === "fastest")?.zonesHit.length ?? 0} zone(s)</Text>
            </View>
          ) : activeOption.zonesHit.length > 0 ? (
            <View style={[g.statusBanner, { backgroundColor: "#fce8e6" }]}>
              <Text style={g.statusIcon}>⚠️</Text>
              <Text style={[g.statusText, { color: "#b31412" }]}>Caution — passes through {activeOption.zonesHit.length} flood zone(s)</Text>
            </View>
          ) : (
            <View style={[g.statusBanner, { backgroundColor: "#e6f4ea" }]}>
              <Text style={g.statusIcon}>✅</Text>
              <Text style={[g.statusText, { color: "#137333" }]}>Route is clear of all flood zones</Text>
            </View>
          )}
          <View style={g.statsRow}>
            <View style={g.stat}><Text style={g.statVal}>{fmtTime(activeOption.duration)}</Text><Text style={g.statLbl}>ETA</Text></View>
            <View style={g.statDivider} />
            <View style={g.stat}><Text style={g.statVal}>{fmtDist(activeOption.distance)}</Text><Text style={g.statLbl}>Distance</Text></View>
            <View style={g.statDivider} />
            <View style={g.stat}>
              <Text style={[g.statVal, { color: activeOption.zonesHit.length ? "#ea4335" : "#34a853" }]}>{activeOption.zonesHit.length}</Text>
              <Text style={g.statLbl}>Flood zones</Text>
            </View>
          </View>
          <View style={g.instrRow}>
            <View style={g.instrArrowBox}><Text style={g.instrArrow}>↑</Text></View>
            <Text style={g.instrText} numberOfLines={2}>{curInstruction}</Text>
            <TouchableOpacity style={[g.voiceToggle, voiceEnabled && g.voiceToggleActive]} onPress={() => setVoiceEnabled((v: boolean) => !v)}>
              <Text style={{ fontSize: 17 }}>{voiceEnabled ? "🔊" : "🔇"}</Text>
            </TouchableOpacity>
          </View>
          {!navigating ? (
            <TouchableOpacity style={g.ctaBtn} onPress={startNav}><Text style={g.ctaBtnText}>▶  Start Navigation</Text></TouchableOpacity>
          ) : (
            <View style={g.activeNavRow}>
              <View style={{ flex: 1 }}>
                <View style={g.progressTrack}><View style={[g.progressFill, { width: `${Math.round(progress * 100)}%` as any }]} /></View>
                <View style={g.progressLabels}>
                  <Text style={g.progressLbl}>Step {stepIdx + 1} / {steps.length}</Text>
                  <Text style={g.progressLbl}>{Math.round(progress * 100)}%</Text>
                </View>
              </View>
              <TouchableOpacity style={g.stopBtn} onPress={stopNav}><Text style={g.stopBtnText}>Stop</Text></TouchableOpacity>
            </View>
          )}
        </>)}
      </Animated.View>

      {/* Hazard detail card */}
      <Animated.View style={[g.hazCard, { transform: [{ translateY: cardY }] }]}>
        {activeReport && (<>
          <View style={g.hazCardHandle} />
          <View style={g.hazCardHeader}>
            <View style={[g.hazCardIconBox, { backgroundColor: `${HAZARD_COLOR[activeReport.report_type]}18` }]}>
              <Text style={{ fontSize: 28 }}>{HAZARD_ICON[activeReport.report_type]}</Text>
            </View>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={g.hazCardTitle}>{HAZARD_LABEL[activeReport.report_type]}</Text>
              <Text style={g.hazCardCoord}>{activeReport.location.latitude.toFixed(4)}, {activeReport.location.longitude.toFixed(4)}</Text>
            </View>
            <View style={[g.sevChip, { backgroundColor: sevColor(activeReport.severity) }]}>
              <Text style={g.sevChipTxt}>SEV {activeReport.severity}</Text>
            </View>
          </View>
          <Text style={g.hazCardDesc}>{activeReport.description}</Text>
          <View style={g.hazCardFooter}>
            <Text style={g.hazCardExpiry}>⏱ Expires {new Date(activeReport.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
            <TouchableOpacity style={g.dismissBtn} onPress={() => setActiveReport(null)}><Text style={g.dismissTxt}>Dismiss</Text></TouchableOpacity>
          </View>
        </>)}
      </Animated.View>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────

const g = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#e8eaed" },
  navBar: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: GOOGLE_BLUE, paddingTop: TOP, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.25, shadowRadius: 10, elevation: 10 },
  navBarInner: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 14, gap: 10 },
  navDirBox: { width: 44, height: 44, borderRadius: 22, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  navDirArrow: { fontSize: 24, color: "#fff", fontWeight: "800" },
  navInstText: { fontSize: 17, fontWeight: "700", color: "#fff" },
  navNextText: { fontSize: 12, color: "rgba(255,255,255,0.72)", marginTop: 2 },
  voiceBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.2)", alignItems: "center", justifyContent: "center" },
  voiceBtnIcon: { fontSize: 17 },
  navExitBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  navExitIcon: { color: "#fff", fontSize: 15, fontWeight: "700" },
  navProgress: { height: 3, backgroundColor: "rgba(255,255,255,0.25)" },
  navProgressFill: { height: "100%", backgroundColor: "#fff" },
  topBar: { position: "absolute", top: TOP, left: 12, right: 12, zIndex: 20, gap: 8 },
  searchPill: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 28, paddingHorizontal: 8, paddingVertical: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.22, shadowRadius: 12, elevation: 9, gap: 10 },
  searchPillIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#f1f3f4", alignItems: "center", justifyContent: "center" },
  searchPillText: { flex: 1, fontSize: 15, color: "#5f6368", fontWeight: "500" },
  gpsDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: GOOGLE_BLUE, marginRight: 4 },
  routeBar: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.18, shadowRadius: 10, elevation: 8 },
  routeBarLeft: { flex: 1 },
  routeBarDest: { fontSize: 14, fontWeight: "700", color: "#202124" },
  routeBarMeta: { fontSize: 12, color: "#80868b", marginTop: 2 },
  routeBarClear: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "#fce8e6", borderRadius: 10 },
  routeBarClearTxt: { fontSize: 12, fontWeight: "700", color: "#c5221f" },
  refreshChip: { flexDirection: "row", alignItems: "center", gap: 5, alignSelf: "flex-end", backgroundColor: "rgba(255,255,255,0.92)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  refreshDot: { width: 7, height: 7, borderRadius: 4 },
  refreshTxt: { fontSize: 11, color: "#5f6368", fontWeight: "500" },
  fabs: { position: "absolute", right: 12, bottom: 250, gap: 10 },
  fab: { width: 50, height: 50, borderRadius: 14, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 6, elevation: 5 },
  fabIcon: { fontSize: 22, color: "#5f6368" },
  legend: { position: "absolute", right: 72, bottom: 250, backgroundColor: "#fff", borderRadius: 16, padding: 14, minWidth: 200, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.14, shadowRadius: 10, elevation: 6 },
  legendHeader: { fontSize: 9, fontWeight: "800", color: "#80868b", letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 7, gap: 8 },
  legendDot: { width: 13, height: 13, borderRadius: 4 },
  legendTxt: { flex: 1, fontSize: 12, color: "#3c4043", fontWeight: "500" },
  legendChip: { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  legendChipTxt: { fontSize: 9, fontWeight: "700" },
  legendSep: { height: 1, backgroundColor: "#f1f3f4", marginVertical: 8 },
  hazPin: { backgroundColor: "#fff", borderRadius: 12, padding: 6, borderWidth: 2, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 4, elevation: 5 },
  hazPinIcon: { fontSize: 20 },
  hazPinTail: { width: 2, height: 8, marginTop: 2, borderRadius: 1 },
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 38 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 14 },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#dadce0", alignSelf: "center", marginTop: 10, marginBottom: 14 },
  statusBanner: { flexDirection: "row", alignItems: "center", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14, gap: 8 },
  statusIcon: { fontSize: 16 },
  statusText: { flex: 1, fontSize: 13, fontWeight: "600" },
  statsRow: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  stat: { flex: 1, alignItems: "center" },
  statVal: { fontSize: 22, fontWeight: "800", color: "#202124", letterSpacing: -0.5 },
  statLbl: { fontSize: 11, color: "#80868b", marginTop: 2, fontWeight: "500" },
  statDivider: { width: 1, height: 36, backgroundColor: "#f1f3f4" },
  instrRow: { flexDirection: "row", alignItems: "center", backgroundColor: "#f8f9fa", borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13, marginBottom: 14, gap: 12 },
  instrArrowBox: { width: 38, height: 38, borderRadius: 10, backgroundColor: GOOGLE_BLUE, alignItems: "center", justifyContent: "center" },
  instrArrow: { fontSize: 20, color: "#fff", fontWeight: "800" },
  instrText: { flex: 1, fontSize: 14, color: "#202124", fontWeight: "600", lineHeight: 20 },
  voiceToggle: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f3f4", alignItems: "center", justifyContent: "center" },
  voiceToggleActive: { backgroundColor: "#e8f0fe" },
  ctaBtn: { backgroundColor: GOOGLE_BLUE, borderRadius: 14, paddingVertical: 16, alignItems: "center" },
  ctaBtnText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.2 },
  activeNavRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  progressTrack: { height: 6, backgroundColor: "#f1f3f4", borderRadius: 3, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: GOOGLE_BLUE, borderRadius: 3 },
  progressLabels: { flexDirection: "row", justifyContent: "space-between", marginTop: 5 },
  progressLbl: { fontSize: 11, color: "#9aa0a6" },
  stopBtn: { backgroundColor: "#fce8e6", borderRadius: 10, paddingHorizontal: 18, paddingVertical: 14 },
  stopBtnText: { color: "#c5221f", fontWeight: "700", fontSize: 13 },
  hazCard: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 38 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.13, shadowRadius: 14, elevation: 16 },
  hazCardHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#dadce0", alignSelf: "center", marginTop: 10, marginBottom: 16 },
  hazCardHeader: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  hazCardIconBox: { width: 54, height: 54, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  hazCardTitle: { fontSize: 16, fontWeight: "700", color: "#202124" },
  hazCardCoord: { fontSize: 11, color: "#9aa0a6", marginTop: 3, fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace" },
  sevChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5 },
  sevChipTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },
  hazCardDesc: { fontSize: 14, color: "#5f6368", lineHeight: 21, marginBottom: 16 },
  hazCardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  hazCardExpiry: { fontSize: 12, color: "#9aa0a6" },
  dismissBtn: { backgroundColor: "#f1f3f4", borderRadius: 8, paddingHorizontal: 18, paddingVertical: 9 },
  dismissTxt: { fontSize: 13, fontWeight: "700", color: "#5f6368" },
});

const sm = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
  header: { flexDirection: "row", alignItems: "center", paddingTop: TOP + 4, paddingHorizontal: 12, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "#f1f3f4" },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center", marginRight: 4 },
  backIcon: { fontSize: 22, color: "#5f6368" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: "#202124" },
  fieldsCard: { flexDirection: "row", alignItems: "stretch", marginHorizontal: 16, marginTop: 16, marginBottom: 4, backgroundColor: "#f8f9fa", borderRadius: 18, padding: 14, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  connectorCol: { width: 22, alignItems: "center", paddingVertical: 4, marginRight: 12 },
  dotA: { width: 12, height: 12, borderRadius: 6, backgroundColor: GOOGLE_BLUE },
  connLine: { flex: 1, width: 2, backgroundColor: "#dadce0", marginVertical: 4 },
  dotB: { width: 12, height: 12, borderRadius: 3, backgroundColor: GOOGLE_RED },
  fieldsCol: { flex: 1 },
  field: { flexDirection: "row", alignItems: "center", backgroundColor: "#fff", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, borderWidth: 1.5, borderColor: "transparent" },
  fieldActive: { borderColor: GOOGLE_BLUE, shadowColor: GOOGLE_BLUE, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.15, shadowRadius: 6, elevation: 2 },
  fieldInput: { flex: 1, fontSize: 14, color: "#202124", paddingVertical: 0 },
  fieldGap: { height: 8 },
  clearIcon: { color: "#9aa0a6", fontSize: 14, fontWeight: "700", paddingLeft: 8 },
  suggList: { flex: 1, paddingHorizontal: 16 },
  suggSection: { paddingTop: 16 },
  suggLabel: { fontSize: 11, fontWeight: "700", color: "#9aa0a6", textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 },
  suggRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 12, borderBottomWidth: 1, borderBottomColor: "#f8f9fa" },
  suggIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "#f1f3f4", alignItems: "center", justifyContent: "center" },
  suggTextCol: { flex: 1 },
  suggMain: { fontSize: 14, color: "#202124", fontWeight: "600" },
  suggSub: { fontSize: 12, color: "#9aa0a6", marginTop: 2 },
  quickActions: { paddingTop: 24 },
  quickLabel: { fontSize: 10, fontWeight: "800", color: "#9aa0a6", letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 12 },
  quickRow: { flexDirection: "row", alignItems: "center", paddingVertical: 13, gap: 14, borderBottomWidth: 1, borderBottomColor: "#f8f9fa" },
  quickIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#f8f9fa", alignItems: "center", justifyContent: "center" },
  quickText: { flex: 1, fontSize: 14, color: "#202124", fontWeight: "500" },
  quickArrow: { fontSize: 20, color: "#dadce0" },
  footer: { padding: 16, paddingBottom: Platform.OS === "ios" ? 32 : 16 },
  routeBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", backgroundColor: GOOGLE_BLUE, borderRadius: 16, paddingVertical: 15, gap: 8 },
  routeBtnDisabled: { opacity: 0.45 },
  routeBtnIcon: { fontSize: 18 },
  routeBtnText: { fontSize: 16, fontWeight: "800", color: "#fff" },
});

const ra = StyleSheet.create({
  sheet: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#fff", borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 20, paddingBottom: Platform.OS === "ios" ? 38 : 24, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 18, elevation: 22, zIndex: 30 },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: "#dadce0", alignSelf: "center", marginTop: 10, marginBottom: 18 },
  title: { fontSize: 17, fontWeight: "800", color: "#202124", marginBottom: 14 },
  card: { backgroundColor: "#f8f9fa", borderRadius: 16, marginBottom: 12, overflow: "hidden", borderWidth: 2, borderColor: "transparent" },
  cardTag: { paddingHorizontal: 14, paddingVertical: 8 },
  cardTagText: { fontSize: 11, fontWeight: "800", color: "#fff", letterSpacing: 0.5 },
  cardBody: { padding: 14 },
  cardStats: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  cardStat: { flex: 1, alignItems: "center" },
  cardStatVal: { fontSize: 18, fontWeight: "800", color: "#202124" },
  cardStatLbl: { fontSize: 10, color: "#9aa0a6", marginTop: 2 },
  cardDivider: { width: 1, height: 30, backgroundColor: "#dadce0" },
  badge: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, alignSelf: "flex-start" },
  badgeTxt: { fontSize: 12, fontWeight: "600" },
  selectedDot: { position: "absolute", top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  footer: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: { flex: 1, backgroundColor: "#f1f3f4", borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  cancelTxt: { fontSize: 14, fontWeight: "700", color: "#5f6368" },
  confirmBtn: { flex: 2, backgroundColor: GOOGLE_BLUE, borderRadius: 14, paddingVertical: 14, alignItems: "center" },
  confirmTxt: { fontSize: 14, fontWeight: "800", color: "#fff" },
});

const ap = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)", alignItems: "center", justifyContent: "center", padding: 24 },
  card: { width: "100%", maxWidth: 360, borderRadius: 24, padding: 28, alignItems: "center", shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 20 },
  icon: { fontSize: 52, marginBottom: 16 },
  title: { fontSize: 20, fontWeight: "800", textAlign: "center", marginBottom: 10 },
  message: { fontSize: 14, textAlign: "center", lineHeight: 22, marginBottom: 16 },
  meta: { backgroundColor: "rgba(0,0,0,0.06)", borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 20 },
  metaTxt: { fontSize: 12, fontWeight: "700", fontFamily: Platform.OS === "ios" ? "Courier New" : "monospace" },
  btn: { width: "100%", borderRadius: 14, borderWidth: 2, paddingVertical: 14, alignItems: "center" },
  btnTxt: { fontSize: 15, fontWeight: "800" },
});

const ov = StyleSheet.create({
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.45)", alignItems: "center", justifyContent: "center", zIndex: 50 },
  card: { backgroundColor: "#fff", borderRadius: 20, padding: 28, alignItems: "center", width: 260, shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 16, elevation: 16 },
  title: { fontSize: 18, fontWeight: "800", color: "#202124", marginTop: 16, marginBottom: 8 },
  sub: { fontSize: 13, color: "#5f6368", textAlign: "center", lineHeight: 19 },
});
