import React from 'react';
import { View, Text, Pressable, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Navigation } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_PADDING = width * 0.06;
const CARD_BORDER_RADIUS = 28;

const SafeRouteCard: React.FC = () => {
  const navigation = useNavigation();
  const mapScale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(mapScale, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(mapScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
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
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
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
  );
};

export default SafeRouteCard;
