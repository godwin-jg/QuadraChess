import { configureStore } from "@reduxjs/toolkit";
import gameReducer from "./gameSlice";
import type { Middleware } from "@reduxjs/toolkit";

// Debug middleware to log game actions and critical bitboard state
const debugMiddleware: Middleware = (storeAPI) => (next) => (action) => {
  const result = next(action);
  if (action.type && action.type.startsWith("game/")) {
    const game = storeAPI.getState().game;
    console.log("[DEBUG ACTION]", action.type, {
      turn: game.currentPlayerTurn,
      selectedPiece: game.selectedPiece,
      validMoves: game.validMoves?.length,
      checkStatus: game.checkStatus,
      eliminated: game.eliminatedPlayers,
      enPassantTargets: game.enPassantTargets,
      pinnedMask: game.bitboardState.pinnedMask?.toString(16),
      occupancy: game.bitboardState.occupancy?.toString(16),
      attackMaps: {
        r: game.bitboardState.attackMaps?.r?.toString(16),
        b: game.bitboardState.attackMaps?.b?.toString(16),
        y: game.bitboardState.attackMaps?.y?.toString(16),
        g: game.bitboardState.attackMaps?.g?.toString(16),
      },
    });
  }
  return result;
};

export const store = configureStore({
  reducer: {
    game: gameReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      // Bitboards use BigInt; disable serializable checks to avoid warnings.
      serializableCheck: false,
    }).concat(debugMiddleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
