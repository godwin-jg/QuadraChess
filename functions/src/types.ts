// Shared types used across the application
export interface Position {
  row: number;
  col: number;
}

export const turnOrder = ["r", "b", "y", "g"] as const;

// Interface for move information including capture status and promotion
export interface MoveInfo {
  row: number;
  col: number;
  isCapture?: boolean;
  isPromotion?: boolean;
  isEnPassant?: boolean;
  isCastling?: boolean;
  promotionPiece?: string;
}

// Player interface for Cloud Functions
export interface Player {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isOnline?: boolean;
  lastSeen?: number;
}
