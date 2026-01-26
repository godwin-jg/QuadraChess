import { useEffect } from "react";
import {
  useSharedValue,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";

interface UseBoardGlowAnimationReturn {
  glowOpacity: SharedValue<number>;
  glowScale: SharedValue<number>;
}

/**
 * Hook that manages the animated glow effect around the board
 * indicating the current player's turn.
 */
export function useBoardGlowAnimation(
  currentPlayerTurn: string
): UseBoardGlowAnimationReturn {
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);

  useEffect(() => {
    if (currentPlayerTurn) {
      // Animate glow in
      glowOpacity.value = withTiming(1, { duration: 400 });

      // Add a subtle, repeating pulse
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Loop forever
        true // Reverse the animation
      );
    } else {
      // Fade out glow
      glowOpacity.value = withTiming(0, { duration: 300 });
      glowScale.value = withTiming(1);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      cancelAnimation(glowScale);
    };
  }, [currentPlayerTurn, glowOpacity, glowScale]);

  return { glowOpacity, glowScale };
}
