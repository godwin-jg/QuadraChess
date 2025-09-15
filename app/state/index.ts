// Re-export all types and interfaces
export * from "./types";

// Re-export board state
export { initialBoardState } from "./boardState";

// Re-export game helpers
export * from "./gameHelpers";

// Re-export the game slice and its actions
export { default as gameReducer } from "./gameSlice";
export {
  setSelectedPiece,
  setValidMoves,
  selectPiece,
  makeMove,
  completePromotion,
  resetGame,
} from "./gameSlice";

// Re-export the store
export { store } from "./store";
export type { RootState } from "./store";

