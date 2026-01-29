import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import networkService, { Player } from "../app/services/networkService";
import { getValidMoves, hasAnyLegalMoves } from "../src/logic/gameLogic";
import { MoveInfo } from "../types";
import { PIECE_VALUES, GAME_BONUSES, TURN_ORDER } from "../config/gameConfig";
import type { BotDifficulty } from "../config/gameConfig";
import { EnPassantTarget } from "./types";
import { squareBit, getPieceAtFromBitboard } from "../src/logic/bitboardUtils";
import { initialBoardState } from "./boardState";
import { bitboardToMoveInfo, getValidMovesBB } from "../src/logic/moveGeneration";
import { getPinnedPiecesMask, isKingInCheck } from "../src/logic/bitboardLogic";
import {
  getRookIdentifier,
  getRookCastlingCoords,
  isCastlingMove,
  updateAllCheckStatus,
} from "./gameHelpers";
import { GameState, Position, turnOrder } from "./types";

// Extracted modules
import {
  applyBitboardTransition,
  refreshAllAttackMaps,
  rebuildEnPassantMask,
  cleanupEliminatedPlayer,
  syncBitboardsFromArray,
  createEmptyPieceBitboards,
  deriveEliminatedPieceBitboardsFromBoard,
  createStateSnapshot,
} from "./bitboardOperations";
import { initialState, baseInitialState } from "./initialState";

// Re-export selectors for backward compatibility
export {
  selectDerivedBoardState,
  selectDisplayBoardState,
  selectDisplayGameState,
  selectIsViewingHistory,
} from "./gameSelectors";

// Re-export createStateSnapshot for external use
export { createStateSnapshot } from "./bitboardOperations";

const DEFAULT_TIME_CONTROL = { baseMs: 5 * 60 * 1000, incrementMs: 0 };
const CLOCK_COLORS = ["r", "b", "y", "g"] as const;
type ClockColor = (typeof CLOCK_COLORS)[number];
const DEFAULT_TEAM_ASSIGNMENTS = { r: "A", y: "A", b: "B", g: "B" } as const;
const TEAM_IDS = ["A", "B"] as const;
type TeamId = (typeof TEAM_IDS)[number];

const isTerminalStatus = (status: GameState["gameStatus"]) =>
  status === "finished" || status === "checkmate" || status === "stalemate";

const ensureTeamState = (state: GameState) => {
  if (typeof state.teamMode !== "boolean") {
    state.teamMode = false;
  }
  if (!state.teamAssignments) {
    state.teamAssignments = { ...DEFAULT_TEAM_ASSIGNMENTS };
  }
  CLOCK_COLORS.forEach((color) => {
    const team = state.teamAssignments[color];
    if (team !== "A" && team !== "B") {
      state.teamAssignments[color] = DEFAULT_TEAM_ASSIGNMENTS[color];
    }
  });
  if (state.winningTeam === undefined) {
    state.winningTeam = null;
  }
};

const getTeamForColor = (assignments: GameState["teamAssignments"], color: ClockColor): TeamId =>
  assignments[color];

const getTeamColors = (assignments: GameState["teamAssignments"], teamId: TeamId): ClockColor[] =>
  CLOCK_COLORS.filter((color) => assignments[color] === teamId);

const getOpposingTeam = (teamId: TeamId): TeamId => (teamId === "A" ? "B" : "A");

// ✅ REMOVED: syncTeamClocks - each player now has individual clock
// Team mode only affects elimination, not clock synchronization

const ensureClockState = (state: GameState) => {
  ensureTeamState(state);
  if (!state.timeControl) {
    state.timeControl = { ...DEFAULT_TIME_CONTROL };
  }
  if (!state.clocks || typeof state.clocks !== "object" || Array.isArray(state.clocks)) {
    state.clocks = {
      r: state.timeControl.baseMs,
      b: state.timeControl.baseMs,
      y: state.timeControl.baseMs,
      g: state.timeControl.baseMs,
    };
  }
  CLOCK_COLORS.forEach((color) => {
    if (typeof state.clocks[color] !== "number") {
      state.clocks[color] = state.timeControl.baseMs;
    }
  });
  if (state.turnStartedAt === undefined) {
    state.turnStartedAt = null;
  }
  if (
    state.turnStartedAt === null &&
    (state.gameStatus === "active" || state.gameStatus === "promotion")
  ) {
    state.turnStartedAt = Date.now();
  }
};

const applyElapsedToClock = (state: GameState, playerColor: ClockColor, now: number) => {
  ensureClockState(state);
  // ✅ UPDATED: Each player has their own individual clock (even in team mode)
  // Team mode only affects elimination - if one player times out, the whole team is eliminated
  if (state.turnStartedAt === null) {
    state.turnStartedAt = now;
    return state.clocks[playerColor];
  }
  const elapsedMs = Math.max(0, now - state.turnStartedAt);
  const remaining = Math.max(0, state.clocks[playerColor] - elapsedMs);
  state.clocks[playerColor] = remaining;
  return remaining;
};

const finalizeTurnStart = (state: GameState, now: number) => {
  if (isTerminalStatus(state.gameStatus)) {
    state.turnStartedAt = null;
    return;
  }
  state.turnStartedAt = now;
};

const endTeamGame = (
  state: GameState,
  losingColor: ClockColor,
  status: "checkmate" | "stalemate" | "finished",
  now: number
) => {
  ensureClockState(state);
  if (state.viewingHistoryIndex !== null) {
    return;
  }
  if (isTerminalStatus(state.gameStatus)) {
    return;
  }

  const losingTeam = getTeamForColor(state.teamAssignments, losingColor);
  const winningTeam = getOpposingTeam(losingTeam);
  const losingColors = getTeamColors(state.teamAssignments, losingTeam);
  const winningColors = getTeamColors(state.teamAssignments, winningTeam);

  // ✅ UPDATED: Set each eliminated player's clock to 0 individually
  losingColors.forEach((color) => {
    state.clocks[color] = 0;
  });

  losingColors.forEach((color) => {
    if (!state.eliminatedPlayers.includes(color)) {
      state.eliminatedPlayers.push(color);
      cleanupEliminatedPlayer(state, color);
    }
  });

  state.selectedPiece = null;
  state.validMoves = [];
  state.checkStatus = updateAllCheckStatus(state);
  state.justEliminated = losingColor;
  state.winningTeam = winningTeam;
  state.winner = winningColors[0] ?? null;
  // In team mode, game ends when a team is eliminated, so always set "finished"
  state.gameStatus = "finished";
  state.gameOverState = {
    isGameOver: true,
    status: "finished",
    eliminatedPlayer: losingColor,
  };
  state.currentPlayerTurn = winningColors[0] ?? state.currentPlayerTurn;
  state.turnStartedAt = null;
  state.moveCache = {};
};

