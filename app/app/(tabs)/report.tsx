import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  StatusBar,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:8080';

const REPORT_TYPES = [
  { value: 'FLOODED_ROAD',    label: 'Flooded Road',    icon: 'water'         },
  { value: 'DAMAGED_BRIDGE',  label: 'Damaged Bridge',  icon: 'bridge'        },
  { value: 'BLOCKED_ROAD',    label: 'Blocked Road',    icon: 'alert-octagon' },
] as const;

type ReportType = typeof REPORT_TYPES[number]['value'];

const severityColor = (level: number) =>
  ['', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'][level];

// ─── Address Picker Modal ────────────────────────────────────────────────────

const AddressPickerModal = ({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: string, lat: number, lng: number) => void;
}) => {
  const [query, setQuery]           = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const debRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<TextInput>(null);

  const search = (text: string) => {
    setQuery(text);
    if (debRef.current) clearTimeout(debRef.current);
    if (text.length < 2) { setSuggestions([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=lk&limit=6`,
          { headers: { 'User-Agent': 'FloodEvacApp/1.0' } }
        );
        setSuggestions(await res.json());
      } catch {}
    }, 300);
  };

  const pick = (item: any) => {
    setSuggestions([]);
    setQuery('');
    onSelect(item.display_name, parseFloat(item.lat), parseFloat(item.lon));
    onClose();
  };

  const useCurrentLocation = async () => {
    setLoadingGPS(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Enable location access to use this feature.');
        setLoadingGPS(false);
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const { latitude, longitude } = loc.coords;
      const geo = await Location.reverseGeocodeAsync({ latitude, longitude });
      const g = geo[0];
      const label = [g.name, g.street, g.city, g.region].filter(Boolean).join(', ');
      onSelect(label || `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`, latitude, longitude);
      onClose();
    } catch {
      Alert.alert('Error', 'Could not get current location.');
    }
    setLoadingGPS(false);
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <View style={ms.root}>
        <StatusBar barStyle="light-content" backgroundColor="#0c1d2e" />

        {/* Header */}
        <LinearGradient colors={['#0c1d2e', '#081420']} style={ms.header}>
          <SafeAreaView>
            <View style={ms.headerRow}>
              <TouchableOpacity style={ms.backBtn} onPress={() => { setSuggestions([]); setQuery(''); onClose(); }}>
                <Feather name="arrow-left" size={22} color="#00dff3" />
              </TouchableOpacity>
              <Text style={ms.headerTitle}>Select Location</Text>
            </View>

            {/* Search field */}
            <View style={ms.searchBox}>
              <Feather name="search" size={18} color="#475569" style={{ marginRight: 10 }} />
              <TextInput
                ref={inputRef}
                style={ms.searchInput}
                placeholder="Search address in Sri Lanka…"
                placeholderTextColor="#475569"
                value={query}
                onChangeText={search}
                autoFocus
                returnKeyType="search"
              />
              {query.length > 0 && (
                <TouchableOpacity onPress={() => { setQuery(''); setSuggestions([]); }}>
                  <Feather name="x" size={16} color="#475569" />
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </LinearGradient>

        {/* GPS button */}
        <TouchableOpacity style={ms.gpsRow} onPress={useCurrentLocation} disabled={loadingGPS}>
          <View style={ms.gpsIconBox}>
            {loadingGPS
              ? <ActivityIndicator size="small" color="#00dff3" />
              : <Feather name="crosshair" size={20} color="#00dff3" />}
          </View>
          <View>
            <Text style={ms.gpsTitle}>Use my current location</Text>
            <Text style={ms.gpsSub}>Auto-fill from GPS</Text>
          </View>
          <Feather name="chevron-right" size={18} color="#334155" style={{ marginLeft: 'auto' }} />
        </TouchableOpacity>

        <View style={ms.divider} />

        {/* Results */}
        {suggestions.length > 0 ? (
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            <Text style={ms.sectionLabel}>RESULTS</Text>
            {suggestions.map((item, idx) => (
              <TouchableOpacity key={item.place_id ?? idx} style={ms.resultRow} onPress={() => pick(item)} activeOpacity={0.7}>
                <View style={ms.resultIcon}>
                  <Feather name="map-pin" size={16} color="#00dff3" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={ms.resultMain} numberOfLines={1}>
                    {item.display_name.split(',')[0]}
                  </Text>
                  <Text style={ms.resultSub} numberOfLines={1}>
                    {item.display_name.split(',').slice(1).join(',').trim()}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : query.length === 0 ? (
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={ms.sectionLabel}>QUICK SELECT</Text>
            {[
              { icon: 'activity',  label: 'Nearest Hospital',   val: 'Hospital Colombo Sri Lanka' },
              { icon: 'home',      label: 'Emergency Shelter',  val: 'Emergency Shelter Sri Lanka' },
              { icon: 'alert-triangle', label: 'Fire Station',  val: 'Fire Station Colombo' },
              { icon: 'shield',    label: 'Police Station',     val: 'Police Station Colombo' },
            ].map((q) => (
              <TouchableOpacity key={q.label} style={ms.quickRow} onPress={() => search(q.val)} activeOpacity={0.7}>
                <View style={ms.quickIcon}>
                  <Feather name={q.icon as any} size={18} color="#00dff3" />
                </View>
                <Text style={ms.quickText}>{q.label}</Text>
                <Feather name="chevron-right" size={16} color="#334155" />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={ms.emptyState}>
            <Feather name="map" size={40} color="#1e3a4a" />
            <Text style={ms.emptyText}>No results found</Text>
            <Text style={ms.emptySub}>Try a different search term</Text>
          </View>
        )}
      </View>
    </Modal>
  );
};

// ─── Main Report Screen ──────────────────────────────────────────────────────

export default function FloodReportScreen() {
  const [fullName, setFullName]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [address, setAddress]         = useState('');
  const [latitude, setLatitude]       = useState<number | null>(null);
  const [longitude, setLongitude]     = useState<number | null>(null);
  const [reportType, setReportType]   = useState<ReportType>('FLOODED_ROAD');
  const [severity, setSeverity]       = useState(1);
  const [description, setDescription] = useState('');
  const [image, setImage]             = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [mapOpen, setMapOpen]         = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9] as [number, number],
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleAddressSelect = (addr: string, lat: number, lng: number) => {
    setAddress(addr);
    setLatitude(lat);
    setLongitude(lng);
  };

  const handleSubmit = async () => {
    if (!fullName.trim())       return Alert.alert('Missing Field', 'Please enter your full name.');
    if (!phoneNumber.trim())    return Alert.alert('Missing Field', 'Please enter your phone number.');
    if (!address.trim() || latitude === null || longitude === null)
      return Alert.alert('Missing Field', 'Please select a location using the address picker.');
    if (!description.trim())    return Alert.alert('Missing Field', 'Please describe the hazard.');

    if (latitude < 5.9 || latitude > 9.9 || longitude < 79.6 || longitude > 81.9)
      return Alert.alert('Invalid Location', 'Location must be within Sri Lanka.');

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');
      if (!token) {
        Alert.alert('Not Logged In', 'You must be logged in to submit a report.');
        return;
      }

      const response = await fetch(`${BASE_URL}/api/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude,
          longitude,
          address: address.trim(),
          report_type: reportType,
          severity,
          description: description.trim(),
          reporter_name: fullName.trim(),
          reporter_phone: phoneNumber.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok || !data.success) throw new Error(data.error || 'Submission failed.');

      Alert.alert('✅ Report Submitted', 'Your report is pending admin review and will appear on the map once approved.');
      setFullName(''); setPhoneNumber(''); setAddress('');
      setLatitude(null); setLongitude(null);
      setDescription(''); setSeverity(1);
      setReportType('FLOODED_ROAD'); setImage(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#060f17', '#0c1d2e', '#081420']} style={StyleSheet.absoluteFill} />
      <View style={[s.glow, { top: -80,   left: -80,  backgroundColor: '#00dff318' }]} />
      <View style={[s.glow, { bottom: -120, right: -80, backgroundColor: '#00dff310' }]} />

      <AddressPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        onSelect={handleAddressSelect}
      />

      <SafeAreaView style={s.safeArea}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.headerEyebrow}>Emergency</Text>
            <Text style={s.headerTitle}>Flood Report</Text>
          </View>
          <View style={s.liveBadge}>
            <View style={s.liveDot} />
            <Text style={s.liveBadgeText}>LIVE</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Reporter Info */}
          <Text style={s.sectionLabel}>REPORTER INFO</Text>
          <BlurView intensity={15} tint="dark" style={s.card}>
            <View style={s.inputWrapper}>
              <Feather name="user" size={16} color="#64748b" style={s.inputIcon} />
              <TextInput
                placeholder="Full Name"
                placeholderTextColor="#475569"
                style={s.input}
                value={fullName}
                onChangeText={setFullName}
              />
            </View>
            <View style={s.cardDivider} />
            <View style={s.inputWrapper}>
              <Feather name="phone" size={16} color="#64748b" style={s.inputIcon} />
              <TextInput
                placeholder="Phone Number"
                placeholderTextColor="#475569"
                keyboardType="phone-pad"
                style={s.input}
                value={phoneNumber}
                onChangeText={setPhoneNumber}
              />
            </View>
          </BlurView>

          {/* Location */}
          <Text style={s.sectionLabel}>INCIDENT LOCATION</Text>
          <TouchableOpacity style={s.locationBox} onPress={() => setMapOpen(true)} activeOpacity={0.85}>
            <View style={s.locationIconBox}>
              <Feather name="map-pin" size={20} color="#00dff3" />
            </View>
            <View style={{ flex: 1 }}>
              {address ? (
                <>
                  <Text style={s.locationAddress} numberOfLines={2}>{address}</Text>
                  <Text style={s.locationCoords}>
                    {latitude?.toFixed(5)}, {longitude?.toFixed(5)}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={s.locationPlaceholder}>Tap to select location</Text>
                  <Text style={s.locationSub}>Search address or use GPS</Text>
                </>
              )}
            </View>
            <View style={s.locationChevron}>
              <Feather name={address ? 'edit-2' : 'chevron-right'} size={16} color="#00dff3" />
            </View>
          </TouchableOpacity>

          {/* Incident Type */}
          <Text style={s.sectionLabel}>INCIDENT TYPE</Text>
          <View style={s.typeRow}>
            {REPORT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[s.typeChip, reportType === t.value && s.typeChipActive]}
                onPress={() => setReportType(t.value)}
              >
                <MaterialCommunityIcons
                  name={t.icon as any}
                  size={18}
                  color={reportType === t.value ? '#081219' : '#64748b'}
                />
                <Text style={[s.typeChipText, reportType === t.value && s.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Severity */}
          <Text style={s.sectionLabel}>SEVERITY LEVEL</Text>
          <BlurView intensity={15} tint="dark" style={s.card}>
            <View style={s.severityHeader}>
              <Text style={s.severityValue}>Level {severity}</Text>
              <Text style={s.severityDesc}>
                {['', 'Minor puddles', 'Passable with care', 'Difficult to pass', 'Dangerous', 'Impassable'][severity]}
              </Text>
            </View>
            <View style={s.severityBars}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setSeverity(n)} style={{ flex: 1 }}>
                  <View style={[
                    s.severityBar,
                    { backgroundColor: severity >= n ? severityColor(severity) : 'rgba(100,116,139,0.2)' }
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          {/* Description */}
          <Text style={s.sectionLabel}>DESCRIPTION</Text>
          <BlurView intensity={15} tint="dark" style={[s.card, { padding: 0, overflow: 'hidden' }]}>
            <TextInput
              placeholder="Describe the hazard — road condition, water level, visibility…"
              placeholderTextColor="#475569"
              multiline
              numberOfLines={4}
              style={s.textArea}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
          </BlurView>

          {/* Photo */}
          <Text style={s.sectionLabel}>
            PHOTO EVIDENCE <Text style={s.optional}>(OPTIONAL)</Text>
          </Text>
          {image ? (
            <View style={s.previewContainer}>
              <Image source={{ uri: image }} style={s.previewImage} />
              <TouchableOpacity style={s.removeImage} onPress={() => setImage(null)}>
                <Feather name="x" size={14} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={s.uploadBox} onPress={pickImage}>
              <View style={s.uploadIconCircle}>
                <MaterialCommunityIcons name="camera-plus-outline" size={26} color="#00dff3" />
              </View>
              <Text style={s.uploadTitle}>Attach Photo</Text>
              <Text style={s.uploadSub}>Tap to select from gallery</Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[s.submitButton, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={['#00dff3', '#00a8bf']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={s.gradientButton}
            >
              {loading ? (
                <ActivityIndicator color="#081219" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#081219" style={{ marginRight: 8 }} />
                  <Text style={s.submitText}>Submit Report</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={s.footerInfo}>
            <Feather name="shield" size={11} color="#475569" />
            <Text style={s.footerText}>Encrypted · Pending admin review · Expires in 3 hours</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container:        { flex: 1 },
  safeArea:         { flex: 1 },
  glow:             { position: 'absolute', width: 280, height: 280, borderRadius: 140 },
  header:           { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 16 },
  headerEyebrow:    { fontSize: 11, color: '#475569', fontWeight: '600', letterSpacing: 2, textTransform: 'uppercase' },
  headerTitle:      { color: '#f1f5f9', fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  liveBadge:        { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(239,68,68,0.12)', borderRadius: 20, paddingHorizontal: 12, paddingVertical: 6, borderWidth: 1, borderColor: 'rgba(239,68,68,0.25)', gap: 6 },
  liveDot:          { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ef4444' },
  liveBadgeText:    { color: '#ef4444', fontSize: 11, fontWeight: '800', letterSpacing: 1.5 },
  scrollContent:    { paddingHorizontal: 20, paddingBottom: 40 },
  sectionLabel:     { fontSize: 11, fontWeight: '700', color: '#00dff3', letterSpacing: 1.5, marginBottom: 10, marginTop: 22 },
  optional:         { color: '#475569', fontWeight: '600' },

  // Card (BlurView wrapper)
  card:             { borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)', overflow: 'hidden', backgroundColor: 'rgba(15,23,42,0.5)' },
  cardDivider:      { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },

  // Inputs inside card
  inputWrapper:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, height: 54 },
  inputIcon:        { marginRight: 12 },
  input:            { flex: 1, color: '#f1f5f9', fontSize: 15 },

  // Location picker
  locationBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(15,23,42,0.5)', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: 'rgba(0,223,243,0.2)', gap: 14 },
  locationIconBox:  { width: 42, height: 42, borderRadius: 21, backgroundColor: 'rgba(0,223,243,0.1)', alignItems: 'center', justifyContent: 'center' },
  locationAddress:  { color: '#f1f5f9', fontSize: 14, fontWeight: '600', lineHeight: 20 },
  locationCoords:   { color: '#475569', fontSize: 11, marginTop: 3, fontFamily: Platform.OS === 'ios' ? 'Courier New' : 'monospace' },
  locationPlaceholder: { color: '#64748b', fontSize: 14, fontWeight: '600' },
  locationSub:      { color: '#334155', fontSize: 12, marginTop: 3 },
  locationChevron:  { width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(0,223,243,0.1)', alignItems: 'center', justifyContent: 'center' },

  // Type chips
  typeRow:          { flexDirection: 'row', gap: 8 },
  typeChip:         { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 14, borderRadius: 16, backgroundColor: 'rgba(30,41,59,0.5)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  typeChipActive:   { backgroundColor: '#00dff3', borderColor: '#00dff3' },
  typeChipText:     { fontSize: 10, fontWeight: '700', color: '#64748b', textAlign: 'center' },
  typeChipTextActive: { color: '#081219' },

  // Severity
  severityHeader:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16, paddingBottom: 12 },
  severityValue:    { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
  severityDesc:     { color: '#64748b', fontSize: 13 },
  severityBars:     { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
  severityBar:      { height: 8, borderRadius: 4 },

  // Text area
  textArea:         { color: '#f1f5f9', fontSize: 15, padding: 16, minHeight: 110, lineHeight: 22 },

  // Upload
  uploadBox:        { borderRadius: 18, borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(0,223,243,0.25)', backgroundColor: 'rgba(0,223,243,0.04)', alignItems: 'center', paddingVertical: 28, gap: 6 },
  uploadIconCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(0,223,243,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  uploadTitle:      { color: '#cbd5e1', fontSize: 14, fontWeight: '700' },
  uploadSub:        { color: '#475569', fontSize: 12 },
  previewContainer: { position: 'relative' },
  previewImage:     { width: '100%', height: 190, borderRadius: 18 },
  removeImage:      { position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.55)', padding: 6, borderRadius: 10 },

  // Submit
  submitButton:     { marginTop: 28, borderRadius: 18, overflow: 'hidden', shadowColor: '#00dff3', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.25, shadowRadius: 14, elevation: 8 },
  gradientButton:   { height: 58, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitText:       { color: '#081219', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  footerInfo:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 14, gap: 6 },
  footerText:       { fontSize: 11, color: '#475569' },
});

// Modal styles
const ms = StyleSheet.create({
  root:           { flex: 1, backgroundColor: '#060f17' },
  header:         { paddingBottom: 16, paddingHorizontal: 16 },
  headerRow:      { flexDirection: 'row', alignItems: 'center', paddingBottom: 14, gap: 12 },
  backBtn:        { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(0,223,243,0.1)', alignItems: 'center', justifyContent: 'center' },
  headerTitle:    { color: '#f1f5f9', fontSize: 18, fontWeight: '800' },
  searchBox:      { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(30,41,59,0.8)', borderRadius: 14, paddingHorizontal: 14, height: 50, borderWidth: 1, borderColor: 'rgba(0,223,243,0.2)' },
  searchInput:    { flex: 1, color: '#f1f5f9', fontSize: 15 },

  gpsRow:         { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, gap: 14 },
  gpsIconBox:     { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,223,243,0.1)', alignItems: 'center', justifyContent: 'center' },
  gpsTitle:       { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },
  gpsSub:         { color: '#475569', fontSize: 12, marginTop: 2 },

  divider:        { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 20 },

  sectionLabel:   { fontSize: 11, fontWeight: '700', color: '#00dff3', letterSpacing: 1.5, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 10 },

  resultRow:      { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  resultIcon:     { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(0,223,243,0.1)', alignItems: 'center', justifyContent: 'center' },
  resultMain:     { color: '#f1f5f9', fontSize: 14, fontWeight: '600' },
  resultSub:      { color: '#475569', fontSize: 12, marginTop: 2 },

  quickRow:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  quickIcon:      { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(0,223,243,0.08)', alignItems: 'center', justifyContent: 'center' },
  quickText:      { flex: 1, color: '#cbd5e1', fontSize: 14, fontWeight: '500' },

  emptyState:     { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  emptyText:      { color: '#94a3b8', fontSize: 16, fontWeight: '700' },
  emptySub:       { color: '#475569', fontSize: 13 },
});