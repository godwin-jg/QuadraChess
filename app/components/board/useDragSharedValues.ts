import { useSharedValue, type SharedValue } from "react-native-reanimated";

export interface DragSharedValues {
  // Drag position and scale
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  dragScale: SharedValue<number>;
  dragOffsetX: SharedValue<number>;
  dragOffsetY: SharedValue<number>;
  
  // Snap position
  dragSnapX: SharedValue<number>;
  dragSnapY: SharedValue<number>;
  dragSnapActive: SharedValue<number>;
  dragSnapTargets: SharedValue<number[]>;
  
  // Move legality map (196 = 14x14 board)
  validMoveMap: SharedValue<number[]>;
  
  // Drag start position for revert capability
  dragStartPos: SharedValue<{ row: number; col: number } | null>;
  
  // Tracking keys
  lastSnappedKey: SharedValue<number>;
  lastCursorKey: SharedValue<number>;
  
  // Ghost piece (preview at snap target)
  ghostX: SharedValue<number>;
  ghostY: SharedValue<number>;
  ghostOpacity: SharedValue<number>;
  
  // UI State Machine: 0=IDLE, 1=DRAGGING, 2=OPTIMISTIC_WAITING
  uiState: SharedValue<number>;
}

/**
 * Hook that creates all shared values needed for the drag system.
 * Separates declaration from usage for cleaner code organization.
 */
export function useDragSharedValues(): DragSharedValues {
  return {
    // Drag position and scale
    dragX: useSharedValue(0),
    dragY: useSharedValue(0),
    dragScale: useSharedValue(1),
    dragOffsetX: useSharedValue(0),
    dragOffsetY: useSharedValue(0),
    
    // Snap position
    dragSnapX: useSharedValue(0),
    dragSnapY: useSharedValue(0),
    dragSnapActive: useSharedValue(0),
    dragSnapTargets: useSharedValue<number[]>([]),
    
    // Move legality map
    validMoveMap: useSharedValue<number[]>(new Array(196).fill(0)),
    
    // Drag start position
    dragStartPos: useSharedValue<{ row: number; col: number } | null>(null),
    
    // Tracking keys
    lastSnappedKey: useSharedValue(-1),
    lastCursorKey: useSharedValue(-1),
    
    // Ghost piece
    ghostX: useSharedValue(0),
    ghostY: useSharedValue(0),
    ghostOpacity: useSharedValue(0),
    
    // UI State
    uiState: useSharedValue(0),
  };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
