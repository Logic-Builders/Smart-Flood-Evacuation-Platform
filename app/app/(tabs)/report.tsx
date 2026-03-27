import React, { useState } from 'react';
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
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BASE_URL = 'http://localhost:8080';

const REPORT_TYPES = [
  { value: 'FLOODED_ROAD', label: 'Flooded Road', icon: 'water' },
  { value: 'DAMAGED_BRIDGE', label: 'Damaged Bridge', icon: 'bridge' },
  { value: 'BLOCKED_ROAD', label: 'Blocked Road', icon: 'alert-octagon' },
] as const;

type ReportType = typeof REPORT_TYPES[number]['value'];

export default function FloodReportScreen() {
  const [description, setDescription] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [reportType, setReportType] = useState<ReportType>('FLOODED_ROAD');
  const [severity, setSeverity] = useState(1);
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9] as [number, number],
      quality: 1,
    });
    if (!result.canceled) setImage(result.assets[0].uri);
  };

  const handleSubmit = async () => {
    if (!description.trim() || !latitude.trim() || !longitude.trim()) {
      Alert.alert('Missing Fields', 'Please fill in all required fields.');
      return;
    }

    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < 5.9 || lat > 9.9 || lng < 79.6 || lng > 81.9) {
      Alert.alert('Invalid Coordinates', 'Please enter valid Sri Lanka coordinates.\nLatitude: 5.9–9.9\nLongitude: 79.6–81.9');
      return;
    }

    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('auth_token');

      if (!token) {
        Alert.alert('Not Logged In', 'You must be logged in to submit a report.');
        setLoading(false);
        return;
      }

      const response = await fetch(`${BASE_URL}/api/v1/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          latitude: lat,
          longitude: lng,
          report_type: reportType,
          severity,
          description: description.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Submission failed.');
      }

      Alert.alert('Report Submitted', 'Your report is pending admin review and will appear on the map once approved.');
      setDescription('');
      setLatitude('');
      setLongitude('');
      setSeverity(1);
      setReportType('FLOODED_ROAD');
      setImage(null);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      <LinearGradient colors={['#060f17', '#0c1d2e', '#081420']} style={StyleSheet.absoluteFill} />

      <View style={[styles.glow, { top: -80, left: -80, backgroundColor: '#00dff318' }]} />
      <View style={[styles.glow, { bottom: -120, right: -80, backgroundColor: '#00dff310' }]} />

      <SafeAreaView style={styles.safeArea}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerEyebrow}>Emergency</Text>
            <Text style={styles.headerTitle}>Flood Report</Text>
          </View>
          <View style={styles.headerBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.headerBadgeText}>LIVE</Text>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Incident Type */}
          <Text style={styles.sectionLabel}>INCIDENT TYPE</Text>
          <View style={styles.typeRow}>
            {REPORT_TYPES.map((t) => (
              <TouchableOpacity
                key={t.value}
                style={[styles.typeChip, reportType === t.value && styles.typeChipActive]}
                onPress={() => setReportType(t.value)}
              >
                <MaterialCommunityIcons
                  name={t.icon as any}
                  size={18}
                  color={reportType === t.value ? '#081219' : '#64748b'}
                />
                <Text style={[styles.typeChipText, reportType === t.value && styles.typeChipTextActive]}>
                  {t.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Coordinates */}
          <Text style={styles.sectionLabel}>COORDINATES</Text>
          <View style={styles.row}>
            <View style={[styles.inputWrapper, { flex: 1, marginRight: 8 }]}>
              <Feather name="crosshair" size={16} color="#64748b" style={styles.inputIcon} />
              <TextInput
                placeholder="Latitude"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                style={styles.input}
                value={latitude}
                onChangeText={setLatitude}
              />
            </View>
            <View style={[styles.inputWrapper, { flex: 1 }]}>
              <Feather name="crosshair" size={16} color="#64748b" style={styles.inputIcon} />
              <TextInput
                placeholder="Longitude"
                placeholderTextColor="#475569"
                keyboardType="numeric"
                style={styles.input}
                value={longitude}
                onChangeText={setLongitude}
              />
            </View>
          </View>

          {/* Severity */}
          <Text style={styles.sectionLabel}>SEVERITY LEVEL</Text>
          <BlurView intensity={15} tint="dark" style={styles.severityCard}>
            <View style={styles.severityHeader}>
              <Text style={styles.severityValue}>Level {severity}</Text>
              <Text style={styles.severityDesc}>
                {['', 'Minor puddles', 'Passable with care', 'Difficult to pass', 'Dangerous', 'Impassable'][severity]}
              </Text>
            </View>
            <View style={styles.severityDots}>
              {[1, 2, 3, 4, 5].map((n) => (
                <TouchableOpacity key={n} onPress={() => setSeverity(n)} style={styles.dotWrapper}>
                  <View style={[
                    styles.dot,
                    severity >= n && styles.dotActive,
                    { backgroundColor: severity >= n ? severityColor(severity) : 'rgba(100,116,139,0.3)' }
                  ]} />
                </TouchableOpacity>
              ))}
            </View>
          </BlurView>

          {/* Description */}
          <Text style={styles.sectionLabel}>DESCRIPTION</Text>
          <BlurView intensity={15} tint="dark" style={styles.textAreaWrapper}>
            <TextInput
              placeholder="Describe the hazard clearly — road condition, water level, visibility..."
              placeholderTextColor="#475569"
              multiline
              numberOfLines={4}
              style={styles.textArea}
              value={description}
              onChangeText={setDescription}
              textAlignVertical="top"
            />
          </BlurView>

          {/* Photo */}
          <Text style={styles.sectionLabel}>PHOTO EVIDENCE <Text style={styles.optional}>(OPTIONAL)</Text></Text>
          {image ? (
            <View style={styles.previewContainer}>
              <Image source={{ uri: image }} style={styles.previewImage} />
              <TouchableOpacity style={styles.removeImage} onPress={() => setImage(null)}>
                <Feather name="x" size={14} color="white" />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity style={styles.uploadBox} onPress={pickImage}>
              <View style={styles.uploadIconCircle}>
                <MaterialCommunityIcons name="camera-plus-outline" size={26} color="#00dff3" />
              </View>
              <Text style={styles.uploadTitle}>Attach Photo</Text>
              <Text style={styles.uploadSub}>Tap to select from gallery</Text>
            </TouchableOpacity>
          )}

          {/* Submit */}
          <TouchableOpacity
            style={[styles.submitButton, loading && { opacity: 0.7 }]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <LinearGradient
              colors={['#00dff3', '#00a8bf']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.gradientButton}
            >
              {loading ? (
                <ActivityIndicator color="#081219" />
              ) : (
                <>
                  <Feather name="send" size={18} color="#081219" style={{ marginRight: 8 }} />
                  <Text style={styles.submitText}>Submit Report</Text>
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <View style={styles.footerInfo}>
            <Feather name="shield" size={11} color="#475569" />
            <Text style={styles.footerText}>Encrypted · Pending admin review · Expires in 3 hours</Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const severityColor = (level: number) => {
  const colors = ['', '#22c55e', '#84cc16', '#f59e0b', '#f97316', '#ef4444'];
  return colors[level];
};

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerEyebrow: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
  },
  headerTitle: {
    color: '#f1f5f9',
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
    gap: 6,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  headerBadgeText: {
    color: '#ef4444',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.5,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#00dff3',
    letterSpacing: 1.5,
    marginBottom: 10,
    marginTop: 20,
  },
  optional: {
    color: '#475569',
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
  },
  typeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  typeChip: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  typeChipActive: {
    backgroundColor: '#00dff3',
    borderColor: '#00dff3',
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  typeChipTextActive: {
    color: '#081219',
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(30,41,59,0.5)',
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 52,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1,
    color: '#f1f5f9',
    fontSize: 15,
  },
  severityCard: {
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    overflow: 'hidden',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  severityHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  severityValue: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '700',
  },
  severityDesc: {
    color: '#64748b',
    fontSize: 13,
    fontWeight: '500',
  },
  severityDots: {
    flexDirection: 'row',
    gap: 10,
  },
  dotWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  dot: {
    height: 8,
    width: '100%',
    borderRadius: 4,
  },
  dotActive: {},
  textAreaWrapper: {
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.06)',
    backgroundColor: 'rgba(15,23,42,0.5)',
  },
  textArea: {
    color: '#f1f5f9',
    fontSize: 15,
    padding: 16,
    minHeight: 110,
    lineHeight: 22,
  },
  uploadBox: {
    borderRadius: 18,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,223,243,0.25)',
    backgroundColor: 'rgba(0,223,243,0.04)',
    alignItems: 'center',
    paddingVertical: 28,
    gap: 6,
  },
  uploadIconCircle: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(0,223,243,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  uploadTitle: {
    color: '#cbd5e1',
    fontSize: 14,
    fontWeight: '700',
  },
  uploadSub: {
    color: '#475569',
    fontSize: 12,
  },
  previewContainer: {
    position: 'relative',
  },
  previewImage: {
    width: '100%',
    height: 190,
    borderRadius: 18,
  },
  removeImage: {
    position: 'absolute',
    top: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    padding: 6,
    borderRadius: 10,
  },
  submitButton: {
    marginTop: 28,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: '#00dff3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  gradientButton: {
    height: 58,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitText: {
    color: '#081219',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 14,
    gap: 6,
  },
  footerText: {
    fontSize: 11,
    color: '#475569',
  },
});