const applyTimeoutLogic = (state: GameState, timedOutPlayer: ClockColor, now: number) => {
  ensureClockState(state);
  if (state.viewingHistoryIndex !== null) {
    return;
  }
  if (isTerminalStatus(state.gameStatus)) {
    return;
  }

  if (state.teamMode) {
    endTeamGame(state, timedOutPlayer, "finished", now);
  } else {
    state.clocks[timedOutPlayer] = 0;

    if (!state.eliminatedPlayers.includes(timedOutPlayer)) {
      state.eliminatedPlayers.push(timedOutPlayer);
      state.justEliminated = timedOutPlayer;
      cleanupEliminatedPlayer(state, timedOutPlayer);
    }

    // Clear selection
    state.selectedPiece = null;
    state.validMoves = [];

    // Update check status for all players
    state.checkStatus = updateAllCheckStatus(state);

    // Check if the entire game is over
    if (state.eliminatedPlayers.length === 3) {
      const winner = turnOrder.find(
        (player) => !state.eliminatedPlayers.includes(player)
      );
      if (winner) {
        state.winner = winner;
        state.gameStatus = "finished";
        state.gameOverState = {
          isGameOver: true,
          status: "finished",
          eliminatedPlayer: null,
        };
      }
      state.turnStartedAt = null;
    } else {
      const currentIndex = turnOrder.indexOf(timedOutPlayer as any);
      const nextIndex = (currentIndex + 1) % turnOrder.length;
      let nextActivePlayer = turnOrder[nextIndex];
      while (state.eliminatedPlayers.includes(nextActivePlayer)) {
        const activeIndex = turnOrder.indexOf(nextActivePlayer as any);
        const nextActiveIndex = (activeIndex + 1) % turnOrder.length;
        nextActivePlayer = turnOrder[nextActiveIndex];
      }
      state.currentPlayerTurn = nextActivePlayer;
      state.gameStatus = "active";
      state.turnStartedAt = now;
    }
  }

  // Clear move cache when game state changes
  state.moveCache = {};

  // Save to history
  if (state.historyIndex < state.history.length - 1) {
    state.history = state.history.slice(0, state.historyIndex + 1);
  }
  state.history.push(createStateSnapshot(state));
  state.historyIndex = state.history.length - 1;
};

// Define the new payload type for our improved makeMove action
interface MovePayload {
  from: Position;
  to: { row: number; col: number };
  isPromotion?: boolean;
}

interface OnlineSnapshotPayload {
  gameState: GameState;
  lastMove: GameState["lastMove"];
  version: number;
}

// Re-export for backward compatibility
export { syncBitboardsFromArray } from "./bitboardOperations";
export { baseInitialState } from "./initialState";

