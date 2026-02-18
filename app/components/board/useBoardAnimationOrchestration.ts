import React, { useRef, useMemo, useLayoutEffect, useEffect } from "react";
import { runOnUI, type SharedValue, useSharedValue } from "react-native-reanimated";
import { buildPiecesMap, computeAnimPlan, AnimPlan } from "./chessgroundAnimations";
import { getRookCastlingCoords, isCastlingMove } from "../../../state/gameHelpers";
import { buildMoveKey } from "../../../services/gameFlowService";
import type { LastMove } from "../../../state/types";

// ✅ SINGLETON GUARD: Ensure only one orchestration instance processes animations
// This prevents duplicate animation logs when multiple Board components are mounted
let globalActiveOrchestrationId: string | null = null;
let globalOrchestrationCounter = 0;
const MAX_FALLBACK_ANIM_CHANGES = 8;

// Reset global orchestration state - call when switching game modes.
// Only clears the active ID so the next Board can register itself;
// the counter keeps incrementing to avoid ID collisions.
export function resetOrchestrationState(): void {
  globalActiveOrchestrationId = null;
  if (__DEV__) console.log('[Anim] Global orchestration state reset');
}

interface AnimationOrchestrationParams {
  displayBoardState: (string | null)[][];
  lastMove: LastMove;
  isViewingHistory: boolean;
  animationsEnabled: boolean;
  dragState: { piece: string; from: { row: number; col: number } } | null;
  isFlowAnimating: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  gameFlowSend: (event: any) => void;
  visibilityMask: SharedValue<number[]>;
  maskRevision: SharedValue<number>;
  animationRunning: SharedValue<number>;
  uiState?: SharedValue<number>;
}

interface AnimationOrchestrationReturn {
  effectivePlan: AnimPlan | null;
  currentPiecesMap: Map<number, string>;
  animationPiecesMap: Map<number, string>;
  animationKey: string | null;
  movePieceOverrides: Map<number, string> | null;
  handleAnimationComplete: () => void;
  handleAnimationCompleteUI: () => void;
  clearActiveAnimationPlan: () => void;
  skipNextAnimationRef: React.MutableRefObject<boolean>;
  activeMaskIndicesValue: SharedValue<number[]>;
}

/**
 * Hook to orchestrate move animations.
 * Handles:
 * - Building the pieces map
 * - Computing animation plans
 * - Managing animation lifecycle (start, complete)
 * - Game flow state checks
 */
