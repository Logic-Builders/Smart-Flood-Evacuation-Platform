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
  Platform,
  Dimensions,
  KeyboardAvoidingView,
} from "react-native";
import MapView, {
  Marker,
  Polygon,
  Polyline,
  UrlTile,
  PROVIDER_DEFAULT,
} from "react-native-maps";
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

const SEVERITY_FILL: Record<string, string> = {
  NORMAL:  "rgba(34,197,94,0.18)",
  WATCH:   "rgba(234,179,8,0.22)",
  WARNING: "rgba(249,115,22,0.28)",
  EXTREME: "rgba(239,68,68,0.35)",
};
const SEVERITY_STROKE: Record<string, string> = {
  NORMAL:  "#16a34a",
  WATCH:   "#ca8a04",
  WARNING: "#ea580c",
  EXTREME: "#dc2626",
};
const SEVERITY_LABEL: Record<string, string> = {
  NORMAL:  "No Risk",
  WATCH:   "Watch",
  WARNING: "Warning",
  EXTREME: "Extreme",
};
const REPORT_ICONS: Record<string, string> = {
  FLOODED_ROAD:   "🌊",
  DAMAGED_BRIDGE: "🌉",
  BLOCKED_ROAD:   "⚠️",
};
const REPORT_LABEL: Record<string, string> = {
  FLOODED_ROAD:   "Flooded Road",
  DAMAGED_BRIDGE: "Damaged Bridge",
  BLOCKED_ROAD:   "Blocked Road",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const distMetres = (a: Coordinate, b: Coordinate) =>
  Math.sqrt(
    Math.pow(a.latitude  - b.latitude,  2) +
    Math.pow(a.longitude - b.longitude, 2)
  ) * 111_000;

const isInsideFloodZone = (p: Coordinate, zones: FloodZone[]) =>
  zones.some((z) => {
    if (z.severity === "NORMAL") return false;
    const lats = z.boundary.coordinates.map((c) => c.latitude);
    const lngs = z.boundary.coordinates.map((c) => c.longitude);
    return (
      p.latitude  >= Math.min(...lats) && p.latitude  <= Math.max(...lats) &&
      p.longitude >= Math.min(...lngs) && p.longitude <= Math.max(...lngs)
    );
  });

const fmtDist = (m: number) =>
  m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h} hr ${m} min` : `${m} min`;
};

const getSeverityColor = (sev: number) => {
  if (sev >= 5) return "#dc2626";
  if (sev >= 4) return "#ea580c";
  if (sev >= 3) return "#d97706";
  if (sev >= 2) return "#ca8a04";
  return "#16a34a";
};

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_FLOOD_ZONES: FloodZone[] = [
  {
    id: "mock-1", gauge_id: "LK_KELANI_001", severity: "WARNING",
    boundary: { coordinates: [
      { latitude: 7.88, longitude: 80.76 }, { latitude: 7.90, longitude: 80.76 },
      { latitude: 7.90, longitude: 80.78 }, { latitude: 7.88, longitude: 80.78 },
      { latitude: 7.88, longitude: 80.76 },
    ]},
  },
  {
    id: "mock-2", gauge_id: "LK_KALU_002", severity: "EXTREME",
    boundary: { coordinates: [
      { latitude: 7.84, longitude: 80.74 }, { latitude: 7.86, longitude: 80.74 },
      { latitude: 7.86, longitude: 80.76 }, { latitude: 7.84, longitude: 80.76 },
      { latitude: 7.84, longitude: 80.74 },
    ]},
  },
];

const MOCK_REPORTS: HazardReport[] = [
  {
    id: "rep-1", location: { latitude: 7.892, longitude: 80.772 },
    report_type: "FLOODED_ROAD", severity: 4,
    description: "Road completely submerged near Kandy lake junction.",
    expires_at: new Date(Date.now() + 3 * 3600000).toISOString(),
  },
  {
    id: "rep-2", location: { latitude: 7.855, longitude: 80.751 },
    report_type: "DAMAGED_BRIDGE", severity: 5,
    description: "Bridge structurally compromised — do not cross.",
    expires_at: new Date(Date.now() + 2 * 3600000).toISOString(),
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function MapScreen() {

  // Search
  const [start, setStart]             = useState("");
  const [end, setEnd]                 = useState("");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [activeInput, setActiveInput] = useState<"start" | "end" | null>(null);
  const [searchExpanded, setSearchExpanded] = useState(false);

  // Map data
  const [routeCoords, setRouteCoords]     = useState<Coordinate[]>([]);
  const [floodZones, setFloodZones]       = useState<FloodZone[]>([]);
  const [activeReports, setActiveReports] = useState<HazardReport[]>([]);
  const [loadingRoute, setLoadingRoute]   = useState(false);
  const [userLocation, setUserLocation]   = useState<Coordinate | null>(null);

  // Navigation
  const [steps, setSteps]               = useState<NavStep[]>([]);
  const [currentStep, setCurrentStep]   = useState(0);
  const [distance, setDistance]         = useState(0);
  const [duration, setDuration]         = useState(0);
  const [isNavigating, setIsNavigating] = useState(false);
  const isNavigatingRef  = useRef(false);
  const currentStepRef   = useRef(0);

  // UI
  const [selectedReport, setSelectedReport] = useState<HazardReport | null>(null);
  const [showLegend, setShowLegend]         = useState(false);
  const [routeAvoided, setRouteAvoided]     = useState(0);

  const mapRef     = useRef<MapView>(null);
  const sheetAnim  = useRef(new Animated.Value(0)).current;
  const reportAnim = useRef(new Animated.Value(300)).current;
  const navBarAnim = useRef(new Animated.Value(-130)).current;
  const legendAnim = useRef(new Animated.Value(0)).current;

  const [region, setRegion] = useState({
    latitude: 7.8731, longitude: 80.7718,
    latitudeDelta: 0.5, longitudeDelta: 0.5,
  });

  // ── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    requestLocation();
    fetchFloodZones();
    fetchActiveReports();
  }, []);

  useEffect(() => {
    Animated.spring(sheetAnim, {
      toValue: steps.length > 0 ? 1 : 0,
      useNativeDriver: true, tension: 70, friction: 12,
    }).start();
  }, [steps.length]);

  useEffect(() => {
    Animated.spring(navBarAnim, {
      toValue: isNavigating ? 0 : -130,
      useNativeDriver: true, tension: 70, friction: 12,
    }).start();
  }, [isNavigating]);

  useEffect(() => {
    Animated.spring(reportAnim, {
      toValue: selectedReport ? 0 : 300,
      useNativeDriver: true, tension: 70, friction: 12,
    }).start();
  }, [selectedReport]);

  useEffect(() => {
    Animated.timing(legendAnim, {
      toValue: showLegend ? 1 : 0,
      duration: 180, useNativeDriver: true,
    }).start();
  }, [showLegend]);

  useEffect(() => { currentStepRef.current  = currentStep; },  [currentStep]);
  useEffect(() => { isNavigatingRef.current = isNavigating; }, [isNavigating]);

  // ── Location ─────────────────────────────────────────────────────────────

  const requestLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission Required", "Location access is needed for safe routing.");
      return;
    }
    Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 1500, distanceInterval: 5 },
      (loc) => {
        const coord: Coordinate = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        setUserLocation(coord);

        if (isNavigatingRef.current) {
          mapRef.current?.animateCamera(
            { center: coord, zoom: 17, heading: loc.coords.heading ?? 0, pitch: 45 },
            { duration: 700 }
          );
        }

        if (!isNavigatingRef.current) return;
        setSteps((prev) => {
          if (!prev.length) return prev;
          const idx  = currentStepRef.current;
          const step = prev[idx];
          if (!step) return prev;
          const next: Coordinate = {
            latitude:  step.maneuver.location[1],
            longitude: step.maneuver.location[0],
          };
          if (distMetres(coord, next) < 50 && idx < prev.length - 1) {
            const n = idx + 1;
            currentStepRef.current = n;
            setCurrentStep(n);
          }
          if (idx === prev.length - 1 && distMetres(coord, next) < 30) {
            Alert.alert("🎉 Arrived!", "You have reached your destination safely.");
            isNavigatingRef.current = false;
            setIsNavigating(false);
            setSteps([]);
            setRouteCoords([]);
          }
          return prev;
        });
      }
    );
  };

  // ── API ──────────────────────────────────────────────────────────────────

  const fetchFloodZones = async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/v1/flood-zones`);
      const d = await r.json();
      if (d.success) setFloodZones(d.data.zones);
    } catch { setFloodZones(MOCK_FLOOD_ZONES); }
  };

  const fetchActiveReports = async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/v1/reports/active`);
      const d = await r.json();
      if (d.success) setActiveReports(d.data.reports);
    } catch { setActiveReports(MOCK_REPORTS); }
  };

  // ── Search ───────────────────────────────────────────────────────────────

  const searchLocation = async (text: string) => {
    if (text.length < 3) return setSuggestions([]);
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=lk&limit=6`,
        { headers: { "User-Agent": "SmartFloodEvacApp/1.0" } }
      );
      setSuggestions(await r.json());
    } catch {}
  };

  const selectSuggestion = (item: any) => {
    if (activeInput === "start") setStart(item.display_name);
    else setEnd(item.display_name);
    setSuggestions([]);
    setActiveInput(null);
  };

  // ── Routing ──────────────────────────────────────────────────────────────

  const calculateRoute = async () => {
    if (!start || !end)
      return Alert.alert("Missing Info", "Please enter both start and destination.");
    setLoadingRoute(true);
    setSuggestions([]);
    setSearchExpanded(false);

    try {
      const [sLoc, eLoc] = await Promise.all([
        Location.geocodeAsync(start),
        Location.geocodeAsync(end),
      ]);
      if (!sLoc.length || !eLoc.length) throw new Error("Could not find locations");

      const s = sLoc[0], e = eLoc[0];
      const url = `https://router.project-osrm.org/route/v1/driving/${s.longitude},${s.latitude};${e.longitude},${e.latitude}?overview=full&geometries=geojson&steps=true`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.routes?.length) throw new Error("No route found");

      const route = data.routes[0];
      setDistance(route.distance);
      setDuration(route.duration);

      let coords: Coordinate[] = route.geometry.coordinates.map(
        ([lng, lat]: [number, number]) => ({ latitude: lat, longitude: lng })
      );
      const before = coords.length;
      coords = coords.filter((p) => !isInsideFloodZone(p, floodZones));
      setRouteAvoided(before - coords.length);
      setRouteCoords(coords);
      setSteps(route.legs[0].steps);
      setCurrentStep(0);
      currentStepRef.current = 0;
      setIsNavigating(false);

      mapRef.current?.fitToCoordinates(coords, {
        edgePadding: { top: 180, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
    } catch (err: any) {
      Alert.alert("Route Error", err.message || "Failed to calculate route.");
    }
    setLoadingRoute(false);
  };

  const startNavigation = () => {
    if (!userLocation) {
      Alert.alert("No GPS", "Waiting for GPS fix. Please try again.");
      return;
    }
    isNavigatingRef.current = true;
    setIsNavigating(true);
    mapRef.current?.animateCamera(
      { center: userLocation, zoom: 17, pitch: 45 },
      { duration: 800 }
    );
  };

  const stopNavigation = () => {
    isNavigatingRef.current = false;
    setIsNavigating(false);
    if (routeCoords.length > 0) {
      mapRef.current?.fitToCoordinates(routeCoords, {
        edgePadding: { top: 180, right: 40, bottom: 280, left: 40 },
        animated: true,
      });
    }
  };

  const clearRoute = () => {
    setRouteCoords([]);
    setSteps([]);
    isNavigatingRef.current = false;
    setIsNavigating(false);
    currentStepRef.current = 0;
    setCurrentStep(0);
    setDistance(0);
    setDuration(0);
    setRouteAvoided(0);
    setStart("");
    setEnd("");
    setSearchExpanded(false);
  };

  const centerOnUser = () => {
    if (!userLocation) return;
    mapRef.current?.animateCamera({ center: userLocation, zoom: 15 }, { duration: 600 });
  };

  // ── Derived ──────────────────────────────────────────────────────────────

  const sheetTranslate = sheetAnim.interpolate({
    inputRange: [0, 1], outputRange: [300, 0],
  });
  const currentInstruction = steps[currentStep]?.maneuver?.instruction || "Follow the route";
  const nextInstruction    = steps[currentStep + 1]?.maneuver?.instruction || "";

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>

      {/* MAP */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
        onPress={() => { setSelectedReport(null); setShowLegend(false); }}
      >
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />

        {floodZones.map((z) => (
          <Polygon
            key={z.id}
            coordinates={z.boundary.coordinates}
            fillColor={SEVERITY_FILL[z.severity]}
            strokeColor={SEVERITY_STROKE[z.severity]}
            strokeWidth={2}
          />
        ))}

        {routeCoords.length > 0 && (
          <>
            <Polyline coordinates={routeCoords} strokeColor="rgba(26,115,232,0.2)" strokeWidth={18} />
            <Polyline coordinates={routeCoords} strokeColor="#1a73e8" strokeWidth={6} lineCap="round" lineJoin="round" />
          </>
        )}

        {activeReports.map((r) => (
          <Marker key={r.id} coordinate={r.location} anchor={{ x: 0.5, y: 0.5 }} onPress={() => setSelectedReport(r)}>
            <View style={s.pin}>
              <Text style={s.pinIcon}>{REPORT_ICONS[r.report_type]}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      {/* ── NAVIGATION TOP BAR ─────────────────────────────────────────── */}
      <Animated.View style={[s.navBar, { transform: [{ translateY: navBarAnim }] }]}>
        <View style={s.navBarContent}>
          <View style={s.navBarArrowBox}>
            <Text style={s.navBarArrowText}>↑</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.navBarInstruction} numberOfLines={1}>{currentInstruction}</Text>
            {nextInstruction ? (
              <Text style={s.navBarNext} numberOfLines={1}>Then: {nextInstruction}</Text>
            ) : null}
          </View>
          <TouchableOpacity onPress={stopNavigation} style={s.navBarExit}>
            <Text style={s.navBarExitText}>✕</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      {/* ── SEARCH BAR ─────────────────────────────────────────────────── */}
      {!isNavigating && (
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={s.searchWrapper}
          pointerEvents="box-none"
        >
          <View style={s.searchCard}>

            {/* Collapsed single bar */}
            {!searchExpanded && !routeCoords.length && (
              <TouchableOpacity style={s.searchBarIdle} onPress={() => setSearchExpanded(true)} activeOpacity={0.9}>
                <View style={s.searchIdleIcon}><Text>🔍</Text></View>
                <Text style={s.searchIdlePlaceholder}>{start || "Search or enter destination…"}</Text>
                {userLocation && (
                  <View style={s.searchIdleDot} />
                )}
              </TouchableOpacity>
            )}

            {/* Expanded inputs */}
            {(searchExpanded || routeCoords.length > 0) && (
              <View>
                {/* Start */}
                <View style={s.inputRow}>
                  <View style={s.inputLineWrap}>
                    <View style={[s.inputDotTop, { backgroundColor: "#1a73e8" }]} />
                    <View style={s.inputLine} />
                    <View style={[s.inputDotBottom, { backgroundColor: "#ea4335" }]} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={s.inputBox}>
                      <TextInput
                        style={s.inputField}
                        placeholder="Your location"
                        placeholderTextColor="#9aa0a6"
                        value={start}
                        onFocus={() => { setActiveInput("start"); }}
                        onChangeText={(t) => { setStart(t); setActiveInput("start"); searchLocation(t); }}
                      />
                      {start.length > 0 && (
                        <TouchableOpacity onPress={() => setStart("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={s.inputClearText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    <View style={s.inputSep} />
                    <View style={s.inputBox}>
                      <TextInput
                        style={s.inputField}
                        placeholder="Choose destination"
                        placeholderTextColor="#9aa0a6"
                        value={end}
                        onFocus={() => { setActiveInput("end"); }}
                        onChangeText={(t) => { setEnd(t); setActiveInput("end"); searchLocation(t); }}
                      />
                      {end.length > 0 && (
                        <TouchableOpacity onPress={() => setEnd("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                          <Text style={s.inputClearText}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                </View>

                {/* Action row */}
                <View style={s.actionRow}>
                  {routeCoords.length > 0 ? (
                    <TouchableOpacity style={s.btnClear} onPress={clearRoute}>
                      <Text style={s.btnClearText}>Clear Route</Text>
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      style={[s.btnRoute, loadingRoute && { opacity: 0.65 }]}
                      onPress={calculateRoute}
                      disabled={loadingRoute}
                    >
                      {loadingRoute
                        ? <ActivityIndicator color="#fff" size="small" />
                        : <Text style={s.btnRouteText}>Get Safe Route</Text>
                      }
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={s.btnCancel}
                    onPress={() => { setSearchExpanded(false); setSuggestions([]); }}
                  >
                    <Text style={s.btnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Suggestions */}
          {suggestions.length > 0 && (
            <View style={s.suggestionsCard}>
              <FlatList
                data={suggestions.slice(0, 6)}
                keyExtractor={(item) => item.place_id.toString()}
                keyboardShouldPersistTaps="handled"
                renderItem={({ item }) => (
                  <TouchableOpacity style={s.suggRow} onPress={() => selectSuggestion(item)}>
                    <View style={s.suggIconWrap}><Text style={{ fontSize: 14 }}>📍</Text></View>
                    <Text style={s.suggText} numberOfLines={2}>{item.display_name}</Text>
                  </TouchableOpacity>
                )}
                ItemSeparatorComponent={() => <View style={s.suggSep} />}
              />
            </View>
          )}
        </KeyboardAvoidingView>
      )}

      {/* ── RIGHT SIDE FABs ─────────────────────────────────────────────── */}
      {!isNavigating && (
        <View style={s.fabStack}>
          <TouchableOpacity style={s.fab} onPress={() => setShowLegend(!showLegend)}>
            <Text style={s.fabText}>🗂</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.fab} onPress={centerOnUser}>
            <Text style={[s.fabText, { color: "#1a73e8" }]}>◎</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── LEGEND ──────────────────────────────────────────────────────── */}
      {showLegend && (
        <Animated.View style={[s.legendCard, { opacity: legendAnim }]}>
          <Text style={s.legendTitle}>FLOOD ZONES</Text>
          {Object.entries(SEVERITY_LABEL).map(([key, label]) => (
            <View key={key} style={s.legendRow}>
              <View style={[s.legendSwatch, { backgroundColor: SEVERITY_STROKE[key] }]} />
              <Text style={s.legendLabel}>{label}</Text>
            </View>
          ))}
          <View style={s.legendHr} />
          <Text style={s.legendTitle}>HAZARDS</Text>
          {Object.entries(REPORT_ICONS).map(([type, icon]) => (
            <View key={type} style={s.legendRow}>
              <Text style={{ fontSize: 13, width: 18 }}>{icon}</Text>
              <Text style={s.legendLabel}>{REPORT_LABEL[type]}</Text>
            </View>
          ))}
        </Animated.View>
      )}

      {/* ── BOTTOM SHEET ────────────────────────────────────────────────── */}
      <Animated.View style={[s.sheet, { transform: [{ translateY: sheetTranslate }] }]}>
        {steps.length > 0 && (
          <>
            {/* Safe route banner */}
            {routeAvoided > 0 && (
              <View style={s.safeBanner}>
                <Text style={s.safeBannerIcon}>🛡</Text>
                <Text style={s.safeBannerText}>
                  Route avoids {routeAvoided} flood-zone segments
                </Text>
              </View>
            )}

            {/* Stats */}
            <View style={s.statsRow}>
              <View style={s.statItem}>
                <Text style={s.statValue}>{fmtDur(duration)}</Text>
                <Text style={s.statLabel}>ETA</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{fmtDist(distance)}</Text>
                <Text style={s.statLabel}>Distance</Text>
              </View>
              <View style={s.statDivider} />
              <View style={s.statItem}>
                <Text style={s.statValue}>{steps.length}</Text>
                <Text style={s.statLabel}>Steps</Text>
              </View>
            </View>

            {/* Next turn preview */}
            <View style={s.turnPreview}>
              <View style={s.turnArrowBox}>
                <Text style={s.turnArrow}>↑</Text>
              </View>
              <Text style={s.turnText} numberOfLines={2}>{currentInstruction}</Text>
            </View>

            {/* Buttons */}
            {!isNavigating ? (
              <TouchableOpacity style={s.btnStart} onPress={startNavigation}>
                <Text style={s.btnStartText}>▶  Start Navigation</Text>
              </TouchableOpacity>
            ) : (
              <View style={s.navActiveRow}>
                <View style={s.progressWrap}>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, {
                      width: `${Math.round(((currentStep + 1) / steps.length) * 100)}%` as any
                    }]} />
                  </View>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 4 }}>
                    <Text style={s.progressLabel}>Step {currentStep + 1} / {steps.length}</Text>
                    <Text style={s.progressLabel}>{Math.round(((currentStep + 1) / steps.length) * 100)}%</Text>
                  </View>
                </View>
                <TouchableOpacity style={s.btnStopSmall} onPress={stopNavigation}>
                  <Text style={s.btnStopSmallText}>Stop</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </Animated.View>

      {/* ── HAZARD CARD ─────────────────────────────────────────────────── */}
      {selectedReport && (
        <Animated.View style={[s.hazardCard, { transform: [{ translateY: reportAnim }] }]}>
          <View style={s.hazardHandle} />
          <View style={s.hazardHeader}>
            <View style={s.hazardIconBox}>
              <Text style={{ fontSize: 26 }}>{REPORT_ICONS[selectedReport.report_type]}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.hazardType}>{REPORT_LABEL[selectedReport.report_type]}</Text>
              <Text style={s.hazardCoord}>
                {selectedReport.location.latitude.toFixed(5)}, {selectedReport.location.longitude.toFixed(5)}
              </Text>
            </View>
            <View style={[s.sevBadge, { backgroundColor: getSeverityColor(selectedReport.severity) }]}>
              <Text style={s.sevBadgeText}>SEV {selectedReport.severity}/5</Text>
            </View>
          </View>
          <Text style={s.hazardDesc}>{selectedReport.description}</Text>
          <View style={s.hazardFooter}>
            <Text style={s.hazardExpiry}>
              ⏱ Expires {new Date(selectedReport.expires_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <TouchableOpacity style={s.dismissBtn} onPress={() => setSelectedReport(null)}>
              <Text style={s.dismissBtnText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1 },

  // Navigation bar (top, slides in during navigation)
  navBar: {
    position: "absolute", top: 0, left: 0, right: 0,
    backgroundColor: "#1a73e8",
    paddingTop: Platform.OS === "ios" ? 52 : 36,
    paddingBottom: 14,
    shadowColor: "#000", shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.22, shadowRadius: 8, elevation: 8,
    zIndex: 30,
  },
  navBarContent: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, gap: 12,
  },
  navBarArrowBox: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },
  navBarArrowText: { fontSize: 22, color: "#fff", fontWeight: "800" },
  navBarInstruction: { fontSize: 16, fontWeight: "700", color: "#fff" },
  navBarNext: { fontSize: 12, color: "rgba(255,255,255,0.7)", marginTop: 2 },
  navBarExit: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
  },
  navBarExitText: { color: "#fff", fontSize: 15, fontWeight: "700" },

  // Search
  searchWrapper: {
    position: "absolute",
    top: Platform.OS === "ios" ? 52 : 34,
    left: 12, right: 12,
    zIndex: 20,
  },
  searchCard: {
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 6, paddingHorizontal: 6,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2, shadowRadius: 10, elevation: 8,
  },
  searchBarIdle: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 10, paddingVertical: 9, gap: 10,
  },
  searchIdleIcon: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: "#f1f3f4",
    alignItems: "center", justifyContent: "center",
  },
  searchIdlePlaceholder: { flex: 1, fontSize: 15, color: "#5f6368" },
  searchIdleDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: "#1a73e8",
  },

  // Expanded inputs
  inputRow: {
    flexDirection: "row", alignItems: "stretch",
    paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4,
  },
  inputLineWrap: {
    width: 20, alignItems: "center", paddingVertical: 2,
    marginRight: 10, gap: 2,
  },
  inputDotTop: { width: 10, height: 10, borderRadius: 5 },
  inputLine: { flex: 1, width: 2, backgroundColor: "#e0e0e0" },
  inputDotBottom: { width: 10, height: 10, borderRadius: 5 },
  inputBox: {
    flexDirection: "row", alignItems: "center",
    paddingVertical: 6,
  },
  inputField: {
    flex: 1, fontSize: 14, color: "#202124", paddingVertical: 0,
  },
  inputClearText: { color: "#9aa0a6", fontSize: 13, paddingLeft: 6 },
  inputSep: { height: 1, backgroundColor: "#f1f3f4" },
  actionRow: {
    flexDirection: "row", paddingHorizontal: 10,
    paddingBottom: 6, paddingTop: 8, gap: 8,
  },
  btnRoute: {
    flex: 1, backgroundColor: "#1a73e8",
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
  },
  btnRouteText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  btnClear: {
    flex: 1, backgroundColor: "#fff",
    borderRadius: 10, paddingVertical: 12, alignItems: "center",
    borderWidth: 1.5, borderColor: "#ea4335",
  },
  btnClearText: { color: "#ea4335", fontWeight: "700", fontSize: 14 },
  btnCancel: {
    paddingHorizontal: 10, paddingVertical: 12,
    alignItems: "center", justifyContent: "center",
  },
  btnCancelText: { color: "#1a73e8", fontWeight: "600", fontSize: 14 },

  // Suggestions
  suggestionsCard: {
    backgroundColor: "#fff", borderRadius: 14,
    marginTop: 6, maxHeight: 280,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
    overflow: "hidden",
  },
  suggRow: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  suggIconWrap: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "#f1f3f4",
    alignItems: "center", justifyContent: "center", marginRight: 12,
  },
  suggText: { flex: 1, fontSize: 13, color: "#202124", lineHeight: 18 },
  suggSep: { height: 1, backgroundColor: "#f8f9fa", marginLeft: 60 },

  // FABs
  fabStack: {
    position: "absolute",
    right: 12,
    bottom: 210,
    gap: 10,
  },
  fab: {
    width: 48, height: 48, borderRadius: 12,
    backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 5,
  },
  fabText: { fontSize: 20, color: "#5f6368" },

  // Legend
  legendCard: {
    position: "absolute",
    right: 70,
    bottom: 210,
    backgroundColor: "#fff",
    borderRadius: 14, padding: 14,
    minWidth: 164,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 8, elevation: 6,
  },
  legendTitle: {
    fontSize: 9, fontWeight: "800", color: "#80868b",
    letterSpacing: 0.8, marginBottom: 8, textTransform: "uppercase",
  },
  legendRow: { flexDirection: "row", alignItems: "center", marginBottom: 6, gap: 8 },
  legendSwatch: { width: 12, height: 12, borderRadius: 3 },
  legendLabel: { fontSize: 12, color: "#3c4043", fontWeight: "500" },
  legendHr: { height: 1, backgroundColor: "#f1f3f4", marginVertical: 8 },

  // Markers
  pin: {
    backgroundColor: "#fff", borderRadius: 20, padding: 5,
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22, shadowRadius: 4, elevation: 4,
    borderWidth: 1, borderColor: "#e8eaed",
  },
  pinIcon: { fontSize: 20 },

  // Bottom sheet
  sheet: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 10,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1, shadowRadius: 12, elevation: 12,
  },
  safeBanner: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#e6f4ea", borderRadius: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 14, gap: 8,
  },
  safeBannerIcon: { fontSize: 16 },
  safeBannerText: { flex: 1, fontSize: 13, color: "#137333", fontWeight: "600" },
  statsRow: {
    flexDirection: "row", alignItems: "center", marginBottom: 14,
  },
  statItem: { flex: 1, alignItems: "center" },
  statValue: { fontSize: 21, fontWeight: "800", color: "#202124" },
  statLabel: { fontSize: 11, color: "#80868b", marginTop: 2, fontWeight: "500" },
  statDivider: { width: 1, height: 34, backgroundColor: "#f1f3f4" },
  turnPreview: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: "#f8f9fa", borderRadius: 12,
    paddingHorizontal: 14, paddingVertical: 12,
    marginBottom: 14, gap: 12,
  },
  turnArrowBox: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "#1a73e8",
    alignItems: "center", justifyContent: "center",
  },
  turnArrow: { fontSize: 18, color: "#fff", fontWeight: "800" },
  turnText: { flex: 1, fontSize: 14, color: "#202124", fontWeight: "600" },
  btnStart: {
    backgroundColor: "#1a73e8", borderRadius: 12,
    paddingVertical: 15, alignItems: "center",
  },
  btnStartText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: 0.3 },
  navActiveRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  progressWrap: { flex: 1 },
  progressTrack: {
    height: 6, backgroundColor: "#f1f3f4",
    borderRadius: 3, overflow: "hidden",
  },
  progressFill: { height: "100%", backgroundColor: "#1a73e8", borderRadius: 3 },
  progressLabel: { fontSize: 11, color: "#9aa0a6" },
  btnStopSmall: {
    backgroundColor: "#fce8e6", borderRadius: 10,
    paddingHorizontal: 16, paddingVertical: 12,
  },
  btnStopSmallText: { color: "#c5221f", fontWeight: "700", fontSize: 13 },

  // Hazard card
  hazardCard: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 36 : 22,
    shadowColor: "#000", shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.14, shadowRadius: 12, elevation: 14,
  },
  hazardHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: "#e8eaed", alignSelf: "center", marginBottom: 16,
  },
  hazardHeader: {
    flexDirection: "row", alignItems: "center", marginBottom: 12, gap: 12,
  },
  hazardIconBox: {
    width: 52, height: 52, borderRadius: 14,
    backgroundColor: "#fef9c3",
    alignItems: "center", justifyContent: "center",
  },
  hazardType: { fontSize: 16, fontWeight: "700", color: "#202124" },
  hazardCoord: {
    fontSize: 11, color: "#9aa0a6", marginTop: 2,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  sevBadge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  sevBadgeText: { color: "#fff", fontSize: 11, fontWeight: "800" },
  hazardDesc: { fontSize: 14, color: "#5f6368", lineHeight: 20, marginBottom: 14 },
  hazardFooter: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
  },
  hazardExpiry: { fontSize: 12, color: "#9aa0a6" },
  dismissBtn: {
    backgroundColor: "#f1f3f4", borderRadius: 8,
    paddingHorizontal: 16, paddingVertical: 8,
  },
  dismissBtnText: { fontSize: 13, fontWeight: "700", color: "#5f6368" },
});
