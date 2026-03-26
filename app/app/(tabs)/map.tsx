import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Animated,
  ScrollView,
  Platform,
} from "react-native";
import MapView, { Marker, Polygon, Polyline, UrlTile, PROVIDER_DEFAULT } from "react-native-maps";
import * as Location from "expo-location";

// ─── Types ────────────────────────────────────────────────────────────────────

type Coordinate = { latitude: number; longitude: number };

type FloodZone = {
  id: string;
  gauge_id: string;
  severity: "NORMAL" | "WATCH" | "WARNING" | "EXTREME";
  boundary: { coordinates: Coordinate[] };
};

type HazardReport = {
  id: string;
  location: Coordinate;
  report_type: "FLOODED_ROAD" | "DAMAGED_BRIDGE" | "BLOCKED_ROAD";
  severity: number;
  description: string;
  expires_at: string;
};

type NavStep = {
  maneuver: { instruction: string; location: [number, number] };
  distance: number;
  duration: number;
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BASE_URL = "http://10.10.11.136:8080";

const SEVERITY_COLORS: Record<string, string> = {
  NORMAL: "rgba(34,197,94,0.35)",
  WATCH: "rgba(234,179,8,0.40)",
  WARNING: "rgba(249,115,22,0.45)",
  EXTREME: "rgba(239,68,68,0.50)",
};

const SEVERITY_STROKE: Record<string, string> = {
  NORMAL: "#16a34a",
  WATCH: "#ca8a04",
  WARNING: "#ea580c",
  EXTREME: "#dc2626",
};

const SEVERITY_LABEL: Record<string, string> = {
  NORMAL: "No Risk",
  WATCH: "Watch",
  WARNING: "Warning",
  EXTREME: "Extreme",
};

const REPORT_ICONS: Record<string, string> = {
  FLOODED_ROAD: "🌊",
  DAMAGED_BRIDGE: "🌉",
  BLOCKED_ROAD: "⚠️",
};

// ─── Utility ──────────────────────────────────────────────────────────────────

/** Euclidean distance in metres (flat earth, accurate enough at small scales) */
const distMetres = (a: Coordinate, b: Coordinate) =>
  Math.sqrt(Math.pow(a.latitude - b.latitude, 2) + Math.pow(a.longitude - b.longitude, 2)) * 111_000;

/** Check if a coordinate falls inside any flood zone bounding box */
const isInsideFloodZone = (p: Coordinate, zones: FloodZone[]): boolean =>
  zones.some((zone) => {
    if (zone.severity === "NORMAL") return false;
    const lats = zone.boundary.coordinates.map((z) => z.latitude);
    const lngs = zone.boundary.coordinates.map((z) => z.longitude);
    return (
      p.latitude >= Math.min(...lats) &&
      p.latitude <= Math.max(...lats) &&
      p.longitude >= Math.min(...lngs) &&
      p.longitude <= Math.max(...lngs)
    );
  });

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MapScreen() {
  // Search state
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<"start" | "end" | null>(null);

  // Map data
  const [routeCoords, setRouteCoords] = useState<Coordinate[]>([]);
  const [floodZones, setFloodZones] = useState<FloodZone[]>([]);
  const [activeReports, setActiveReports] = useState<HazardReport[]>([]);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [userLocation, setUserLocation] = useState<Coordinate | null>(null);

  // Navigation state
  const [steps, setSteps] = useState<NavStep[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const [distance, setDistance] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);

  // UI state
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [showLegend, setShowLegend] = useState(false);
  const [routeAvoided, setRouteAvoided] = useState(0);

  const mapRef = useRef<MapView>(null);
  const panelAnim = useRef(new Animated.Value(0)).current;
  const legendAnim = useRef(new Animated.Value(0)).current;

  const [region, setRegion] = useState({
    latitude: 7.8731,
    longitude: 80.7718,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  });

  // ── Effects ────────────────────────────────────────────────────────────────

  useEffect(() => {
    requestLocation();
    fetchFloodZones();
    fetchActiveReports();
  }, []);

  useEffect(() => {
    Animated.spring(panelAnim, {
      toValue: steps.length > 0 ? 1 : 0,
      useNativeDriver: true,
      tension: 65,
      friction: 10,
    }).start();
  }, [steps.length]);

  useEffect(() => {
    Animated.timing(legendAnim, {
      toValue: showLegend ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [showLegend]);

  // Turn-by-turn step advancement
  useEffect(() => {
    if (!userLocation || steps.length === 0 || !isNavigating) return;
    const step = steps[currentStep];
    const next: Coordinate = { latitude: step.maneuver.location[1], longitude: step.maneuver.location[0] };
    const dist = distMetres(userLocation, next);
    if (dist < 50 && currentStep < steps.length - 1) {
      setCurrentStep((prev) => prev + 1);
    }
    if (currentStep === steps.length - 1 && dist < 30) {
      Alert.alert("🎉 Arrived", "You have reached your destination safely.");
      setIsNavigating(false);
      setSteps([]);
      setRouteCoords([]);
    }
  }, [userLocation]);

  // ── Data Fetching ──────────────────────────────────────────────────────────

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Location access is needed for safe routing.");
      return;
    }
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 5 },
      (loc) => {
        setUserLocation({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      }
    );
  };

  const fetchFloodZones = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/flood-zones`);
      const data = await res.json();
      if (data.success) setFloodZones(data.data.zones);
    } catch {
      // Use mock data if API is unavailable
      setFloodZones(MOCK_FLOOD_ZONES);
    }
  };

  const fetchActiveReports = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/v1/reports/active`);
      const data = await res.json();
      if (data.success) setActiveReports(data.data.reports);
    } catch {
      setActiveReports(MOCK_REPORTS);
    }
  };

  // ── Search ─────────────────────────────────────────────────────────────────

  const searchLocation = async (text: string) => {
    if (text.length < 3) return setSuggestions([]);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=lk&limit=5`,
        { headers: { "User-Agent": "SmartFloodEvacApp/1.0" } }
      );
      const data = await res.json();
      setSuggestions(data);
    } catch {}
  };

  const selectSuggestion = (item: any) => {
    if (activeInput === "start") setStart(item.display_name);
    else setEnd(item.display_name);
    setSuggestions([]);
    setActiveInput(null);
  };

  // ── Route Calculation ──────────────────────────────────────────────────────

  const calculateRoute = async () => {
    if (!start || !end) return Alert.alert("Missing Info", "Please enter both start and destination.");
    setLoadingRoute(true);
    setSuggestions([]);

    try {
      const [startLocs, endLocs] = await Promise.all([
        Location.geocodeAsync(start),
        Location.geocodeAsync(end),
      ]);

      if (!startLocs.length || !endLocs.length)
        throw new Error("Could not geocode locations");

      const s = startLocs[0];
      const e = endLocs[0];

      const url = `https://router.project-osrm.org/route/v1/driving/${s.longitude},${s.latitude};${e.longitude},${e.latitude}?overview=full&geometries=geojson&steps=true`;
      const res = await fetch(url);
      const data = await res.json();

      if (!data.routes?.length) throw new Error("No route found");

      const route = data.routes[0];
      setDistance(route.distance);
      setDuration(route.duration);

      let coords: Coordinate[] = route.geometry.coordinates.map(([lng, lat]: [number, number]) => ({
        latitude: lat,
        longitude: lng,
      }));

      // Filter out points inside flood zones (avoid unsafe zones)
      const originalLen = coords.length;
      coords = coords.filter((p) => !isInsideFloodZone(p, floodZones));
      setRouteAvoided(originalLen - coords.length);

      setRouteCoords(coords);
      setSteps(route.legs[0].steps);
      setCurrentStep(0);
      setIsNavigating(true);

      // Fit map to show entire route
      if (coords.length > 0) {
        mapRef.current?.fitToCoordinates(coords, {
          edgePadding: { top: 160, right: 40, bottom: 200, left: 40 },
          animated: true,
        });
      }
    } catch (err: any) {
      Alert.alert("Route Error", err.message || "Failed to calculate route. Please try again.");
    }

    setLoadingRoute(false);
  };

  const clearRoute = () => {
    setRouteCoords([]);
    setSteps([]);
    setIsNavigating(false);
    setCurrentStep(0);
    setDistance(0);
    setDuration(0);
    setRouteAvoided(0);
    setStart("");
    setEnd("");
  };

  const centerOnUser = () => {
    if (!userLocation) return;
    mapRef.current?.animateToRegion({ ...userLocation, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 600);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const navPanelTranslate = panelAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [200, 0],
  });

  const legendTranslate = legendAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-20, 0],
  });

  const currentInstruction = steps[currentStep]?.maneuver?.instruction || "";

  return (
    <View style={styles.container}>
      {/* ── MAP ─────────────────────────────────────────────────────────── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
      >
        <UrlTile
          urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
          flipY={false}
        />

        {/* Flood zone polygons */}
        {floodZones.map((z) => (
          <Polygon
            key={z.id}
            coordinates={z.boundary.coordinates}
            fillColor={SEVERITY_COLORS[z.severity] ?? "rgba(239,68,68,0.3)"}
            strokeColor={SEVERITY_STROKE[z.severity] ?? "#dc2626"}
            strokeWidth={2}
          />
        ))}

        {/* Safe route polyline */}
        {routeCoords.length > 0 && (
          <>
            {/* Shadow / glow */}
            <Polyline
              coordinates={routeCoords}
              strokeColor="rgba(56,189,248,0.25)"
              strokeWidth={14}
            />
            {/* Main line */}
            <Polyline
              coordinates={routeCoords}
              strokeColor="#0ea5e9"
              strokeWidth={5}
            />
          </>
        )}

        {/* Hazard report markers */}
        {activeReports.map((r) => (
          <Marker
            key={r.id}
            coordinate={r.location}
            onPress={() => setSelectedReport(r)}
            anchor={{ x: 0.5, y: 0.5 }}
          >
            <View style={styles.markerBubble}>
              <Text style={styles.markerIcon}>{REPORT_ICONS[r.report_type] ?? "⚠️"}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── SEARCH PANEL ────────────────────────────────────────────────── */}
      <View style={styles.searchPanel}>
        <View style={styles.searchHeader}>
          <View style={styles.searchDot} />
          <Text style={styles.searchHeaderText}>FLOOD EVACUATION NAVIGATOR</Text>
        </View>

        {/* Start input */}
        <View style={styles.inputRow}>
          <View style={[styles.inputDot, { backgroundColor: "#22c55e" }]} />
          <TextInput
            style={styles.input}
            placeholder="Start location"
            placeholderTextColor="#94a3b8"
            value={start}
            onFocus={() => setActiveInput("start")}
            onChangeText={(t) => { setStart(t); setActiveInput("start"); searchLocation(t); }}
          />
          {start.length > 0 && (
            <TouchableOpacity onPress={() => setStart("")} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.inputDivider} />

        {/* End input */}
        <View style={styles.inputRow}>
          <View style={[styles.inputDot, { backgroundColor: "#ef4444" }]} />
          <TextInput
            style={styles.input}
            placeholder="Destination"
            placeholderTextColor="#94a3b8"
            value={end}
            onFocus={() => setActiveInput("end")}
            onChangeText={(t) => { setEnd(t); setActiveInput("end"); searchLocation(t); }}
          />
          {end.length > 0 && (
            <TouchableOpacity onPress={() => setEnd("")} style={styles.clearBtn}>
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <View style={styles.suggestionsContainer}>
            <FlatList
              data={suggestions.slice(0, 5)}
              keyExtractor={(item) => item.place_id.toString()}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.suggestionItem} onPress={() => selectSuggestion(item)}>
                  <Text style={styles.suggestionIcon}>📍</Text>
                  <Text style={styles.suggestionText} numberOfLines={1}>{item.display_name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Route / Clear button */}
        {routeCoords.length > 0 ? (
          <TouchableOpacity style={styles.clearRouteBtn} onPress={clearRoute}>
            <Text style={styles.clearRouteBtnText}>✕  Clear Route</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[styles.routeBtn, loadingRoute && styles.routeBtnLoading]}
            onPress={calculateRoute}
            disabled={loadingRoute}
          >
            {loadingRoute ? (
              <ActivityIndicator color="#0f172a" size="small" />
            ) : (
              <Text style={styles.routeBtnText}>🛡  Find Safe Route</Text>
            )}
          </TouchableOpacity>
        )}

        {/* Avoided zones notice */}
        {routeAvoided > 0 && (
          <View style={styles.avoidedBadge}>
            <Text style={styles.avoidedText}>⚡ Route adjusted — {routeAvoided} flood points avoided</Text>
          </View>
        )}
      </View>

      {/* ── LEGEND TOGGLE ───────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.legendToggle} onPress={() => setShowLegend(!showLegend)}>
        <Text style={styles.legendToggleText}>🗺</Text>
      </TouchableOpacity>

      {showLegend && (
        <Animated.View style={[styles.legendPanel, { opacity: legendAnim, transform: [{ translateY: legendTranslate }] }]}>
          <Text style={styles.legendTitle}>FLOOD ZONES</Text>
          {Object.entries(SEVERITY_LABEL).map(([key, label]) => (
            <View key={key} style={styles.legendRow}>
              <View style={[styles.legendSwatch, { backgroundColor: SEVERITY_STROKE[key] }]} />
              <Text style={styles.legendLabel}>{label}</Text>
            </View>
          ))}
          <View style={styles.legendDivider} />
          <Text style={styles.legendTitle}>HAZARDS</Text>
          {Object.entries(REPORT_ICONS).map(([type, icon]) => (
            <View key={type} style={styles.legendRow}>
              <Text style={{ fontSize: 14 }}>{icon}</Text>
              <Text style={styles.legendLabel}>{type.replace("_", " ")}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* ── LOCATE ME BUTTON ────────────────────────────────────────────── */}
      <TouchableOpacity style={styles.locateBtn} onPress={centerOnUser}>
        <Text style={styles.locateBtnText}>◎</Text>
      </TouchableOpacity>

      {/* ── NAVIGATION PANEL ────────────────────────────────────────────── */}
      <Animated.View style={[styles.navPanel, { transform: [{ translateY: navPanelTranslate }] }]}>
        {steps.length > 0 && (
          <>
            <View style={styles.navTopRow}>
              <View style={styles.navEtaBox}>
                <Text style={styles.navEtaValue}>{(duration / 60).toFixed(0)}</Text>
                <Text style={styles.navEtaUnit}>min</Text>
              </View>
              <View style={styles.navDistBox}>
                <Text style={styles.navDistValue}>{(distance / 1000).toFixed(1)}</Text>
                <Text style={styles.navDistUnit}>km</Text>
              </View>
              <View style={styles.navStepBox}>
                <Text style={styles.navStepValue}>{currentStep + 1}/{steps.length}</Text>
                <Text style={styles.navStepUnit}>step</Text>
              </View>
            </View>

            <View style={styles.navInstruction}>
              <Text style={styles.navArrow}>▶</Text>
              <Text style={styles.navInstructionText} numberOfLines={2}>
                {currentInstruction || "Follow the route"}
              </Text>
            </View>

            {/* Step progress bar */}
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${((currentStep + 1) / steps.length) * 100}%` }]} />
            </View>
          </>
        )}
      </Animated.View>

      {/* ── HAZARD REPORT CARD ──────────────────────────────────────────── */}
      {selectedReport && (
        <TouchableOpacity
          style={styles.reportCardOverlay}
          activeOpacity={1}
          onPress={() => setSelectedReport(null)}
        >
          <View style={styles.reportCard} onStartShouldSetResponder={() => true}>
            <View style={styles.reportCardHeader}>
              <Text style={styles.reportCardIcon}>{REPORT_ICONS[selectedReport.report_type]}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.reportCardType}>{selectedReport.report_type.replace(/_/g, " ")}</Text>
                <Text style={styles.reportCardCoord}>
                  {selectedReport.location.latitude.toFixed(4)}, {selectedReport.location.longitude.toFixed(4)}
                </Text>
              </View>
              <View style={[styles.severityBadge, { backgroundColor: getSeverityColor(selectedReport.severity) }]}>
                <Text style={styles.severityText}>SEV {selectedReport.severity}</Text>
              </View>
            </View>
            <Text style={styles.reportCardDesc}>{selectedReport.description}</Text>
            <Text style={styles.reportCardExpiry}>
              Expires: {new Date(selectedReport.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function getSeverityColor(sev: number): string {
  if (sev >= 5) return "#dc2626";
  if (sev >= 4) return "#ea580c";
  if (sev >= 3) return "#d97706";
  if (sev >= 2) return "#ca8a04";
  return "#16a34a";
}

// ─── Mock Data (used when API is unavailable) ─────────────────────────────────

const MOCK_FLOOD_ZONES: FloodZone[] = [
  {
    id: "mock-1",
    gauge_id: "LK_KELANI_001",
    severity: "WARNING",
    boundary: {
      coordinates: [
        { latitude: 7.88, longitude: 80.76 },
        { latitude: 7.90, longitude: 80.76 },
        { latitude: 7.90, longitude: 80.78 },
        { latitude: 7.88, longitude: 80.78 },
        { latitude: 7.88, longitude: 80.76 },
      ],
    },
  },
  {
    id: "mock-2",
    gauge_id: "LK_KALU_002",
    severity: "EXTREME",
    boundary: {
      coordinates: [
        { latitude: 7.84, longitude: 80.74 },
        { latitude: 7.86, longitude: 80.74 },
        { latitude: 7.86, longitude: 80.76 },
        { latitude: 7.84, longitude: 80.76 },
        { latitude: 7.84, longitude: 80.74 },
      ],
    },
  },
];

const MOCK_REPORTS: HazardReport[] = [
  {
    id: "rep-1",
    location: { latitude: 7.892, longitude: 80.772 },
    report_type: "FLOODED_ROAD",
    severity: 4,
    description: "Road completely submerged near Kandy lake junction.",
    expires_at: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: "rep-2",
    location: { latitude: 7.855, longitude: 80.751 },
    report_type: "DAMAGED_BRIDGE",
    severity: 5,
    description: "Bridge structurally compromised — do not cross.",
    expires_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },

  // ── Search Panel ─────────────────────────────────────────────────────────
  searchPanel: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 36,
    left: 14,
    right: 14,
    backgroundColor: "rgba(15,23,42,0.93)",
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.15)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 12,
  },
  searchHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  searchDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#0ea5e9",
    marginRight: 8,
  },
  searchHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#0ea5e9",
    letterSpacing: 1.5,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 2,
  },
  inputDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: "#f1f5f9",
    paddingVertical: 8,
    fontWeight: "500",
  },
  clearBtn: {
    padding: 4,
    marginLeft: 4,
  },
  clearBtnText: {
    color: "#64748b",
    fontSize: 12,
  },
  inputDivider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.12)",
    marginVertical: 2,
    marginLeft: 20,
  },
  suggestionsContainer: {
    maxHeight: 200,
    marginTop: 6,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.1)",
  },
  suggestionItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(148,163,184,0.07)",
  },
  suggestionIcon: {
    fontSize: 13,
    marginRight: 8,
  },
  suggestionText: {
    flex: 1,
    color: "#cbd5e1",
    fontSize: 13,
  },
  routeBtn: {
    backgroundColor: "#0ea5e9",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 10,
  },
  routeBtnLoading: {
    opacity: 0.7,
  },
  routeBtnText: {
    color: "#0f172a",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: 0.4,
  },
  clearRouteBtn: {
    backgroundColor: "rgba(239,68,68,0.15)",
    borderWidth: 1,
    borderColor: "rgba(239,68,68,0.4)",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
    marginTop: 10,
  },
  clearRouteBtnText: {
    color: "#f87171",
    fontWeight: "700",
    fontSize: 13,
  },
  avoidedBadge: {
    backgroundColor: "rgba(249,115,22,0.12)",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "rgba(249,115,22,0.25)",
  },
  avoidedText: {
    color: "#fb923c",
    fontSize: 11,
    fontWeight: "600",
    textAlign: "center",
  },

  // ── Markers ───────────────────────────────────────────────────────────────
  markerBubble: {
    backgroundColor: "rgba(15,23,42,0.85)",
    borderRadius: 20,
    padding: 6,
    borderWidth: 1.5,
    borderColor: "#f59e0b",
  },
  markerIcon: {
    fontSize: 16,
  },

  // ── Legend ────────────────────────────────────────────────────────────────
  legendToggle: {
    position: "absolute",
    bottom: 200,
    left: 16,
    width: 48,
    height: 48,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  legendToggleText: {
    fontSize: 20,
  },
  legendPanel: {
    position: "absolute",
    bottom: 260,
    left: 16,
    backgroundColor: "rgba(15,23,42,0.93)",
    borderRadius: 14,
    padding: 14,
    minWidth: 170,
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.12)",
  },
  legendTitle: {
    fontSize: 9,
    fontWeight: "800",
    color: "#64748b",
    letterSpacing: 1.4,
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 5,
    gap: 8,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  legendLabel: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "500",
  },
  legendDivider: {
    height: 1,
    backgroundColor: "rgba(148,163,184,0.1)",
    marginVertical: 8,
  },

  // ── Controls ──────────────────────────────────────────────────────────────
  locateBtn: {
    position: "absolute",
    bottom: 200,
    right: 16,
    width: 48,
    height: 48,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(148,163,184,0.2)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  locateBtnText: {
    color: "#0ea5e9",
    fontSize: 22,
    fontWeight: "300",
  },

  // ── Navigation Panel ──────────────────────────────────────────────────────
  navPanel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(15,23,42,0.96)",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    paddingBottom: Platform.OS === "ios" ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(148,163,184,0.12)",
  },
  navTopRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 14,
  },
  navEtaBox: { alignItems: "center" },
  navDistBox: { alignItems: "center" },
  navStepBox: { alignItems: "center" },
  navEtaValue: { color: "#f1f5f9", fontSize: 28, fontWeight: "800" },
  navEtaUnit: { color: "#64748b", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  navDistValue: { color: "#0ea5e9", fontSize: 28, fontWeight: "800" },
  navDistUnit: { color: "#64748b", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  navStepValue: { color: "#a78bfa", fontSize: 24, fontWeight: "700" },
  navStepUnit: { color: "#64748b", fontSize: 11, fontWeight: "600", letterSpacing: 0.5 },
  navInstruction: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(14,165,233,0.08)",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(14,165,233,0.18)",
  },
  navArrow: {
    color: "#0ea5e9",
    fontSize: 16,
    marginRight: 10,
  },
  navInstructionText: {
    flex: 1,
    color: "#e2e8f0",
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
  progressBar: {
    height: 4,
    backgroundColor: "rgba(148,163,184,0.15)",
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: "#0ea5e9",
    borderRadius: 2,
  },

  // ── Hazard Report Card ────────────────────────────────────────────────────
  reportCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "flex-end",
    paddingBottom: 180,
    paddingHorizontal: 16,
  },
  reportCard: {
    backgroundColor: "rgba(15,23,42,0.97)",
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
    shadowColor: "#f59e0b",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  reportCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 10,
  },
  reportCardIcon: {
    fontSize: 28,
    marginRight: 12,
  },
  reportCardType: {
    color: "#f1f5f9",
    fontSize: 14,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  reportCardCoord: {
    color: "#64748b",
    fontSize: 11,
    marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  severityBadge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  severityText: {
    color: "white",
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  reportCardDesc: {
    color: "#94a3b8",
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  reportCardExpiry: {
    color: "#475569",
    fontSize: 11,
    fontWeight: "500",
  },
});
