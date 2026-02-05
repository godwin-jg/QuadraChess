import { useCallback, useMemo } from "react";
import { Gesture } from "react-native-gesture-handler";
import { scheduleOnRN } from "react-native-worklets";
import { withSpring, withTiming, type SharedValue } from "react-native-reanimated";

// Spring config for smooth piece lift animation
const LIFT_SPRING_CONFIG = { damping: 18, stiffness: 280 };
const LIFT_TIMING_DURATION = 80;

import {
  DRAG_OFFSET_Y,
  DRAG_START_DISTANCE,
  SNAP_RING_RADIUS_RATIO,
  TAP_MOVE_TOLERANCE,
} from "./boardConstants";
import { getDragLiftOffset } from "./boardDragUtils";
import type { DragSharedValues } from "./useDragSharedValues";

interface UseBoardGesturesParams {
  boardSize: number;
  squareSize: number;
  boardRotation: number;
  sharedValues: DragSharedValues;
  enableTapGestures: boolean;
  enableDragToMove: boolean;
  onCursorChange: (cursorKey: number, fromRow: number, fromCol: number) => void;
  onSnapKeyChange: (snapKey: number, snapX: number, snapY: number) => void;
  visibilityMask: SharedValue<number[]>;
  activeMaskIndicesValue: SharedValue<number[]>;
  clearMask: () => void;
  setPanStart: (x: number, y: number) => void;
  startDragFromPan: (x: number, y: number) => void;
  handleTapAt: (x: number, y: number) => void;
  commitMove: (fromRow: number, fromCol: number, toRow: number, toCol: number) => void;
  cancelDrag: () => void;
}

/**
 * Transform touch coordinates based on board rotation.
 * The board view is rotated, so we need to counter-rotate touch coordinates
 * to get the correct logical board position.
 */
function transformTouchCoords(
  x: number,
  y: number,
  boardSize: number,
  boardRotation: number
): { x: number; y: number } {
  "worklet";
  // Normalize rotation to 0, 90, 180, 270
  const rot = ((boardRotation % 360) + 360) % 360;
  
  switch (rot) {
    case 0:
      return { x, y };
    case 90:
    case -270:
      // 90° clockwise: (x, y) -> (y, boardSize - x)
      return { x: y, y: boardSize - x };
    case 180:
    case -180:
      // 180°: (x, y) -> (boardSize - x, boardSize - y)
      return { x: boardSize - x, y: boardSize - y };
    case 270:
    case -90:
      // 270° clockwise (or -90°): (x, y) -> (boardSize - y, x)
      return { x: boardSize - y, y: x };
    default:
      return { x, y };
  }
}

