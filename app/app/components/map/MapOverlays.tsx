import React, { useRef, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, Animated,
  Modal, ActivityIndicator, StyleSheet, Platform, Vibration,
} from 'react-native';
import { C, SEVERITY_ALERT, HAZARD_ICON, HAZARD_LABEL, HAZARD_COLOR } from '../../constants/mapConstants';
import type { FloodZone, HazardReport } from '../../constants/mapConstants';
import { sevColor } from '../../utils/mapHelpers';

// ─── FloodAlertPopup ──────────────────────────────────────────────────────────

interface FloodAlertPopupProps {
  zone: FloodZone | null;
  onDismiss: () => void;
}

export const FloodAlertPopup: React.FC<FloodAlertPopupProps> = ({ zone, onDismiss }) => {
  const scale   = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (zone) {
      Animated.parallel([
        Animated.spring(scale,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 10 }),
        Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
      ]).start();
      if (zone.severity === 'EXTREME') Vibration.vibrate([0, 200, 100, 200, 100, 300]);
    } else {
      scale.setValue(0.85);
      opacity.setValue(0);
    }
  }, [zone]);

  if (!zone || zone.severity === 'NORMAL') return null;
  const cfg = SEVERITY_ALERT[zone.severity];

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View style={fa.overlay}>
        <Animated.View style={[fa.card, { backgroundColor: cfg.bg, opacity, transform: [{ scale }] }]}>
          <Text style={fa.bigIcon}>{cfg.icon}</Text>
          <Text style={[fa.title,   { color: cfg.tc }]}>{cfg.title}</Text>
          <Text style={[fa.message, { color: cfg.tc }]}>{cfg.message}</Text>
          <View style={fa.meta}>
            <Text style={[fa.metaTxt, { color: cfg.tc }]}>Gauge: {zone.gauge_id}</Text>
          </View>
          <TouchableOpacity style={[fa.btn, { borderColor: cfg.tc }]} onPress={onDismiss}>
            <Text style={[fa.btnTxt, { color: cfg.tc }]}>I Understand</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── ReroutingOverlay ─────────────────────────────────────────────────────────

interface ReroutingOverlayProps {
  visible: boolean;
}

export const ReroutingOverlay: React.FC<ReroutingOverlayProps> = ({ visible }) => {
  if (!visible) return null;
  return (
    <View style={ov.overlay}>
      <View style={ov.card}>
        <ActivityIndicator size="large" color={C.primary} />
        <Text style={ov.title}>Rerouting…</Text>
        <Text style={ov.sub}>Flood zone ahead. Finding a safer path.</Text>
      </View>
    </View>
  );
};

// ─── HazardCard ───────────────────────────────────────────────────────────────

interface HazardCardProps {
  report: HazardReport | null;
  onDismiss: () => void;
}

export const HazardCard: React.FC<HazardCardProps> = ({ report, onDismiss }) => {
  const slideY = useRef(new Animated.Value(400)).current;

  useEffect(() => {
    if (report) {
      slideY.setValue(400);
      Animated.spring(slideY, {
        toValue: 0, useNativeDriver: true, tension: 68, friction: 11,
      }).start();
    }
  }, [report]);

  return (
    <Modal
      visible={!!report}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onDismiss}
    >
      <View style={hc.modalRoot}>
        <TouchableOpacity style={hc.backdrop} activeOpacity={1} onPress={onDismiss} />
        <Animated.View style={[hc.card, { transform: [{ translateY: slideY }] }]}>
          {report && (
            <>
              <View style={hc.handle} />
              <View style={hc.header}>
                <View style={[hc.iconBox, { backgroundColor: `${HAZARD_COLOR[report.report_type]}18` }]}>
                  <Text style={{ fontSize: 30 }}>{HAZARD_ICON[report.report_type]}</Text>
                </View>
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <Text style={hc.title}>{HAZARD_LABEL[report.report_type]}</Text>
                  <Text style={hc.coord}>
                    {report.location.latitude.toFixed(4)}, {report.location.longitude.toFixed(4)}
                  </Text>
                </View>
                <View style={[hc.sevBadge, { backgroundColor: sevColor(report.severity) }]}>
                  <Text style={hc.sevTxt}>SEV {report.severity}</Text>
                </View>
              </View>

              <Text style={hc.desc}>{report.description}</Text>

              <View style={hc.footer}>
                <Text style={hc.expiry}>
                  ⏱ Expires {new Date(report.expires_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </Text>
                <TouchableOpacity style={hc.dismissBtn} onPress={onDismiss}>
                  <Text style={hc.dismissTxt}>Dismiss</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const fa = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card:    { width: '100%', maxWidth: 360, borderRadius: 28, padding: 28, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 24, elevation: 24 },
  bigIcon: { fontSize: 54, marginBottom: 16 },
  title:   { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  message: { fontSize: 14, textAlign: 'center', lineHeight: 22, marginBottom: 16 },
  meta:    { backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8, marginBottom: 20 },
  metaTxt: { fontSize: 12, fontWeight: '700' },
  btn:     { width: '100%', borderRadius: 16, borderWidth: 2, paddingVertical: 15, alignItems: 'center' },
  btnTxt:  { fontSize: 15, fontWeight: '800' },
});

const ov = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 50, backgroundColor: 'rgba(0,0,0,0.42)', alignItems: 'center', justifyContent: 'center' },
  card:    { backgroundColor: '#fff', borderRadius: 24, padding: 28, alignItems: 'center', width: 270, shadowColor: '#000', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 18, elevation: 18 },
  title:   { fontSize: 18, fontWeight: '800', color: C.onSurface, marginTop: 16, marginBottom: 8 },
  sub:     { fontSize: 13, color: C.outline, textAlign: 'center', lineHeight: 20 },
});

const hc = StyleSheet.create({
  modalRoot:  { flex: 1, flexDirection: 'column', justifyContent: 'flex-end' },
  backdrop:   { flex: 1, backgroundColor: 'rgba(0,0,0,0.08)' },
  card:       { backgroundColor: C.surfaceContainerLowest, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 46 : 28, shadowColor: '#000', shadowOffset: { width: 0, height: -5 }, shadowOpacity: 0.14, shadowRadius: 22, elevation: 30 },
  handle:     { width: 44, height: 5, borderRadius: 3, backgroundColor: C.surfaceDim, alignSelf: 'center', marginTop: 12, marginBottom: 18 },
  header:     { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  iconBox:    { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  title:      { fontSize: 17, fontWeight: '800', color: C.onSurface },
  coord:      { fontSize: 11, color: C.outline, marginTop: 3 },
  sevBadge:   { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  sevTxt:     { color: '#fff', fontSize: 11, fontWeight: '800' },
  desc:       { fontSize: 14, color: C.onSurfaceVariant, lineHeight: 22, marginBottom: 18 },
  footer:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  expiry:     { fontSize: 12, color: C.outline },
  dismissBtn: { backgroundColor: C.surfaceContainerHigh, borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 },
  dismissTxt: { fontSize: 13, fontWeight: '700', color: C.onSurfaceVariant },
});
