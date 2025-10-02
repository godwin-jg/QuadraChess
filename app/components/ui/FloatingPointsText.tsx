import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  runOnJS,
  Easing,
} from 'react-native-reanimated';

interface FloatingPointsTextProps {
  points: number;
  x: number;
  y: number;
  color: string;
  onComplete: () => void;
}

const FloatingPointsText: React.FC<FloatingPointsTextProps> = ({
  points,
  x,
  y,
  color,
  onComplete,
}) => {
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0.8);

  useEffect(() => {
    // Start animation sequence
    translateY.value = withSequence(
      withTiming(-60, { duration: 1500, easing: Easing.out(Easing.cubic) }),
      withTiming(-80, { duration: 500, easing: Easing.in(Easing.cubic) }, () => {
        // Call onComplete when animation finishes
        runOnJS(onComplete)();
      })
    );
    
    opacity.value = withSequence(
      withTiming(1, { duration: 200 }),
      withTiming(0, { duration: 1300, easing: Easing.out(Easing.cubic) })
    );
    
    scale.value = withSequence(
      withTiming(1.5, { duration: 200 }),
      withTiming(1.2, { duration: 300 }),
      withTiming(0.9, { duration: 1000, easing: Easing.out(Easing.cubic) })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: translateY.value },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const getColorStyle = (color: string) => {
    switch (color) {
      case 'r':
        return { color: '#FF6B6B', textShadowColor: '#B91C1C' };
      case 'b':
        return { color: '#4DABF7', textShadowColor: '#1E3A8A' };
      case 'y':
        return { color: '#7C3AED', textShadowColor: '#4C1D95' };
      case 'g':
        return { color: '#51CF66', textShadowColor: '#047857' };
      default:
        return { color: '#FFFFFF', textShadowColor: '#000000' };
    }
  };

  const colorStyle = getColorStyle(color);

  return (
    <Animated.Text
      style={[
        styles.floatingText,
        {
          left: x,
          top: y,
          ...colorStyle,
        },
        animatedStyle,
      ]}
    >
      +{points}
    </Animated.Text>
  );
};

const styles = StyleSheet.create({
  floatingText: {
    position: 'absolute',
    fontSize: 36,
    fontWeight: 'bold',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 6,
    zIndex: 1000,
    pointerEvents: 'none',
  },
});

export default FloatingPointsText;
