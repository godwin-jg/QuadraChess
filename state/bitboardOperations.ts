/**
 * Bitboard operations for the game state.
 * These functions handle low-level bitboard manipulation.
 */
import { squareBit, bitboardToArray, getPieceAtFromBitboard } from "../src/logic/bitboardUtils";
import { generateAttackMap, getPinnedPiecesMask } from "../src/logic/bitboardLogic";
import { updateAllCheckStatus } from "./gameHelpers";
import { TURN_ORDER } from "../config/gameConfig";
import type { Bitboard } from "../src/logic/bitboardUtils";
import type { BitboardState, GameState } from "./types";

/**
 * Apply a piece transition on bitboards (move piece from one square to another)
 */
export const applyBitboardTransition = (
  state: GameState,
  fromIdx: number,
  toIdx: number,
  pieceCode: string,
  playerColor: string
) => {
  const fromMask = squareBit(fromIdx);
  const toMask = squareBit(toIdx);
  const moveMask = fromMask | toMask;

  // 1. Capture correction: remove captured piece bit first
  const toRow = Math.floor(toIdx / 14);
  const toCol = toIdx % 14;
  const capturedPiece = getPieceAtFromBitboard(state.bitboardState.pieces, toRow, toCol);
  if (capturedPiece) {
    const enemyColor = capturedPiece[0];
    state.bitboardState.pieces[capturedPiece] ^= toMask;
    state.bitboardState[enemyColor as "r" | "b" | "y" | "g"] ^= toMask;
  }

  // 2. Move piece
  state.bitboardState.pieces[pieceCode] ^= moveMask;
  state.bitboardState[playerColor as "r" | "b" | "y" | "g"] ^= moveMask;

  const occupancyMask = capturedPiece ? fromMask : moveMask;
  state.bitboardState.allPieces ^= occupancyMask;
  state.bitboardState.occupancy ^= occupancyMask;
};

/**
 * Rebuild all attack maps for all players
 */
export const refreshAllAttackMaps = (state: GameState) => {
  // Rebuild occupancy/allPieces from piece bitboards to self-heal any desync.
  let newOccupancy = 0n;
  Object.values(state.bitboardState.pieces).forEach((bb) => {
    newOccupancy |= bb;
  });
  state.bitboardState.allPieces = newOccupancy;
  state.bitboardState.occupancy = newOccupancy;

  // Regenerate attack maps; eliminated players contribute no threats.
  TURN_ORDER.forEach((c) => {
    if (state.eliminatedPlayers.includes(c)) {
      state.bitboardState.attackMaps[c as "r" | "b" | "y" | "g"] = 0n;
    } else {
      state.bitboardState.attackMaps[c as "r" | "b" | "y" | "g"] = generateAttackMap(
        c,
        state.bitboardState.pieces,
        state.bitboardState.allPieces
      );
    }
  });
};

/**
 * Rebuild the en passant target mask from the enPassantTargets array
 */
export const rebuildEnPassantMask = (state: GameState) => {
  let mask = 0n;
  state.enPassantTargets.forEach((target) => {
    const { row, col } = target.position;
    mask |= squareBit(row * 14 + col);
  });
  state.bitboardState.enPassantTarget = mask;
};

/**
 * Clean up an eliminated player's pieces from the game logic
 * Note: Pieces remain visible on the board but grayed out (purely visual)
 */
export const cleanupEliminatedPlayer = (state: GameState, eliminatedPlayer: string) => {
  const colorMap: Record<string, "red" | "blue" | "yellow" | "green"> = {
    r: "red",
    b: "blue",
    y: "yellow",
    g: "green",
  };

  state.bitboardState[eliminatedPlayer as "r" | "b" | "y" | "g"] = 0n;
  const colorKey = colorMap[eliminatedPlayer];
  if (colorKey) {
    state.bitboardState[colorKey] = 0n;
  }

  Object.keys(state.bitboardState.pieces).forEach((key) => {
    if (key.startsWith(eliminatedPlayer)) {
      const bb = state.bitboardState.pieces[key];
      if (bb && bb !== 0n) {
        state.eliminatedPieceBitboards[key] =
          (state.eliminatedPieceBitboards[key] ?? 0n) | bb;
      }
      state.bitboardState.pieces[key] = 0n;
    }
  });

  let occupancy = 0n;
  Object.values(state.bitboardState.pieces).forEach((bb) => {
    occupancy |= bb;
  });
  state.bitboardState.allPieces = occupancy;
  state.bitboardState.occupancy = occupancy;
  refreshAllAttackMaps(state);

  // Clear en passant targets created by the eliminated player
  state.enPassantTargets = state.enPassantTargets.filter(
    (t) => t.createdBy.charAt(0) !== eliminatedPlayer
  );

  // Refresh check status and pinned mask for the current player
  state.checkStatus = updateAllCheckStatus(state);
  state.bitboardState.pinnedMask = getPinnedPiecesMask(
    state,
    state.currentPlayerTurn
  );
};

