// Types for Firebase Cloud Functions
// Re-export shared types from main types file
export { Position } from "../../types";
export { Player } from "../../app/services/networkService";

export interface MoveInfo {
  row: number;
  col: number;
  isCapture?: boolean;
  isEnPassant?: boolean;
  isCastling?: boolean;
  isPromotion?: boolean;
  promotionPiece?: string;
}

// Player interface is defined in the main types file

export const turnOrder = ["r", "b", "y", "g"] as const;
