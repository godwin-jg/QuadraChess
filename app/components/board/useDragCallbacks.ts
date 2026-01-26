import { useCallback, useRef } from "react";
import type { DragTarget } from "./DragHoverIndicator";
import type { MoveInfo } from "../../../types";

interface UseDragCallbacksOptions {
  enablePerfLog: boolean;
  perfRef: React.MutableRefObject<{
    cursorChangeCount: number;
    snapChangeCount: number;
  }>;
  dragValidMovesRef: React.MutableRefObject<MoveInfo[]>;
  dragHoverRef: React.MutableRefObject<DragTarget | null>;
  setDragHover: (target: DragTarget | null) => void;
  dragKeyHasChangedRef: React.MutableRefObject<boolean>;
}

interface UseDragCallbacksReturn {
  onCursorChange: (cursorKey: number, fromRow: number, fromCol: number) => void;
  onSnapKeyChange: (snapKey: number, snapX: number, snapY: number) => void;
}

/**
 * Hook that provides callbacks for drag cursor and snap key changes.
 * These are called from worklets when crossing square boundaries or snap changes.
 */
export function useDragCallbacks({
  enablePerfLog,
  perfRef,
  dragValidMovesRef,
  dragHoverRef,
  setDragHover,
  dragKeyHasChangedRef,
}: UseDragCallbacksOptions): UseDragCallbacksReturn {
  // JS callback for cursor position changes (track drag movement)
  // Called from worklet only when cursor crosses square boundaries
  const onCursorChange = useCallback(
    (cursorKey: number, fromRow: number, fromCol: number) => {
      if (enablePerfLog) {
        perfRef.current.cursorChangeCount += 1;
      }

      if (cursorKey === -1) return;

      const row = Math.floor(cursorKey / 14);
      const col = cursorKey - row * 14;

      // Track if cursor moved away from origin
      if (row !== fromRow || col !== fromCol) {
        dragKeyHasChangedRef.current = true;
      }
    },
    [enablePerfLog, perfRef, dragKeyHasChangedRef]
  );

  // JS callback for snap key changes (haptics + hover state)
  // Called from worklet only when snap target actually changes
  const onSnapKeyChange = useCallback(
    (snapKey: number, _snapX: number, _snapY: number) => {
      if (enablePerfLog) {
        perfRef.current.snapChangeCount += 1;
      }

      if (snapKey === -1) {
        // Cleared snap
        if (dragHoverRef.current) {
          dragHoverRef.current = null;
          setDragHover(null);
        }
        return;
      }

      const row = Math.floor(snapKey / 14);
      const col = snapKey - row * 14;

      // Only update if actually changed
      if (
        !dragHoverRef.current ||
        dragHoverRef.current.row !== row ||
        dragHoverRef.current.col !== col
      ) {
        // Check if it's a capture
        const move = dragValidMovesRef.current.find(
          (m) => m.row === row && m.col === col
        );
        const target: DragTarget = {
          row,
          col,
          type: move?.isCapture ? "capture" : "move",
        };
        dragHoverRef.current = target;
        setDragHover(target);

        // Trigger haptic feedback
        try {
          const haptics = require("../../../services/hapticsService").hapticsService;
          haptics.medium();
        } catch {
          // Haptics not available
        }
      }
    },
    [enablePerfLog, perfRef, dragValidMovesRef, dragHoverRef, setDragHover]
  );

  return { onCursorChange, onSnapKeyChange };
}
