import React from 'react';
import { View, Text, Pressable, Dimensions, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle } from 'lucide-react-native';
import { useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
const CARD_PADDING = width * 0.06;
const CARD_BORDER_RADIUS = 28;

const ReportFloodCard: React.FC = () => {
  const navigation = useNavigation();
  const reportScale = React.useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.timing(reportScale, {
      toValue: 0.97,
      duration: 100,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.timing(reportScale, {
      toValue: 1,
      duration: 200,
      useNativeDriver: true,
    }).start();
  };

  return (
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
            Detected rising waters or blocked drainage? Your live report helps
            save lives in real-time.
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
  );
};

export default ReportFloodCard;
