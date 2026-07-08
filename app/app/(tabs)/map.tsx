import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, Alert,
  StyleSheet, Animated, Platform,
  StatusBar, ScrollView,
} from 'react-native';
import MapView, { Marker, Polygon, Polyline, UrlTile, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import * as Speech from 'expo-speech';

import SearchModal from '../components/map/SearchModal';
import RouteSheet from '../components/map/RouteSheet';
import { FloodAlertPopup, ReroutingOverlay, HazardCard } from '../components/map/MapOverlays';

import {
  C, BASE_URL, REFRESH_INTERVAL, TOP,
  ZONE_FILL, ZONE_STROKE, ZONE_LABEL,
  ZONE_BADGE_BG, ZONE_BADGE_TEXT,
  SEGMENT_COLOR, HAZARD_ICON, HAZARD_LABEL, HAZARD_COLOR,
  MOCK_ZONES, MOCK_REPORTS,
} from '../constants/mapConstants';
import type { Coord, FloodZone, HazardReport, NavStep, RouteOption, RouteSegment } from '../constants/mapConstants';
import {
  abortAfter, pointInPolygon, distM, buildInstruction,
  buildSafeRoute, fmtDist, fmtTime, colorSegments,
} from '../utils/mapHelpers';

export default function MapScreen() {
  const [startText,  setStartText]  = useState('');
  const [endText,    setEndText]    = useState('');
  const [searchOpen, setSearchOpen] = useState(false);

  const [floodZones,    setFloodZones]    = useState<FloodZone[]>([]);
  const [hazardReports, setHazardReports] = useState<HazardReport[]>([]);
  const [userCoord,     setUserCoord]     = useState<Coord | null>(null);

  const [loadingRoute, setLoadingRoute] = useState(false);
  const [rerouting,    setRerouting]    = useState(false);

  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedIdx,  setSelectedIdx]  = useState(0);
  const [showAlts,     setShowAlts]     = useState(false);
  const [activeOption, setActiveOption] = useState<RouteOption | null>(null);

  const [steps,      setSteps]      = useState<NavStep[]>([]);
  const [stepIdx,    setStepIdx]    = useState(0);
  const [navigating, setNavigating] = useState(false);
  const [voiceOn,    setVoiceOn]    = useState(true);

  const [activeReport,     setActiveReport]     = useState<HazardReport | null>(null);
  const [legendOpen,       setLegendOpen]       = useState(false);
  const [alertZone,        setAlertZone]        = useState<FloodZone | null>(null);
  const [refreshCountdown, setRefreshCountdown] = useState(REFRESH_INTERVAL);

  const mapRef       = useRef<MapView>(null);
  const navRef       = useRef(false);
  const stepRef      = useRef(0);
  const spokenStep   = useRef(-1);
  const endCoordRef  = useRef<Coord | null>(null);
  const zonesRef     = useRef<FloodZone[]>([]);
  const hazardsRef   = useRef<HazardReport[]>([]);
  const rerouteGuard = useRef(false);

  const [region, setRegion] = useState({
    latitude: 7.8731, longitude: 80.7718,
    latitudeDelta: 0.8, longitudeDelta: 0.8,
  });

  const sheetY   = useRef(new Animated.Value(500)).current;
  const navBarY  = useRef(new Animated.Value(-160)).current;
  const legendOp = useRef(new Animated.Value(0)).current;
  const legendSc = useRef(new Animated.Value(0.92)).current;

  useEffect(() => { zonesRef.current   = floodZones;   }, [floodZones]);
  useEffect(() => { hazardsRef.current = hazardReports; }, [hazardReports]);
  useEffect(() => { bootLocation(); loadFloodZones(); loadHazardReports(); }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setRefreshCountdown(p => {
        if (p <= 1) { loadFloodZones(); loadHazardReports(); return REFRESH_INTERVAL; }
        return p - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    Animated.spring(sheetY, { toValue: activeOption && !showAlts ? 0 : 500, useNativeDriver: true, tension: 68, friction: 11 }).start();
  }, [activeOption, showAlts]);

  useEffect(() => {
    Animated.spring(navBarY, { toValue: navigating ? 0 : -160, useNativeDriver: true, tension: 68, friction: 11 }).start();
  }, [navigating]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(legendOp, { toValue: legendOpen ? 1 : 0, duration: 200, useNativeDriver: true }),
      Animated.spring(legendSc, { toValue: legendOpen ? 1 : 0.92, useNativeDriver: true, tension: 80, friction: 10 }),
    ]).start();
  }, [legendOpen]);

  useEffect(() => { stepRef.current = stepIdx;   }, [stepIdx]);
  useEffect(() => { navRef.current  = navigating; }, [navigating]);

  // ── Location ──────────────────────────────────────────────────────────────

  const bootLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Permission needed', 'Enable location for safe routing.'); return; }
    const initial = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const c: Coord = { latitude: initial.coords.latitude, longitude: initial.coords.longitude };
    setUserCoord(c);
    setRegion({ ...c, latitudeDelta: 0.08, longitudeDelta: 0.08 });

    Location.watchPositionAsync({ accuracy: Location.Accuracy.High, timeInterval: 2000, distanceInterval: 8 }, async loc => {
      const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setUserCoord(coord);
      if (!navRef.current) return;

      mapRef.current?.animateCamera({ center: coord, zoom: 17, heading: loc.coords.heading ?? 0, pitch: 45 }, { duration: 700 });

      setSteps(prev => {
        if (!prev.length) return prev;
        const i  = stepRef.current;
        const st = prev[i];
        if (!st) return prev;
        const nxt: Coord = { latitude: st.maneuver.location[1], longitude: st.maneuver.location[0] };
        if (distM(coord, nxt) < 50 && i < prev.length - 1) {
          const ni = i + 1;
          stepRef.current = ni; setStepIdx(ni);
          if (voiceOn && spokenStep.current !== ni) {
            spokenStep.current = ni;
            const instr = buildInstruction(prev[ni]);
            if (instr) Speech.speak(instr, { language: 'en', rate: 0.9, pitch: 1.0 });
          }
        }
        if (i === prev.length - 1 && distM(coord, nxt) < 30) {
          Speech.speak('You have arrived at your destination. Stay safe!', { language: 'en' });
          Alert.alert('🎉 Arrived!', 'You reached your destination safely.');
          navRef.current = false; setNavigating(false); setActiveOption(null); setSteps([]);
        }
        return prev;
      });

      if (rerouteGuard.current || !endCoordRef.current) return;
      const zones   = zonesRef.current;
      const hazards = hazardsRef.current;
      const inFlood = zones.some(z => z.severity !== 'NORMAL' && pointInPolygon(coord, z.boundary.coordinates));
      if (inFlood) {
        rerouteGuard.current = true;
        setRerouting(true);
        if (voiceOn) Speech.speak('Flood zone detected. Rerouting to a safer path.', { language: 'en' });
        try {
          const { safest } = await buildSafeRoute(coord, endCoordRef.current, zones, hazards);
          setActiveOption(safest); setSteps(safest.steps); setStepIdx(0);
          stepRef.current = 0; spokenStep.current = -1;
          mapRef.current?.fitToCoordinates(safest.coords, { edgePadding: { top: 160, right: 40, bottom: 380, left: 40 }, animated: true });
        } catch (_) { Alert.alert('Reroute failed', 'Could not find a safe alternative route.'); }
        setRerouting(false);
        setTimeout(() => { rerouteGuard.current = false; }, 30_000);
      }
    });
  };

  // ── API calls ─────────────────────────────────────────────────────────────

  const loadFloodZones = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/v1/flood-zones`, { signal: abortAfter(5000) });
      const json = await res.json();
      if (json.success && json.data?.zones?.length) { setFloodZones(json.data.zones); setRefreshCountdown(REFRESH_INTERVAL); return; }
    } catch (_) {}
    setFloodZones(MOCK_ZONES); setRefreshCountdown(REFRESH_INTERVAL);
  };

  const loadHazardReports = async () => {
    try {
      const res  = await fetch(`${BASE_URL}/api/v1/reports/active`, { signal: abortAfter(5000) });
      const json = await res.json();
      if (json.success && json.data?.reports?.length) { setHazardReports(json.data.reports); return; }
    } catch (_) {}
    setHazardReports(MOCK_REPORTS);
  };

  // ── Use my location ───────────────────────────────────────────────────────

  const handleUseMyLocation = useCallback(async () => {
    if (!userCoord) { Alert.alert('Location unavailable', 'Waiting for GPS signal.'); return; }
    try {
      const results = await Location.reverseGeocodeAsync(userCoord);
      if (results.length > 0) {
        const r = results[0];
        const parts = [r.name, r.street, r.district, r.city, r.region].filter(Boolean);
        setStartText(parts.join(', ') || `${userCoord.latitude.toFixed(5)}, ${userCoord.longitude.toFixed(5)}`);
      } else {
        setStartText(`${userCoord.latitude.toFixed(5)}, ${userCoord.longitude.toFixed(5)}`);
      }
    } catch (_) {
      setStartText(`${userCoord.latitude.toFixed(5)}, ${userCoord.longitude.toFixed(5)}`);
    }
  }, [userCoord]);

  // ── Route planning ────────────────────────────────────────────────────────

  const getRoute = async () => {
    if (!startText || !endText) return Alert.alert('Incomplete', 'Enter both start and destination.');
    setLoadingRoute(true); setSearchOpen(false);
    try {
      let startC: Coord;
      const coordMatch = startText.match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/);
      if (coordMatch) {
        startC = { latitude: parseFloat(coordMatch[1]), longitude: parseFloat(coordMatch[2]) };
      } else if (userCoord && (startText.toLowerCase().includes('current') || startText.toLowerCase().includes('my location'))) {
        startC = userCoord;
      } else {
        const sArr = await Location.geocodeAsync(startText);
        if (!sArr.length) throw new Error('Start location not found.');
        startC = { latitude: sArr[0].latitude, longitude: sArr[0].longitude };
      }
      const eArr = await Location.geocodeAsync(endText);
      if (!eArr.length) throw new Error('Destination not found.');
      const endC: Coord = { latitude: eArr[0].latitude, longitude: eArr[0].longitude };

      endCoordRef.current = endC;
      const { safest, fastest } = await buildSafeRoute(startC, endC, floodZones, hazardReports);
      setRouteOptions([safest, fastest]);
      setSelectedIdx(0); setShowAlts(true); setActiveOption(safest);
      mapRef.current?.fitToCoordinates(safest.coords, { edgePadding: { top: 140, right: 40, bottom: 520, left: 40 }, animated: true });
    } catch (e: any) { Alert.alert('Route Error', e.message ?? 'Could not get route.'); }
    setLoadingRoute(false);
  };

  const previewRoute = (i: number) => {
    setSelectedIdx(i);
    const opt = routeOptions[i]; if (!opt) return;
    setActiveOption(opt);
    mapRef.current?.fitToCoordinates(opt.coords, { edgePadding: { top: 140, right: 40, bottom: 520, left: 40 }, animated: true });
  };

  const confirmRoute = () => {
    const opt = routeOptions[selectedIdx]; if (!opt) return;
    setActiveOption(opt); setSteps(opt.steps); setStepIdx(0); stepRef.current = 0;
    setShowAlts(false); setNavigating(false);
    mapRef.current?.fitToCoordinates(opt.coords, { edgePadding: { top: 140, right: 40, bottom: 430, left: 40 }, animated: true });
  };

  const startNav = () => {
    if (!userCoord) { Alert.alert('No GPS', 'Waiting for location.'); return; }
    spokenStep.current = -1; rerouteGuard.current = false;
    navRef.current = true; setNavigating(true);
    mapRef.current?.animateCamera({ center: userCoord, zoom: 17, pitch: 45 }, { duration: 900 });
    if (voiceOn && steps[0]) Speech.speak(`Starting navigation. ${buildInstruction(steps[0])}`, { language: 'en', rate: 0.9 });
  };

  const stopNav = () => {
    navRef.current = false; setNavigating(false); Speech.stop();
    if (activeOption?.coords.length)
      mapRef.current?.fitToCoordinates(activeOption.coords, { edgePadding: { top: 140, right: 40, bottom: 430, left: 40 }, animated: true });
  };

  const clearAll = () => {
    setActiveOption(null); setSteps([]); navRef.current = false; setNavigating(false);
    stepRef.current = 0; setStepIdx(0); setStartText(''); setEndText('');
    setRouteOptions([]); setShowAlts(false); endCoordRef.current = null; Speech.stop();
  };

  const goToUser = () => {
    if (userCoord) mapRef.current?.animateCamera({ center: userCoord, zoom: 16 }, { duration: 600 });
  };

  const curInstruction = steps[stepIdx]     ? buildInstruction(steps[stepIdx])     : 'Follow the route';
  const nxtInstruction = steps[stepIdx + 1] ? buildInstruction(steps[stepIdx + 1]) : '';
  const progress = steps.length ? (stepIdx + 1) / steps.length : 0;

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <View style={g.root}>
      <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      {/* ── Map ── */}
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        provider={PROVIDER_DEFAULT}
        region={region}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsCompass={false}
        showsMyLocationButton={false}
        onPress={() => setLegendOpen(false)}
      >
        <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />

        {floodZones.map(z => (
          <Polygon key={z.id} coordinates={z.boundary.coordinates}
            fillColor={ZONE_FILL[z.severity]} strokeColor={ZONE_STROKE[z.severity]} strokeWidth={2.5} />
        ))}

        {showAlts && routeOptions.map((opt, i) =>
          i !== selectedIdx && opt.coords.length > 0
            ? <Polyline key={`dim-${i}`} coordinates={opt.coords} strokeColor="rgba(100,100,100,0.22)" strokeWidth={6} lineCap="round" />
            : null
        )}

        {activeOption?.segments.map((seg, i) => (
          <React.Fragment key={`seg-${i}`}>
            <Polyline coordinates={seg.coords} strokeColor={`${SEGMENT_COLOR[seg.risk]}30`} strokeWidth={20} lineCap="round" />
            <Polyline coordinates={seg.coords} strokeColor={SEGMENT_COLOR[seg.risk]} strokeWidth={7} lineCap="round" lineJoin="round" />
          </React.Fragment>
        ))}

        {hazardReports.map(r => (
          <Marker key={r.id} coordinate={r.location} anchor={{ x: 0.5, y: 1 }} onPress={() => setActiveReport(r)}>
            <View style={[g.hazPin, { borderColor: HAZARD_COLOR[r.report_type] }]}>
              <Text style={g.hazPinIcon}>{HAZARD_ICON[r.report_type]}</Text>
            </View>
          </Marker>
        ))}
      </MapView>

      <ReroutingOverlay visible={rerouting} />

      {/* ── Active navigation bar ── */}
      <Animated.View style={[g.navBar, { transform: [{ translateY: navBarY }] }]}>
        <View style={g.navBarInner}>
          <View style={g.navDirBox}>
            <Text style={g.navArrow}>↑</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={g.navSubLabel}>Next manoeuvre</Text>
            <Text style={g.navInst} numberOfLines={1}>{curInstruction}</Text>
            {!!nxtInstruction && <Text style={g.navNext} numberOfLines={1}>then · {nxtInstruction}</Text>}
          </View>
          <TouchableOpacity style={g.navIconBtn} onPress={() => { setVoiceOn(v => !v); if (voiceOn) Speech.stop(); }}>
            <Text style={{ fontSize: 18 }}>{voiceOn ? '🔊' : '🔇'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[g.navIconBtn, g.navEndBtn]} onPress={stopNav}>
            <Text style={{ color: C.error, fontWeight: '800', fontSize: 13 }}>END</Text>
          </TouchableOpacity>
        </View>
        <View style={g.navProgTrack}>
          <View style={[g.navProgFill, { width: `${Math.round(progress * 100)}%` as any }]} />
        </View>
      </Animated.View>

      {/* ── Top search / route bar ── */}
      {!navigating && (
        <View style={g.topBar} pointerEvents="box-none">
          {!activeOption && !showAlts ? (
            <TouchableOpacity style={g.searchPill} onPress={() => setSearchOpen(true)} activeOpacity={0.92}>
              <View style={g.searchPillIcon}><Text style={{ fontSize: 15 }}>🔍</Text></View>
              <Text style={g.searchPillText}>Where to navigate?</Text>
              {userCoord && <View style={g.gpsDot} />}
            </TouchableOpacity>
          ) : (
            <View style={g.routeBar}>
              <View style={{ flex: 1 }}>
                <Text style={g.routeBarDest} numberOfLines={1}>{endText}</Text>
                <Text style={g.routeBarMeta}>{activeOption ? `${fmtTime(activeOption.duration)} · ${fmtDist(activeOption.distance)}` : 'Calculating…'}</Text>
              </View>
              <TouchableOpacity style={g.clearBtn} onPress={clearAll}>
                <Text style={g.clearBtnTxt}>✕ Clear</Text>
              </TouchableOpacity>
            </View>
          )}
          <View style={g.refreshChip} pointerEvents="none">
            <View style={[g.refreshDot, { backgroundColor: refreshCountdown > 10 ? C.secondary : C.warning }]} />
            <Text style={g.refreshTxt}>Refresh {refreshCountdown}s</Text>
          </View>
        </View>
      )}

      {/* ── FABs ── */}
      {!navigating && (
        <View style={g.fabs}>
          <TouchableOpacity style={g.fab} onPress={() => setLegendOpen(v => !v)}>
            <Text style={{ fontSize: 20 }}>🗂</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[g.fab, { backgroundColor: C.primary }]} onPress={goToUser}>
            <Text style={{ fontSize: 22, color: '#fff' }}>◎</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Legend ── */}
      <Animated.View
        style={[g.legend, { opacity: legendOp, transform: [{ scale: legendSc }] }]}
        pointerEvents={legendOpen ? 'auto' : 'none'}
      >
        <ScrollView showsVerticalScrollIndicator={false} bounces={false}>
          <Text style={g.legendHdr}>FLOOD ZONES</Text>
          {Object.entries(ZONE_LABEL).map(([k, v]) => (
            <View key={k} style={g.legendRow}>
              <View style={[g.legendSwatch, { backgroundColor: ZONE_STROKE[k] }]} />
              <Text style={g.legendTxt}>{v}</Text>
              <View style={[g.legendBadge, { backgroundColor: ZONE_BADGE_BG[k] }]}>
                <Text style={[g.legendBadgeTxt, { color: ZONE_BADGE_TEXT[k] }]}>{k}</Text>
              </View>
            </View>
          ))}
          <View style={g.legendDiv} />
          <Text style={g.legendHdr}>ROUTE</Text>
          {(Object.entries(SEGMENT_COLOR) as [RouteSegment['risk'], string][]).map(([k, col]) => (
            <View key={k} style={g.legendRow}>
              <View style={[g.legendSwatch, { backgroundColor: col, borderRadius: 2 }]} />
              <Text style={g.legendTxt}>{k.charAt(0).toUpperCase() + k.slice(1)}</Text>
            </View>
          ))}
          <View style={g.legendDiv} />
          <Text style={g.legendHdr}>HAZARDS</Text>
          {Object.entries(HAZARD_ICON).map(([k, ic]) => (
            <View key={k} style={g.legendRow}>
              <Text style={{ fontSize: 13, width: 20 }}>{ic}</Text>
              <Text style={g.legendTxt}>{HAZARD_LABEL[k]}</Text>
            </View>
          ))}
        </ScrollView>
      </Animated.View>

      {/* ── Route alternatives sheet ── */}
      <RouteSheet
        visible={showAlts} options={routeOptions}
        selectedIdx={selectedIdx} onSelect={previewRoute}
        onConfirm={confirmRoute}
        onClose={() => { setShowAlts(false); clearAll(); }}
      />

      {/* ── Bottom info sheet ── */}
      <Animated.View style={[g.sheet, { transform: [{ translateY: sheetY }] }]}>
        {activeOption && !showAlts && (
          <>
            <View style={g.sheetHandle} />
            {activeOption.detoured ? (
              <View style={[g.statusBanner, { backgroundColor: '#dcfce7' }]}>
                <Text style={g.statusIcon}>🛡</Text>
                <Text style={[g.statusTxt, { color: '#137333' }]}>
                  Flood-safe — rerouted around {routeOptions.find(o => o.tag === 'fastest')?.zonesHit.length ?? 0} zone(s)
                </Text>
              </View>
            ) : activeOption.zonesHit.length > 0 ? (
              <View style={[g.statusBanner, { backgroundColor: '#fce8e6' }]}>
                <Text style={g.statusIcon}>⚠️</Text>
                <Text style={[g.statusTxt, { color: '#b31412' }]}>
                  Caution — passes through {activeOption.zonesHit.length} flood zone(s)
                </Text>
              </View>
            ) : (
              <View style={[g.statusBanner, { backgroundColor: '#dcfce7' }]}>
                <Text style={g.statusIcon}>✅</Text>
                <Text style={[g.statusTxt, { color: '#137333' }]}>Route is clear of all flood zones</Text>
              </View>
            )}

            <View style={g.statsRow}>
              <View style={g.statItem}>
                <Text style={[g.statVal, { color: C.secondary }]}>{fmtTime(activeOption.duration)}</Text>
                <Text style={g.statLbl}>ETA</Text>
              </View>
              <View style={g.statDiv} />
              <View style={g.statItem}>
                <Text style={[g.statVal, { color: C.onSurface }]}>{fmtDist(activeOption.distance)}</Text>
                <Text style={g.statLbl}>Distance</Text>
              </View>
              <View style={g.statDiv} />
              <View style={g.statItem}>
                <Text style={[g.statVal, { color: activeOption.zonesHit.length ? C.error : C.secondary }]}>
                  {activeOption.zonesHit.length}
                </Text>
                <Text style={g.statLbl}>Flood zones</Text>
              </View>
            </View>

            <View style={g.instrRow}>
              <View style={g.instrArrow}>
                <Text style={g.instrArrowTxt}>↑</Text>
              </View>
              <Text style={g.instrTxt} numberOfLines={2}>{curInstruction}</Text>
              <TouchableOpacity style={[g.voiceBtn, voiceOn && g.voiceBtnOn]} onPress={() => setVoiceOn(v => !v)}>
                <Text style={{ fontSize: 16 }}>{voiceOn ? '🔊' : '🔇'}</Text>
              </TouchableOpacity>
            </View>

            {!navigating ? (
              <TouchableOpacity style={g.startBtn} onPress={startNav}>
                <Text style={g.startBtnTxt}>▶  Start Navigation</Text>
              </TouchableOpacity>
            ) : (
              <View style={g.activeRow}>
                <View style={{ flex: 1 }}>
                  <View style={g.progTrack}>
                    <View style={[g.progFill, { width: `${Math.round(progress * 100)}%` as any }]} />
                  </View>
                  <View style={g.progLbls}>
                    <Text style={g.progLbl}>Step {stepIdx + 1} / {steps.length}</Text>
                    <Text style={g.progLbl}>{Math.round(progress * 100)}%</Text>
                  </View>
                </View>
                <TouchableOpacity style={g.endBtn} onPress={stopNav}>
                  <Text style={g.endBtnTxt}>End</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </Animated.View>

      <SearchModal
        visible={searchOpen} onClose={() => setSearchOpen(false)}
        startText={startText} endText={endText}
        onStartChange={setStartText} onEndChange={setEndText}
        onGetRoute={getRoute} loadingRoute={loadingRoute}
        onUseMyLocation={handleUseMyLocation}
      />

      <FloodAlertPopup zone={alertZone} onDismiss={() => setAlertZone(null)} />
      <HazardCard report={activeReport} onDismiss={() => setActiveReport(null)} />
    </View>
  );
}

const g = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#e7e8e9' },

  hazPin:     { backgroundColor: '#fff', borderRadius: 14, padding: 7, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 6, elevation: 6 },
  hazPinIcon: { fontSize: 18 },

  navBar:       { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 40, backgroundColor: C.primaryContainer, paddingTop: TOP, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 14, elevation: 14 },
  navBarInner:  { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 16, gap: 12 },
  navDirBox:    { width: 54, height: 54, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  navArrow:     { fontSize: 28, color: '#fff', fontWeight: '800' },
  navSubLabel:  { fontSize: 10, color: 'rgba(255,255,255,0.72)', fontWeight: '700', letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 2 },
  navInst:      { fontSize: 17, fontWeight: '800', color: '#fff' },
  navNext:      { fontSize: 12, color: 'rgba(255,255,255,0.68)', marginTop: 3 },
  navIconBtn:   { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  navEndBtn:    { backgroundColor: 'rgba(186,26,26,0.2)' },
  navProgTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.2)' },
  navProgFill:  { height: '100%', backgroundColor: '#fff' },

  topBar:         { position: 'absolute', top: TOP - 8, left: 12, right: 12, zIndex: 30, gap: 8 },
  searchPill:     { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(255,255,255,0.94)', borderRadius: 32, paddingHorizontal: 8, paddingVertical: 8, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.16, shadowRadius: 16, elevation: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  searchPillIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#e7e8e9', alignItems: 'center', justifyContent: 'center' },
  searchPillText: { flex: 1, fontSize: 15, color: C.onSurfaceVariant, fontWeight: '500' },
  gpsDot:         { width: 9, height: 9, borderRadius: 5, backgroundColor: C.primary, marginRight: 4 },
  routeBar:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 18, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.12, shadowRadius: 10, elevation: 8 },
  routeBarDest:   { fontSize: 14, fontWeight: '700', color: C.onSurface },
  routeBarMeta:   { fontSize: 12, color: C.outline, marginTop: 2 },
  clearBtn:       { backgroundColor: '#fce8e6', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 7 },
  clearBtnTxt:    { fontSize: 12, fontWeight: '700', color: '#c5221f' },
  refreshChip:    { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-end', backgroundColor: 'rgba(255,255,255,0.92)', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  refreshDot:     { width: 7, height: 7, borderRadius: 4 },
  refreshTxt:     { fontSize: 11, color: C.onSurfaceVariant, fontWeight: '500' },

  fabs: { position: 'absolute', right: 14, bottom: 100, gap: 12, zIndex: 25 },
  fab:  { width: 52, height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },

  legend:         { position: 'absolute', right: 80, bottom: 180, zIndex: 26, backgroundColor: '#fff', borderRadius: 20, padding: 14, width: 190, maxHeight: 340, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.12, shadowRadius: 14, elevation: 8 },
  legendHdr:      { fontSize: 8, fontWeight: '800', color: C.outline, letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: 8 },
  legendRow:      { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 7 },
  legendSwatch:   { width: 12, height: 12, borderRadius: 3 },
  legendTxt:      { flex: 1, fontSize: 11, color: C.onSurface, fontWeight: '500' },
  legendBadge:    { borderRadius: 5, paddingHorizontal: 5, paddingVertical: 1 },
  legendBadgeTxt: { fontSize: 8, fontWeight: '700' },
  legendDiv:      { height: 1, backgroundColor: '#e7e8e9', marginVertical: 8 },

  sheet:       { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 20, backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 44 : 28, shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.07, shadowRadius: 18, elevation: 18 },
  sheetHandle: { width: 44, height: 5, borderRadius: 3, backgroundColor: C.surfaceDim, alignSelf: 'center', marginTop: 12, marginBottom: 16 },

  statusBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  statusIcon:   { fontSize: 16 },
  statusTxt:    { flex: 1, fontSize: 13, fontWeight: '700' },

  statsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 18, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: C.outlineVariant + '40' },
  statItem: { flex: 1, alignItems: 'center' },
  statVal:  { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  statLbl:  { fontSize: 10, color: C.outline, marginTop: 4, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.8 },
  statDiv:  { width: 1, height: 40, backgroundColor: C.outlineVariant },

  instrRow:      { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: C.surfaceContainerLow, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, marginBottom: 14 },
  instrArrow:    { width: 40, height: 40, borderRadius: 12, backgroundColor: C.primaryContainer, alignItems: 'center', justifyContent: 'center' },
  instrArrowTxt: { fontSize: 20, color: '#fff', fontWeight: '800' },
  instrTxt:      { flex: 1, fontSize: 14, color: C.onSurface, fontWeight: '600', lineHeight: 20 },
  voiceBtn:      { width: 36, height: 36, borderRadius: 18, backgroundColor: '#e7e8e9', alignItems: 'center', justifyContent: 'center' },
  voiceBtnOn:    { backgroundColor: '#e8f0fe' },

  startBtn:    { backgroundColor: C.secondary, borderRadius: 18, paddingVertical: 18, alignItems: 'center', shadowColor: C.secondary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 6 },
  startBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 15, letterSpacing: 0.3 },

  activeRow: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  progTrack: { height: 6, backgroundColor: '#e7e8e9', borderRadius: 3, overflow: 'hidden' },
  progFill:  { height: '100%', backgroundColor: C.secondary, borderRadius: 3 },
  progLbls:  { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  progLbl:   { fontSize: 11, color: C.outline },
  endBtn:    { backgroundColor: '#fce8e6', borderRadius: 12, paddingHorizontal: 20, paddingVertical: 16 },
  endBtnTxt: { color: C.error, fontWeight: '800', fontSize: 13 },
});