// ✅ Core game logic function - DRY principle implementation
// This function contains all the shared logic for processing moves
const _applyMoveLogic = (
  state: GameState,
  move: {
    from: Position;
    to: Position;
    pieceCode: string;
    playerColor: string;
    capturedPiece: string | null;
    isCastling: boolean;
    isEnPassant: boolean;
    isPromotion?: boolean;
    enPassantTarget?: EnPassantTarget | null; // ✅ Enhanced type safety
  }
) => {
  const {
    from,
    to,
    pieceCode,
    playerColor,
    capturedPiece,
    isCastling,
    isEnPassant,
    isPromotion,
    enPassantTarget,
  } = move;
  const { row: startRow, col: startCol } = from;
  const { row: targetRow, col: targetCol } = to;
  const pieceType = pieceCode[1];

  // ✅ BITBOARD ONLY: No boardState backup needed - derive from bitboards
  const prevState = {
    bitboardState: {
      ...state.bitboardState,
      pieces: { ...state.bitboardState.pieces },
      attackMaps: { ...state.bitboardState.attackMaps },
      r: state.bitboardState.r,
      b: state.bitboardState.b,
      y: state.bitboardState.y,
      g: state.bitboardState.g,
      allPieces: state.bitboardState.allPieces,
      occupancy: state.bitboardState.occupancy,
    },
    hasMoved: { ...state.hasMoved },
    enPassantTargets: state.enPassantTargets.map((target) => ({
      ...target,
      position: { ...target.position },
    })),
    capturedPieces: {
      r: [...(state.capturedPieces?.r || [])],
      b: [...(state.capturedPieces?.b || [])],
      y: [...(state.capturedPieces?.y || [])],
      g: [...(state.capturedPieces?.g || [])],
    },
    scores: { ...state.scores },
    checkStatus: { ...state.checkStatus },
    gameStatus: state.gameStatus,
  };

  // Disallow king capture before any mutation
  // Exception: eliminated players' kings can be "captured" (they're just visual)
  // ✅ Read from bitboards, not array
  const targetPiece = getPieceAtFromBitboard(state.bitboardState.pieces, targetRow, targetCol);
  if (targetPiece && targetPiece[1] === "K") {
    const targetColor = targetPiece[0];
    // Only block if the king belongs to a non-eliminated player
    if (!state.eliminatedPlayers.includes(targetColor)) {
      return;
    }
  }

  // Apply atomic bitboard transition before board updates
  const fromIdx = startRow * 14 + startCol;
  const toIdx_ = targetRow * 14 + targetCol;
  applyBitboardTransition(state, fromIdx, toIdx_, pieceCode, playerColor);

  // Track if King or Rook has moved
  if (pieceType === "K") {
    state.hasMoved[`${playerColor}K` as keyof typeof state.hasMoved] = true;
  } else if (pieceType === "R") {
    const rookId = getRookIdentifier(playerColor, startRow, startCol);
    if (rookId) {
      state.hasMoved[rookId as keyof typeof state.hasMoved] = true;
    }
  }

  // Handle castling - move both King and Rook
  if (isCastling) {
    const kingTargetRow = targetRow;
    const kingTargetCol = targetCol;

    // Determine rook positions based on castling direction
    let rookStartRow: number, rookStartCol: number, rookTargetRow: number, rookTargetCol: number;

    if (playerColor === "r") {
      // Red - bottom row
      if (targetCol > startCol) {
        // Kingside castling
        rookStartRow = 13;
        rookStartCol = 10; // Right rook
        rookTargetRow = 13;
        rookTargetCol = 8;
      } else {
        // Queenside castling
        rookStartRow = 13;
        rookStartCol = 3; // Left rook
        rookTargetRow = 13;
        rookTargetCol = 6;
      }
    } else if (playerColor === "b") {
      // Blue - left column
      if (targetRow > startRow) {
        // Kingside castling (down)
        rookStartRow = 10;
        rookStartCol = 0; // Bottom rook at (10, 0)
        rookTargetRow = 8; // Rook moves to (8, 0)
        rookTargetCol = 0;
      } else {
        // Queenside castling (up)
        rookStartRow = 3;
        rookStartCol = 0; // Top rook at (3, 0)
        rookTargetRow = 6; // Rook moves to (6, 0)
        rookTargetCol = 0;
      }
    } else if (playerColor === "y") {
      // Yellow - top row
      if (targetCol > startCol) {
        // Kingside castling (right) - King moves from (0,6) to (0,8)
        rookStartRow = 0;
        rookStartCol = 10; // Right rook at (0, 10)
        rookTargetRow = 0;
        rookTargetCol = 7; // Rook moves to (0, 7)
      } else {
        // Queenside castling (left) - King moves from (0,6) to (0,4)
        rookStartRow = 0;
        rookStartCol = 3; // Left rook at (0, 3)
        rookTargetRow = 0;
        rookTargetCol = 5; // Rook moves to (0, 5)
      }
    } else if (playerColor === "g") {
      // Green - right column
      if (targetRow > startRow) {
        // Kingside castling (down) - King moves from (6,13) to (8,13)
        rookStartRow = 10;
        rookStartCol = 13; // Bottom rook at (10, 13)
        rookTargetRow = 7; // Rook moves to (7, 13)
        rookTargetCol = 13;
      } else {
        // Queenside castling (up) - King moves from (6,13) to (4,13)
        rookStartRow = 3;
        rookStartCol = 13; // Top rook at (3, 13)
        rookTargetRow = 5; // Rook moves to (5, 13)
        rookTargetCol = 13;
      }
    } else {
      // Default fallback (should not happen)
      rookStartRow = 0;
      rookStartCol = 0;
      rookTargetRow = 0;
      rookTargetCol = 0;
    }

    // Move the rook
    const rookCoords = getRookCastlingCoords(playerColor, {
      row: kingTargetRow,
      col: kingTargetCol,
    });
    if (rookCoords) {
      rookStartRow = rookCoords.rookFrom.row;
      rookStartCol = rookCoords.rookFrom.col;
      rookTargetRow = rookCoords.rookTo.row;
      rookTargetCol = rookCoords.rookTo.col;
    }

    // ✅ BITBOARD ONLY: No array board update needed
    const rookFromIdx = rookStartRow! * 14 + rookStartCol!;
    const rookToIdx = rookTargetRow! * 14 + rookTargetCol!;
    const rookMask = squareBit(rookFromIdx) | squareBit(rookToIdx);
    state.bitboardState.pieces[`${playerColor}R`] ^= rookMask;
    state.bitboardState.allPieces ^= rookMask;
    state.bitboardState.occupancy ^= rookMask;
    state.bitboardState[playerColor as "r" | "b" | "y" | "g"] ^= rookMask;

    // Mark the rook as moved
    const rookId = getRookIdentifier(playerColor, rookStartRow!, rookStartCol!);
    if (rookId) {
      state.hasMoved[rookId as keyof typeof state.hasMoved] = true;
    }
  }

  // Handle en passant capture
  if (isEnPassant && enPassantTarget) {
    const createdByColor = enPassantTarget.createdBy.charAt(0);
    const { row: skippedRow, col: skippedCol } = enPassantTarget.position;

    // Calculate captured pawn position based on movement direction
    const capturedPos = (() => {
      switch (createdByColor) {
        case "r":
          return { row: skippedRow - 1, col: skippedCol };
        case "y":
          return { row: skippedRow + 1, col: skippedCol };
        case "b":
          return { row: skippedRow, col: skippedCol + 1 };
        case "g":
          return { row: skippedRow, col: skippedCol - 1 };
        default:
          throw new Error(`Invalid piece color: ${createdByColor}`);
      }
    })();

    // Remove captured pawn and update score
    // ✅ Read from bitboards, not array
    const capturedPawn = getPieceAtFromBitboard(state.bitboardState.pieces, capturedPos.row, capturedPos.col);
    if (capturedPawn) {
      // ✅ BITBOARD ONLY: No array board update needed
      const victimIdx = capturedPos.row * 14 + capturedPos.col;
      const victimMask = squareBit(victimIdx);
      state.bitboardState.pieces[capturedPawn] ^= victimMask;
      state.bitboardState[
        capturedPawn[0] as "r" | "b" | "y" | "g"
      ] ^= victimMask;
      state.bitboardState.allPieces ^= victimMask;
      state.bitboardState.occupancy ^= victimMask;
      if (!state.capturedPieces[playerColor as keyof typeof state.capturedPieces]) {
        state.capturedPieces[playerColor as keyof typeof state.capturedPieces] = [];
      }
      state.capturedPieces[playerColor as keyof typeof state.capturedPieces].push(capturedPawn);
      state.scores[playerColor as keyof typeof state.scores] += 1;
    }
  }

  // Handle regular capture (only for non-castling moves and non-en passant captures)
  if (capturedPiece && !isCastling && !isEnPassant) {
    const capturedColor = capturedPiece[0];

    // Skip if the "captured" piece belongs to an eliminated player (just visual)
    if (!state.eliminatedPlayers.includes(capturedColor)) {
      // Prevent king capture - kings cannot be captured
      if (capturedPiece[1] === "K") {
        return; // Don't make the move if trying to capture a king
      }

      const capturingPlayer = playerColor;
      if (!state.capturedPieces[capturingPlayer as keyof typeof state.capturedPieces]) {
        state.capturedPieces[capturingPlayer as keyof typeof state.capturedPieces] = [];
      }
      state.capturedPieces[capturingPlayer as keyof typeof state.capturedPieces].push(capturedPiece);

      // Add points for captured piece
      const capturedPieceType = capturedPiece[1];
      const points = PIECE_VALUES[capturedPieceType as keyof typeof PIECE_VALUES] || 0;
      state.scores[capturingPlayer as keyof typeof state.scores] += points;
    }
    // Note: Moving onto eliminated piece's square - bitboard handles this automatically
  }

  // ✅ BITBOARD ONLY: The piece move is already handled by applyBitboardTransition
  // No array board update needed - board is derived from bitboards for UI

  // Track en passant targets for one full round
  if (pieceType === "P") {
    const isTwoSquareMove =
      (Math.abs(targetRow - startRow) === 2 && targetCol === startCol) ||
      (Math.abs(targetCol - startCol) === 2 && targetRow === startRow);

    if (isTwoSquareMove) {
      const skippedSquare = (() => {
        switch (playerColor) {
          case "r":
            return { row: targetRow + 1, col: targetCol };
          case "y":
            return { row: targetRow - 1, col: targetCol };
          case "b":
            return { row: targetRow, col: targetCol - 1 };
          case "g":
            return { row: targetRow, col: targetCol + 1 };
          default:
            throw new Error(`Invalid piece color: ${playerColor}`);
        }
      })();

      state.enPassantTargets.push({
        position: skippedSquare,
        createdBy: pieceCode,
        createdByTurn: state.currentPlayerTurn,
      });
    }
  }

  // Rebuild the bitboard en passant mask from all valid targets
  rebuildEnPassantMask(state);

  // Re-calculate all Attack Maps for the new state
  refreshAllAttackMaps(state);

  // Clear selection
  state.selectedPiece = null;
  state.validMoves = [];

  // Update check status for all players
  const newCheckStatus = updateAllCheckStatus(state);

  state.checkStatus = newCheckStatus;

  // Check if the current player is in check after their move
  const currentPlayerInCheck =
    state.checkStatus[state.currentPlayerTurn as keyof typeof state.checkStatus];

  if (currentPlayerInCheck) {
    // The current player is in check after their move - this is illegal
    // Revert the move - ✅ BITBOARD ONLY: board derived from bitboards
    state.bitboardState = prevState.bitboardState;
    state.hasMoved = prevState.hasMoved;
    state.enPassantTargets = prevState.enPassantTargets;
    state.capturedPieces = prevState.capturedPieces;
    state.scores = prevState.scores;
    state.checkStatus = prevState.checkStatus;
    state.gameStatus = prevState.gameStatus;
    state.selectedPiece = { row: startRow, col: startCol };
    state.validMoves = getValidMoves(
      pieceCode,
      { row: startRow, col: startCol },
      state,
      state.eliminatedPlayers,
      state.hasMoved,
      state.enPassantTargets
    );
    return; // Don't advance the turn
  }

  // If this move triggers promotion, defer turn advance and mate checks
  if (isPromotion) {
    return;
  }

  // Check if any opponent is in checkmate/stalemate after this move
  // We need to check all other players, not just the next one
  const currentPlayer = state.currentPlayerTurn;
  const otherPlayers = TURN_ORDER.filter(
    (player) =>
      player !== currentPlayer &&
      !state.eliminatedPlayers.includes(player)
  );

  // Check each opponent for checkmate/stalemate
  for (const opponent of otherPlayers) {
    const opponentHasMoves = hasAnyLegalMoves(opponent, state);

    if (!opponentHasMoves) {
      // This opponent has no legal moves
      const isInCheck = isKingInCheck(opponent, state);

      if (state.teamMode) {
        const status = isInCheck ? "checkmate" : "stalemate";
        endTeamGame(state, opponent as ClockColor, status, Date.now());
        return;
      }

      if (isInCheck) {
        // Checkmate - eliminate the player
        state.gameStatus = "checkmate";
        state.eliminatedPlayers.push(opponent);
        cleanupEliminatedPlayer(state, opponent);
        state.justEliminated = opponent;
        state.scores[state.currentPlayerTurn as keyof typeof state.scores] += GAME_BONUSES.CHECKMATE;

        // Set game over state for checkmate
        state.gameOverState = {
          isGameOver: true,
          status: "checkmate",
          eliminatedPlayer: opponent,
        };
      } else {
        // Stalemate - eliminate the player
        state.gameStatus = "stalemate";
        state.eliminatedPlayers.push(opponent);
        cleanupEliminatedPlayer(state, opponent);
        state.justEliminated = opponent;

        // Award points for stalemating opponent: +10 for each player still in game
        const remainingPlayers = TURN_ORDER.filter(
          (player) => !state.eliminatedPlayers.includes(player)
        );
        const stalematePoints = remainingPlayers.length * GAME_BONUSES.STALEMATE_PER_PLAYER;
        state.scores[state.currentPlayerTurn as keyof typeof state.scores] += stalematePoints;

        // Set game over state for stalemate
        state.gameOverState = {
          isGameOver: true,
          status: "stalemate",
          eliminatedPlayer: opponent,
        };
      }
      break; // Exit the loop after eliminating one player
    }
  }

  // Always advance to next player after a move
  // ✅ CRITICAL FIX: Use the player who made the move (not the eliminated player) for turn advancement
  const playerWhoMoved = state.currentPlayerTurn;
  const currentIndex = TURN_ORDER.indexOf(playerWhoMoved as any);
  const nextIndex = (currentIndex + 1) % TURN_ORDER.length;
  const nextPlayerInSequence = TURN_ORDER[nextIndex];

  // Find the next active player (skip eliminated players)
  let nextActivePlayer = nextPlayerInSequence;
  while (state.eliminatedPlayers.includes(nextActivePlayer)) {
    const activeIndex = TURN_ORDER.indexOf(nextActivePlayer as any);
    const nextActiveIndex = (activeIndex + 1) % TURN_ORDER.length;
    nextActivePlayer = TURN_ORDER[nextActiveIndex];
  }

  state.currentPlayerTurn = nextActivePlayer;
  state.enPassantTargets = state.enPassantTargets.filter(
    (target) => target.createdByTurn !== state.currentPlayerTurn
  );
  rebuildEnPassantMask(state);
  state.bitboardState.pinnedMask = getPinnedPiecesMask(
    state,
    state.currentPlayerTurn
  );

  // Check if the next player has any legal moves
  if (!state.teamMode && !state.gameOverState.isGameOver) {
    const nextPlayer = state.currentPlayerTurn;
    const nextPlayerHasMoves = hasAnyLegalMoves(nextPlayer, state);

    if (!nextPlayerHasMoves) {
      const isInCheck = isKingInCheck(nextPlayer, state);

      if (isInCheck) {
        state.gameStatus = "checkmate";
        state.eliminatedPlayers.push(nextPlayer);
        cleanupEliminatedPlayer(state, nextPlayer);
      } else {
        state.gameStatus = "stalemate";
        state.eliminatedPlayers.push(nextPlayer);
        cleanupEliminatedPlayer(state, nextPlayer);
      }
    }
  }

  if (!state.teamMode) {
    // Check if the entire game is over
    if (state.eliminatedPlayers.length === 3) {
      // Find the one player who is NOT in the eliminatedPlayers array
      const winner = TURN_ORDER.find(
        (player) => !state.eliminatedPlayers.includes(player)
      );

      if (winner) {
        state.winner = winner;
        state.gameStatus = "finished";
        state.gameOverState = {
          isGameOver: true,
          status: "finished",
          eliminatedPlayer: null,
        };
      }

      // Clear justEliminated flag after a delay to allow UI to react
      // We'll clear it in the next move instead
    } else {
      // ✅ CRITICAL FIX: Reset game status to active after elimination (unless game is finished)
      // This allows the game to continue with remaining players
      state.gameStatus = "active";
    }
  }
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setSelectedPiece: (state, action: PayloadAction<Position | null>) => {
      state.selectedPiece = action.payload;
    },
    setBotPlayers: (state, action: PayloadAction<string[]>) => {
      state.botPlayers = action.payload;
    },
    setBotDifficulty: (
      state,
      action: PayloadAction<BotDifficulty>
    ) => {
      state.botDifficulty = action.payload;
    },
    setBotTeamMode: (state, action: PayloadAction<boolean>) => {
      state.botTeamMode = action.payload;
    },
    setTeamConfig: (
      state,
      action: PayloadAction<{
        teamMode: boolean;
        teamAssignments: GameState["teamAssignments"];
      }>
    ) => {
      state.teamMode = action.payload.teamMode;
      state.teamAssignments = { ...action.payload.teamAssignments };
      state.winningTeam = null;
    },
    setTimeControl: (
      state,
      action: PayloadAction<{ baseMs: number; incrementMs: number }>
    ) => {
      state.timeControl = {
        baseMs: action.payload.baseMs,
        incrementMs: action.payload.incrementMs,
      };
      state.clocks = {
        r: action.payload.baseMs,
        b: action.payload.baseMs,
        y: action.payload.baseMs,
        g: action.payload.baseMs,
      };
      state.turnStartedAt = null;
    },
    setValidMoves: (state, action: PayloadAction<MoveInfo[]>) => {
      state.validMoves = action.payload;
    },
    deselectPiece: (state) => {
      // OPTIMIZATION: Removed console.log for better performance
      state.selectedPiece = null;
      state.validMoves = [];
    },
    // Premove actions for online play
    setPremove: (state, action: PayloadAction<{ from: Position; to: Position; pieceCode: string }>) => {
      // Only allow premove in online mode
      if (state.gameMode !== "online") return;
      state.premove = action.payload;
      // Clear selection after setting premove
      state.selectedPiece = null;
      state.validMoves = [];
    },
    clearPremove: (state) => {
      state.premove = null;
    },
    selectPiece: (state, action: PayloadAction<Position>) => {
      // OPTIMIZATION: Removed console.log statements for better performance

      // Don't allow piece selection when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return; // OPTIMIZATION: Removed console.log
      }

      const { row, col } = action.payload;
      // ✅ BITBOARD ONLY: Read from bitboards
      const pieceCode = getPieceAtFromBitboard(state.bitboardState.pieces, row, col);
      // OPTIMIZATION: Removed console.log for better performance

      // Check if clicking the same piece that's already selected - deselect it
      if (
        state.selectedPiece &&
        state.selectedPiece.row === row &&
        state.selectedPiece.col === col
      ) {
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      // Check if the piece belongs to an eliminated player
      const pieceColor = pieceCode?.charAt(0);
      if (!pieceCode || (pieceColor && state.eliminatedPlayers.includes(pieceColor))) {
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      // In online mode, allow selecting pieces for premove even when not your turn
      // In other modes, only allow selecting current player's pieces
      if (state.gameMode !== "online" && pieceColor !== state.currentPlayerTurn) {
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      const movesBB = getValidMovesBB(pieceCode, action.payload, state);
      state.validMoves = bitboardToMoveInfo(
        movesBB,
        pieceCode[0],
        pieceCode[1],
        state
      );
      state.selectedPiece = action.payload;

      // Clear any existing premove when selecting a new piece
      if (state.gameMode === "online") {
        state.premove = null;
      }

    },
    makeMove: (state, action: PayloadAction<MovePayload>) => {
      // Don't allow moves when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      // Store the current justEliminated flag before processing the move
      const previousJustEliminated = state.justEliminated;

      // Clear move cache when board state changes
      state.moveCache = {};

      const { from, to, isPromotion } = action.payload;
      const { row: startRow, col: startCol } = from;
      const { row: targetRow, col: targetCol } = to;

      // ✅ BITBOARD ONLY: Read from bitboards
      const pieceToMove = getPieceAtFromBitboard(state.bitboardState.pieces, startRow, startCol);

      if (!pieceToMove) return;

      // Check if en passant opportunities should expire
      // Remove targets that were created by the current player (full round has passed)
      state.enPassantTargets = state.enPassantTargets.filter(
        (target) => target.createdByTurn !== state.currentPlayerTurn
      );

      // ✅ BITBOARD ONLY: Read from bitboards
      const capturedPiece = getPieceAtFromBitboard(state.bitboardState.pieces, targetRow, targetCol);
      const pieceColor = pieceToMove.charAt(0);
      const pieceType = pieceToMove[1];

      // Enforce player turn - only current player can make moves
      if (
        state.gameMode !== "solo" &&
        state.gameMode !== "p2p" &&
        state.gameMode !== "online" &&
        pieceColor !== state.currentPlayerTurn
      ) {
        return; // Don't make the move
      }

      // For P2P mode, validate turn and send move through P2P service
      if (state.gameMode === "p2p") {
        if (pieceColor !== state.currentPlayerTurn) {
          return; // Don't make the move
        }

        // Import the P2P service dynamically to avoid circular imports
        const p2pGameService = require("../services/p2pGameService").default;
        const moveData = {
          from: { row: startRow, col: startCol },
          to: { row: targetRow, col: targetCol },
          pieceCode: pieceToMove,
          playerColor: pieceColor,
        };

        // Send move through P2P service (this will handle validation and synchronization)
        p2pGameService.makeMove(moveData).catch((error: any) => {
          console.error("P2P move failed:", error);
        });

        // Don't apply the move locally - let the P2P service handle it
        return;
      }

      const now = Date.now();
      const moverColor = pieceColor as ClockColor;
      const shouldTrackClock = state.gameMode !== "solo" && state.gameMode !== "single";
      if (shouldTrackClock) {
        const remainingMs = applyElapsedToClock(state, moverColor, now);
        if (remainingMs <= 0) {
          applyTimeoutLogic(state, moverColor, now);
          return;
        }
      }

      // ✅ Gather all information about the move
      const isCastling = isCastlingMove(pieceToMove, startRow, startCol, targetRow, targetCol);
      const enPassantTarget = state.enPassantTargets.find(
        (target) =>
          target.position.row === targetRow &&
          target.position.col === targetCol &&
          pieceType === "P" &&
          pieceToMove !== target.createdBy
      );

      // ✅ Call the core logic function
      _applyMoveLogic(state, {
        from,
        to,
        pieceCode: pieceToMove,
        playerColor: pieceColor,
        capturedPiece,
        isCastling,
        isEnPassant: !!enPassantTarget,
        isPromotion,
        enPassantTarget,
      });

      if (shouldTrackClock && state.timeControl.incrementMs > 0) {
        state.clocks[moverColor] = Math.max(
          0,
          state.clocks[moverColor] + state.timeControl.incrementMs
        );
      }

      // ✅ CRITICAL FIX: Clear justEliminated flag only if no elimination occurred in this move
      // This prevents the flag from being cleared immediately when an elimination happens
      if (state.justEliminated === previousJustEliminated) {
        state.justEliminated = null;
      }

      // Cancel any pending bot thinking notifications since a move was made
      try {
        const notificationService = require('../services/notificationService').default;
        notificationService.clearByPattern('is thinking hard');
      } catch (error) {
        // Ignore notification service errors
      }

      // ✅ Update the lastMove and history (this is unique to making a new move)
      state.lastMove = {
        from: { row: startRow, col: startCol },
        to: { row: targetRow, col: targetCol },
        pieceCode: pieceToMove,
        playerColor: pieceColor,
        timestamp: now,
        capturedPiece: capturedPiece,
      };

      if (isPromotion) {
        // Pause the game for promotion selection
        state.promotionState = {
          isAwaiting: true,
          position: { row: targetRow, col: targetCol },
          color: pieceColor,
        };
        state.gameStatus = "promotion";
        // Don't advance the turn yet - wait for promotion completion
      }

      finalizeTurnStart(state, now);

      // Save current state to history (only if not in promotion mode)
      if (state.gameStatus !== "promotion") {
        // Remove any future history if we're not at the end
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }

        // Add current state to history
        state.history.push(createStateSnapshot(state));
        state.historyIndex = state.history.length - 1;
      }
    },
    resetGame: (state) => {
      // Preserve the current game mode and bot configuration before resetting
      const currentGameMode = state.gameMode;
      const currentBotPlayers = [...state.botPlayers]; // Create a copy to preserve
      const currentBotDifficulty = state.botDifficulty;

      // ✅ CRITICAL FIX: Completely clear all state properties first
      // Delete all existing properties to ensure no stale data persists
      Object.keys(state).forEach(key => {
        delete (state as any)[key];
      });

      // ✅ CRITICAL FIX: Assign the complete baseInitialState
      // This ensures ALL properties are properly reset
      Object.assign(state, {
        ...baseInitialState,
        // Re-sync bitboards from the authoritative initial board each reset
        bitboardState: syncBitboardsFromArray(initialBoardState),
        moveCache: {}, // Clear move cache
      });
      state.turnStartedAt = Date.now();

      // Recompute attack maps / check / pins after re-sync
      refreshAllAttackMaps(state);
      state.checkStatus = updateAllCheckStatus(state);
      state.bitboardState.pinnedMask = getPinnedPiecesMask(
        state,
        state.currentPlayerTurn
      );

      // Restore the game mode after reset
      state.gameMode = currentGameMode;
      state.botDifficulty = currentBotDifficulty;

      // Set bots based on game mode and preserve user configuration
      if (currentGameMode === "single") {
        // For single player mode, always use the default bot configuration (Red is human, others are bots)
        // This ensures that "Play Again" always maintains the 1 vs 3 bots setup
        state.botPlayers = ['b', 'y', 'g'];
      } else if (currentGameMode === "p2p" || currentGameMode === "online") {
        // ✅ CRITICAL FIX: For P2P and Online modes, start with no bots - they will be set by the lobby/host
        // This prevents stale bot configurations from previous games
        state.botPlayers = [];
      } else {
        state.botPlayers = []; // Other modes have no bots
      }

      // Initialize history as empty - no initial snapshot
      state.history = [];
      state.historyIndex = 0; // This should be 0 for the current state, not viewing history
      state.viewingHistoryIndex = null; // Start viewing live state

      // Ensure the board state is properly set
      state.boardState = initialBoardState.map((row) => [...row]);
      state.bitboardState = syncBitboardsFromArray(state.boardState);
      state.eliminatedPieceBitboards = createEmptyPieceBitboards(
        state.bitboardState.pieces
      );
      state.checkStatus = updateAllCheckStatus(state);
      state.bitboardState.pinnedMask = getPinnedPiecesMask(
        state,
        state.currentPlayerTurn
      );
    },
    clearGameOver: (state) => {
      state.gameOverState = {
        isGameOver: false,
        status: null,
        eliminatedPlayer: null,
      };
      // ✅ CRITICAL FIX: Also reset gameStatus to allow modal dismissal
      state.gameStatus = "active";
      state.winningTeam = null;
      finalizeTurnStart(state, Date.now());
    },
    completePromotion: (
      state,
      action: PayloadAction<{ pieceType: string }>
    ) => {
      if (state.promotionState.isAwaiting && state.promotionState.position) {
        const { pieceType } = action.payload;

        // ✅ Sound effects moved to UI layer (Board.tsx useEffect)

        const { row, col } = state.promotionState.position;
        const pieceColor = state.promotionState.color!;

        // ✅ BITBOARD ONLY: Replace the pawn with the selected piece
        const promotionBit = squareBit(row * 14 + col);
        state.bitboardState.pieces[`${pieceColor}P`] ^= promotionBit;
        state.bitboardState.pieces[`${pieceColor}${pieceType}`] |= promotionBit;
        // Note: Color occupancy doesn't change - just piece type changes
        refreshAllAttackMaps(state);

        // Clear promotion state
        state.promotionState = {
          isAwaiting: false,
          position: null,
          color: null,
        };
        state.gameStatus = "active";

        // Clear selection
        state.selectedPiece = null;
        state.validMoves = [];

        // Update check status for all players
        state.checkStatus = updateAllCheckStatus(state);

        // Advance to next active player (skip eliminated players)
        const currentIndex = turnOrder.indexOf(state.currentPlayerTurn as any);
        let nextIndex = (currentIndex + 1) % turnOrder.length;
        let nextPlayer = turnOrder[nextIndex];
        while (state.eliminatedPlayers.includes(nextPlayer)) {
          nextIndex = (nextIndex + 1) % turnOrder.length;
          nextPlayer = turnOrder[nextIndex];
        }
        state.currentPlayerTurn = nextPlayer;
        state.enPassantTargets = state.enPassantTargets.filter(
          (target) => target.createdByTurn !== state.currentPlayerTurn
        );
        rebuildEnPassantMask(state);
        state.bitboardState.pinnedMask = getPinnedPiecesMask(
          state,
          state.currentPlayerTurn
        );
        finalizeTurnStart(state, Date.now());
      }
    },
    stepHistory: (state, action: PayloadAction<"back" | "previous" | "forward">) => {
      console.log('stepHistory called:', {
        action: action.payload,
        currentViewingHistoryIndex: state.viewingHistoryIndex,
        historyLength: state.history.length
      });

      if (action.payload === "back") {
        // Start button: Always go to the first move (index 0) or back to live if already at first move
        if (state.viewingHistoryIndex === null) {
          // From live state: go to first move
          state.viewingHistoryIndex = 0;
          console.log('Started viewing history at first move (index 0)');
        } else {
          // From any other move: go to first move
          state.viewingHistoryIndex = 0;
          console.log('Went to first move from move:', state.viewingHistoryIndex);
        }
      } else if (action.payload === "previous" && state.viewingHistoryIndex === null) {
        // Go two steps back from live state (to the previous move)
        if (state.history.length > 0) {
          state.viewingHistoryIndex = state.history.length - 2;
          console.log('Stepped previous from live state to move:', state.viewingHistoryIndex);
        }
      } else if (action.payload === "previous" && state.viewingHistoryIndex !== null && state.viewingHistoryIndex > 0) {
        // Go one step back in history
        state.viewingHistoryIndex--;
        console.log('Stepped previous to index:', state.viewingHistoryIndex);
      } else if (action.payload === "forward" && state.viewingHistoryIndex !== null && state.viewingHistoryIndex < state.history.length - 1) {
        // Go one step forward in history
        state.viewingHistoryIndex++;
        console.log('Stepped forward to index:', state.viewingHistoryIndex);
      }

      console.log('Final viewingHistoryIndex:', state.viewingHistoryIndex);
    },
    returnToLive: (state) => {
      state.viewingHistoryIndex = null;
    },
    resignGame: (state, action: PayloadAction<string | undefined>) => {
      // Don't allow resigning when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      // Don't allow resigning if game is already over
      if (
        state.gameStatus === "finished" ||
        state.gameStatus === "checkmate" ||
        state.gameStatus === "stalemate"
      ) {
        return;
      }

      const now = Date.now();

      // Use provided player color or default to current player turn
      const currentPlayer = action.payload || state.currentPlayerTurn;
      console.log("resignGame reducer: action.payload:", action.payload, "currentPlayerTurn:", state.currentPlayerTurn, "final currentPlayer:", currentPlayer);

      if (state.teamMode && CLOCK_COLORS.includes(currentPlayer as ClockColor)) {
        endTeamGame(state, currentPlayer as ClockColor, "finished", now);
        // Save current state to history
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push(createStateSnapshot(state));
        state.historyIndex = state.history.length - 1;
        return;
      }

      // Add current player to eliminated players
      if (!state.eliminatedPlayers.includes(currentPlayer)) {
        state.eliminatedPlayers.push(currentPlayer);
        state.justEliminated = currentPlayer;
        cleanupEliminatedPlayer(state, currentPlayer);
      }

      // Clear selection
      state.selectedPiece = null;
      state.validMoves = [];

      // Update check status for all players
      state.checkStatus = updateAllCheckStatus(state);

      // Check if the entire game is over
      if (state.eliminatedPlayers.length === 3) {
        // Find the one player who is NOT in the eliminatedPlayers array
        const winner = turnOrder.find(
          (player) => !state.eliminatedPlayers.includes(player)
        );

        if (winner) {
          state.winner = winner;
          state.gameStatus = "finished";
          state.gameOverState = {
            isGameOver: true,
            status: "finished",
            eliminatedPlayer: null,
          };
        }
      } else {
        // Advance to next active player
        // ✅ CRITICAL FIX: Use the resigning player's color to calculate next turn
        const currentIndex = turnOrder.indexOf(currentPlayer as any);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        const nextPlayerInSequence = turnOrder[nextIndex];

        // Find the next active player (skip eliminated players)
        let nextActivePlayer = nextPlayerInSequence;
        while (state.eliminatedPlayers.includes(nextActivePlayer)) {
          const activeIndex = turnOrder.indexOf(nextActivePlayer as any);
          const nextActiveIndex = (activeIndex + 1) % turnOrder.length;
          nextActivePlayer = turnOrder[nextActiveIndex];
        }

        state.currentPlayerTurn = nextActivePlayer;
      }

      finalizeTurnStart(state, now);

      // Save current state to history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(createStateSnapshot(state));
      state.historyIndex = state.history.length - 1;
    },
    timeoutPlayer: (
      state,
      action: PayloadAction<{ playerColor: string; timestamp?: number }>
    ) => {
      const { playerColor, timestamp } = action.payload;
      const color = playerColor as ClockColor;
      if (!CLOCK_COLORS.includes(color)) {
        return;
      }
      const now = timestamp ?? Date.now();
      applyTimeoutLogic(state, color, now);
    },
    endGame: (state) => {
      // Don't allow ending game when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      // Don't allow ending game if game is already over
      if (
        state.gameStatus === "finished" ||
        state.gameStatus === "checkmate" ||
        state.gameStatus === "stalemate"
      ) {
        return;
      }

      // Clear selection
      state.selectedPiece = null;
      state.validMoves = [];

      // Find the player with the highest score
      const scores = state.scores;
      const players = ['r', 'b', 'y', 'g'] as const;
      let winner: string = players[0];
      let highestScore = scores[winner as keyof typeof scores];

      if (state.teamMode) {
        const teamScores: Record<TeamId, number> = { A: 0, B: 0 };
        CLOCK_COLORS.forEach((color) => {
          const teamId = getTeamForColor(state.teamAssignments, color);
          teamScores[teamId] += scores[color];
        });
        const winningTeam = teamScores.A >= teamScores.B ? "A" : "B";
        state.winningTeam = winningTeam;
        const winningColors = getTeamColors(state.teamAssignments, winningTeam);
        winner = winningColors[0] ?? players[0];
      } else {
        for (const player of players) {
          if (!state.eliminatedPlayers.includes(player) && scores[player] > highestScore) {
            winner = player;
            highestScore = scores[player];
          }
        }
      }

      // Set the winner and end the game
      state.winner = winner;
      state.gameStatus = "finished";
      state.gameOverState = {
        isGameOver: true,
        status: "finished",
        eliminatedPlayer: null,
      };
      state.turnStartedAt = null;

      // Save current state to history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(createStateSnapshot(state));
      state.historyIndex = state.history.length - 1;
    },
    applyNetworkMove: (
      state,
      action: PayloadAction<{
        from: { row: number; col: number };
        to: { row: number; col: number };
        pieceCode: string;
        playerColor: string;
        isEnPassant?: boolean;
        enPassantTarget?: EnPassantTarget | null; // ✅ Enhanced type safety
        timestamp?: number;
      }>
    ) => {
      // Store the current justEliminated flag before processing the move
      const previousJustEliminated = state.justEliminated;
      const now = action.payload.timestamp ?? Date.now();

      const { from, to, pieceCode, playerColor, isEnPassant = false, enPassantTarget } = action.payload;

      // ✅ Handle resignation messages
      if (pieceCode === "RESIGN") {
        if (state.teamMode && CLOCK_COLORS.includes(playerColor as ClockColor)) {
          endTeamGame(state, playerColor as ClockColor, "finished", now);
          if (state.historyIndex < state.history.length - 1) {
            state.history = state.history.slice(0, state.historyIndex + 1);
          }
          state.history.push(createStateSnapshot(state));
          state.historyIndex = state.history.length - 1;
          return;
        }
        // Add player to eliminated players
        if (!state.eliminatedPlayers.includes(playerColor)) {
          state.eliminatedPlayers.push(playerColor);
          state.justEliminated = playerColor;
        }

        // Clear selection
        state.selectedPiece = null;
        state.validMoves = [];

        // Update check status for all players
        state.checkStatus = updateAllCheckStatus(state);

        // Check if the entire game is over
        if (state.eliminatedPlayers.length === 3) {
          const turnOrder = ["r", "b", "y", "g"];
          const winner = turnOrder.find(
            (color) => !state.eliminatedPlayers.includes(color)
          );

          if (winner) {
            state.winner = winner;
            state.gameStatus = "finished";
            state.gameOverState = {
              isGameOver: true,
              status: "finished",
              eliminatedPlayer: null,
            };
          }
        } else {
          // Advance to next active player
          const turnOrder = ["r", "b", "y", "g"];
          const currentIndex = turnOrder.indexOf(playerColor);
          const nextIndex = (currentIndex + 1) % 4;
          const nextPlayerInSequence = turnOrder[nextIndex];

          // Find the next active player (skip eliminated players)
          let nextActivePlayer = nextPlayerInSequence;
          while (state.eliminatedPlayers.includes(nextActivePlayer)) {
            const activeIndex = turnOrder.indexOf(nextActivePlayer);
            const nextActiveIndex = (activeIndex + 1) % 4;
            nextActivePlayer = turnOrder[nextActiveIndex];
          }

          state.currentPlayerTurn = nextActivePlayer;
        }

        finalizeTurnStart(state, now);

        // Clear move cache when game state changes
        state.moveCache = {};

        // Save to history
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push(createStateSnapshot(state));
        state.historyIndex = state.history.length - 1;

        return; // Exit early for resignation
      }

      const moverColor = playerColor as ClockColor;
      const shouldTrackClock = state.gameMode !== "solo" && state.gameMode !== "single";
      if (shouldTrackClock) {
        const remainingMs = applyElapsedToClock(state, moverColor, now);
        if (remainingMs <= 0) {
          applyTimeoutLogic(state, moverColor, now);
          return;
        }
      }

      // ✅ Gather all information about the move
      const { row: fromRow, col: fromCol } = from;
      const { row: toRow, col: toCol } = to;
      // ✅ BITBOARD ONLY: Read from bitboards
      const capturedPiece = getPieceAtFromBitboard(state.bitboardState.pieces, toRow, toCol);

      // Check if trying to capture a king - prevent king capture (unless eliminated)
      if (capturedPiece && capturedPiece[1] === "K") {
        const capturedColor = capturedPiece[0];
        if (!state.eliminatedPlayers.includes(capturedColor)) {
          return; // Don't apply the move if trying to capture an active king
        }
      }

      const isCastling = isCastlingMove(pieceCode, fromRow, fromCol, toRow, toCol);

      // ✅ Call the same core logic function
      _applyMoveLogic(state, {
        from,
        to,
        pieceCode,
        playerColor,
        capturedPiece,
        isCastling,
        isEnPassant,
        enPassantTarget,
      });

      if (shouldTrackClock && state.timeControl.incrementMs > 0) {
        state.clocks[moverColor] = Math.max(
          0,
          state.clocks[moverColor] + state.timeControl.incrementMs
        );
      }

      // ✅ CRITICAL FIX: Clear justEliminated flag only if no elimination occurred in this move
      // This prevents the flag from being cleared immediately when an elimination happens
      if (state.justEliminated === previousJustEliminated) {
        state.justEliminated = null;
      }

      // Cancel any pending bot thinking notifications since a move was made
      try {
        const notificationService = require('../services/notificationService').default;
        notificationService.clearByPattern('is thinking hard');
      } catch (error) {
        // Ignore notification service errors
      }

      // ✅ Update lastMove and history
      state.lastMove = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        pieceCode,
        playerColor,
        timestamp: now,
        capturedPiece,
      };

      // ✅ Set game status to active when first move is made (network-specific)
      if ((state.gameMode === "p2p" || state.gameMode === "online") && state.gameStatus === "waiting") {
        state.gameStatus = "active";
      }

      finalizeTurnStart(state, now);

      // Save to history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(createStateSnapshot(state));
      state.historyIndex = state.history.length - 1;
    },
    syncGameState: (state, action: PayloadAction<GameState>) => {
      // Sync the entire game state from network (create new state object)
      const networkState = action.payload;
      const preservedPremove = state.premove; // Preserve local premove
      const mergedState = { ...state, ...networkState, premove: preservedPremove };
      ensureClockState(mergedState);
      if (!mergedState.eliminatedPieceBitboards) {
        mergedState.eliminatedPieceBitboards = deriveEliminatedPieceBitboardsFromBoard(
          mergedState.boardState,
          mergedState.eliminatedPlayers,
          mergedState.bitboardState.pieces
        );
      }
      refreshAllAttackMaps(mergedState);
      mergedState.checkStatus = updateAllCheckStatus(mergedState);
      mergedState.bitboardState.pinnedMask = getPinnedPiecesMask(
        mergedState,
        mergedState.currentPlayerTurn
      );
      return mergedState;
    },
    applyOnlineSnapshot: (
      state,
      action: PayloadAction<OnlineSnapshotPayload>
    ) => {
      const { gameState, lastMove, version } = action.payload;
      const preservedSelectedPiece = state.selectedPiece;
      const preservedValidMoves = state.validMoves;
      const preservedViewingHistoryIndex = state.viewingHistoryIndex;
      const preservedPremove = state.premove; // Preserve local premove
      // ✅ PERFORMANCE: Keep reference to existing history (no copy yet)
      const existingHistory = state.history || [];
      const existingHistoryIndex = state.historyIndex ?? 0;

      // Check if this is a new move by comparing lastMove (O(1) comparison)
      const currentLastMove = state.lastMove;
      const newLastMove = lastMove ?? gameState.lastMove ?? null;
      const isNewMove = newLastMove && (
        !currentLastMove ||
        currentLastMove.timestamp !== newLastMove.timestamp ||
        currentLastMove.from?.row !== newLastMove.from?.row ||
        currentLastMove.from?.col !== newLastMove.from?.col ||
        currentLastMove.to?.row !== newLastMove.to?.row ||
        currentLastMove.to?.col !== newLastMove.to?.col
      );

      // ✅ CRITICAL: Also check if board state changed (elimination, timeout, etc.)
      // Compare eliminated players count - if changed, board needs recalculation
      const eliminatedChanged = 
        (state.eliminatedPlayers?.length ?? 0) !== (gameState.eliminatedPlayers?.length ?? 0);
      
      // Check if turn changed without a move (can happen on timeout/resignation)
      const turnChangedWithoutMove = !isNewMove && state.currentPlayerTurn !== gameState.currentPlayerTurn;
      
      // Need recalculation if move, elimination, or turn change
      const needsRecalculation = isNewMove || eliminatedChanged || turnChangedWithoutMove;

      // Build merged state as a plain object (not Immer draft)
      const mergedState: GameState = {
        ...state,
        ...gameState,
        selectedPiece: preservedSelectedPiece,
        validMoves: preservedValidMoves,
        viewingHistoryIndex: preservedViewingHistoryIndex,
        premove: preservedPremove, // Premove is local-only, don't overwrite
        // ✅ PERFORMANCE: Reuse existing history reference (no copy on every sync)
        history: existingHistory,
        historyIndex: existingHistoryIndex,
        lastMove: newLastMove,
        version,
        gameMode: "online",
      };
      ensureClockState(mergedState);

      if (mergedState.bitboardState?.pieces) {
        mergedState.eliminatedPieceBitboards =
          mergedState.eliminatedPieceBitboards ??
          createEmptyPieceBitboards(mergedState.bitboardState.pieces);
      } else {
        // Fallback: rebuild bitboards from boardState when missing
        const syncedBitboards = syncBitboardsFromArray(
          mergedState.boardState,
          mergedState.eliminatedPlayers
        );
        mergedState.bitboardState = syncedBitboards;
        mergedState.eliminatedPieceBitboards = deriveEliminatedPieceBitboardsFromBoard(
          mergedState.boardState,
          mergedState.eliminatedPlayers,
          syncedBitboards.pieces
        );
      }

      // ✅ PERFORMANCE: Only recalculate expensive attack maps when board changes
      // On regular syncs (clock updates, presence), skip these O(n) operations
      if (needsRecalculation) {
        mergedState.moveCache = {};
        refreshAllAttackMaps(mergedState);
        mergedState.checkStatus = updateAllCheckStatus(mergedState);
        mergedState.bitboardState.pinnedMask = getPinnedPiecesMask(
          mergedState,
          mergedState.currentPlayerTurn
        );
      } else {
        // Preserve existing attack maps and check status when no board change
        mergedState.moveCache = state.moveCache ?? {};
        if (state.bitboardState?.attackMaps) {
          mergedState.bitboardState.attackMaps = state.bitboardState.attackMaps;
        }
        if (state.checkStatus) {
          mergedState.checkStatus = state.checkStatus;
        }
        if (state.bitboardState?.pinnedMask !== undefined) {
          mergedState.bitboardState.pinnedMask = state.bitboardState.pinnedMask;
        }
      }

      // ✅ PERFORMANCE: Only copy/modify history when a new move is detected
      if (isNewMove) {
        // Create new array only when adding a move (not on every sync)
        const baseHistory = existingHistoryIndex < existingHistory.length - 1
          ? existingHistory.slice(0, existingHistoryIndex + 1)
          : existingHistory;
        // Add current state to history
        mergedState.history = [...baseHistory, createStateSnapshot(mergedState)];
        mergedState.historyIndex = mergedState.history.length - 1;
      }

      return mergedState;
    },
    setGameState: (state, action: PayloadAction<GameState>) => {
      // Replace the entire game state (useful for syncing when game starts)
      const newState = action.payload;
      const preservedPremove = state.premove; // Preserve local premove

      // ✅ FIX: Copy payload properties to the Immer draft state first
      // This avoids mutating the frozen action.payload object
      Object.assign(state, newState);

      // Now we can safely mutate the draft state
      state.premove = preservedPremove;

      ensureClockState(state);
      if (!state.eliminatedPieceBitboards) {
        state.eliminatedPieceBitboards = deriveEliminatedPieceBitboardsFromBoard(
          state.boardState,
          state.eliminatedPlayers,
          state.bitboardState.pieces
        );
      }
      // Clear move cache when game state changes
      state.moveCache = {};

      // ✅ CRITICAL FIX: Recalculate check status when syncing from server
      refreshAllAttackMaps(state);
      const recalculatedCheckStatus = updateAllCheckStatus(state);
      state.checkStatus = recalculatedCheckStatus;
      state.bitboardState.pinnedMask = getPinnedPiecesMask(
        state,
        state.currentPlayerTurn
      );
      // Immer draft is mutated in place, no return needed
    },

    sendMoveToServer: (
      state,
      action: PayloadAction<{ row: number; col: number }>
    ) => {
      // Send move to server without applying locally (for multiplayer mode)
      if (!networkService.connected || !networkService.roomId) {
        return;
      }

      if (state.selectedPiece) {
        const { row: targetRow, col: targetCol } = action.payload;
        const { row: startRow, col: startCol } = state.selectedPiece;

        // ✅ BITBOARD ONLY: Read from bitboards
        const pieceToMove = getPieceAtFromBitboard(state.bitboardState.pieces, startRow, startCol);
        const pieceColor = pieceToMove?.charAt(0);

        // Enforce player turn - only current player can make moves
        if (pieceColor !== state.currentPlayerTurn) {
          return; // Don't send the move
        }

        const moveData = {
          from: { row: startRow, col: startCol },
          to: { row: targetRow, col: targetCol },
          pieceCode: pieceToMove!,
          playerColor: pieceColor!,
        };

        networkService.sendMove(moveData);
      }
    },
    // Multiplayer actions
    setPlayers: (state, action: PayloadAction<Player[]>) => {
      state.players = action.payload;
    },
    setIsHost: (state, action: PayloadAction<boolean>) => {
      state.isHost = action.payload;
    },
    setCanStartGame: (state, action: PayloadAction<boolean>) => {
      state.canStartGame = action.payload;
    },
    setGameMode: (
      state,
      action: PayloadAction<"solo" | "local" | "online" | "p2p" | "single">
    ) => {
      console.log(
        "setGameMode: Setting game mode from",
        state.gameMode,
        "to",
        action.payload,
        "call stack:",
        new Error().stack?.split('\n').slice(1, 4).join('\n')
      );
      state.gameMode = action.payload;
    },
    // P2P Lobby actions
    setCurrentGame: (state, action: PayloadAction<any>) => {
      state.currentGame = action.payload;
    },
    setDiscoveredGames: (state, action: PayloadAction<any[]>) => {
      state.discoveredGames = action.payload;
    },
    setIsDiscovering: (state, action: PayloadAction<boolean>) => {
      state.isDiscovering = action.payload;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setIsConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.connectionError = action.payload;
    },
    setIsEditingName: (state, action: PayloadAction<boolean>) => {
      state.isEditingName = action.payload;
    },
    setTempName: (state, action: PayloadAction<string>) => {
      state.tempName = action.payload;
    },
    // P2P Lobby state sync - only essential info
    syncP2PGameState: (state, action: PayloadAction<any>) => {
      const lobbyData = action.payload;

      if (lobbyData) {
        // Only update lobby-related state, not the entire game state
        if (lobbyData.currentGame) {
          state.currentGame = lobbyData.currentGame;
        }
        if (lobbyData.players) {
          state.players = lobbyData.players;
        }
        if (typeof lobbyData.isHost === 'boolean') {
          state.isHost = lobbyData.isHost;
        }
        if (typeof lobbyData.canStartGame === 'boolean') {
          state.canStartGame = lobbyData.canStartGame;
        }
      } else {
        // Clear lobby state
        state.currentGame = null;
        state.players = [];
        state.isHost = false;
        state.canStartGame = false;
      }
    },

    // Clear the justEliminated flag (used after notification is shown)
    clearJustEliminated: (state) => {
      state.justEliminated = null;
    },
  },
});

export const {
  setSelectedPiece,
  setValidMoves,
  deselectPiece,
  setPremove,
  clearPremove,
  selectPiece,
  makeMove,
  completePromotion,
  resetGame,
  clearGameOver,
  stepHistory,
  returnToLive,
  resignGame,
  timeoutPlayer,
  endGame,
  applyNetworkMove,
  syncGameState,
  applyOnlineSnapshot,
  setGameState,
  sendMoveToServer,
  setPlayers,
  setIsHost,
  setCanStartGame,
  setGameMode,
  setBotPlayers,
  setBotDifficulty,
  setBotTeamMode,
  setTeamConfig,
  setTimeControl,
  // P2P Lobby actions
  setCurrentGame,
  setDiscoveredGames,
  setIsDiscovering,
  setIsLoading,
  setIsConnected,
  setConnectionError,
  setIsEditingName,
  setTempName,
  syncP2PGameState,
  clearJustEliminated,
} = gameSlice.actions;

// Selectors are now in ./gameSelectors.ts (re-exported at top of this file)

export default gameSlice.reducer;
