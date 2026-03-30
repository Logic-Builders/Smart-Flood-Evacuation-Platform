
import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, StyleSheet, Platform } from 'react-native';
import { C } from '../../constants/mapConstants';
import type { RouteOption } from '../../constants/mapConstants';
import { fmtDist, fmtTime } from '../../utils/mapHelpers';

interface RouteSheetProps {
  visible: boolean;
  options: RouteOption[];
  selectedIdx: number;
  onSelect: (i: number) => void;
  onConfirm: () => void;
  onClose: () => void;
}

const RouteSheet: React.FC<RouteSheetProps> = ({
  visible, options, selectedIdx, onSelect, onConfirm, onClose,
}) => {
  const slideY = useRef(new Animated.Value(600)).current;

  useEffect(() => {
    Animated.spring(slideY, {
      toValue: visible ? 0 : 600,
      useNativeDriver: true,
      tension: 68, friction: 12,
    }).start();
  }, [visible]);

  return (
    <Animated.View style={[rs.sheet, { transform: [{ translateY: slideY }] }]}>
      <View style={rs.handle} />
      <View style={rs.titleRow}>
        <Text style={rs.title}>Choose Route</Text>
        <Text style={rs.subtitle}>{options.length} optimal paths detected</Text>
      </View>

      {options.map((opt, i) => {
        const isSafest = opt.tag === 'safest';
        const selected = selectedIdx === i;
        const hasRisk  = opt.zonesHit.length > 0;
        return (
          <TouchableOpacity
            key={`${opt.tag}-${i}`}
            style={[rs.card, selected && { borderColor: opt.color, borderWidth: 2.5 }]}
            onPress={() => onSelect(i)}
            activeOpacity={0.88}
          >
            <View style={rs.cardHead}>
              <View style={[rs.cardIconWrap, { backgroundColor: isSafest ? '#dcfce7' : '#fff3e0' }]}>
                <Text style={{ fontSize: 22 }}>{isSafest ? '🛡' : '⚡'}</Text>
              </View>
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={[rs.cardTitle, { color: opt.color }]}>
                  {isSafest ? 'Safest Path' : 'Fastest Path'}
                </Text>
                <Text style={[rs.cardSubtitle, {
                  color: isSafest ? '#137333' : (hasRisk ? C.error : C.outline),
                }]}>
                  {isSafest
                    ? (opt.detoured ? '✓ Verified Flood-Free' : '✓ Flood-Free Route')
                    : (hasRisk ? '⚠ Passes Flood Zone' : 'No hazards')}
                </Text>
              </View>
              <View style={{ alignItems: 'flex-end' }}>
                <Text style={rs.cardTime}>{fmtTime(opt.duration)}</Text>
                <Text style={rs.cardDist}>{fmtDist(opt.distance)}</Text>
              </View>
            </View>

            <View style={rs.cardFoot}>
              <Text style={rs.cardFootNote}>
                {isSafest
                  ? (opt.detoured ? `Rerouted around ${options.find(o => o.tag === 'fastest')?.zonesHit.length ?? 0} zone(s)` : 'Clear of all flood zones')
                  : (hasRisk ? `Caution — ${opt.zonesHit.length} zone(s) on route` : 'No hazards detected')}
              </Text>
              {selected && (
                <View style={[rs.selectedPill, { backgroundColor: opt.color }]}>
                  <Text style={rs.selectedPillTxt}>✓</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
        );
      })}

      <View style={rs.footer}>
        <TouchableOpacity style={rs.cancelBtn} onPress={onClose}>
          <Text style={rs.cancelTxt}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[rs.goBtn, { backgroundColor: options[selectedIdx]?.color ?? C.secondary }]}
          onPress={onConfirm}
        >
          <Text style={rs.goTxt}>▶  Go Safely</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
};

export default RouteSheet;

const rs = StyleSheet.create({
  sheet:     { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 21, backgroundColor: C.surface, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingBottom: Platform.OS === 'ios' ? 46 : 30, shadowColor: '#000', shadowOffset: { width: 0, height: -6 }, shadowOpacity: 0.10, shadowRadius: 22, elevation: 24 },
  handle:    { width: 44, height: 5, borderRadius: 3, backgroundColor: C.surfaceDim, alignSelf: 'center', marginTop: 12, marginBottom: 18 },
  titleRow:  { marginBottom: 18 },
  title:     { fontSize: 22, fontWeight: '800', color: C.onSurface },
  subtitle:  { fontSize: 13, color: C.outline, marginTop: 3 },

  card:         { backgroundColor: C.surfaceContainerLowest, borderRadius: 22, marginBottom: 14, overflow: 'hidden', borderWidth: 2, borderColor: 'transparent', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 6, elevation: 2 },
  cardHead:     { flexDirection: 'row', alignItems: 'center', padding: 16 },
  cardIconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  cardTitle:    { fontSize: 16, fontWeight: '800' },
  cardSubtitle: { fontSize: 11, fontWeight: '700', marginTop: 3, textTransform: 'uppercase', letterSpacing: 0.5 },
  cardTime:     { fontSize: 22, fontWeight: '800', color: C.onSurface },
  cardDist:     { fontSize: 11, color: C.outline, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8, marginTop: 2 },

  cardFoot:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 14, paddingTop: 6, borderTopWidth: 1, borderTopColor: C.outlineVariant + '30' },
  cardFootNote:    { fontSize: 12, color: C.onSurfaceVariant, fontStyle: 'italic', flex: 1 },
  selectedPill:    { borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5 },
  selectedPillTxt: { color: '#fff', fontSize: 13, fontWeight: '800' },

  footer:    { flexDirection: 'row', gap: 12, marginTop: 6 },
  cancelBtn: { flex: 1, backgroundColor: C.surfaceContainerHigh, borderRadius: 16, paddingVertical: 16, alignItems: 'center' },
  cancelTxt: { fontSize: 14, fontWeight: '700', color: C.onSurfaceVariant },
  goBtn:     { flex: 2, borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: C.secondary, shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 5 },
  goTxt:     { fontSize: 15, fontWeight: '800', color: '#fff' },
});
