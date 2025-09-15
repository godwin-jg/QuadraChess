// Re-export all functions from the split modules for backward compatibility
export * from "./types";
export * from "./utils";
export * from "./pieceMoves";
export * from "./gameLogic";

// Main exports that were in the original chessLogic.ts
export {
  getValidMoves,
  isKingInCheck,
  hasAnyLegalMoves,
  isSquareUnderAttack,
} from "./gameLogic";

export {
  getPawnMoves,
  getKnightMoves,
  getRookMoves,
  getBishopMoves,
  getQueenMoves,
  getKingMoves,
  getKingMovesWithoutCastling,
} from "./pieceMoves";

export {
  isWithinBounds,
  isCornerSquare,
  isEmpty,
  isEnemy,
  isFriendly,
  cloneBoardState,
  simulateMove,
} from "./utils";
