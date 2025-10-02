import React, { useEffect } from 'react';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
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
        runOnJS(onAnimationComplete)();
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
