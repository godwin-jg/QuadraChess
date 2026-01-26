/**
 * Board-related constants used across board components
 */

// Gradient mapping for player colors
export const GRADIENT_MAP = {
  r: "rGradient",
  b: "bGradient",
  y: "yGradient",
  g: "gGradient",
} as const;

// SVG path for the cross-shaped board glow
export const CROSS_SHAPE_PATH =
  "M 30 0 L 110 0 L 110 30 L 140 30 L 140 110 L 110 110 L 110 140 L 30 140 L 30 110 L 0 110 L 0 30 L 30 30 Z";

// Accent colors for drag operations per player color
export const DRAG_ACCENT = {
  r: { border: "#ef4444", bg: "rgba(239, 68, 68, 0.12)" },
  b: { border: "#3b82f6", bg: "rgba(59, 130, 246, 0.12)" },
  y: { border: "#a855f7", bg: "rgba(168, 85, 247, 0.12)" },
  g: { border: "#10b981", bg: "rgba(16, 185, 129, 0.12)" },
} as const;

// Drag behavior constants
export const DRAG_OFFSET_Y = -1.8; // Multiplier of squareSize for piece lift
export const DRAG_START_DISTANCE = 31; // px movement before drag activates
export const TAP_MOVE_TOLERANCE = 30; // px movement still treated as tap
export const SNAP_RING_RADIUS_RATIO = 0.75; // Keep tap/drag snap areas aligned
export const LEGAL_DOT_RATIO = 1 / 3; // Size ratio for legal move dots

// Debounce delay for piece selection
export const DEBOUNCE_DELAY = 150; // ms

// Board dimensions
export const BOARD_SQUARES = 14;
export const TOTAL_SQUARES = BOARD_SQUARES * BOARD_SQUARES; // 196

// Type exports
export type PlayerColor = keyof typeof GRADIENT_MAP;
export type DragAccentColor = keyof typeof DRAG_ACCENT;
