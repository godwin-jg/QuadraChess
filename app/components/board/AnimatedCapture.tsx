import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Piece from './Piece';
import { ANIMATION_DURATIONS } from '../../../config/gameConfig';

interface AnimatedCaptureProps {
  pieceCode: string;
  size: number;
  onAnimationComplete: () => void;
}

const AnimatedCapture = ({ pieceCode, size, onAnimationComplete }: AnimatedCaptureProps) => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    // ✅ SYNCHRONIZED TIMING: Use centralized animation duration
    // Capture animation should complete slightly before piece movement finishes
    const captureDuration = ANIMATION_DURATIONS.CAPTURE_EFFECT;
    
    // Start the "poof" animation immediately
    opacity.value = withTiming(0, { duration: captureDuration, easing: Easing.ease });
    scale.value = withTiming(0.5, { duration: captureDuration, easing: Easing.ease }, (isFinished) => {
        if (isFinished) {
          scheduleOnRN(onAnimationComplete);
        }
    });
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      <Piece piece={pieceCode} size={size} />
    </Animated.View>
  );
};

export default AnimatedCapture;
