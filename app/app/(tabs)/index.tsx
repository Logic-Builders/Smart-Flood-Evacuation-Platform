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
import { AlertTriangle, Navigation, Grid, Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');
const CARD_PADDING = width * 0.06;
const CARD_BORDER_RADIUS = 28;

const HighContrastDashboard: React.FC = () => {
  const navigation = useNavigation();

  // Separate animated values for each card
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
      style={{ flex: 1, backgroundColor: '#f8fafc' }}
    >
      {/* Top App Bar */}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 24,
          height: 60,
          backgroundColor: 'white',
          borderBottomWidth: 4,
          borderBottomColor: '#1E3A8A',
        }}
      >
        <Text
          style={{
            fontFamily: 'Manrope',
            fontWeight: '900',
            fontSize: 24,
            color: '#1E3A8A',
            letterSpacing: -0.5,
          }}
        >
          Flood Evacuation
        </Text>
        <Bell color="#1E3A8A" size={28} />
      </View>

      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }}>
        {/* Report Flood Card */}
        <LinearGradient
          colors={['#FF0000', '#8B0000']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            borderRadius: CARD_BORDER_RADIUS,
            padding: CARD_PADDING,
            marginBottom: 24,
            elevation: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
          }}
        >
          <View
            style={{
              backgroundColor: 'rgba(255,255,255,0.2)',
              alignSelf: 'flex-start',
              padding: 8,
              borderRadius: 8,
              marginBottom: 12,
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
                  marginBottom: 12,
                  lineHeight: 36,
                }}
              >
                REPORT{"\n"}FLOOD
              </Text>
              <Text
                style={{
                  color: 'rgba(255,255,255,0.9)',
                  fontSize: 14,
                  fontWeight: '500',
                  marginBottom: 16,
                }}
              >
                Detected rising waters or blocked drainage? Your live report helps
                save lives in real-time.
              </Text>
            </View>
            <AlertTriangle
              color="white"
              size={65}
              strokeWidth={1.5}
              style={{ opacity: 0.3, position: 'absolute', right: -10, top: 20 }}
            />
          </View>

          {/* Clickable White Card */}
          <Animated.View style={{ transform: [{ scale: reportScale }] }}>
            <Pressable
              onPress={() => navigation.navigate('report' as never)}
              onPressIn={() => handlePressIn(reportScale)}
              onPressOut={() => handlePressOut(reportScale)}
              style={{
                backgroundColor: 'white',
                borderRadius: 24,
                paddingVertical: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
              }}
            >
              <Text
                style={{
                  color: '#af101a',
                  fontWeight: '900',
                  fontSize: 16,
                  marginRight: 8,
                }}
              >
                START REPORT
              </Text>
              <View
                style={{
                  backgroundColor: '#af101a',
                  borderRadius: 50,
                  padding: 6,
                }}
              >
                <AlertTriangle color="white" size={16} />
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
            marginBottom: 24,
            elevation: 6,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 3 },
            shadowOpacity: 0.25,
            shadowRadius: 6,
          }}
        >
          <Navigation
            color="white"
            size={40}
            strokeWidth={2}
            style={{ opacity: 0.6, position: 'absolute', right: 24, top: 24 }}
          />

          <Text
            style={{
              color: 'white',
              fontSize: 28,
              fontWeight: '900',
              marginBottom: 12,
            }}
          >
            Safe Route Map
          </Text>
          <Text
            style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: 14,
              fontWeight: '500',
              marginBottom: 16,
              paddingRight: 8,
            }}
          >
            Real-time evacuation paths cleared by emergency personnel. Avoid
            Riverside & Valley sectors.
          </Text>

          {/* Clickable White Card */}
          <Animated.View style={{ transform: [{ scale: mapScale }] }}>
            <Pressable
              onPress={() => navigation.navigate('map' as never)}
              onPressIn={() => handlePressIn(mapScale)}
              onPressOut={() => handlePressOut(mapScale)}
              style={{
                backgroundColor: 'white',
                borderRadius: 24,
                paddingVertical: 16,
                flexDirection: 'row',
                justifyContent: 'center',
                alignItems: 'center',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.1,
                shadowRadius: 6,
              }}
            >
              <Text
                style={{
                  color: '#1E3A8A',
                  fontWeight: '900',
                  fontSize: 16,
                  marginRight: 8,
                }}
              >
                VIEW LIVE NAVIGATION
              </Text>
              <Navigation color="#1E3A8A" size={20} />
            </Pressable>
          </Animated.View>
        </LinearGradient>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HighContrastDashboard;