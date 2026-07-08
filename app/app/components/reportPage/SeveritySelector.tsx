import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { C, FONT, SEV_COLOR, SEV_DESC, SEV_LABEL } from '../../constants/reportConstants';

interface SeveritySelectorProps {
  value: number;
  onChange: (level: number) => void;
}

const SeveritySelector: React.FC<SeveritySelectorProps> = ({ value, onChange }) => {
  const sevColor = SEV_COLOR(value);

  return (
    <>
      {/* Header row with badge */}
      <View style={styles.sevHeaderRow}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionDot} />
          <Text style={styles.sectionLabel}>SEVERITY LEVEL</Text>
        </View>
        <View style={[styles.sevBadge, { borderColor: sevColor + '55', backgroundColor: sevColor + '18' }]}>
          <Text style={[styles.sevBadgeText, { color: sevColor }]}>{SEV_LABEL[value]}</Text>
        </View>
      </View>

      <BlurView intensity={55} tint="light" style={styles.glassCard}>
        {/* Top info row */}
        <View style={styles.sevTop}>
          <View style={[styles.sevNumBox, { borderColor: sevColor + '70', backgroundColor: sevColor + '15' }]}>
            <Text style={[styles.sevNum, { color: sevColor }]}>{value}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.sevDescText}>{SEV_DESC[value]}</Text>
            <Text style={styles.sevScaleHint}>Scale: 1 (minor) → 5 (critical)</Text>
          </View>
        </View>

        {/* Bar chart selector */}
        <View style={styles.sevBars}>
          {[1, 2, 3, 4, 5].map(n => (
            <TouchableOpacity key={n} onPress={() => onChange(n)} style={{ flex: 1, paddingHorizontal: 3 }}>
              <View style={{
                height: value === n ? 40 : value > n ? 30 : 22,
                borderRadius: 8,
                backgroundColor: n <= value ? SEV_COLOR(n) : 'rgba(30,58,138,0.08)',
                borderWidth: value === n ? 1.5 : 0,
                borderColor: SEV_COLOR(n) + 'aa',
                shadowColor: n <= value ? SEV_COLOR(n) : 'transparent',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5, shadowRadius: 6,
                elevation: n <= value ? 3 : 0,
                alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 4,
              }}>
                {value === n && <Text style={styles.sevBarLabel}>{n}</Text>}
              </View>
            </TouchableOpacity>
          ))}
        </View>
      </BlurView>
    </>
  );
};

export default SeveritySelector;

const styles = StyleSheet.create({
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, marginBottom: 12 },
  sectionDot:    { width: 4, height: 4, borderRadius: 2, backgroundColor: C.blueMid },
  sectionLabel:  { fontSize: 10, fontFamily: FONT, fontWeight: '700', color: C.blue, letterSpacing: 3 },
  glassCard:     { borderRadius: 22, borderWidth: 1, borderColor: C.border, overflow: 'hidden', padding: 6, backgroundColor: C.card },
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
});
