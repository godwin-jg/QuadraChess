import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import Piece from './Piece';

interface AnimatedCaptureProps {
  pieceCode: string;
  size: number;
  onAnimationComplete: () => void;
}

const AnimatedCapture = ({ pieceCode, size, onAnimationComplete }: AnimatedCaptureProps) => {
  const opacity = useSharedValue(1);
  const scale = useSharedValue(1);

  useEffect(() => {
    // Start the "poof" animation immediately
    opacity.value = withTiming(0, { duration: 300, easing: Easing.ease });
    scale.value = withTiming(0.5, { duration: 300, easing: Easing.ease }, (isFinished) => {
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
