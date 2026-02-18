import { useCallback } from "react";
import { useSharedValue, type SharedValue } from "react-native-reanimated";
import { TOTAL_SQUARES } from "./boardConstants";

export interface VisibilityMaskReturn {
  visibilityMask: SharedValue<number[]>;
  maskRevision: SharedValue<number>;
  animationRunning: SharedValue<number>;
  setMaskIndices: (indices: number[], hidden: boolean) => void;
  clearMask: () => void;
}

/**
 * Hook that manages the visibility mask for zero-flicker piece hiding
 * during animations. The mask is a 196-element array (14x14 board)
 * where 1 = hidden, 0 = visible.
 *
 * maskRevision is a simple number that increments on every mask change.
 * Reanimated reliably tracks number SharedValues, so Square worklets
 * subscribe to maskRevision for guaranteed re-evaluation even when
 * array change detection is unreliable.
 */
export function useVisibilityMask(): VisibilityMaskReturn {
  const visibilityMask = useSharedValue<number[]>(new Array(TOTAL_SQUARES).fill(0));
  const maskRevision = useSharedValue(0);
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
      maskRevision.value += 1;
    },
    [visibilityMask, maskRevision]
  );

  const clearMask = useCallback(() => {
    "worklet";
    visibilityMask.value = new Array(TOTAL_SQUARES).fill(0);
    maskRevision.value += 1;
  }, [visibilityMask, maskRevision]);

  return {
    visibilityMask,
    maskRevision,
    animationRunning,
    setMaskIndices,
    clearMask,
  };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
