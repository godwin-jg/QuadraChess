// Shared types used across the application
export interface Position {
  row: number;
  col: number;
}

// Interface for move information including capture status and promotion
export interface MoveInfo {
  row: number;
  col: number;
  isCapture: boolean;
  isPromotion?: boolean;
  isEnPassant?: boolean;
}
