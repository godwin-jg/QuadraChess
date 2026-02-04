import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

interface SimpleNotificationProps {
  message: string;
  type: 'info' | 'warning' | 'error' | 'success' | 'betrayal';
  onComplete: () => void;
}

const SimpleNotification: React.FC<SimpleNotificationProps> = ({
  message,
  type,
  onComplete,
}) => {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-20);

  React.useEffect(() => {
    // Fade in
    opacity.value = withTiming(1, { duration: 200 });
    translateY.value = withTiming(0, { duration: 200 });

    // Auto-dismiss after 2 seconds
    const timer = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 200 }, () => {
        scheduleOnRN(onComplete);
      });
      translateY.value = withTiming(-20, { duration: 200 });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const getTypeStyle = () => {
    switch (type) {
      case 'success':
        return { backgroundColor: 'rgba(34, 197, 94, 0.9)', color: '#FFFFFF' };
      case 'warning':
        return { backgroundColor: 'rgba(245, 158, 11, 0.9)', color: '#FFFFFF' };
      case 'error':
        return { backgroundColor: 'rgba(239, 68, 68, 0.9)', color: '#FFFFFF' };
      case 'betrayal':
        return { backgroundColor: 'rgba(168, 85, 247, 0.95)', color: '#FFFFFF' }; // Purple for betrayal
      default:
        return { backgroundColor: 'rgba(59, 130, 246, 0.9)', color: '#FFFFFF' };
    }
  };

  const typeStyle = getTypeStyle();

  return (
    <Animated.View style={[styles.container, animatedStyle, typeStyle]}>
      <Text style={[styles.text, { color: typeStyle.color }]}>
        {message}
      </Text>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 60,
    left: 20,
    right: 20,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    zIndex: 9999,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 8,
  },
  text: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SimpleNotification;
