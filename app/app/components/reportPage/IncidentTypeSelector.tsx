import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { C, FONT, REPORT_TYPES } from '../../constants/reportConstants';
import type { ReportType } from '../../constants/reportConstants';

interface IncidentTypeSelectorProps {
  value: ReportType;
  onChange: (type: ReportType) => void;
}

const IncidentTypeSelector: React.FC<IncidentTypeSelectorProps> = ({ value, onChange }) => {
  return (
    <View style={styles.typeGrid}>
      {REPORT_TYPES.map(t => {
        const active = value === t.value;
        return (
          <TouchableOpacity
            key={t.value}
            onPress={() => onChange(t.value)}
            activeOpacity={0.75}
            style={styles.typeChipWrap}
          >
            <BlurView intensity={55} tint="light" style={[styles.typeChip, active && styles.typeChipActive]}>
              {active && (
                <LinearGradient
                  colors={['rgba(59,130,246,0.14)', 'rgba(59,130,246,0.03)']}
                  style={[StyleSheet.absoluteFill, { borderRadius: 20 }]}
                />
              )}
              <View style={[styles.typeIconBox, active && styles.typeIconBoxActive]}>
                <MaterialCommunityIcons
                  name={t.icon as any}
                  size={22}
                  color={active ? C.blue : C.textMid}
                />
              </View>
              <Text style={[styles.typeLabel, active && styles.typeLabelActive]}>{t.label}</Text>
              {active && <View style={styles.typeActiveDot} />}
            </BlurView>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default IncidentTypeSelector;

const styles = StyleSheet.create({
  typeGrid:          { flexDirection: 'row', gap: 10 },
  typeChipWrap:      { flex: 1 },
  typeChip:          { borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', paddingVertical: 18, paddingHorizontal: 6, gap: 8, backgroundColor: C.card },
  typeChipActive:    { borderColor: 'rgba(30,58,138,0.35)' },
  typeIconBox:       { width: 42, height: 42, borderRadius: 14, backgroundColor: 'rgba(30,58,138,0.06)', alignItems: 'center', justifyContent: 'center' },
  typeIconBoxActive: { backgroundColor: C.blueSoft },
  typeLabel:         { fontSize: 11, fontFamily: FONT, fontWeight: '700', color: C.textMid, textAlign: 'center', lineHeight: 15 },
  typeLabelActive:   { color: C.blue },
  typeActiveDot:     { width: 5, height: 5, borderRadius: 3, backgroundColor: C.blueMid },
});