export function useBoardGestures({
  boardSize,
  squareSize,
  boardRotation,
  sharedValues,
  enableTapGestures,
  enableDragToMove,
  onCursorChange,
  onSnapKeyChange,
  visibilityMask,
  activeMaskIndicesValue,
  clearMask,
  setPanStart,
  startDragFromPan,
  handleTapAt,
  commitMove,
  cancelDrag,
}: UseBoardGesturesParams) {
  const {
    dragX,
    dragY,
    dragScale,
    dragOffsetX,
    dragOffsetY,
    dragSnapX,
    dragSnapY,
    dragSnapActive,
    dragSnapTargets,
    validMoveMap,
    dragStartPos,
    lastSnappedKey,
    lastCursorKey,
    ghostX,
    ghostY,
    ghostOpacity,
    uiState,
  } = sharedValues;

  const applyDropMask = useCallback(
    (fromIdx: number, toIdx: number) => {
      "worklet";
      const next = visibilityMask.value.slice();
      next[fromIdx] = 1;
      next[toIdx] = 1;
      visibilityMask.value = next;

      const indices = fromIdx === toIdx ? [fromIdx] : [fromIdx, toIdx];
      const existing = activeMaskIndicesValue.value;
      if (!existing || existing.length === 0) {
        activeMaskIndicesValue.value = indices;
        return;
      }
      const merged = existing.slice();
      for (let i = 0; i < indices.length; i += 1) {
        const idx = indices[i];
        if (merged.indexOf(idx) === -1) {
          merged.push(idx);
        }
      }
      activeMaskIndicesValue.value = merged;
    },
    [visibilityMask, activeMaskIndicesValue]
  );

  const applyDragVisuals = useCallback(
    (localX: number, localY: number) => {
      "worklet";
      const liftOffset = getDragLiftOffset(squareSize * DRAG_OFFSET_Y, boardRotation);
      const pieceX = localX + liftOffset.x;
      const pieceY = localY + liftOffset.y;
      const safeX = Math.max(0, Math.min(pieceX, boardSize));
      const safeY = Math.max(0, Math.min(pieceY, boardSize));
      const targetX = localX - squareSize / 2;
      const targetY = localY - squareSize / 2;
      const isInside =
        pieceX >= 0 && pieceY >= 0 && pieceX <= boardSize && pieceY <= boardSize;
      const snapThreshold = squareSize * SNAP_RING_RADIUS_RATIO;
      let bestDist = Number.POSITIVE_INFINITY;
      let bestKey = -1;
      let bestX = 0;
      let bestY = 0;

      const cursorCol = Math.max(0, Math.min(13, Math.floor(safeX / squareSize)));
      const cursorRow = Math.max(0, Math.min(13, Math.floor(safeY / squareSize)));
      const cursorKey = isInside ? cursorRow * 14 + cursorCol : -1;

      if (lastCursorKey.value !== cursorKey) {
        lastCursorKey.value = cursorKey;
        const fromRow = dragStartPos.value?.row ?? 0;
        const fromCol = dragStartPos.value?.col ?? 0;
        scheduleOnRN(onCursorChange, cursorKey, fromRow, fromCol);
      }

      if (isInside && dragSnapTargets.value.length > 0) {
        const targets = dragSnapTargets.value;
        for (let i = 0; i < targets.length; i += 1) {
          const key = targets[i];
          const row = Math.floor(key / 14);
          const col = key - row * 14;
          const centerX = (col + 0.5) * squareSize;
          const centerY = (row + 0.5) * squareSize;
          const dist = Math.hypot(safeX - centerX, safeY - centerY);
          if (dist < bestDist) {
            bestDist = dist;
            bestKey = key;
            bestX = centerX;
            bestY = centerY;
          }
        }
      }

      const isLegal = bestKey >= 0 && validMoveMap.value[bestKey] === 1;
      const shouldSnap = bestDist <= snapThreshold && isLegal;

      if (shouldSnap) {
        dragSnapActive.value = 1;
        dragSnapX.value = bestX - squareSize / 2;
        dragSnapY.value = bestY - squareSize / 2;

        if (lastSnappedKey.value !== bestKey) {
          lastSnappedKey.value = bestKey;
          ghostX.value = withSpring(dragSnapX.value, { damping: 20, stiffness: 200 });
          ghostY.value = withSpring(dragSnapY.value, { damping: 20, stiffness: 200 });
          ghostOpacity.value = withTiming(0.4, { duration: 100 });
          scheduleOnRN(onSnapKeyChange, bestKey, dragSnapX.value, dragSnapY.value);
        }
      } else {
        dragSnapActive.value = 0;
        if (lastSnappedKey.value !== -1) {
          lastSnappedKey.value = -1;
          ghostOpacity.value = withTiming(0, { duration: 80 });
          scheduleOnRN(onSnapKeyChange, -1, 0, 0);
        }
      }

      dragX.value = targetX;
      dragY.value = targetY;
      
      // Animate lift on first call (when scale is close to 1), direct assign on updates
      // Use threshold check because cancelDrag animates scale back, might not be exactly 1
      const isStarting = dragScale.value < 1.1;
      if (isStarting) {
        dragScale.value = withSpring(1.45, LIFT_SPRING_CONFIG);
        dragOffsetX.value = withTiming(liftOffset.x, { duration: LIFT_TIMING_DURATION });
        dragOffsetY.value = withTiming(liftOffset.y, { duration: LIFT_TIMING_DURATION });
      }
    },
    [
      boardSize,
      squareSize,
      boardRotation,
      dragX,
      dragY,
      dragOffsetX,
      dragOffsetY,
      dragSnapActive,
      dragSnapTargets,
      validMoveMap,
      dragSnapX,
      dragSnapY,
      ghostX,
      ghostY,
      ghostOpacity,
      lastSnappedKey,
      lastCursorKey,
      dragStartPos,
      onCursorChange,
      onSnapKeyChange,
    ]
  );

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(enableDragToMove)
        .minDistance(DRAG_START_DISTANCE)
        .onBegin((event) => {
          // Only start if not already dragging
          if (uiState.value !== 0) return;
          scheduleOnRN(setPanStart, event.x, event.y);
        })
        .onStart((event) => {
          // Guard: prevent starting if already in a drag or waiting state
          if (uiState.value !== 0) return;
          // Mark as dragging immediately on UI thread to prevent race conditions
          uiState.value = 1;
          // Note: dragSnapTargets won't be populated yet when this runs,
          // but we still need to apply visuals for initial drag position.
          // Snapping will work in subsequent onUpdate calls once JS thread populates targets.
          applyDragVisuals(event.x, event.y);
          scheduleOnRN(startDragFromPan, event.x, event.y);
        })
        .onUpdate((event) => {
          // Only process updates if we're actively dragging
          if (uiState.value !== 1) return;
          applyDragVisuals(event.x, event.y);
        })
        .onEnd((event) => {
          const dragDistance = Math.hypot(event.translationX, event.translationY);
          const snappedKey = lastSnappedKey.value;
          const hasSnap = dragSnapActive.value === 1 && snappedKey >= 0;
          // If we have a snap target, commit regardless of drag distance.
          if (hasSnap) {
            const fromRow = dragStartPos.value?.row ?? 0;
            const fromCol = dragStartPos.value?.col ?? 0;
            const toRow = Math.floor(snappedKey / 14);
            const toCol = snappedKey % 14;
            
            // If dropping on the same square, cancel instead of committing
            if (fromRow === toRow && fromCol === toCol) {
              // Reset UI-thread values immediately to allow new drag to start
              uiState.value = 0;
              dragScale.value = 1;
              dragOffsetX.value = 0;
              dragOffsetY.value = 0;
              dragSnapActive.value = 0;
              lastSnappedKey.value = -1;
              lastCursorKey.value = -1;
              clearMask();
              // Schedule full cleanup on JS thread
              scheduleOnRN(cancelDrag);
              return;
            }
            
            uiState.value = 2;
            
            // Instant snap - no animation for smooth, immediate feel
            dragX.value = dragSnapX.value;
            dragY.value = dragSnapY.value;
            dragScale.value = 1;
            dragOffsetX.value = 0;
            dragOffsetY.value = 0;

            if (dragStartPos.value) {
              const fromIdx = fromRow * 14 + fromCol;
              applyDropMask(fromIdx, snappedKey);
            }

            scheduleOnRN(commitMove, fromRow, fromCol, toRow, toCol);
            return;
          }

          if (dragDistance <= TAP_MOVE_TOLERANCE) {
            clearMask();
            if (enableTapGestures) {
              scheduleOnRN(handleTapAt, event.x, event.y);
            }
            scheduleOnRN(cancelDrag);
            return;
          }

          const liftOffset = getDragLiftOffset(squareSize * DRAG_OFFSET_Y, boardRotation);
          const pieceX = event.x + liftOffset.x;
          const pieceY = event.y + liftOffset.y;
          const safeX = Math.max(0, Math.min(pieceX, boardSize));
          const safeY = Math.max(0, Math.min(pieceY, boardSize));
          const snapThreshold = squareSize * SNAP_RING_RADIUS_RATIO;
          const isInside =
            pieceX >= 0 && pieceY >= 0 && pieceX <= boardSize && pieceY <= boardSize;

          let bestDist = Number.POSITIVE_INFINITY;
          let bestKey = -1;
          let bestX = 0;
          let bestY = 0;

          if (isInside && dragSnapTargets.value.length > 0) {
            const targets = dragSnapTargets.value;
            for (let i = 0; i < targets.length; i += 1) {
              const key = targets[i];
              const row = Math.floor(key / 14);
              const col = key - row * 14;
              const centerX = (col + 0.5) * squareSize;
              const centerY = (row + 0.5) * squareSize;
              const dist = Math.hypot(safeX - centerX, safeY - centerY);
              if (dist < bestDist) {
                bestDist = dist;
                bestKey = key;
                bestX = centerX;
                bestY = centerY;
              }
            }
          }

          const isLegal = bestKey >= 0 && validMoveMap.value[bestKey] === 1;
          const shouldSnap = bestDist <= snapThreshold && isLegal;

          if (shouldSnap) {
            const fromRow = dragStartPos.value?.row ?? 0;
            const fromCol = dragStartPos.value?.col ?? 0;
            const toRow = Math.floor(bestKey / 14);
            const toCol = bestKey % 14;
            
            // If dropping on the same square, cancel instead of committing
            if (fromRow === toRow && fromCol === toCol) {
              // Reset UI-thread values immediately to allow new drag to start
              uiState.value = 0;
              dragScale.value = 1;
              dragOffsetX.value = 0;
              dragOffsetY.value = 0;
              dragSnapActive.value = 0;
              lastSnappedKey.value = -1;
              lastCursorKey.value = -1;
              clearMask();
              // Schedule full cleanup on JS thread
              scheduleOnRN(cancelDrag);
              return;
            }
            
            uiState.value = 2;
            
            // Instant snap - no animation for smooth, immediate feel
            dragX.value = bestX - squareSize / 2;
            dragY.value = bestY - squareSize / 2;
            dragScale.value = 1;
            dragOffsetX.value = 0;
            dragOffsetY.value = 0;

            if (dragStartPos.value) {
              const fromIdx = fromRow * 14 + fromCol;
              applyDropMask(fromIdx, bestKey);
            }

            scheduleOnRN(commitMove, fromRow, fromCol, toRow, toCol);
          } else {
            uiState.value = 0;
            clearMask();
            scheduleOnRN(cancelDrag);
          }
        })
        .onFinalize(() => {
          if (uiState.value !== 2) {
            scheduleOnRN(cancelDrag);
          }
        }),
    [
      enableDragToMove,
      enableTapGestures,
      applyDragVisuals,
      setPanStart,
      startDragFromPan,
      commitMove,
      cancelDrag,
      handleTapAt,
      clearMask,
      boardSize,
      squareSize,
      boardRotation,
      dragSnapTargets,
      validMoveMap,
      dragStartPos,
      dragX,
      dragY,
      dragScale,
      dragOffsetX,
      dragOffsetY,
      dragSnapX,
      dragSnapY,
      uiState,
      lastSnappedKey,
      visibilityMask,
      activeMaskIndicesValue,
      applyDropMask,
    ]
  );

  const tapGesture = useMemo(
    () =>
      Gesture.Tap()
        .enabled(enableTapGestures)
        .maxDistance(TAP_MOVE_TOLERANCE)
        .onEnd((event) => {
          scheduleOnRN(handleTapAt, event.x, event.y);
        }),
    [enableTapGestures, handleTapAt]
  );

  const boardGesture = useMemo(
    () => {
      if (enableDragToMove && enableTapGestures) {
        return Gesture.Exclusive(panGesture, tapGesture);
      }
      if (enableDragToMove) return panGesture;
      if (enableTapGestures) return tapGesture;
      return Gesture.Tap().enabled(false);
    },
    [enableDragToMove, enableTapGestures, panGesture, tapGesture]
  );

  return { panGesture, tapGesture, boardGesture };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
