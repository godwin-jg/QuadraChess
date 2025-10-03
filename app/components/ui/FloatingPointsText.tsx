import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { ANIMATION_DURATIONS } from '../../../config/gameConfig';

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
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.5);

  useEffect(() => {
    // ✅ SYNCHRONIZED TIMING: Use centralized animation duration
    // Floating points should be shorter and more responsive
    const fadeInDuration = ANIMATION_DURATIONS.FADE_IN;
    const fadeOutDuration = ANIMATION_DURATIONS.FADE_OUT;
    const visibleDuration = 800; // Shorter visible time for better responsiveness
    
    // Simple fade in/out animation - no movement
    opacity.value = withSequence(
      withTiming(1, { duration: fadeInDuration }),
      withTiming(1, { duration: visibleDuration }), // Stay visible for shorter time
      withTiming(0, { duration: fadeOutDuration, easing: Easing.out(Easing.cubic) }, () => {
        // Call onComplete when animation finishes
        scheduleOnRN(onComplete);
      })
    );
    
    scale.value = withTiming(1.3, { duration: fadeInDuration, easing: Easing.out(Easing.back(1.2)) }); // Bigger initial scale, no shrinking
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
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
    fontWeight: '900',
    textShadowOffset: { width: 2, height: 2 },
    textShadowRadius: 4,
    zIndex: 1000,
    pointerEvents: 'none',
    fontFamily: 'SpaceMono-Bold',
  },
});

export default FloatingPointsText;
