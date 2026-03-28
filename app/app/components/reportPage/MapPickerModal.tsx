import React, { useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StatusBar, StyleSheet, ActivityIndicator,
  Alert, Modal, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, {
  Marker, Polygon, UrlTile, PROVIDER_DEFAULT, MapPressEvent,
} from 'react-native-maps';
import { C, FONT, MONO, ZONE_FILL, ZONE_STROKE } from '../../constants/reportConstants';
import type { Coord, FloodZone } from '../../constants/reportConstants';

interface MapPickerModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (coord: Coord, address: string) => void;
  initialCoord: Coord | null;
  floodZones: FloodZone[];
}

const MapPickerModal: React.FC<MapPickerModalProps> = ({
  visible, onClose, onConfirm, initialCoord, floodZones,
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

export default MapPickerModal;

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
