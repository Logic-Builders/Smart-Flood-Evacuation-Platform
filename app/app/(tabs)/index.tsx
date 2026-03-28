import React from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Droplets, Bell } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import AlertStrip from '../components/homepage/AlertStrip';
import ReportFloodCard from '../components/homepage/ReportFloodCard';
import SafeRouteCard from '../components/homepage/SafeRouteCard';

const HighContrastDashboard: React.FC = () => {
  return (
    <SafeAreaView
      edges={['left', 'right', 'bottom']}
      style={{ flex: 1, backgroundColor: '#f0f4f8' }}
    >
      {/* ── Top App Bar ── */}
      <View style={{ backgroundColor: '#1E3A8A' }}>
        {/* Main row */}
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingTop: 14,
            paddingBottom: 14,
          }}
        >
          {/* Left: icon + text */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 38,
                height: 38,
                backgroundColor: 'rgba(255,255,255,0.12)',
                borderRadius: 12,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Droplets color="white" size={19} strokeWidth={2} />
            </View>
            <View>
              <Text
                style={{
                  color: 'white',
                  fontFamily: 'Manrope',
                  fontWeight: '800',
                  fontSize: 18,
                  letterSpacing: -0.4,
                  lineHeight: 22,
                }}
              >
                Flood Evacuation
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.45)',
                  fontSize: 10,
                  fontWeight: '600',
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                }}
              >
                Emergency Response
              </Text>
            </View>
          </View>

          {/* Right: bell */}
          <View style={{ position: 'relative' }}>
            <View
              style={{
                width: 40,
                height: 40,
                backgroundColor: 'rgba(255,255,255,0.1)',
                borderRadius: 20,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Bell color="white" size={20} />
            </View>
            <View
              style={{
                position: 'absolute',
                top: 7,
                right: 7,
                width: 8,
                height: 8,
                backgroundColor: '#EF4444',
                borderRadius: 4,
                borderWidth: 1.5,
                borderColor: '#1E3A8A',
              }}
            />
          </View>
        </View>

        {/* Alert strip */}
        <AlertStrip message="Active Flood Alert — Riverside & Valley sectors" />
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 28,
          paddingBottom: 32,
          gap: 20,
        }}
        showsVerticalScrollIndicator={false}
      >
        {/* Section label */}
        <Text
          style={{
            color: '#64748b',
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            marginBottom: 4,
          }}
        >
          Quick Actions
        </Text>

        <ReportFloodCard />
        <SafeRouteCard />
      </ScrollView>
    </SafeAreaView>
  );
};

export default HighContrastDashboard;
