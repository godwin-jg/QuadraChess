import { useEffect, useRef, useLayoutEffect } from "react";
import {
  useSharedValue,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  type SharedValue,
} from "react-native-reanimated";

// Delay before glow starts (in milliseconds)
const GLOW_DELAY_MS = 1500;

interface UseBoardGlowAnimationReturn {
  glowOpacity: SharedValue<number>;
  glowScale: SharedValue<number>;
}

/**
 * Hook that manages the animated glow effect around the board
 * indicating the current player's turn.
 * Glow only starts if the player takes more than 1 second to move.
 */
export function useBoardGlowAnimation(
  currentPlayerTurn: string,
  animationsEnabled: boolean
): UseBoardGlowAnimationReturn {
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  
  // Use ref to always have access to current animationsEnabled value
  const animationsEnabledRef = useRef(animationsEnabled);
  useLayoutEffect(() => {
    animationsEnabledRef.current = animationsEnabled;
  }, [animationsEnabled]);

  useEffect(() => {
    // Use ref to get current value (avoids stale closure issues)
    const isAnimationsEnabled = animationsEnabledRef.current;
    
    // Cancel any pending animations when turn changes
    cancelAnimation(glowScale);
    cancelAnimation(glowOpacity);
    
    if (!isAnimationsEnabled) {
      glowOpacity.value = 0;
      glowScale.value = 1;
      return;
    }

    if (currentPlayerTurn) {
      // Reset glow immediately, then animate in after delay
      glowOpacity.value = 0;
      glowScale.value = 1;
      
      // Start glow only after 1 second delay (runs on UI thread)
      glowOpacity.value = withDelay(GLOW_DELAY_MS, withTiming(1, { duration: 400 }));
      
      // Add a subtle, repeating pulse after delay
      glowScale.value = withDelay(
        GLOW_DELAY_MS,
        withRepeat(
          withSequence(
            withTiming(1.02, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
            withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
          ),
          -1, // Loop forever
          true // Reverse the animation
        )
      );
    } else {
      // Fade out glow
      glowOpacity.value = withTiming(0, { duration: 300 });
      glowScale.value = withTiming(1);
    }

    // Cleanup function to prevent memory leaks
    return () => {
      cancelAnimation(glowScale);
      cancelAnimation(glowOpacity);
    };
  }, [currentPlayerTurn, animationsEnabled, glowOpacity, glowScale]);

  return { glowOpacity, glowScale };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
