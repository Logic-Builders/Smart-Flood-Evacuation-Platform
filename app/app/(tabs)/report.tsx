import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Image,
  ScrollView, StatusBar, StyleSheet, ActivityIndicator,
  Alert, Modal, Platform, Animated, Dimensions,
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

const { width } = Dimensions.get('window');
const BASE_URL = 'http://10.10.11.136:8080';

// ── Flood zone colours ────────────────────────────────────────────────────────
const ZONE_FILL: Record<string, string> = {
  NORMAL:  'rgba(52,168,83,0.15)',  WATCH:   'rgba(251,188,4,0.20)',
  WARNING: 'rgba(255,109,0,0.25)', EXTREME: 'rgba(234,67,53,0.32)',
};
const ZONE_STROKE: Record<string, string> = {
  NORMAL: '#34a853', WATCH: '#fbbc04', WARNING: '#ff6d00', EXTREME: '#ea4335',
};

type Coord     = { latitude: number; longitude: number };
type FloodZone = {
  id: string; gauge_id: string;
  severity: 'NORMAL' | 'WATCH' | 'WARNING' | 'EXTREME';
  boundary: { coordinates: Coord[] };
};

const REPORT_TYPES = [
  { value: 'FLOODED_ROAD',   label: 'Flooded Road',   icon: 'water'         },
  { value: 'DAMAGED_BRIDGE', label: 'Damaged Bridge', icon: 'bridge'        },
  { value: 'BLOCKED_ROAD',   label: 'Blocked Road',   icon: 'alert-octagon' },
] as const;
type ReportType = typeof REPORT_TYPES[number]['value'];

const SEV_COLOR = (n: number) =>
  ['', '#00e5a0', '#84cc16', '#f59e0b', '#f97316', '#ff3b5c'][n];
const SEV_LABEL = ['', 'Minor', 'Low', 'Medium', 'High', 'Critical'];
const SEV_DESC  = [
  '',
  'Minor puddles, road passable',
  'Passable with care',
  'Difficult to pass',
  'Dangerous conditions',
  'Completely impassable',
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:       '#080d14',
  surface:  'rgba(255,255,255,0.035)',
  border:   'rgba(0,218,243,0.10)',
  borderHi: 'rgba(0,218,243,0.35)',
  cyan:     '#00daf3',
  cyanDim:  'rgba(0,218,243,0.12)',
  cyanGlow: 'rgba(0,218,243,0.05)',
  text:     '#e8f4ff',
  textMid:  '#7a99b8',
  textDim:  '#2a4a6a',
  red:      '#ff3b5c',
  redDim:   'rgba(255,59,92,0.12)',
};

