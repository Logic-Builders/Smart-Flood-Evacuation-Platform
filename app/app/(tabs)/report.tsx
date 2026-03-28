import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ScrollView, StatusBar, StyleSheet, ActivityIndicator,
  Alert, Modal, Platform, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import MapView, {
  Marker, Polygon, UrlTile, PROVIDER_DEFAULT, MapPressEvent,
} from 'react-native-maps';

const BASE_URL = 'http://10.10.11.136:8080';

const ZONE_FILL: Record<string, string> = {
  NORMAL: 'rgba(52,168,83,0.15)', WATCH: 'rgba(251,188,4,0.20)',
  WARNING: 'rgba(255,109,0,0.25)', EXTREME: 'rgba(234,67,53,0.32)',
};
const ZONE_STROKE: Record<string, string> = {
  NORMAL: '#34a853', WATCH: '#fbbc04', WARNING: '#ff6d00', EXTREME: '#ea4335',
};

type Coord = { latitude: number; longitude: number };
type FloodZone = {
  id: string; gauge_id: string;
  severity: 'NORMAL' | 'WATCH' | 'WARNING' | 'EXTREME';
  boundary: { coordinates: Coord[] };
};

const REPORT_TYPES = [
  { value: 'FLOODED_ROAD',   label: 'Flooded\nRoad',   icon: 'water'         },
  { value: 'DAMAGED_BRIDGE', label: 'Damaged\nBridge', icon: 'bridge'        },
  { value: 'BLOCKED_ROAD',   label: 'Blocked\nRoad',   icon: 'alert-octagon' },
] as const;
type ReportType = typeof REPORT_TYPES[number]['value'];

const SEV_COLOR  = (n: number) => ['', '#059669', '#65a30d', '#d97706', '#ea580c', '#dc2626'][n];
const SEV_LABEL  = ['', 'Very Low', 'Low', 'Medium', 'High', 'Critical'];
const SEV_DESC   = ['', 'Minor puddles, passable', 'Passable with care', 'Difficult to pass', 'Dangerous conditions', 'Completely impassable'];

// ─── Light Design System ──────────────────────────────────────────────────────
const C = {
  bg:         '#EEF4FF',        // soft blue-white page bg
  card:       'rgba(255,255,255,0.72)',
  cardHi:     'rgba(255,255,255,0.90)',
  border:     'rgba(30,58,138,0.10)',
  borderHi:   'rgba(30,58,138,0.30)',
  blue:       '#1E3A8A',
  blueMid:    '#3B82F6',
  blueSoft:   'rgba(59,130,246,0.12)',
  red:        '#DC2626',
  redSoft:    'rgba(220,38,38,0.10)',
  text:       '#0F172A',
  textMid:    '#475569',
  textDim:    '#94A3B8',
  white:      '#FFFFFF',
};

const FONT = Platform.select({ ios: 'SF Pro Display', android: 'sans-serif-medium', default: 'System' });
const MONO = Platform.select({ ios: 'SF Mono', android: 'monospace', default: 'monospace' });