/**
 * Sync bitboards from a 2D board array
 */
export const syncBitboardsFromArray = (
  board: (string | null)[][],
  eliminatedPlayers: string[] = []
): BitboardState => {
  const pieces: Record<string, Bitboard> = {
    rP: 0n, rN: 0n, rB: 0n, rR: 0n, rQ: 0n, rK: 0n,
    bP: 0n, bN: 0n, bB: 0n, bR: 0n, bQ: 0n, bK: 0n,
    yP: 0n, yN: 0n, yB: 0n, yR: 0n, yQ: 0n, yK: 0n,
    gP: 0n, gN: 0n, gB: 0n, gR: 0n, gQ: 0n, gK: 0n,
  };
  let allPieces = 0n;
  let r = 0n;
  let b = 0n;
  let y = 0n;
  let g = 0n;

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const code = board[row][col];
      if (code) {
        const pieceColor = code[0];
        if (eliminatedPlayers.includes(pieceColor)) {
          continue;
        }
        const bit = squareBit(row * 14 + col);
        pieces[code] = (pieces[code] || 0n) | bit;
        allPieces |= bit;
        if (code[0] === "r") r |= bit;
        if (code[0] === "b") b |= bit;
        if (code[0] === "y") y |= bit;
        if (code[0] === "g") g |= bit;
      }
    }
  }

  const attackMaps = {
    r: generateAttackMap("r", pieces, allPieces),
    b: generateAttackMap("b", pieces, allPieces),
    y: generateAttackMap("y", pieces, allPieces),
    g: generateAttackMap("g", pieces, allPieces),
  };

  return {
    white: 0n,
    black: 0n,
    red: r,
    yellow: y,
    blue: b,
    green: g,
    r,
    b,
    y,
    g,
    allPieces,
    occupancy: allPieces,
    pieces,
    enPassantTarget: 0n,
    pinnedMask: 0n,
    attackMaps,
  };
};

/**
 * Create empty piece bitboards object with all piece types initialized to 0n
 */
export const createEmptyPieceBitboards = (pieces: Record<string, Bitboard>) =>
  Object.keys(pieces).reduce((acc, key) => {
    acc[key] = 0n;
    return acc;
  }, {} as Record<string, Bitboard>);

/**
 * Derive eliminated piece bitboards from the board array
 */
export const deriveEliminatedPieceBitboardsFromBoard = (
  board: (string | null)[][],
  eliminatedPlayers: string[],
  basePieces: Record<string, Bitboard>
): Record<string, Bitboard> => {
  const eliminatedPieces = createEmptyPieceBitboards(basePieces);
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const code = board[row][col];
      if (!code) continue;
      const pieceColor = code[0];
      if (!eliminatedPlayers.includes(pieceColor)) continue;
      const bit = squareBit(row * 14 + col);
      eliminatedPieces[code] = (eliminatedPieces[code] || 0n) | bit;
    }
  }
  return eliminatedPieces;
};

/**
 * Create a deep copy of the game state for history
 */
export const createStateSnapshot = (state: GameState): GameState => {
  return {
    ...state,
    boardState: bitboardToArray(
      state.bitboardState.pieces,
      state.eliminatedPieceBitboards
    ),
    bitboardState: {
      ...state.bitboardState,
      pieces: { ...state.bitboardState.pieces },
      attackMaps: { ...state.bitboardState.attackMaps },
    },
    eliminatedPieceBitboards: { ...state.eliminatedPieceBitboards },
    capturedPieces: {
      r: [...(state.capturedPieces?.r || [])],
      b: [...(state.capturedPieces?.b || [])],
      y: [...(state.capturedPieces?.y || [])],
      g: [...(state.capturedPieces?.g || [])],
    },
    timeControl: { ...state.timeControl },
    clocks: { ...state.clocks },
    turnStartedAt: state.turnStartedAt,
    teamMode: state.teamMode,
    teamAssignments: { ...state.teamAssignments },
    winningTeam: state.winningTeam ?? null,
    checkStatus: { ...state.checkStatus },
    scores: { ...state.scores },
    hasMoved: { ...state.hasMoved },
    enPassantTargets: state.enPassantTargets.map((target) => ({
      ...target,
      position: { ...target.position },
    })),
    promotionState: { ...state.promotionState },
    gameOverState: { ...state.gameOverState },
    eliminatedPlayers: [...state.eliminatedPlayers],
    history: [],
    historyIndex: 0,
    viewingHistoryIndex: null,
  };
};
