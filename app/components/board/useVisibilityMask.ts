import { useCallback } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { TOTAL_SQUARES } from "./boardConstants";

export interface VisibilityMaskReturn {
  visibilityMask: SharedValue<number[]>;
  animationRunning: SharedValue<number>;
  setMaskIndices: (indices: number[], hidden: boolean) => void;
  clearMask: () => void;
}

/**
 * Hook that manages the visibility mask for zero-flicker piece hiding
 * during animations. The mask is a 196-element array (14x14 board)
 * where 1 = hidden, 0 = visible.
 */
export function useVisibilityMask(): VisibilityMaskReturn {
  const visibilityMask = useSharedValue<number[]>(new Array(TOTAL_SQUARES).fill(0));
  const animationRunning = useSharedValue(0);

  const setMaskIndices = useCallback(
    (indices: number[], hidden: boolean) => {
      "worklet";
      const next = visibilityMask.value.slice();
      for (let i = 0; i < indices.length; i += 1) {
        const idx = indices[i];
        if (idx >= 0 && idx < TOTAL_SQUARES) {
          next[idx] = hidden ? 1 : 0;
        }
      }
      visibilityMask.value = next;
    },
    [visibilityMask]
  );

  const clearMask = useCallback(() => {
    "worklet";
    visibilityMask.value = new Array(TOTAL_SQUARES).fill(0);
  }, [visibilityMask]);

  return {
    visibilityMask,
    animationRunning,
    setMaskIndices,
    clearMask,
  };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
