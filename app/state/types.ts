// Import shared types
import { Position, MoveInfo } from "../types/index";

// Define the turn order for 4-player chess
export const turnOrder = ["r", "b", "y", "g"] as const;

// Re-export shared types
export { Position, MoveInfo };

export interface GameState {
  boardState: (string | null)[][];
  currentPlayerTurn: string;
  gameStatus: string;
  selectedPiece: Position | null;
  validMoves: MoveInfo[];
  capturedPieces: { r: string[]; b: string[]; y: string[]; g: string[] };
  checkStatus: { r: boolean; b: boolean; y: boolean; g: boolean };
  winner: string | null;
  eliminatedPlayers: string[];
  scores: { r: number; b: number; y: number; g: number };
  promotionState: {
    isAwaiting: boolean;
    position: Position | null;
    color: string | null;
  };
  hasMoved: {
    rK: boolean;
    rR1: boolean;
    rR2: boolean; // Red King, Rook on a-file, Rook on h-file
    bK: boolean;
    bR1: boolean;
    bR2: boolean; // Blue King, Rook on rank 1, Rook on rank 8
    yK: boolean;
    yR1: boolean;
    yR2: boolean; // Yellow
    gK: boolean;
    gR1: boolean;
    gR2: boolean; // Green
  };
}
