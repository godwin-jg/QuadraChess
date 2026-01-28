import { useCallback, useEffect, useMemo, useRef } from "react";
import { runOnUI } from "react-native-reanimated";
import type { SharedValue } from "react-native-reanimated";
import { AnimPlan, buildPiecesMap, computeAnimPlan } from "./chessgroundAnimations";
import { TOTAL_SQUARES } from "./boardConstants";
import type { LastMove } from "../../../state/types";

interface UseAnimationPlanOptions {
  displayBoardState: (string | null)[][];
  lastMove: LastMove | null;
  isViewingHistory: boolean;
  dragState: { piece: string; from: { row: number; col: number } } | null;
  visibilityMask: SharedValue<number[]>;
  animationRunning: SharedValue<number>;
  gameFlowSend: (event: { type: string }) => void;
  skipNextAnimationRef: React.MutableRefObject<boolean>;
}

interface UseAnimationPlanReturn {
  effectivePlan: AnimPlan | null;
  currentPiecesMap: Map<number, string>;
  handleAnimationComplete: () => void;
}

/**
 * Hook that manages animation planning for piece movements.
 * Computes animation plans when moves occur and handles completion.
 */
export function useAnimationPlan({
  displayBoardState,
  lastMove,
  isViewingHistory,
  dragState,
  visibilityMask,
  animationRunning,
  gameFlowSend,
  skipNextAnimationRef,
}: UseAnimationPlanOptions): UseAnimationPlanReturn {
  // Refs for tracking animation state
  const prevPiecesRef = useRef<Map<number, string> | null>(null);
  const lastMoveKeyRef = useRef<string | null>(null);
  const activePlanRef = useRef<AnimPlan | null>(null);
  const activeMoveKeyRef = useRef<string | null>(null);
  const activeMaskIndicesRef = useRef<number[]>([]);

  // Build pieces map from board state
  const currentPiecesMap = useMemo(
    () => buildPiecesMap(displayBoardState),
    [displayBoardState]
  );

  // Ref to access currentPiecesMap without triggering useMemo re-runs
  const currentPiecesMapRef = useRef(currentPiecesMap);
  currentPiecesMapRef.current = currentPiecesMap;

  // Generate a unique key for the current move
  const moveKey = lastMove
    ? `${lastMove.from.row}-${lastMove.from.col}-${lastMove.to.row}-${lastMove.to.col}-${lastMove.pieceCode}`
    : null;

  const skipAnimation =
    skipNextAnimationRef.current || isViewingHistory || !!dragState;

  // Compute pending animation plan (only when moveKey or skipAnimation changes)
  const pendingPlan = useMemo(() => {
    if (activePlanRef.current) return activePlanRef.current;
    if (!moveKey || moveKey === lastMoveKeyRef.current) return null;
    if (skipAnimation || !prevPiecesRef.current) return null;

    const plan = computeAnimPlan(prevPiecesRef.current, currentPiecesMapRef.current);
    if (plan.anims.size === 0 && plan.fadings.size === 0) {
      return null;
    }

    activePlanRef.current = plan;
    activeMoveKeyRef.current = moveKey;
    return plan;
  }, [moveKey, skipAnimation]);

  const effectivePlan = pendingPlan;

  // Animation effect: when lastMove changes, decide to animate or skip
  useEffect(() => {
    if (!moveKey || moveKey === lastMoveKeyRef.current) return;

    if (
      activePlanRef.current &&
      activeMoveKeyRef.current &&
      moveKey !== activeMoveKeyRef.current
    ) {
      return;
    }

    skipNextAnimationRef.current = false;

    if (skipAnimation || !pendingPlan) {
      lastMoveKeyRef.current = moveKey;
      prevPiecesRef.current = currentPiecesMap;
      activePlanRef.current = null;
      activeMoveKeyRef.current = null;
      activeMaskIndicesRef.current = [];
      // Batch UI updates into single worklet call
      runOnUI(() => {
        "worklet";
        animationRunning.value = 0;
        visibilityMask.value = new Array(TOTAL_SQUARES).fill(0);
      })();
      gameFlowSend({ type: "ANIMATION_DONE" });
      return;
    }

    const indices: number[] = [];
    pendingPlan.anims.forEach((_, key) => indices.push(key));
    pendingPlan.fadings.forEach((_, key) => indices.push(key));

    if (indices.length > 0) {
      // Batch UI updates into single worklet call
      runOnUI(() => {
        "worklet";
        animationRunning.value = 1;
        const next = visibilityMask.value.slice();
        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i];
          if (idx >= 0 && idx < TOTAL_SQUARES) {
            next[idx] = 1;
          }
        }
        visibilityMask.value = next;
      })();
      activeMaskIndicesRef.current = indices;
    }
  }, [
    moveKey,
    skipAnimation,
    pendingPlan,
    currentPiecesMap,
    gameFlowSend,
    visibilityMask,
    animationRunning,
    skipNextAnimationRef,
  ]);

  // Initialize prevPiecesRef on first render
  useEffect(() => {
    if (!prevPiecesRef.current) {
      prevPiecesRef.current = currentPiecesMap;
    }
  }, [currentPiecesMap]);

  // Handle animation completion
  const handleAnimationComplete = useCallback(() => {
    const indicesToClear = activeMaskIndicesRef.current;
    // Batch all UI updates into single worklet call
    runOnUI(() => {
      "worklet";
      animationRunning.value = 0;
      if (indicesToClear.length > 0) {
        const next = visibilityMask.value.slice();
        for (let i = 0; i < indicesToClear.length; i++) {
          const idx = indicesToClear[i];
          if (idx >= 0 && idx < TOTAL_SQUARES) {
            next[idx] = 0;
          }
        }
        visibilityMask.value = next;
      } else {
        visibilityMask.value = new Array(TOTAL_SQUARES).fill(0);
      }
    })();
    activeMaskIndicesRef.current = [];
    prevPiecesRef.current = currentPiecesMap;
    if (activeMoveKeyRef.current) {
      lastMoveKeyRef.current = activeMoveKeyRef.current;
    }
    activePlanRef.current = null;
    activeMoveKeyRef.current = null;
    gameFlowSend({ type: "ANIMATION_DONE" });
  }, [currentPiecesMap, gameFlowSend, animationRunning, visibilityMask]);

  return {
    effectivePlan,
    currentPiecesMap,
    handleAnimationComplete,
  };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
