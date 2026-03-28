import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Navigation, Bell, Droplets } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CARD_PADDING = width * 0.06;
const CARD_BORDER_RADIUS = 28;

const HighContrastDashboard: React.FC = () => {
  const navigation = useNavigation();

  const reportScale = React.useRef(new Animated.Value(1)).current;
  const mapScale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = (animatedValue: Animated.Value) => {
    Animated.timing(animatedValue, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = (animatedValue: Animated.Value) => {
    Animated.timing(animatedValue, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

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
        <View
          style={{
            backgroundColor: '#DC2626',
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 8,
            gap: 7,
          }}
        >
          <AlertTriangle color="white" size={12} strokeWidth={2.5} />
          <Text
            style={{
              color: 'white',
              fontSize: 11,
              fontWeight: '700',
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              opacity: 0.95,
            }}
          >
            Active Flood Alert — Riverside &amp; Valley sectors
          </Text>
        </View>
      </View>

      {/* ── Scrollable Content ── */}
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: 28,       // ← pushed down from the bar
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

        {/* Report Flood Card */}
        <LinearGradient
          colors={['#FF2020', '#8B0000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: CARD_BORDER_RADIUS,
            padding: CARD_PADDING,
            elevation: 6,
            shadowColor: '#8B0000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.18)',
              alignSelf: 'flex-start',
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 8,
              marginBottom: 14,
            }}
          >
            <Text
              style={{
                color: 'white',
                fontWeight: '700',
                fontSize: 10,
                letterSpacing: 1.5,
                textTransform: 'uppercase',
              }}
            >
              Immediate Action Required
            </Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  color: 'white',
                  fontSize: 32,
                  fontWeight: '900',
                  marginBottom: 10,
                  lineHeight: 36,
                }}
              >
                REPORT{'\n'}FLOOD
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.85)',
                  fontSize: 13.5,
                  fontWeight: '500',
                  marginBottom: 20,
                  lineHeight: 20,
                }}
              >
                Detected rising waters or blocked drainage? Your live report
                helps save lives in real-time.
              </Text>
            </View>
            <AlertTriangle
              color="white"
              size={65}
              strokeWidth={1.5}
              style={{ opacity: 0.2, position: 'absolute', right: -10, top: 20 }}
            />
          </View>

          <Animated.View style={{ transform: [{ scale: reportScale }] }}>
            <Pressable
              onPress={() => navigation.navigate('report' as never)}
              onPressIn={() => handlePressIn(reportScale)}
              onPressOut={() => handlePressOut(reportScale)}
              style={{
                backgroundColor: 'white',
                borderRadius: 24,
                paddingVertical: 15,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ color: '#af101a', fontWeight: '900', fontSize: 15 }}>
                START REPORT
              </Text>
              <View
                style={{
                  backgroundColor: '#af101a',
                  borderRadius: 50,
                  padding: 5,
                }}
              >
                <AlertTriangle color="white" size={15} />
              </View>
            </Pressable>
          </Animated.View>
        </LinearGradient>

        {/* Safe Route Map Card */}
        <LinearGradient
          colors={['#3B82F6', '#1E3A8A']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: CARD_BORDER_RADIUS,
            padding: CARD_PADDING,
            elevation: 6,
            shadowColor: '#1E3A8A',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
          }}
        >
          <Navigation
            color="white"
            size={38}
            strokeWidth={2}
            style={{ opacity: 0.25, position: 'absolute', right: 24, top: 24 }}
          />

          <Text
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: '900',
              marginBottom: 10,
            }}
          >
            Safe Route Map
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.85)',
              fontSize: 13.5,
              fontWeight: '500',
              marginBottom: 20,
              paddingRight: 8,
              lineHeight: 20,
            }}
          >
            Real-time evacuation paths cleared by emergency personnel. Avoid
            Riverside &amp; Valley sectors.
          </Text>

          <Animated.View style={{ transform: [{ scale: mapScale }] }}>
            <Pressable
              onPress={() => navigation.navigate('map' as never)}
              onPressIn={() => handlePressIn(mapScale)}
              onPressOut={() => handlePressOut(mapScale)}
              style={{
                backgroundColor: 'white',
                borderRadius: 24,
                paddingVertical: 15,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <Text style={{ color: '#1E3A8A', fontWeight: '900', fontSize: 15 }}>
                VIEW LIVE NAVIGATION
              </Text>
              <Navigation color="#1E3A8A" size={19} />
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HighContrastDashboard;