import React, { useRef, ReactNode } from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Animated } from 'react-native';
import { useRouter } from "expo-router";
import { ShieldCheck, AlertTriangle, MapPin, Navigation, Droplets, CloudRain, Shield } from 'lucide-react-native';

// ----------------- AnimatedCard Component -----------------
type AnimatedCardProps = {
  children: ReactNode;
  onPress?: () => void; // optional
};

const AnimatedCard: React.FC<AnimatedCardProps> = ({ children, onPress }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    Animated.sequence([
      Animated.spring(scaleAnim, { toValue: 0.95, friction: 4, useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, friction: 4, useNativeDriver: true }),
    ]).start(() => {
      if (onPress) onPress();
    });
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity activeOpacity={0.9} onPress={handlePress}>
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
};

// ----------------- FloodSafetyDashboard -----------------
const FloodSafetyDashboard: React.FC = () => {
  const router = useRouter();

  return (
    <SafeAreaView className="flex-1 bg-[#f3faff]">
      {/* Top App Bar */}
      <View className="flex-row justify-between items-center px-6 py-4">
        <View className="flex-row items-center">
          <Shield color="#002045" size={24} />
          <Text className="ml-2 font-['Manrope'] font-extrabold tracking-[0.2em] text-[#002045] text-xl">
            Logic Builders
          </Text>
        </View>
        <TouchableOpacity>
          <View className="p-2 rounded-full">
            <View className="w-6 h-6 bg-[#002045] rounded-full" />
          </View>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1 px-6">
        {/* Header */}
        <View className="items-center mt-8 mb-10">
          <Text className="text-4xl font-extrabold text-[#002045] text-center leading-tight">
            Flood Safety{"\n"}Dashboard
          </Text>
          <Text className="text-slate-500 text-center mt-4 text-base leading-relaxed">
            Real-time monitoring and emergency response tools to keep your community safe during weather events.
          </Text>
        </View>

        {/* Current Status Card */}
        {/* <AnimatedCard>
          <View className="bg-white rounded-[2.5rem] p-8 mb-6 shadow-sm">
            <View className="flex-row items-center mb-4">
              <View className="bg-blue-100 p-4 rounded-2xl mr-4">
                <ShieldCheck color="#1A365D" size={32} />
              </View>
              <View>
                <Text className="text-[#002045]/60 font-bold uppercase tracking-wider text-xs mb-1">
                  CURRENT STATUS
                </Text>
                <Text className="text-3xl font-extrabold text-[#002045]">
                  Normal{"\n"}Conditions
                </Text>
              </View>
            </View>
            <View className="flex-row items-center justify-center mt-4">
              <Text className="text-slate-400 text-sm">Updated 2 mins ago</Text>
            </View>
            <View className="flex-row items-center justify-center mt-1">
              <MapPin size={16} color="#002045" />
              <Text className="ml-1 font-bold text-[#002045]">Metropolitan District</Text>
            </View>
          </View>
        </AnimatedCard> */}

        {/* Report Flood Card */}
        <AnimatedCard onPress={() => router.push("/report")}>
          <View className="bg-[#C52828] rounded-[2.5rem] p-8 mb-6">
            <View className="bg-white/20 w-16 h-16 rounded-2xl items-center justify-center mb-6">
              <AlertTriangle color="white" size={32} />
            </View>
            <Text className="text-white text-3xl font-extrabold mb-2">Report Flood</Text>
            <Text className="text-white/80 text-base mb-6 leading-relaxed">
              Instantly alert local authorities and nearby residents of rising water levels.
            </Text>
            <View className="flex-row items-center">
              <Text className="text-white font-bold uppercase tracking-widest mr-2">TAKE ACTION</Text>
              <View className="w-4 h-0.5 bg-white" />
            </View>
          </View>
        </AnimatedCard>

        {/* Safe Route Map Card */}
        <AnimatedCard onPress={() => router.push("/map")}>
          <View className="bg-[#002045] rounded-[2.5rem] p-8 mb-6">
            <View className="bg-white/10 w-16 h-16 rounded-2xl items-center justify-center mb-6">
              <Navigation color="white" size={32} />
            </View>
            <Text className="text-white text-3xl font-extrabold mb-2">Safe Route Map</Text>
            <Text className="text-white/80 text-base mb-6 leading-relaxed">
              Find optimized evacuation paths and high-ground shelters in real-time.
            </Text>
            <View className="flex-row items-center">
              <Text className="text-white font-bold uppercase tracking-widest mr-2">OPEN NAVIGATION</Text>
              <View className="w-4 h-0.5 bg-white" />
            </View>
          </View>
        </AnimatedCard>

        {/* Stats Cards */}
        {/* <AnimatedCard>
          <View className="bg-blue-50/50 rounded-3xl p-6 flex-row items-center mb-4">
            <View className="mr-4"><Droplets color="#002045" size={24} /></View>
            <View>
              <Text className="text-[#002045]/60 font-bold uppercase tracking-wider text-[10px]">RIVER LEVEL</Text>
              <Text className="text-xl font-extrabold text-[#002045]">1.2m (Stable)</Text>
            </View>
          </View>
        </AnimatedCard>

        <AnimatedCard>
          <View className="bg-blue-50/50 rounded-3xl p-6 flex-row items-center mb-4">
            <View className="mr-4"><CloudRain color="#002045" size={24} /></View>
            <View>
              <Text className="text-[#002045]/60 font-bold uppercase tracking-wider text-[10px]">PRECIPITATION</Text>
              <Text className="text-xl font-extrabold text-[#002045]">5mm / 24h</Text>
            </View>
          </View>
        </AnimatedCard>

        <AnimatedCard>
          <View className="bg-blue-50/50 rounded-3xl p-6 flex-row items-center mb-24">
            <View className="mr-4">
              <View className="w-6 h-6 border-2 border-[#002045] rotate-45 items-center justify-center">
                <Text className="font-bold text-[#002045] -rotate-45">!</Text>
              </View>
            </View>
            <View>
              <Text className="text-[#002045]/60 font-bold uppercase tracking-wider text-[10px]">SHELTERS OPEN</Text>
              <Text className="text-xl font-extrabold text-[#002045]">12 Nearby</Text>
            </View>
          </View>
        </AnimatedCard> */}

      </ScrollView>
    </SafeAreaView>
  );
};

export default FloodSafetyDashboard;