// ─────────────────────────────────────────────────────────────────────────────
// Map Picker Modal
// ─────────────────────────────────────────────────────────────────────────────
const MapPickerModal = ({
  visible, onClose, onConfirm, initialCoord, floodZones,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coord: Coord, address: string) => void;
  initialCoord: Coord | null;
  floodZones: FloodZone[];
}) => {
  const SL_CENTER: Coord = { latitude: 7.8731, longitude: 80.7718 };
  const [pin, setPin]               = useState<Coord | null>(initialCoord);
  const [address, setAddress]       = useState('');
  const [resolving, setResolving]   = useState(false);
  const [searchText, setSearchText] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const mapRef = useRef<MapView>(null);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resolveAddress = async (coord: Coord) => {
    setResolving(true);
    try {
      const res = await Location.reverseGeocodeAsync(coord);
      const g = res[0];
      const label = [g?.name, g?.street, g?.city, g?.region].filter(Boolean).join(', ');
      setAddress(label || `${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
    } catch {
      setAddress(`${coord.latitude.toFixed(5)}, ${coord.longitude.toFixed(5)}`);
    }
    setResolving(false);
  };

  const handleMapPress = (e: MapPressEvent) => {
    const coord = e.nativeEvent.coordinate;
    setPin(coord); resolveAddress(coord); setSuggestions([]);
  };

  const handleSearch = useCallback((text: string) => {
    setSearchText(text);
    if (debRef.current) clearTimeout(debRef.current);
    if (text.length < 2) { setSuggestions([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=lk&limit=5`,
          { headers: { 'User-Agent': 'FloodEvacApp/1.0' } }
        );
        setSuggestions(await r.json());
      } catch {}
    }, 300);
  }, []);

  const pickSuggestion = (item: any) => {
    const coord: Coord = { latitude: parseFloat(item.lat), longitude: parseFloat(item.lon) };
    setPin(coord); setAddress(item.display_name);
    setSearchText(item.display_name.split(',')[0]); setSuggestions([]);
    mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.02, longitudeDelta: 0.02 }, 600);
  };

  const useGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coord: Coord = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      setPin(coord); resolveAddress(coord); setSearchText(''); setSuggestions([]);
      mapRef.current?.animateToRegion({ ...coord, latitudeDelta: 0.01, longitudeDelta: 0.01 }, 600);
    } catch { Alert.alert('Error', 'Could not get location.'); }
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <View style={mp.root}>
        <StatusBar barStyle="dark-content" backgroundColor="#fff" />
        <SafeAreaView style={mp.header}>
          <View style={mp.headerRow}>
            <TouchableOpacity style={mp.backBtn} onPress={onClose}>
              <Feather name="arrow-left" size={20} color="#1E3A8A" />
            </TouchableOpacity>
            <Text style={mp.headerTitle}>Pin Incident Location</Text>
            <TouchableOpacity style={mp.gpsBtn} onPress={useGPS}>
              <Feather name="crosshair" size={18} color="#1E3A8A" />
            </TouchableOpacity>
          </View>
          <View style={mp.searchRow}>
            <Feather name="search" size={15} color="#94A3B8" style={{ marginRight: 8 }} />
            <TextInput
              style={mp.searchInput}
              placeholder="Search in Sri Lanka…"
              placeholderTextColor="#94A3B8"
              value={searchText}
              onChangeText={handleSearch}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchText(''); setSuggestions([]); }}>
                <Feather name="x" size={15} color="#94A3B8" />
              </TouchableOpacity>
            )}
          </View>
          {suggestions.length > 0 && (
            <View style={mp.suggBox}>
              {suggestions.map((item, idx) => (
                <TouchableOpacity
                  key={item.place_id ?? idx}
                  style={[mp.suggRow, idx < suggestions.length - 1 && mp.suggBorder]}
                  onPress={() => pickSuggestion(item)}
                >
                  <Feather name="map-pin" size={13} color="#3B82F6" style={{ marginRight: 10 }} />
                  <View style={{ flex: 1 }}>
                    <Text style={mp.suggMain} numberOfLines={1}>{item.display_name.split(',')[0]}</Text>
                    <Text style={mp.suggSub} numberOfLines={1}>{item.display_name.split(',').slice(1, 3).join(',').trim()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </SafeAreaView>

        <View style={{ flex: 1 }}>
          <MapView
            ref={mapRef}
            style={StyleSheet.absoluteFill}
            provider={PROVIDER_DEFAULT}
            initialRegion={pin
              ? { ...pin, latitudeDelta: 0.04, longitudeDelta: 0.04 }
              : { ...SL_CENTER, latitudeDelta: 2.5, longitudeDelta: 2.5 }
            }
            onPress={handleMapPress}
            showsUserLocation
            showsCompass={false}
          >
            <UrlTile urlTemplate="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maximumZ={19} />
            {floodZones.map(z => (
              <Polygon key={z.id} coordinates={z.boundary.coordinates}
                fillColor={ZONE_FILL[z.severity]} strokeColor={ZONE_STROKE[z.severity]} strokeWidth={2} />
            ))}
            {pin && (
              <Marker coordinate={pin} draggable
                onDragEnd={e => { const c = e.nativeEvent.coordinate; setPin(c); resolveAddress(c); }}>
                <View style={mp.pinOuter}><View style={mp.pinInner} /></View>
              </Marker>
            )}
          </MapView>

          {!pin && (
            <View style={mp.hint} pointerEvents="none">
              <BlurView intensity={60} tint="light" style={mp.hintBubble}>
                <Feather name="map-pin" size={13} color="#3B82F6" />
                <Text style={mp.hintText}>Tap map to place pin</Text>
              </BlurView>
            </View>
          )}

          <BlurView intensity={90} tint="light" style={mp.bottomPanel}>
            {pin ? (
              <>
                <View style={mp.addressRow}>
                  <View style={mp.addressIcon}>
                    <Feather name="map-pin" size={15} color={C.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {resolving
                      ? <ActivityIndicator size="small" color="#3B82F6" />
                      : <>
                          <Text style={mp.addressText} numberOfLines={2}>{address}</Text>
                          <Text style={mp.coordText}>{pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</Text>
                        </>
                    }
                  </View>
                  <TouchableOpacity style={mp.clearBtn} onPress={() => { setPin(null); setAddress(''); }}>
                    <Text style={mp.clearBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={mp.confirmBtn}
                  onPress={() => { if (pin) { onConfirm(pin, address); onClose(); } }}
                  disabled={resolving}
                >
                  <LinearGradient colors={['#3B82F6', '#1E3A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={mp.confirmGrad}>
                    <Feather name="check" size={18} color="#fff" style={{ marginRight: 8 }} />
                    <Text style={mp.confirmText}>Confirm Location</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <View style={mp.noPin}>
                <Text style={mp.noPinText}>Tap anywhere on the map</Text>
                <Text style={mp.noPinSub}>Drag the pin to fine-tune position</Text>
              </View>
            )}
          </BlurView>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function FloodReportScreen() {
  const [address, setAddress]         = useState('');
  const [coord, setCoord]             = useState<Coord | null>(null);
  const [reportType, setReportType]   = useState<ReportType>('FLOODED_ROAD');
  const [severity, setSeverity]       = useState(1);
  const [description, setDescription] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading]         = useState(false);
  const [mapOpen, setMapOpen]         = useState(false);
  const [floodZones, setFloodZones]   = useState<FloodZone[]>([]);

  const pulse = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1,   duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 850, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const ctrl  = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    fetch(`${BASE_URL}/api/v1/flood-zones`, { signal: ctrl.signal })
      .then(r => r.json())
      .then(j => { if (j.success && j.data?.zones?.length) setFloodZones(j.data.zones); })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { ctrl.abort(); clearTimeout(timer); };
  }, []);

const pickImage = async () => {
  let result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    allowsMultipleSelection: true, // ✅ important
    quality: 1,
  });

  if (!result.canceled) {
    const selected = result.assets.map((asset) => asset.uri);
    setImages((prev) => [...prev, ...selected]);
  }
};

  const handleSubmit = async () => {
    if (!coord)              return Alert.alert('Missing Location', 'Please pin the incident on the map.');
    if (!description.trim()) return Alert.alert('Missing Description', 'Please describe the hazard.');
    if (coord.latitude < 5.9 || coord.latitude > 9.9 ||
        coord.longitude < 79.6 || coord.longitude > 81.9)
      return Alert.alert('Invalid Location', 'Location must be within Sri Lanka.');

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude:    coord.latitude,
          longitude:   coord.longitude,
          report_type: reportType,
          severity,
          description: description.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Submission failed.');

      Alert.alert('✅ Report Submitted', 'Report is pending admin review and will appear on the map once approved.');
      setAddress(''); setCoord(null); setDescription('');
      setSeverity(1); setReportType('FLOODED_ROAD'); setImages([]);;
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const sevColor = SEV_COLOR(severity);

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Light gradient background */}
      <LinearGradient
        colors={['#DBEAFE', '#EEF4FF', '#F0F9FF']}
        style={StyleSheet.absoluteFill}
      />

      {/* Soft ambient blobs */}
      <View style={[s.blob, { top: -80, left: -80,  width: 300, height: 300, backgroundColor: 'rgba(59,130,246,0.10)' }]} />
      <View style={[s.blob, { top: 300, right: -100, width: 260, height: 260, backgroundColor: 'rgba(99,102,241,0.07)' }]} />
      <View style={[s.blob, { bottom: -80, left: -60, width: 280, height: 280, backgroundColor: 'rgba(14,165,233,0.08)' }]} />

      <MapPickerModal
        visible={mapOpen} onClose={() => setMapOpen(false)}
        onConfirm={(c, a) => { setCoord(c); setAddress(a); }}
        initialCoord={coord} floodZones={floodZones}
      />

      <SafeAreaView style={s.safe}>

        {/* ── TOP BAR ── */}
        <View style={s.topBar}>
          <View style={s.topBarLeft}>
            <View style={s.livePill}>
              <Animated.View style={[s.liveDot, { opacity: pulse }]} />
              <Text style={s.livePillText}>LIVE</Text>
            </View>
            <Text style={s.topBarSub}>Emergency Dispatch Active</Text>
          </View>
          <View style={s.sosChip}>
            <Feather name="alert-triangle" size={14} color={C.red} />
          </View>
        </View>

        {/* ── HERO TITLE ── */}
        <View style={s.heroWrap}>
          <Text style={s.heroLabel}>HAZARD REPORT</Text>
          <Text style={s.heroTitle}>Flood Report</Text>
          <Text style={s.heroSub}>Fill all fields accurately. Reports are reviewed before going live.</Text>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ══ LOCATION ══ */}
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>INCIDENT LOCATION</Text>
          </View>

          <TouchableOpacity onPress={() => setMapOpen(true)} activeOpacity={0.8}>
            <BlurView intensity={55} tint="light" style={[s.glassCard, coord && s.glassCardActive]}>
              {coord ? (
                <View style={s.locFilled}>
                  <View style={s.locPinBg}>
                    <Feather name="map-pin" size={20} color={C.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.locAddr} numberOfLines={2}>{address}</Text>
                    <Text style={s.locCoord}>{coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}</Text>
                  </View>
                  <View style={s.editPill}>
                    <Feather name="edit-2" size={11} color={C.blue} />
                    <Text style={s.editPillText}>EDIT</Text>
                  </View>
                </View>
              ) : (
                <View style={s.locEmpty}>
                  <BlurView intensity={40} tint="light" style={s.locIconBox}>
                    <Feather name="map" size={22} color={C.blueMid} />
                  </BlurView>
                  <View style={{ flex: 1 }}>
                    <Text style={s.locEmptyTitle}>Tap to pin on map</Text>
                    <Text style={s.locEmptySub}>Search, tap or use GPS</Text>
                  </View>
                  <View style={s.locArrow}>
                    <Feather name="arrow-right" size={16} color={C.blueMid} />
                  </View>
                </View>
              )}
            </BlurView>
          </TouchableOpacity>

          {/* ══ INCIDENT TYPE ══ */}
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>INCIDENT TYPE</Text>
          </View>

          <View style={s.typeGrid}>
            {REPORT_TYPES.map(t => {
              const active = reportType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  onPress={() => setReportType(t.value)}
                  activeOpacity={0.75}
                  style={s.typeChipWrap}
                >
                  <BlurView intensity={55} tint="light" style={[s.typeChip, active && s.typeChipActive]}>
                    {active && (
                      <LinearGradient
                        colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.03)']}
                        style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                      />
                    )}
                    <View style={[s.typeIconBox, active && s.typeIconBoxActive]}>
                      <MaterialCommunityIcons
                        name={t.icon as any} size={22}
                        color={active ? C.blue : C.textMid}
                      />
                    </View>
                    <Text style={[s.typeLabel, active && s.typeLabelActive]}>{t.label}</Text>
                    {active && <View style={s.typeActiveDot} />}
                  </BlurView>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ══ SEVERITY ══ */}
          <View style={s.sevHeaderRow}>
            <View style={s.sectionHeader}>
              <View style={s.sectionDot} />
              <Text style={s.sectionLabel}>SEVERITY LEVEL</Text>
            </View>
            <View style={[s.sevBadge, { borderColor: sevColor + '55', backgroundColor: sevColor + '18' }]}>
              <Text style={[s.sevBadgeText, { color: sevColor }]}>{SEV_LABEL[severity]}</Text>
            </View>
          </View>

          <BlurView intensity={55} tint="light" style={s.glassCard}>
            <View style={s.sevTop}>
              <View style={[s.sevNumBox, { borderColor: sevColor + '70', backgroundColor: sevColor + '15' }]}>
                <Text style={[s.sevNum, { color: sevColor }]}>{severity}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.sevDescText}>{SEV_DESC[severity]}</Text>
                <Text style={s.sevScaleHint}>Scale: 1 (minor) → 5 (critical)</Text>
              </View>
            </View>
            <View style={s.sevBars}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setSeverity(n)} style={{ flex: 1, paddingHorizontal: 3 }}>
                  <View style={{
                    height: severity === n ? 40 : severity > n ? 30 : 22,
                    borderRadius: 8,
                    backgroundColor: n <= severity ? SEV_COLOR(n) : 'rgba(30,58,138,0.08)',
                    borderWidth: severity === n ? 1.5 : 0,
                    borderColor: SEV_COLOR(n) + 'aa',
                    shadowColor: n <= severity ? SEV_COLOR(n) : 'transparent',
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: 0.5, shadowRadius: 6,
                    elevation: n <= severity ? 3 : 0,
                    alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4,
                  }}>
                    {severity === n && <Text style={s.sevBarLabel}>{n}</Text>}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          {/* ══ DESCRIPTION ══ */}
          <View style={s.sectionHeader}>
            <View style={s.sectionDot} />
            <Text style={s.sectionLabel}>DESCRIPTION</Text>
          </View>

          <BlurView intensity={55} tint="light" style={[s.glassCard, { padding: 0 }]}>
            <TextInput
              style={s.textArea}
              placeholder={'Describe the hazard…\nWater depth, road condition, visibility, trapped vehicles'}
              placeholderTextColor={C.textDim}
              multiline
              numberOfLines={5}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
            <View style={s.descFooter}>
              <Text style={s.charCount}>{description.length} chars</Text>
            </View>
          </BlurView>

          {/* ══ PHOTO ══ */}
          <View style={[s.sectionHeader, { justifyContent: 'space-between' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <View style={s.sectionDot} />
              <Text style={s.sectionLabel}>PHOTO EVIDENCE</Text>
            </View>
            <Text style={s.optTag}>OPTIONAL</Text>
          </View>

          {images.length > 0 ? (
            <View style={s.imgContainer}>
              {images.map((img, index) => (
                <View key={index} style={s.imgWrap}>
                  <Image source={{ uri: img }} style={s.imgPreview} />

                  <LinearGradient
                    colors={['transparent', 'rgba(15,23,42,0.5)']}
                    style={s.imgOverlay}
                  />

                  <TouchableOpacity
                    style={s.imgRemove}
                    onPress={() =>
                      setImages(images.filter((_, i) => i !== index))
                    }
                  >
                    <BlurView intensity={60} tint="light" style={s.imgRemoveBlur}>
                      <Feather name="x" size={14} color={C.text} />
                    </BlurView>
                  </TouchableOpacity>

                  <View style={s.imgLabel}>
                    <Feather name="check-circle" size={13} color={C.white} />
                    <Text style={s.imgLabelText}>Photo attached</Text>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <TouchableOpacity onPress={pickImage} activeOpacity={0.8}>
              <BlurView intensity={55} tint="light" style={s.uploadBox}>
                <View style={s.uploadIconCircle}>
                  <MaterialCommunityIcons
                    name="camera-plus-outline"
                    size={28}
                    color={C.blueMid}
                  />
                </View>
                <Text style={s.uploadTitle}>Attach Photos</Text>
                <Text style={s.uploadSub}>
                  You can upload multiple images
                </Text>
              </BlurView>
            </TouchableOpacity>
          )}

          {/* ══ SUBMIT ══ */}
          <TouchableOpacity
            style={[s.submitWrap, loading && { opacity: 0.55 }]}
            onPress={handleSubmit}
            disabled={loading}
            activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#3B82F6', '#1E3A8A']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.submitGrad}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <>
                  <Feather name="send" size={18} color={C.white} style={{ marginRight: 10 }} />
                  <Text style={s.submitText}>SUBMIT EMERGENCY REPORT</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.footerRow}>
            <Feather name="lock" size={11} color={C.textDim} />
            <Text style={s.footerText}>ENCRYPTED  ·  PENDING REVIEW  ·  AUTO-EXPIRES IN 3 HRS</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },

  // Top bar
  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 0, paddingBottom: 9 },
  topBarLeft:   { gap: 4 },
  livePill:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(30,58,138,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(30,58,138,0.18)', alignSelf: 'flex-start' },
  liveDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B82F6' },
  livePillText: { color: C.blue, fontSize: 10, fontFamily: FONT, fontWeight: '800', letterSpacing: 2.5 },
  topBarSub:    { color: C.textMid, fontSize: 11, fontFamily: FONT, marginLeft: 2 },
  sosChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.20)' },

  // Hero
  heroWrap:  { paddingHorizontal: 22, paddingBottom: 20, paddingTop: 2 },
  heroLabel: { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.blueMid, letterSpacing: 4, opacity: 0.8, marginBottom: 5 },
  heroTitle: { fontSize: 35, fontFamily: FONT, fontWeight: '800', color: C.blue, letterSpacing: -1.5, lineHeight: 40 },
  heroSub:   { fontSize: 11, fontFamily: FONT, color: C.textMid, marginTop: 10, lineHeight: 15 },

  scroll: { paddingHorizontal: 18, paddingBottom: 54 },

  // Sections
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  sectionDot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: C.blueMid },
  sectionLabel:  { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.blue, letterSpacing: 3 },

  // Glass card
  glassCard:       { borderRadius: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden', padding: 6, backgroundColor: C.card },
  glassCardActive: { borderColor: 'rgba(220,38,38,0.30)' },

  // Location
  locFilled:     { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 13 },
  locPinBg:      { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(220,38,38,0.10)', alignItems: 'center', justifyContent: 'center' },
  locAddr:       { color: C.text,    fontSize: 14, fontFamily: FONT, fontWeight: '600', lineHeight: 20 },
  locCoord:      { color: C.textDim, fontSize: 11, marginTop: 3, fontFamily: MONO },
  editPill:      { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.blueSoft, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(30,58,138,0.20)' },
  editPillText:  { color: C.blue, fontSize: 10, fontFamily: FONT, fontWeight: '800', letterSpacing: 0.5 },
  locEmpty:      { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 15 },
  locIconBox:    { width: 52, height: 52, borderRadius: 16, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  locEmptyTitle: { color: C.text,    fontSize: 15, fontFamily: FONT, fontWeight: '700' },
  locEmptySub:   { color: C.textMid, fontSize: 12, fontFamily: FONT, marginTop: 3 },
  locArrow:      { width: 34, height: 34, borderRadius: 17, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(59,130,246,0.25)' },

  // Type grid
  typeGrid:         { flexDirection: 'row', gap: 10 },
  typeChipWrap:     { flex: 1 },
  typeChip:         { borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 6, gap: 8, backgroundColor: C.card },
  typeChipActive:   { borderColor: 'rgba(30,58,138,0.35)' },
  typeIconBox:      { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(30,58,138,0.06)', alignItems: 'center', justifyContent: 'center' },
  typeIconBoxActive:{ backgroundColor: C.blueSoft },
  typeLabel:        { fontSize: 11, fontFamily: FONT, fontWeight: '700', color: C.textMid, textAlign: 'center', lineHeight: 15 },
  typeLabelActive:  { color: C.blue },
  typeActiveDot:    { width: 5, height: 5, borderRadius: 3, backgroundColor: C.blueMid },

  // Severity
  sevHeaderRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sevBadge:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 12, borderWidth: 1, marginBottom: 12 },
  sevBadgeText:  { fontSize: 11, fontFamily: FONT, fontWeight: '800', letterSpacing: 1 },
  sevTop:        { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14, paddingBottom: 10 },
  sevNumBox:     { width: 48, height: 48, borderRadius: 16, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  sevNum:        { fontSize: 22, fontFamily: FONT, fontWeight: '900' },
  sevDescText:   { color: C.text,    fontSize: 13, fontFamily: FONT, fontWeight: '600', lineHeight: 18 },
  sevScaleHint:  { color: C.textMid, fontSize: 11, fontFamily: FONT, marginTop: 3 },
  sevBars:       { flexDirection: 'row', paddingHorizontal: 14, paddingBottom: 16, paddingTop: 6, alignItems: 'flex-end' },
  sevBarLabel:   { color: 'rgba(255,255,255,0.9)', fontSize: 10, fontFamily: FONT, fontWeight: '800' },

  // Description
  textArea:   { color: C.text, fontSize: 15, fontFamily: FONT, padding: 18, minHeight: 120, lineHeight: 24 },
  descFooter: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 10 },
  charCount:  { color: C.textDim, fontSize: 11, fontFamily: MONO },

  // Photo
  optTag:        { fontSize: 9, fontFamily: FONT, fontWeight: '700', color: C.textDim, letterSpacing: 2, marginBottom: 12 },
  imgWrap: { width: 100, height: 100, borderRadius: 12, overflow: 'hidden', marginBottom: 10,},
  imgPreview:    { width: '100%', height: 200, borderRadius: 22 },
  imgOverlay:    { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, borderBottomLeftRadius: 22, borderBottomRightRadius: 22 },
  imgRemove:     { position: 'absolute', top: 12, right: 12 },
  imgRemoveBlur: { width: 34, height: 34, borderRadius: 17, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  imgLabel:      { position: 'absolute', bottom: 12, left: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  imgLabelText:  { color: C.white, fontSize: 12, fontFamily: FONT, fontWeight: '700' },
  uploadBox:     { borderRadius: 22, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(59,130,246,0.30)', overflow: 'hidden', alignItems: 'center', paddingVertical: 38, gap: 8, backgroundColor: C.card },
  uploadIconCircle:{ width: 64, height: 64, borderRadius: 32, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadTitle:   { color: C.text,    fontSize: 14, fontFamily: FONT, fontWeight: '700' },
  uploadSub:     { color: C.textMid, fontSize: 12, fontFamily: FONT },
  imgContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10,},


  // Submit
  submitWrap: { marginTop: 36, borderRadius: 24, overflow: 'hidden', shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  submitGrad: { height: 66, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitText: { color: C.white, fontSize: 14, fontFamily: FONT, fontWeight: '900', letterSpacing: 2 },

  // Footer
  footerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 7 },
  footerText: { fontSize: 9.5, fontFamily: FONT, fontWeight: '700', color: C.textDim, letterSpacing: 1.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Map Modal Styles
// ─────────────────────────────────────────────────────────────────────────────
const mp = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#fff' },
  header:        { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EEF4FF', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle:   { flex: 1, fontSize: 17, fontFamily: FONT, fontWeight: '800', color: C.blue },
  gpsBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: C.blueSoft, alignItems: 'center', justifyContent: 'center' },
  searchRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 13, paddingHorizontal: 12, height: 44 },
  searchInput:   { flex: 1, color: C.text, fontSize: 14, fontFamily: FONT },
  suggBox:       { backgroundColor: '#fff', borderRadius: 13, marginTop: 6, borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 },
  suggRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  suggBorder:    { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
  suggMain:      { fontSize: 13, fontFamily: FONT, fontWeight: '600', color: C.text },
  suggSub:       { fontSize: 11, fontFamily: FONT, color: C.textDim, marginTop: 1 },
  pinOuter:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(220,38,38,0.15)', alignItems: 'center', justifyContent: 'center' },
  pinInner:      { width: 14, height: 14, borderRadius: 7, backgroundColor: C.red, borderWidth: 2.5, borderColor: '#fff' },
  hint:          { position: 'absolute', top: 24, left: 0, right: 0, alignItems: 'center' },
  hintBubble:    { flexDirection: 'row', alignItems: 'center', gap: 6, overflow: 'hidden', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10 },
  hintText:      { fontSize: 13, fontFamily: FONT, color: C.text, fontWeight: '700' },
  bottomPanel:   { position: 'absolute', bottom: 0, left: 0, right: 0, borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 22, paddingBottom: Platform.OS === 'ios' ? 42 : 28, overflow: 'hidden' },
  addressRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  addressIcon:   { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(220,38,38,0.08)', alignItems: 'center', justifyContent: 'center' },
  addressText:   { fontSize: 14, fontFamily: FONT, fontWeight: '600', color: C.text, lineHeight: 20 },
  coordText:     { fontSize: 11, color: C.textDim, marginTop: 2, fontFamily: MONO },
  clearBtn:      { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#F1F5F9', borderRadius: 12 },
  clearBtnText:  { fontSize: 12, fontFamily: FONT, fontWeight: '700', color: C.textMid },
  confirmBtn:    { borderRadius: 18, overflow: 'hidden' },
  confirmGrad:   { paddingVertical: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  confirmText:   { color: '#fff', fontSize: 15, fontFamily: FONT, fontWeight: '900', letterSpacing: 0.5 },
  noPin:         { alignItems: 'center', paddingVertical: 12, gap: 6 },
  noPinText:     { fontSize: 15, fontFamily: FONT, color: C.text, fontWeight: '700', textAlign: 'center' },
  noPinSub:      { fontSize: 12, fontFamily: FONT, color: C.textDim, textAlign: 'center' },
});