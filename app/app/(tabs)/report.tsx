import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ScrollView, StatusBar, StyleSheet, ActivityIndicator,
  Alert, Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import MapPickerModal from '../components/reportPage/MapPickerModal';
import IncidentTypeSelector from '../components/reportPage/IncidentTypeSelector';
import SeveritySelector from '../components/reportPage/SeveritySelector';
import PhotoPicker from '../components/reportPage/PhotoPicker';
import { BlurView } from 'expo-blur';
import {
  BASE_URL, C, FONT, MONO,
} from '../constants/reportConstants';
import type { Coord, FloodZone, ReportType } from '../constants/reportConstants.ts';

export default function FloodReportScreen() {
  const [address, setAddress]         = useState('');
  const [coord, setCoord]             = useState<Coord | null>(null);
  const [reportType, setReportType]   = useState<ReportType>('FLOODED_ROAD');
  const [severity, setSeverity]       = useState(1);
  const [description, setDescription] = useState('');
  const [images, setImages]           = useState<string[]>([]);
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
      setSeverity(1); setReportType('FLOODED_ROAD'); setImages([]);
    } catch (err: any) {
      Alert.alert('Submission Failed', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={s.root}>
      <StatusBar barStyle="dark-content" />

      {/* Light gradient background */}
      <LinearGradient colors={['#DBEAFE', '#EEF4FF', '#F0F9FF']} style={StyleSheet.absoluteFill} />

      {/* Ambient blobs */}
      <View style={[s.blob, { top: -80,   left: -80,   width: 300, height: 300, backgroundColor: 'rgba(59,130,246,0.10)' }]} />
      <View style={[s.blob, { top: 300,   right: -100, width: 260, height: 260, backgroundColor: 'rgba(99,102,241,0.07)' }]} />
      <View style={[s.blob, { bottom: -80, left: -60,  width: 280, height: 280, backgroundColor: 'rgba(14,165,233,0.08)' }]} />

      <MapPickerModal
        visible={mapOpen}
        onClose={() => setMapOpen(false)}
        onConfirm={(c, a) => { setCoord(c); setAddress(a); }}
        initialCoord={coord}
        floodZones={floodZones}
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
          <IncidentTypeSelector value={reportType} onChange={setReportType} />

          {/* ══ SEVERITY ══ */}
          <SeveritySelector value={severity} onChange={setSeverity} />

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
          <PhotoPicker images={images} onChange={setImages} />

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

const s = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  blob: { position: 'absolute', borderRadius: 999 },

  topBar:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 22, paddingTop: 16, paddingBottom: 7 },
  topBarLeft:   { gap: 4 },
  livePill:     { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: 'rgba(30,58,138,0.08)', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(30,58,138,0.18)', alignSelf: 'flex-start' },
  liveDot:      { width: 7, height: 7, borderRadius: 4, backgroundColor: '#3B82F6' },
  livePillText: { color: C.blue, fontSize: 10, fontFamily: FONT, fontWeight: '800', letterSpacing: 2.5 },
  topBarSub:    { color: C.textMid, fontSize: 11, fontFamily: FONT, marginLeft: 2 },
  sosChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: 'rgba(220,38,38,0.08)', borderWidth: 1, borderColor: 'rgba(220,38,38,0.20)' },

  heroWrap:  { paddingHorizontal: 22, paddingBottom: 20, paddingTop: 2 },
  heroLabel: { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.blueMid, letterSpacing: 4, opacity: 0.8, marginBottom: 5 },
  heroTitle: { fontSize: 35, fontFamily: FONT, fontWeight: '800', color: C.blue, letterSpacing: -1.5, lineHeight: 40 },
  heroSub:   { fontSize: 11, fontFamily: FONT, color: C.textMid, marginTop: 10, lineHeight: 15 },

  scroll: { paddingHorizontal: 18, paddingBottom: 54 },

  sectionHeader:   { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  sectionDot:      { width: 4, height: 4, borderRadius: 2, backgroundColor: C.blueMid },
  sectionLabel:    { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.blue, letterSpacing: 3 },

  glassCard:       { borderRadius: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden', padding: 6, backgroundColor: C.card },
  glassCardActive: { borderColor: 'rgba(220,38,38,0.30)' },

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

  textArea:   { color: C.text, fontSize: 15, fontFamily: FONT, padding: 18, minHeight: 120, lineHeight: 24 },
  descFooter: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: 16, paddingBottom: 10 },
  charCount:  { color: C.textDim, fontSize: 11, fontFamily: MONO },

  optTag:     { fontSize: 9, fontFamily: FONT, fontWeight: '700', color: C.textDim, letterSpacing: 2, marginBottom: 12 },

  submitWrap: { marginTop: 36, borderRadius: 24, overflow: 'hidden', shadowColor: '#1E3A8A', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 20, elevation: 10 },
  submitGrad: { height: 66, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  submitText: { color: C.white, fontSize: 14, fontFamily: FONT, fontWeight: '900', letterSpacing: 2 },

  footerRow:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20, gap: 7 },
  footerText: { fontSize: 9.5, fontFamily: FONT, fontWeight: '700', color: C.textDim, letterSpacing: 1.5 },
});
