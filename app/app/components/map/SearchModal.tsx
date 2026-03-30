import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, StatusBar, StyleSheet, Platform,
} from 'react-native';
import { C, TOP } from '../../constants/mapConstants';

interface SearchModalProps {
  visible: boolean;
  onClose: () => void;
  startText: string;
  endText: string;
  onStartChange: (t: string) => void;
  onEndChange: (t: string) => void;
  onGetRoute: () => void;
  loadingRoute: boolean;
  onUseMyLocation: () => Promise<void>;
}

const SearchModal = React.memo(({
  visible, onClose, startText, endText,
  onStartChange, onEndChange, onGetRoute, loadingRoute, onUseMyLocation,
}: SearchModalProps) => {
  const [activeField, setActiveField] = useState<'start' | 'end'>('end');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [locLoading,  setLocLoading]  = useState(false);
  const debRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef<TextInput>(null);
  const endRef   = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) setTimeout(() => endRef.current?.focus(), 280);
    else setSuggestions([]);
  }, [visible]);

  const query = useCallback((text: string, field: 'start' | 'end') => {
    if (debRef.current) clearTimeout(debRef.current);
    if (text.length < 2) { setSuggestions([]); return; }
    debRef.current = setTimeout(async () => {
      try {
        const r = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(text)}&countrycodes=lk&limit=6`,
          { headers: { 'User-Agent': 'FloodEvacApp/1.0' } }
        );
        const data = await r.json();
        setSuggestions(data.map((s: any) => ({ ...s, _field: field })));
      } catch {}
    }, 300);
  }, []);

  const handleFieldFocus = (field: 'start' | 'end') => {
    setActiveField(field);
    const txt = field === 'start' ? startText : endText;
    if (txt.length >= 2) query(txt, field);
    else setSuggestions([]);
  };

  const pick = (item: any) => {
    setSuggestions([]);
    if (item._field === 'start') {
      onStartChange(item.display_name);
      setTimeout(() => { setActiveField('end'); endRef.current?.focus(); }, 100);
    } else {
      onEndChange(item.display_name);
    }
  };

  const handleUseMyLocation = async () => {
    setLocLoading(true);
    try { await onUseMyLocation(); } finally { setLocLoading(false); }
    setSuggestions([]);
    setActiveField('end');
    setTimeout(() => endRef.current?.focus(), 150);
  };

  if (!visible) return null;

  return (
    <Modal visible animationType="slide" transparent={false} statusBarTranslucent>
      <View style={sm.root}>
        <StatusBar barStyle="dark-content" backgroundColor={C.surface} />

        {/* Header */}
        <View style={sm.header}>
          <TouchableOpacity style={sm.backBtn} onPress={onClose}>
            <Text style={sm.backIcon}>←</Text>
          </TouchableOpacity>
          <Text style={sm.headerTitle}>Plan Safe Route</Text>
        </View>

        {/* Input card */}
        <View style={sm.inputCard}>
          <View style={sm.connectorCol}>
            <View style={sm.dotStart} />
            <View style={sm.connLine} />
            <View style={sm.dotEnd} />
          </View>
          <View style={sm.fieldsCol}>
            {/* Start field */}
            <View style={[sm.fieldWrap, activeField === 'start' && sm.fieldWrapActive]}>
              <TouchableOpacity activeOpacity={1} style={{ flex: 1 }}
                onPress={() => { handleFieldFocus('start'); startRef.current?.focus(); }}>
                <Text style={sm.fieldLabel}>START LOCATION</Text>
                <TextInput
                  ref={startRef}
                  style={sm.fieldInput}
                  placeholder="Enter start point"
                  placeholderTextColor={C.outline}
                  value={startText}
                  onFocus={() => handleFieldFocus('start')}
                  onChangeText={t => { onStartChange(t); query(t, 'start'); }}
                  returnKeyType="next"
                  onSubmitEditing={() => { setActiveField('end'); endRef.current?.focus(); }}
                />
              </TouchableOpacity>
              {startText.length > 0 && (
                <TouchableOpacity onPress={() => { onStartChange(''); setSuggestions([]); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={sm.clearX}>✕</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Use My Location */}
            {activeField === 'start' && suggestions.length === 0 && (
              <TouchableOpacity style={sm.myLocRow} onPress={handleUseMyLocation} disabled={locLoading}>
                {locLoading
                  ? <ActivityIndicator size="small" color={C.primary} style={{ marginRight: 6 }} />
                  : <Text style={sm.myLocIcon}>📍</Text>}
                <Text style={sm.myLocText}>Use my current location</Text>
              </TouchableOpacity>
            )}

            <View style={{ height: 10 }} />

            {/* Destination field */}
            <View style={[sm.fieldWrap, activeField === 'end' && sm.fieldWrapActive]}>
              <TouchableOpacity activeOpacity={1} style={{ flex: 1 }}
                onPress={() => { handleFieldFocus('end'); endRef.current?.focus(); }}>
                <Text style={sm.fieldLabel}>DESTINATION</Text>
                <TextInput
                  ref={endRef}
                  style={sm.fieldInput}
                  placeholder="Where to?"
                  placeholderTextColor={C.outline}
                  value={endText}
                  onFocus={() => handleFieldFocus('end')}
                  onChangeText={t => { onEndChange(t); query(t, 'end'); }}
                  returnKeyType="search"
                  onSubmitEditing={() => { onClose(); onGetRoute(); }}
                />
              </TouchableOpacity>
              {endText.length > 0 && (
                <TouchableOpacity onPress={() => { onEndChange(''); setSuggestions([]); }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={sm.clearX}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>

        {/* Suggestions / Quick Select */}
        <ScrollView style={sm.list} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {suggestions.length > 0 ? (
            <View>
              <Text style={sm.sectionLabel}>{activeField === 'start' ? 'Start' : 'Destination'} suggestions</Text>
              {suggestions.slice(0, 6).map((item, idx) => (
                <TouchableOpacity key={item.place_id ?? idx} style={sm.suggRow} onPress={() => pick(item)} activeOpacity={0.7}>
                  <View style={[sm.suggDot, { backgroundColor: item._field === 'start' ? C.primary : C.error }]} />
                  <View style={sm.suggTextCol}>
                    <Text style={sm.suggMain} numberOfLines={1}>{item.display_name.split(',')[0]}</Text>
                    <Text style={sm.suggSub}  numberOfLines={1}>{item.display_name.split(',').slice(1).join(',').trim()}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View>
              <Text style={sm.sectionLabel}>QUICK SELECT</Text>
              <View style={sm.quickGrid}>
                {[
                  { icon: '🏥', label: 'Nearest\nHospital',  val: 'Hospital Colombo' },
                  { icon: '🏠', label: 'Emergency\nShelter', val: 'Emergency Shelter Sri Lanka' },
                  { icon: '🚒', label: 'Fire\nStation',       val: 'Fire Station Colombo' },
                  { icon: '🚔', label: 'Police\nStation',     val: 'Police Station Colombo' },
                ].map(q => (
                  <TouchableOpacity key={q.label} style={sm.quickCard}
                    onPress={() => { onEndChange(q.val); setActiveField('end'); }} activeOpacity={0.78}>
                    <Text style={sm.quickIcon}>{q.icon}</Text>
                    <Text style={sm.quickLabel}>{q.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </ScrollView>

        {/* CTA button */}
        <View style={sm.footer}>
          <TouchableOpacity
            style={[sm.ctaBtn, (!startText || !endText || loadingRoute) && sm.ctaBtnDisabled]}
            onPress={() => { onClose(); onGetRoute(); }}
            disabled={!startText || !endText || loadingRoute}>
            {loadingRoute
              ? <ActivityIndicator color="#fff" size="small" />
              : <><Text style={sm.ctaIcon}>🛡</Text><Text style={sm.ctaText}>Get Safe Route</Text></>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
});

export default SearchModal;

const sm = StyleSheet.create({
  root:        { flex: 1, backgroundColor: C.surface },
  header:      { flexDirection: 'row', alignItems: 'center', paddingTop: TOP + 6, paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: C.surfaceContainerHigh, backgroundColor: 'rgba(248,249,250,0.95)' },
  backBtn:     { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginRight: 8 },
  backIcon:    { fontSize: 22, color: C.primary },
  headerTitle: { fontSize: 17, fontWeight: '800', color: C.primary },

  inputCard:    { flexDirection: 'row', alignItems: 'stretch', marginHorizontal: 16, marginTop: 18, marginBottom: 8, backgroundColor: C.surfaceContainerLowest, borderRadius: 24, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.07, shadowRadius: 14, elevation: 5 },
  connectorCol: { width: 24, alignItems: 'center', paddingTop: 20, paddingBottom: 20, marginRight: 14 },
  dotStart:     { width: 12, height: 12, borderRadius: 6, backgroundColor: C.primary },
  connLine:     { flex: 1, width: 2, backgroundColor: C.outlineVariant, marginVertical: 6 },
  dotEnd:       { width: 12, height: 12, borderRadius: 3, backgroundColor: C.error },
  fieldsCol:    { flex: 1 },

  fieldWrap:       { flexDirection: 'row', alignItems: 'center', backgroundColor: C.surfaceContainerLow, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, borderWidth: 1.5, borderColor: 'transparent' },
  fieldWrapActive: { borderColor: C.primary, shadowColor: C.primary, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.12, shadowRadius: 6, elevation: 2 },
  fieldLabel:      { fontSize: 9, fontWeight: '800', color: C.outline, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 },
  fieldInput:      { fontSize: 14, color: C.onSurface, fontWeight: '500', paddingVertical: 0 },
  clearX:          { color: C.outline, fontSize: 13, fontWeight: '700', paddingLeft: 8 },

  myLocRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingHorizontal: 2 },
  myLocIcon: { fontSize: 15 },
  myLocText: { fontSize: 13, color: C.primary, fontWeight: '700' },

  list:         { flex: 1, paddingHorizontal: 16, paddingTop: 4 },
  sectionLabel: { fontSize: 10, fontWeight: '800', color: C.outline, textTransform: 'uppercase', letterSpacing: 1.2, marginTop: 20, marginBottom: 12 },

  suggRow:     { flexDirection: 'row', alignItems: 'center', paddingVertical: 13, gap: 12, borderBottomWidth: 1, borderBottomColor: C.surfaceContainerLow },
  suggDot:     { width: 10, height: 10, borderRadius: 5 },
  suggTextCol: { flex: 1 },
  suggMain:    { fontSize: 14, color: C.onSurface, fontWeight: '600' },
  suggSub:     { fontSize: 12, color: C.outline, marginTop: 2 },

  quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 20 },
  quickCard: { width: '46%', backgroundColor: C.surfaceContainerLowest, borderRadius: 20, padding: 16, alignItems: 'flex-start', gap: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 },
  quickIcon:  { fontSize: 26 },
  quickLabel: { fontSize: 11, fontWeight: '700', color: C.onSurfaceVariant, textTransform: 'uppercase', letterSpacing: 0.6 },

  footer:        { padding: 16, paddingBottom: Platform.OS === 'ios' ? 38 : 16 },
  ctaBtn:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: C.primary, borderRadius: 20, paddingVertical: 17, shadowColor: C.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.28, shadowRadius: 10, elevation: 8 },
  ctaBtnDisabled:{ opacity: 0.45 },
  ctaIcon:       { fontSize: 18 },
  ctaText:       { fontSize: 16, fontWeight: '800', color: '#fff' },
});