const FONT = Platform.select({ ios: 'SF Pro Display', android: 'sans-serif-medium', default: 'System' });
const MONO = Platform.select({ ios: 'SF Mono',        android: 'monospace',         default: 'monospace' });

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
              <Feather name="arrow-left" size={20} color="#202124" />
            </TouchableOpacity>
            <Text style={mp.headerTitle}>Pin Incident Location</Text>
            <TouchableOpacity style={mp.gpsBtn} onPress={useGPS}>
              <Feather name="crosshair" size={18} color="#00b8cc" />
            </TouchableOpacity>
          </View>

          <View style={mp.searchRow}>
            <Feather name="search" size={15} color="#9aa0a6" style={{ marginRight: 8 }} />
            <TextInput
              style={mp.searchInput}
              placeholder="Search location in Sri Lanka…"
              placeholderTextColor="#9aa0a6"
              value={searchText}
              onChangeText={handleSearch}
            />
            {searchText.length > 0 && (
              <TouchableOpacity onPress={() => { setSearchText(''); setSuggestions([]); }}>
                <Feather name="x" size={15} color="#9aa0a6" />
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
                  <Feather name="map-pin" size={13} color="#00b8cc" style={{ marginRight: 10 }} />
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
              <Polygon
                key={z.id} coordinates={z.boundary.coordinates}
                fillColor={ZONE_FILL[z.severity]} strokeColor={ZONE_STROKE[z.severity]} strokeWidth={2}
              />
            ))}
            {pin && (
              <Marker coordinate={pin} draggable
                onDragEnd={e => { const c = e.nativeEvent.coordinate; setPin(c); resolveAddress(c); }}
              >
                <View style={mp.pinOuter}><View style={mp.pinInner} /></View>
              </Marker>
            )}
          </MapView>

          {!pin && (
            <View style={mp.hint} pointerEvents="none">
              <View style={mp.hintBubble}>
                <Feather name="map-pin" size={13} color="#00b8cc" />
                <Text style={mp.hintText}>Tap map to place pin</Text>
              </View>
            </View>
          )}

          <View style={mp.bottomPanel}>
            {pin ? (
              <>
                <View style={mp.addressRow}>
                  <View style={mp.addressIcon}>
                    <Feather name="map-pin" size={15} color={C.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    {resolving
                      ? <ActivityIndicator size="small" color="#00b8cc" />
                      : <>
                          <Text style={mp.addressText} numberOfLines={2}>{address}</Text>
                          <Text style={mp.coordText}>{pin.latitude.toFixed(5)}, {pin.longitude.toFixed(5)}</Text>
                        </>
                    }
                  </View>
                  <TouchableOpacity style={mp.changeBtn} onPress={() => { setPin(null); setAddress(''); }}>
                    <Text style={mp.changeBtnText}>Clear</Text>
                  </TouchableOpacity>
                </View>
                <TouchableOpacity
                  style={mp.confirmBtn}
                  onPress={() => { if (pin) { onConfirm(pin, address); onClose(); } }}
                  disabled={resolving}
                >
                  <LinearGradient
                    colors={['#00daf3', '#0097a7']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={mp.confirmGrad}
                  >
                    <Text style={mp.confirmBtnText}>✓  Confirm This Location</Text>
                  </LinearGradient>
                </TouchableOpacity>
              </>
            ) : (
              <View style={mp.noPin}>
                <Text style={mp.noPinText}>Tap anywhere on the map to mark the incident location</Text>
                <Text style={mp.noPinSub}>You can also drag the pin after placing it</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Main Report Screen
// ─────────────────────────────────────────────────────────────────────────────
export default function FloodReportScreen() {
  const [fullName, setFullName]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress]         = useState('');
  const [coord, setCoord]             = useState<Coord | null>(null);
  const [reportType, setReportType]   = useState<ReportType>('FLOODED_ROAD');
  const [severity, setSeverity]       = useState(1);
  const [description, setDescription] = useState('');
  const [image, setImage]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [mapOpen, setMapOpen]         = useState(false);
  const [floodZones, setFloodZones]   = useState<FloodZone[]>([]);

  const pulseAnim = useRef(new Animated.Value(0.35)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    fetch(`${BASE_URL}/api/v1/flood-zones`, { signal: controller.signal })
      .then(r => r.json())
      .then(j => { if (j.success && j.data?.zones?.length) setFloodZones(j.data.zones); })
      .catch(() => {})
      .finally(() => clearTimeout(timer));
    return () => { controller.abort(); clearTimeout(timer); };
  }, []);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [16, 9] as [number, number], quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!fullName.trim())    return Alert.alert('Missing Field', 'Please enter your full name.');
    if (!phoneNumber.trim()) return Alert.alert('Missing Field', 'Please enter your phone number.');
    if (!coord)              return Alert.alert('Missing Field', 'Please pin the incident location on the map.');
    if (!description.trim()) return Alert.alert('Missing Field', 'Please describe the hazard.');
    if (coord.latitude < 5.9 || coord.latitude > 9.9 ||
        coord.longitude < 79.6 || coord.longitude > 81.9)
      return Alert.alert('Invalid Location', 'Location must be within Sri Lanka.');

    try {
      setLoading(true);
      const response = await fetch(`${BASE_URL}/api/v1/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          latitude:       coord.latitude,
          longitude:      coord.longitude,
          report_type:    reportType,
          severity,
          description:    description.trim(),
          reporter_name:  fullName.trim(),
          reporter_phone: phoneNumber.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Submission failed.');

      Alert.alert('Report Submitted', 'Pending admin review. It will appear on the map once approved.');
      setFullName(''); setPhoneNumber(''); setAddress('');
      setCoord(null); setDescription(''); setSeverity(1);
      setReportType('FLOODED_ROAD'); setImage(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#060b12', '#080d14', '#050910']} style={StyleSheet.absoluteFill} />

      {/* Ambient glows */}
      <View style={[s.glow, { top: -110, left: -110, backgroundColor: 'rgba(0,218,243,0.07)' }]} />
      <View style={[s.glow, { top: 300, right: -130, width: 290, height: 290, borderRadius: 145, backgroundColor: 'rgba(80,40,255,0.055)' }]} />
      <View style={[s.glow, { bottom: -110, left: -70, backgroundColor: 'rgba(0,218,243,0.04)' }]} />

      <MapPickerModal
        visible={mapOpen} onClose={() => setMapOpen(false)}
        onConfirm={(c, a) => { setCoord(c); setAddress(a); }}
        initialCoord={coord} floodZones={floodZones}
      />

      <SafeAreaView style={s.safeArea}>

        {/* ── Header ── */}
        <View style={s.header}>
          <View>
            <View style={s.eyebrowRow}>
              <Animated.View style={[s.liveDot, { opacity: pulseAnim }]} />
              <Text style={s.eyebrow}>EMERGENCY · LIVE</Text>
            </View>
            <Text style={s.headerTitle}>Flood Report</Text>
          </View>
          <LinearGradient colors={[C.cyanDim, C.cyanGlow]} style={s.headerIcon}>
            <Feather name="alert-triangle" size={20} color={C.cyan} />
          </LinearGradient>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
        >

          {/* ── Reporter Info ── */}
          <Text style={s.sectionLabel}>REPORTER INFO</Text>
          <BlurView intensity={14} tint="dark" style={s.card}>
            <View style={s.inputRow}>
              <View style={s.iconBox}><Feather name="user" size={16} color={C.cyan} /></View>
              <TextInput
                style={s.input} placeholder="Full Name"
                placeholderTextColor={C.textDim} value={fullName} onChangeText={setFullName}
              />
            </View>
            <View style={s.cardDivider} />
            <View style={s.inputRow}>
              <View style={s.iconBox}><Feather name="phone" size={16} color={C.cyan} /></View>
              <TextInput
                style={s.input} placeholder="Phone Number"
                placeholderTextColor={C.textDim} keyboardType="phone-pad"
                value={phoneNumber} onChangeText={setPhoneNumber}
              />
            </View>
          </BlurView>

          {/* ── Incident Location ── */}
          <Text style={s.sectionLabel}>INCIDENT LOCATION</Text>
          <TouchableOpacity onPress={() => setMapOpen(true)} activeOpacity={0.8}>
            <BlurView intensity={14} tint="dark" style={s.locationCard}>
              {coord ? (
                <View style={s.locationFilled}>
                  <View style={s.locationPinBox}>
                    <Feather name="map-pin" size={18} color={C.red} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.locationAddr} numberOfLines={2}>{address}</Text>
                    <Text style={s.locationCoord}>{coord.latitude.toFixed(5)}, {coord.longitude.toFixed(5)}</Text>
                  </View>
                  <View style={s.editChip}>
                    <Feather name="edit-2" size={12} color={C.cyan} />
                    <Text style={s.editChipText}>Edit</Text>
                  </View>
                </View>
              ) : (
                <View style={s.locationEmpty}>
                  <LinearGradient colors={[C.cyanDim, C.cyanGlow]} style={s.mapIconBox}>
                    <Feather name="map" size={24} color={C.cyan} />
                  </LinearGradient>
                  <View style={{ flex: 1 }}>
                    <Text style={s.locationEmptyTitle}>Pin on Map</Text>
                    <Text style={s.locationEmptySub}>Search, tap map, or use GPS</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={C.textMid} />
                </View>
              )}
            </BlurView>
          </TouchableOpacity>

          {/* ── Incident Type ── */}
          <Text style={s.sectionLabel}>INCIDENT TYPE</Text>
          <View style={s.typeRow}>
            {REPORT_TYPES.map(t => {
              const active = reportType === t.value;
              return (
                <TouchableOpacity
                  key={t.value}
                  style={[s.typeChip, active && s.typeChipActive]}
                  onPress={() => setReportType(t.value)}
                  activeOpacity={0.75}
                >
                  {active && (
                    <LinearGradient
                      colors={[C.cyanDim, C.cyanGlow]}
                      style={[StyleSheet.absoluteFill, { borderRadius: 18 }]}
                    />
                  )}
                  <MaterialCommunityIcons
                    name={t.icon as any} size={21}
                    color={active ? C.cyan : C.textMid}
                  />
                  <Text style={[s.typeChipText, active && s.typeChipTextActive]}>{t.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ── Severity ── */}
          <View style={s.sevHeaderRow}>
            <Text style={s.sectionLabel}>SEVERITY LEVEL</Text>
            <View style={[s.sevBadge, { backgroundColor: SEV_COLOR(severity) + '20' }]}>
              <Text style={[s.sevBadgeText, { color: SEV_COLOR(severity) }]}>
                {SEV_LABEL[severity].toUpperCase()}
              </Text>
            </View>
          </View>
          <BlurView intensity={14} tint="dark" style={s.card}>
            <View style={s.sevBarsRow}>
              {[1, 2, 3, 4, 5].map(n => (
                <TouchableOpacity key={n} onPress={() => setSeverity(n)} style={{ flex: 1 }}>
                  <View style={[s.sevBar, {
                    backgroundColor:  severity >= n ? SEV_COLOR(severity) : 'rgba(255,255,255,0.06)',
                    height:           severity >= n ? 14 : 7,
                    marginTop:        severity >= n ? 0 : 3.5,
                    shadowColor:      severity >= n ? SEV_COLOR(severity) : 'transparent',
                    shadowOffset:     { width: 0, height: 0 },
                    shadowOpacity:    0.9,
                    shadowRadius:     7,
                    elevation:        severity >= n ? 5 : 0,
                  }]} />
                </TouchableOpacity>
              ))}
            </View>
            <Text style={s.sevDesc}>{SEV_DESC[severity]}</Text>
          </BlurView>

          {/* ── Description ── */}
          <Text style={s.sectionLabel}>DESCRIPTION</Text>
          <BlurView intensity={14} tint="dark" style={[s.card, { padding: 0 }]}>
            <TextInput
              style={s.textArea}
              placeholder="Describe the hazard — water level, road condition, visibility…"
              placeholderTextColor={C.textDim}
              multiline numberOfLines={4}
              value={description} onChangeText={setDescription}
              textAlignVertical="top"
            />
          </BlurView>

          {/* ── Photo ── */}
          <View style={s.photoHeader}>
            <Text style={s.sectionLabel}>PHOTO EVIDENCE</Text>
            <Text style={s.optionalTag}>OPTIONAL</Text>
          </View>
          {image ? (
            <View style={s.previewWrap}>
              <Image source={{ uri: image }} style={s.previewImg} />
              <TouchableOpacity style={s.removeBtn} onPress={() => setImage(null)}>
                <Feather name="x" size={13} color="#fff" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.uploadBox} onPress={pickImage} activeOpacity={0.75}>
              <LinearGradient colors={[C.cyanDim, C.cyanGlow]} style={s.uploadCircle}>
                <MaterialCommunityIcons name="camera-plus-outline" size={26} color={C.cyan} />
              </LinearGradient>
              <Text style={s.uploadTitle}>Attach Photo Evidence</Text>
              <Text style={s.uploadSub}>Tap to pick from gallery</Text>
            </TouchableOpacity>
          )}

          {/* ── Submit ── */}
          <TouchableOpacity
            style={[s.submitBtn, loading && { opacity: 0.6 }]}
            onPress={handleSubmit} disabled={loading} activeOpacity={0.85}
          >
            <LinearGradient
              colors={['#00daf3', '#0097a7']}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={s.submitGrad}
            >
              {loading
                ? <ActivityIndicator color={C.bg} />
                : <>
                    <Text style={s.submitText}>SUBMIT EMERGENCY REPORT</Text>
                    <Feather name="send" size={17} color={C.bg} style={{ marginLeft: 10 }} />
                  </>
              }
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.footer}>
            <Feather name="shield" size={11} color={C.textDim} />
            <Text style={s.footerText}>ENCRYPTED · PENDING REVIEW · EXPIRES IN 3 HRS</Text>
          </View>

        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles — Main Screen
// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:  { flex: 1 },
  safeArea:   { flex: 1 },
  glow:       { position: 'absolute', width: 340, height: 340, borderRadius: 170 },

  // Header
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 8, paddingBottom: 20 },
  eyebrowRow:     { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 5 },
  liveDot:        { width: 7, height: 7, borderRadius: 4, backgroundColor: C.cyan },
  eyebrow:        { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.cyan, letterSpacing: 2.5 },
  headerTitle:    { fontSize: 34, fontFamily: FONT, fontWeight: '800', color: C.text, letterSpacing: -0.8 },
  headerIcon:     { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },

  scroll:         { paddingHorizontal: 20, paddingBottom: 50 },

  // Section labels
  sectionLabel:   { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.cyan, letterSpacing: 3, marginTop: 30, marginBottom: 12, opacity: 0.85 },

  // Glass card base
  card:           {
    borderRadius: 22, borderWidth: 1, borderColor: C.border,
    backgroundColor: C.surface, overflow: 'hidden', padding: 4,
  },
  cardDivider:    { height: 1, backgroundColor: 'rgba(255,255,255,0.04)', marginHorizontal: 16 },

  // Inputs
  inputRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 58 },
  iconBox:        { width: 34, height: 34, borderRadius: 11, backgroundColor: C.cyanDim, alignItems: 'center', justifyContent: 'center', marginRight: 14 },
  input:          { flex: 1, color: C.text, fontSize: 15, fontFamily: FONT, fontWeight: '500', letterSpacing: 0.1 },

  // Location card
  locationCard:   { borderRadius: 22, borderWidth: 1, borderColor: C.border, backgroundColor: C.surface, overflow: 'hidden' },
  locationFilled: { flexDirection: 'row', alignItems: 'center', padding: 18, gap: 13 },
  locationPinBox: { width: 42, height: 42, borderRadius: 21, backgroundColor: C.redDim, alignItems: 'center', justifyContent: 'center' },
  locationAddr:   { color: C.text,    fontSize: 14, fontFamily: FONT, fontWeight: '600', lineHeight: 20 },
  locationCoord:  { color: C.textDim, fontSize: 11, marginTop: 3, fontFamily: MONO },
  editChip:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.cyanDim, paddingHorizontal: 11, paddingVertical: 7, borderRadius: 12, borderWidth: 1, borderColor: C.borderHi },
  editChipText:   { color: C.cyan, fontSize: 11, fontFamily: FONT, fontWeight: '700' },
  locationEmpty:  { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 15 },
  mapIconBox:     { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: C.border },
  locationEmptyTitle: { color: C.textMid, fontSize: 14, fontFamily: FONT, fontWeight: '700' },
  locationEmptySub:   { color: C.textDim,  fontSize: 12, fontFamily: FONT, marginTop: 3 },

  // Type chips
  typeRow:            { flexDirection: 'row', gap: 9 },
  typeChip:           {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingVertical: 18, borderRadius: 18, overflow: 'hidden',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
  },
  typeChipActive:     { borderColor: C.cyan },
  typeChipText:       { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.textMid, textAlign: 'center', letterSpacing: 0.3 },
  typeChipTextActive: { color: C.cyan },

  // Severity
  sevHeaderRow:   { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  sevBadge:       { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 12 },
  sevBadgeText:   { fontSize: 10, fontFamily: FONT, fontWeight: '800', letterSpacing: 1.5 },
  sevBarsRow:     { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 4, gap: 6, alignItems: 'flex-end' },
  sevBar:         { borderRadius: 6 },
  sevDesc:        { color: C.textMid, fontSize: 12, fontFamily: FONT, paddingHorizontal: 16, paddingBottom: 16, marginTop: 10, letterSpacing: 0.1 },

  // Text area
  textArea:       { color: C.text, fontSize: 15, fontFamily: FONT, padding: 18, minHeight: 115, lineHeight: 24 },

  // Photo
  photoHeader:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  optionalTag:    { fontSize: 9, fontFamily: FONT, fontWeight: '700', color: C.textDim, letterSpacing: 2, marginBottom: 12 },
  uploadBox:      {
    borderRadius: 22, borderWidth: 1, borderStyle: 'dashed',
    borderColor: 'rgba(0,218,243,0.22)',
    backgroundColor: 'rgba(0,218,243,0.02)',
    alignItems: 'center', paddingVertical: 36, gap: 7,
  },
  uploadCircle:   { width: 58, height: 58, borderRadius: 29, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadTitle:    { color: C.textMid, fontSize: 13, fontFamily: FONT, fontWeight: '700' },
  uploadSub:      { color: C.textDim,  fontSize: 12, fontFamily: FONT },
  previewWrap:    { position: 'relative' },
  previewImg:     { width: '100%', height: 195, borderRadius: 22 },
  removeBtn:      { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.65)', padding: 8, borderRadius: 12 },

  // Submit
  submitBtn:      {
    marginTop: 34, borderRadius: 22, overflow: 'hidden',
    shadowColor: C.cyan, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45, shadowRadius: 22, elevation: 14,
  },
  submitGrad:     { height: 62, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitText:     { color: C.bg, fontSize: 14, fontFamily: FONT, fontWeight: '900', letterSpacing: 1.5 },

  // Footer
  footer:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 7 },
  footerText:     { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.textDim, letterSpacing: 1.5 },
});

// ─────────────────────────────────────────────────────────────────────────────
// Styles — Map Picker Modal
// ─────────────────────────────────────────────────────────────────────────────
const mp = StyleSheet.create({
  root:          { flex: 1, backgroundColor: '#fff' },
  header:        { backgroundColor: '#fff', paddingHorizontal: 16, paddingBottom: 10, zIndex: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 4 },
  headerRow:     { flexDirection: 'row', alignItems: 'center', paddingBottom: 12 },
  backBtn:       { width: 38, height: 38, borderRadius: 19, backgroundColor: '#f1f3f4', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
  headerTitle:   { flex: 1, fontSize: 17, fontFamily: FONT, fontWeight: '800', color: '#202124' },
  gpsBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,184,204,0.10)', alignItems: 'center', justifyContent: 'center' },
  searchRow:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#f1f3f4', borderRadius: 13, paddingHorizontal: 12, height: 44 },
  searchInput:   { flex: 1, color: '#202124', fontSize: 14, fontFamily: FONT },
  suggBox:       { backgroundColor: '#fff', borderRadius: 13, marginTop: 6, borderWidth: 1, borderColor: '#f1f3f4', overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 6, elevation: 4 },
  suggRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12 },
  suggBorder:    { borderBottomWidth: 1, borderBottomColor: '#f1f3f4' },
  suggMain:      { fontSize: 13, fontFamily: FONT, fontWeight: '600', color: '#202124' },
  suggSub:       { fontSize: 11, fontFamily: FONT, color: '#9aa0a6', marginTop: 1 },
  pinOuter:      { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,59,92,0.15)', alignItems: 'center', justifyContent: 'center' },
  pinInner:      { width: 14, height: 14, borderRadius: 7, backgroundColor: '#ff3b5c', borderWidth: 2.5, borderColor: '#fff' },
  hint:          { position: 'absolute', top: 20, left: 0, right: 0, alignItems: 'center' },
  hintBubble:    { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.96)', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 4 },
  hintText:      { fontSize: 13, fontFamily: FONT, color: '#202124', fontWeight: '600' },
  bottomPanel:   { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 22, paddingBottom: Platform.OS === 'ios' ? 40 : 26, shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 14, elevation: 18 },
  addressRow:    { flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 12 },
  addressIcon:   { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff0f3', alignItems: 'center', justifyContent: 'center' },
  addressText:   { fontSize: 14, fontFamily: FONT, fontWeight: '600', color: '#202124', lineHeight: 20 },
  coordText:     { fontSize: 11, color: '#9aa0a6', marginTop: 2, fontFamily: MONO },
  changeBtn:     { paddingHorizontal: 13, paddingVertical: 8, backgroundColor: '#f1f3f4', borderRadius: 12 },
  changeBtnText: { fontSize: 12, fontFamily: FONT, fontWeight: '700', color: '#5f6368' },
  confirmBtn:    { borderRadius: 18, overflow: 'hidden' },
  confirmGrad:   { paddingVertical: 18, alignItems: 'center' },
  confirmBtnText:{ color: '#060b12', fontSize: 15, fontFamily: FONT, fontWeight: '900', letterSpacing: 0.5 },
  noPin:         { alignItems: 'center', paddingVertical: 10, gap: 5 },
  noPinText:     { fontSize: 14, fontFamily: FONT, color: '#202124', fontWeight: '600', textAlign: 'center' },
  noPinSub:      { fontSize: 12, fontFamily: FONT, color: '#9aa0a6', textAlign: 'center' },
});