export function useBoardAnimationOrchestration({
  displayBoardState,
  lastMove,
  isViewingHistory,
  animationsEnabled,
  dragState: _dragState, // Kept for API compatibility, not used in skip logic
  isFlowAnimating,
  gameFlowSend,
  visibilityMask,
  maskRevision,
  animationRunning,
  uiState,
}: AnimationOrchestrationParams): AnimationOrchestrationReturn {
  const buildPlanFromLastMove = (
    move: LastMove,
    prevPieces: Map<number, string>,
    currentPieces: Map<number, string>
  ): { plan: AnimPlan; movePieceOverrides: Map<number, string> } | null => {
    if (!move?.pieceCode) return null;
    const playerColor = move.playerColor ?? move.pieceCode[0];
    const fromKey = move.from.row * 14 + move.from.col;
    const toKey = move.to.row * 14 + move.to.col;
    const pieceAtFrom = prevPieces.get(fromKey);
    if (!pieceAtFrom || pieceAtFrom !== move.pieceCode) return null;
    const pieceAtToNow = currentPieces.get(toKey);
    const destinationMatchesMove =
      pieceAtToNow === move.pieceCode ||
      (move.pieceCode[1] === "P" &&
        !!pieceAtToNow &&
        pieceAtToNow[0] === move.pieceCode[0] &&
        pieceAtToNow[1] !== "P");
    // Guard against stale/out-of-order snapshots (common in spectate mode).
    // If current board destination does not reflect the move payload yet,
    // skip deterministic animation to avoid "piece appears while moving, then vanishes".
    if (!destinationMatchesMove) return null;

    const dx = move.from.col - move.to.col;
    const dy = move.from.row - move.to.row;
    if (dx === 0 && dy === 0) return null;

    const anims = new Map<number, [number, number, number, number]>();
    const fadings = new Map<number, string>();
    const movePieceOverrides = new Map<number, string>();

    anims.set(toKey, [dx, dy, dx, dy]);
    movePieceOverrides.set(toKey, move.pieceCode);

    if (move.capturedPiece) {
      fadings.set(toKey, move.capturedPiece);
    } else if (
      move.pieceCode[1] === "P" &&
      Math.abs(move.from.row - move.to.row) === 1 &&
      Math.abs(move.from.col - move.to.col) === 1
    ) {
      let captureRow = move.to.row;
      let captureCol = move.to.col;
      if (playerColor === "r") captureRow = move.to.row + 1;
      else if (playerColor === "y") captureRow = move.to.row - 1;
      else if (playerColor === "b") captureCol = move.to.col - 1;
      else if (playerColor === "g") captureCol = move.to.col + 1;

      if (
        captureRow >= 0 &&
        captureRow < 14 &&
        captureCol >= 0 &&
        captureCol < 14
      ) {
        const captureKey = captureRow * 14 + captureCol;
        const capturePiece = prevPieces.get(captureKey);
        if (capturePiece && capturePiece[1] === "P" && capturePiece[0] !== playerColor) {
          fadings.set(captureKey, capturePiece);
        }
      }
    }

    if (
      isCastlingMove(
        move.pieceCode,
        move.from.row,
        move.from.col,
        move.to.row,
        move.to.col
      )
    ) {
      const rookCoords = getRookCastlingCoords(playerColor, {
        row: move.to.row,
        col: move.to.col,
      });
      if (rookCoords) {
        const rookFromKey = rookCoords.rookFrom.row * 14 + rookCoords.rookFrom.col;
        const rookToKey = rookCoords.rookTo.row * 14 + rookCoords.rookTo.col;
        const rookPiece = prevPieces.get(rookFromKey);
        if (rookPiece) {
          const rookDx = rookCoords.rookFrom.col - rookCoords.rookTo.col;
          const rookDy = rookCoords.rookFrom.row - rookCoords.rookTo.row;
          anims.set(rookToKey, [rookDx, rookDy, rookDx, rookDy]);
          movePieceOverrides.set(rookToKey, rookPiece);
        }
      }
    }

    if (anims.size === 0 && fadings.size === 0) return null;
    return { plan: { anims, fadings }, movePieceOverrides };
  };

  // Animation refs
  const prevPiecesRef = useRef<Map<number, string> | null>(null);
  const lastMoveKeyRef = useRef<string | null>(null);
  const skipNextAnimationRef = useRef(false);
  const activePlanRef = useRef<AnimPlan | null>(null);
  const activeMoveKeyRef = useRef<string | null>(null);
  const planPiecesRef = useRef<Map<number, string> | null>(null);
  const activeMoveOverridesRef = useRef<Map<number, string> | null>(null);
  const animationSetupDoneRef = useRef(false); // Track if animation setup (visibility mask) completed
  const activeMaskIndicesValue = useSharedValue<number[]>([]);

  // ✅ SINGLETON GUARD: Generate unique ID for this orchestration instance
  const orchestrationIdRef = useRef<string | null>(null);
  if (orchestrationIdRef.current === null) {
    globalOrchestrationCounter += 1;
    orchestrationIdRef.current = `orch-${globalOrchestrationCounter}`;
  }
  const orchestrationId = orchestrationIdRef.current;

  // Register this orchestration as active on mount, unregister on unmount
  useEffect(() => {
    globalActiveOrchestrationId = orchestrationId;
    return () => {
      if (globalActiveOrchestrationId === orchestrationId) {
        globalActiveOrchestrationId = null;
      }
    };
  }, [orchestrationId]);

  // Self-healing: re-register if the global was cleared externally
  // (e.g. resetOrchestrationState after spectating) while this component
  // stayed mounted/frozen. Runs during render so it's fixed before
  // the layout effect checks the guard.
  if (globalActiveOrchestrationId === null) {
    globalActiveOrchestrationId = orchestrationId;
  }

  // Use ref to always have access to current animationsEnabled value
  const animationsEnabledRef = useRef(animationsEnabled);
  useLayoutEffect(() => {
    animationsEnabledRef.current = animationsEnabled;
  }, [animationsEnabled]);

  // Build current pieces map
  const currentPiecesMap = useMemo(
    () => buildPiecesMap(displayBoardState),
    [displayBoardState]
  );

  // Ref to access currentPiecesMap without triggering useMemo re-runs
  const currentPiecesMapRef = useRef(currentPiecesMap);
  currentPiecesMapRef.current = currentPiecesMap;

  // Initialize prevPiecesRef synchronously on first call (not in effect)
  // This prevents the race condition where a move happens before the effect runs
  if (prevPiecesRef.current === null) {
    if (__DEV__) console.log('[Anim] Initializing prevPiecesRef');
    prevPiecesRef.current = currentPiecesMap;
  }

  // Build a stable move key that ignores timestamp churn
  const moveKey = buildMoveKey(lastMove);

  // Game was reset (no last move) — sync prevPieces to current board state
  // so the first move after reset animates from the correct baseline.
  // Also clear any stale animation refs that may have leaked from a previous
  // session (e.g. spectating) to prevent the "busy animating a different move"
  // guard from blocking future animations.
  if (!moveKey && prevPiecesRef.current !== currentPiecesMap) {
    prevPiecesRef.current = currentPiecesMap;
    lastMoveKeyRef.current = null;
    if (activePlanRef.current || activeMoveKeyRef.current) {
      activePlanRef.current = null;
      activeMoveKeyRef.current = null;
      planPiecesRef.current = null;
      activeMoveOverridesRef.current = null;
      animationSetupDoneRef.current = false;
    }
  }

  // Skip animation if:
  // - skipNextAnimationRef is true (set for user's own drag moves)
  // - isViewingHistory is true
  // Note: We don't skip for !!dragState - network moves should still animate
  // even if user is currently dragging a piece
  // Use ref to get current value (avoids stale closure issues)
  const skipAnimation =
    skipNextAnimationRef.current || isViewingHistory || !animationsEnabledRef.current;

  // Compute pending animation plan
  const pendingPlan = useMemo(() => {
    if (activePlanRef.current) return activePlanRef.current;
    if (!moveKey || moveKey === lastMoveKeyRef.current) {
      if (__DEV__ && moveKey) console.log('[Anim] Skip: same moveKey', moveKey);
      return null;
    }
    if (skipAnimation || !prevPiecesRef.current) {
      if (__DEV__) console.log('[Anim] Skip: skipAnimation=', skipAnimation, 'prevPieces=', !!prevPiecesRef.current);
      return null;
    }

    const deterministicPlan = lastMove
      ? buildPlanFromLastMove(
          lastMove,
          prevPiecesRef.current,
          currentPiecesMapRef.current
        )
      : null;
    if (deterministicPlan) {
      activePlanRef.current = deterministicPlan.plan;
      activeMoveKeyRef.current = moveKey;
      activeMoveOverridesRef.current = deterministicPlan.movePieceOverrides;
      return deterministicPlan.plan;
    }

    const plan = computeAnimPlan(prevPiecesRef.current, currentPiecesMapRef.current);
    const totalFallbackChanges = plan.anims.size + plan.fadings.size;
    if (totalFallbackChanges === 0) {
      return null;
    }
    // Snapshot reconciliation can occasionally produce large diffs (e.g. online sync jumps).
    // Animating those as one move hides too many squares and causes visual artifacts.
    // Prefer an instant board sync in this case.
    if (totalFallbackChanges > MAX_FALLBACK_ANIM_CHANGES) {
      if (__DEV__) {
        console.log(
          "[Anim] Skip fallback plan: large diff",
          totalFallbackChanges,
          "moveKey:",
          moveKey
        );
      }
      return null;
    }
    activePlanRef.current = plan;
    activeMoveKeyRef.current = moveKey;
    activeMoveOverridesRef.current = null;
    return plan;
  }, [moveKey, skipAnimation, lastMove, currentPiecesMap]);

  // Guard against stale useMemo cache: only return plan if refs are still set
  // This prevents animation replay after cancelDrag clears the refs
  const effectivePlan = activePlanRef.current ? pendingPlan : null;

  const handleAnimationCompleteUI = React.useCallback(() => {
    "worklet";
    animationRunning.value = 0;
    const dragging = uiState ? uiState.value === 1 || uiState.value === 2 : false;
    let clearedCount = 0;
    if (!dragging) {
      // Full clear is more robust than targeted index clearing;
      // avoids stale hidden pieces if indices get out of sync.
      visibilityMask.value = new Array(196).fill(0);
      clearedCount = 196;
    } else {
      // When dragging, only clear animation-related indices (preserve drag mask)
      const indices = activeMaskIndicesValue.value;
      clearedCount = indices ? indices.length : 0;
      if (indices && indices.length > 0) {
        const next = visibilityMask.value.slice();
        for (let i = 0; i < indices.length; i++) {
          const idx = indices[i];
          if (idx >= 0 && idx < 196) {
            next[idx] = 0;
          }
        }
        visibilityMask.value = next;
      }
    }
    activeMaskIndicesValue.value = [];
    if (__DEV__) {
      console.log("[VANISH][MaskClear]", {
        dragging,
        clearedCount,
        animationRunning: animationRunning.value,
        nextMaskRevision: maskRevision.value + 1,
      });
    }
    maskRevision.value += 1;
  }, [visibilityMask, maskRevision, animationRunning, activeMaskIndicesValue, uiState]);

  const handleAnimationComplete = React.useCallback(
    (options?: { baselinePieces?: Map<number, string>; moveKeyOverride?: string | null }) => {
      // Defensive clear: ensure visibility mask is reset even if
      // animator callback ordering/races skip onCompleteUI for a frame.
      runOnUI(handleAnimationCompleteUI)();
      if (!activePlanRef.current && !options?.baselinePieces) {
        if (__DEV__) console.log('[Anim] handleAnimationComplete early return');
        return;
      }
      const planPieces = planPiecesRef.current;
      const source = options?.baselinePieces ? 'baseline' : planPieces ? 'planPieces' : 'currentRef';
      if (__DEV__) console.log('[Anim] handleAnimationComplete updating prevPieces from:', source);
      prevPiecesRef.current =
        options?.baselinePieces ?? planPieces ?? currentPiecesMapRef.current;
      const moveKeyToSet = options?.moveKeyOverride ?? activeMoveKeyRef.current;
      if (moveKeyToSet) {
        lastMoveKeyRef.current = moveKeyToSet;
      }
      activePlanRef.current = null;
      activeMoveKeyRef.current = null;
      planPiecesRef.current = null;
      activeMoveOverridesRef.current = null;
      animationSetupDoneRef.current = false; // Reset for next animation
      gameFlowSend({ type: "ANIMATION_DONE" });
    },
    [gameFlowSend, handleAnimationCompleteUI]
  );

  // Animation setup effect
  React.useLayoutEffect(() => {
    if (!moveKey || moveKey === lastMoveKeyRef.current) return;

    // ✅ SINGLETON GUARD: Only process if we're the active orchestration
    if (globalActiveOrchestrationId !== orchestrationId) {
      return;
    }

    // Skip if animation setup already done for this exact move (optimistic + server confirmation)
    if (animationSetupDoneRef.current && activeMoveKeyRef.current === moveKey) {
      return;
    }

    // Skip if busy animating a DIFFERENT move (wait for it to complete)
    if (
      activePlanRef.current &&
      activeMoveKeyRef.current &&
      moveKey !== activeMoveKeyRef.current
    ) {
      return;
    }

    const skipWasUser = skipNextAnimationRef.current;
    skipNextAnimationRef.current = false;

    if (skipAnimation || !pendingPlan) {
      activeMaskIndicesValue.value = [];
      if (skipWasUser && lastMove) {
        const fromKey = lastMove.from.row * 14 + lastMove.from.col;
        const toKey = lastMove.to.row * 14 + lastMove.to.col;
        const indices = fromKey === toKey ? [fromKey] : [fromKey, toKey];
        activeMaskIndicesValue.value = indices;
      }
      activeMoveKeyRef.current = moveKey;
      animationSetupDoneRef.current = true;
      lastMoveKeyRef.current = moveKey;
      runOnUI(handleAnimationCompleteUI)();
      handleAnimationComplete({ baselinePieces: currentPiecesMap, moveKeyOverride: moveKey });
      return;
    }

    const indices: number[] = [];
    pendingPlan.anims.forEach((_, key) => indices.push(key));
    pendingPlan.fadings.forEach((_, key) => indices.push(key));

    if (indices.length > 0) {
      if (__DEV__) console.log('[Anim] Starting animation, indices:', indices.length, 'moveKey:', moveKey);
      // Freeze the pieces map for this animation plan to avoid flicker
      planPiecesRef.current = currentPiecesMap;
      // Mark this moveKey as being animated immediately (not waiting for completion)
      // This ensures server confirmations skip at the first check
      lastMoveKeyRef.current = moveKey;
      animationSetupDoneRef.current = true;
      activeMaskIndicesValue.value = indices;
      const draggingNow = uiState ? uiState.value === 1 || uiState.value === 2 : false;
      // Build mask from a clean slate for each animation. This prevents stale
      // hidden squares from a previous move leaking into the next move.
      // Preserve current mask only while actively dragging.
      const next = draggingNow
        ? visibilityMask.value.slice()
        : new Array(196).fill(0);
      for (let i = 0; i < indices.length; i++) {
        const idx = indices[i];
        if (idx >= 0 && idx < 196) {
          next[idx] = 1;
        }
      }
      visibilityMask.value = next;
      if (__DEV__) {
        const fromKey = lastMove
          ? lastMove.from.row * 14 + lastMove.from.col
          : null;
        const toKey = lastMove
          ? lastMove.to.row * 14 + lastMove.to.col
          : null;
        console.log("[VANISH][MaskSet]", {
          moveKey,
          indicesCount: indices.length,
          indicesPreview: indices.slice(0, 8),
          fromKey,
          toKey,
          maskFrom: fromKey !== null ? next[fromKey] : null,
          maskTo: toKey !== null ? next[toKey] : null,
          nextMaskRevision: maskRevision.value + 1,
        });
      }
      maskRevision.value += 1;
      animationRunning.value = 1;
    }
  }, [
    moveKey,
    skipAnimation,
    pendingPlan,
    currentPiecesMap,
    visibilityMask,
    maskRevision,
    animationRunning,
    handleAnimationComplete,
    handleAnimationCompleteUI,
    orchestrationId,
  ]);

  // Handle flow animating state without a plan
  React.useEffect(() => {
    if (isFlowAnimating && !effectivePlan) {
      gameFlowSend({ type: "ANIMATION_DONE" });
    }
  }, [isFlowAnimating, effectivePlan, gameFlowSend]);

  // Note: prevPiecesRef is now initialized synchronously above (not in effect)
  // This prevents the race condition where a move happens before effect runs

  // Clear any pending animation plan (e.g. if a drag interrupts before render)
  const clearActiveAnimationPlan = React.useCallback(() => {
    activeMoveKeyRef.current = moveKey ?? activeMoveKeyRef.current;
    runOnUI(handleAnimationCompleteUI)();
    handleAnimationComplete({
      baselinePieces: currentPiecesMap,
      moveKeyOverride: moveKey ?? null,
    });
  }, [moveKey, currentPiecesMap, handleAnimationComplete, handleAnimationCompleteUI]);

  React.useEffect(() => {
    if (!animationsEnabled && activePlanRef.current) {
      clearActiveAnimationPlan();
    }
  }, [animationsEnabled, clearActiveAnimationPlan]);

  const animationPiecesMap =
    effectivePlan && planPiecesRef.current ? planPiecesRef.current : currentPiecesMap;
  const animationKey = effectivePlan ? activeMoveKeyRef.current ?? moveKey : null;
  const movePieceOverrides =
    effectivePlan && activeMoveOverridesRef.current ? activeMoveOverridesRef.current : null;

  return {
    effectivePlan,
    currentPiecesMap,
    animationPiecesMap,
    animationKey,
    movePieceOverrides,
    handleAnimationComplete,
    handleAnimationCompleteUI,
    clearActiveAnimationPlan,
    skipNextAnimationRef,
    activeMaskIndicesValue,
  };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
