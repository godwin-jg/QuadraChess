/**
 * Redux selectors for the game state.
 * Memoized selectors for UI components.
 */
import { createSelector } from "@reduxjs/toolkit";
import { bitboardToArray } from "../src/logic/bitboardUtils";
import type { GameState } from "./types";

// Input selectors: simple functions to get parts of the state
const selectGame = (state: { game: GameState }) => state.game;
const selectViewingHistoryIndex = (state: { game: GameState }) => state.game.viewingHistoryIndex;
const selectHistory = (state: { game: GameState }) => state.game.history;
const selectBitboardPieces = (state: { game: GameState }) => state.game.bitboardState.pieces;
const selectEliminatedPieceBitboards = (state: { game: GameState }) =>
  state.game.eliminatedPieceBitboards;

/**
 * Memoized selector that derives board array from bitboards (single source of truth)
 */
export const selectDerivedBoardState = createSelector(
  [selectBitboardPieces, selectEliminatedPieceBitboards],
  (pieces, eliminatedPieces) => bitboardToArray(pieces, eliminatedPieces)
);

/**
 * Memoized selector for display board state (handles history viewing)
 */
export const selectDisplayBoardState = createSelector(
  [selectDerivedBoardState, selectViewingHistoryIndex, selectHistory],
  (derivedBoard, viewingHistoryIndex, history) => {
    if (viewingHistoryIndex !== null && history.length > 0) {
      const historicalState = history[viewingHistoryIndex];
      return historicalState ? historicalState.boardState : derivedBoard;
    }
    return derivedBoard;
  }
);

/**
 * Memoized selector for full display game state (handles history viewing)
 */
export const selectDisplayGameState = createSelector(
  [selectGame, selectDerivedBoardState, selectViewingHistoryIndex, selectHistory],
  (game, derivedBoard, viewingHistoryIndex, history) => {
    if (viewingHistoryIndex !== null && history.length > 0) {
      const historicalState = history[viewingHistoryIndex];
      if (historicalState) {
        return {
          ...game,
          boardState: historicalState.boardState,
          currentPlayerTurn: historicalState.currentPlayerTurn,
          gameStatus: historicalState.gameStatus,
          capturedPieces: historicalState.capturedPieces,
          checkStatus: historicalState.checkStatus,
          winner: historicalState.winner,
          eliminatedPlayers: historicalState.eliminatedPlayers,
          justEliminated: historicalState.justEliminated,
          scores: historicalState.scores,
          promotionState: historicalState.promotionState,
          hasMoved: historicalState.hasMoved,
          enPassantTargets: historicalState.enPassantTargets,
          gameOverState: historicalState.gameOverState,
        };
      }
    }
    return {
      ...game,
      boardState: derivedBoard,
    };
  }
);

/**
 * Selector to check if currently viewing history
 */
export const selectIsViewingHistory = createSelector(
  [selectViewingHistoryIndex],
  (viewingHistoryIndex) => viewingHistoryIndex !== null
);
