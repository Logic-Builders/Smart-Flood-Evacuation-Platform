import React from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  SafeAreaView,
  Dimensions,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle, Navigation, Grid, Bell } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');

const CARD_PADDING = width * 0.06; 
const CARD_BORDER_RADIUS = 28; 

const HighContrastDashboard: React.FC = () => {
  const navigation = useNavigation();

  const reportScale = React.useRef(new Animated.Value(1)).current;
  const mapScale = React.useRef(new Animated.Value(1)).current;

  const animatePressIn = (scale: Animated.Value) => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start();
  };

  const animatePressOut = (scale: Animated.Value, navigateTo?: string) => {
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 20,
      bounciness: 10,
    }).start(() => {
      if (navigateTo) {
        navigation.navigate(navigateTo as never);
      }
    });
  };

  return (
    <SafeAreaView className="flex-1 bg-slate-50">
      <View className="flex-row justify-between items-center px-6 h-20 bg-white border-b-4 border-[#1E3A8A]">
        <Text className="font-['Manrope'] font-black tracking-tighter text-2xl text-[#213a84]">
          Flood Evacuation
        </Text>
        <Bell color="#E28913" size={28} />
      </View>

      <ScrollView className="flex-1 px-4 pt-6">
        <Animated.View style={{ transform: [{ scale: reportScale }] }}>
          <Pressable
            onPressIn={() => animatePressIn(reportScale)}
            onPressOut={() => animatePressOut(reportScale, 'report')}
            className="mb-6"
          >
            <LinearGradient
              colors={['#FF0000', '#8B0000']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: CARD_BORDER_RADIUS,
                padding: CARD_PADDING,
                elevation: 6,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 3 },
                shadowOpacity: 0.25,
                shadowRadius: 6,
              }}
            >
              <View className="bg-white/20 self-start p-2 rounded-lg mb-3">
                <Text className="text-white font-bold text-xs tracking-[0.15em] uppercase">
                  Immediate Action Required
                </Text>
              </View>

              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-white text-4xl font-black leading-none mb-3">
                    REPORT{"\n"}FLOOD
                  </Text>
                  <Text className="text-white/90 text-base font-medium mb-6">
                    Detected rising waters or blocked drainage? Your live report
                    helps dispatch save lives in real-time.
                  </Text>
                </View>
                <AlertTriangle
                  color="white"
                  size={65}
                  strokeWidth={1.5}
                  style={{ opacity: 0.3, position: 'absolute', right: -10, top: 20 }}
                />
              </View>

              <View className="bg-white rounded-2xl py-4 items-center flex-row justify-center shadow-lg">
                <Text className="text-[#af101a] font-black text-lg mr-3">
                  START REPORT
                </Text>
                <View className="bg-[#af101a] rounded-full p-1">
                  <AlertTriangle color="white" size={16} />
                </View>
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>

        <Animated.View style={{ transform: [{ scale: mapScale }] }}>
          <Pressable
            onPressIn={() => animatePressIn(mapScale)}
            onPressOut={() => animatePressOut(mapScale, 'map')}
            className="mb-10"
          >
            <LinearGradient
              colors={['#3B82F6', '#1E3A8A']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={{
                borderRadius: CARD_BORDER_RADIUS,
                padding: CARD_PADDING,
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

              <Text className="text-white text-3xl font-black mb-3">
                Safe Route Map
              </Text>
              <Text className="text-white/90 text-base font-medium mb-6 pr-10">
                Real-time evacuation paths cleared by emergency personnel. Avoid
                Riverside & Valley sectors.
              </Text>

              <View className="bg-white rounded-2xl py-4 items-center flex-row justify-center shadow-lg">
                <Text className="text-[#1E3A8A] font-black text-lg mr-3">
                  VIEW LIVE NAVIGATION
                </Text>
                <Navigation color="#1E3A8A" size={20} />
              </View>
            </LinearGradient>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default HighContrastDashboard;