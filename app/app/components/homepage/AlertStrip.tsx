import React from 'react';
import { View, Text } from 'react-native';
import { AlertTriangle } from 'lucide-react-native';

interface AlertStripProps {
  message?: string;
}

const AlertStrip: React.FC<AlertStripProps> = ({
  message = 'Active Flood Alert — Riverside & Valley sectors',
}) => {
  return (
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
        {message}
      </Text>
    </View>
  );
};

export default AlertStrip;
