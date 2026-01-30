// services/botService.ts

import { store } from '../state/store';
import { makeMove, completePromotion, resignGame } from '../state/gameSlice';
import { bitboardToMoveInfo, getValidMovesBB, isValidMove } from "../src/logic/moveGeneration";
import { generateAttackMap, getPinnedPiecesMask } from "../src/logic/bitboardLogic";
import { bitScanForward, squareBit, getPieceAtFromBitboard } from "../src/logic/bitboardUtils";
import { EnPassantTarget, GameState, Position } from '../state/types';
import { getRookCastlingCoords, getRookIdentifier, isCastlingMove, updateAllCheckStatus } from '../state/gameHelpers';
import p2pGameService from './p2pGameService';
import { PIECE_VALUES, TURN_ORDER, getBotConfig } from '../config/gameConfig';
import { hasAnyLegalMoves } from "../src/logic/gameLogic";

// Global lock to prevent multiple bots from moving simultaneously
let botMoveInProgress = false;

// ========== DEBUG TIMING SYSTEM ==========
const DEBUG_TIMING = true; // Set to false to disable all timing logs
const debugTimers: Record<string, { total: number; count: number; max: number }> = {};

const resetDebugTimers = () => {
  Object.keys(debugTimers).forEach((key) => delete debugTimers[key]);
};

const startTimer = (): number => (DEBUG_TIMING ? Date.now() : 0);

const recordTime = (label: string, startTime: number) => {
  if (!DEBUG_TIMING) return;
  const elapsed = Date.now() - startTime;
  if (!debugTimers[label]) {
    debugTimers[label] = { total: 0, count: 0, max: 0 };
  }
  debugTimers[label].total += elapsed;
  debugTimers[label].count += 1;
  if (elapsed > debugTimers[label].max) {
    debugTimers[label].max = elapsed;
  }
};

const printDebugTimers = (botColor: string) => {
  if (!DEBUG_TIMING) return;
  console.log(`\n[DEBUG TIMING] ${botColor.toUpperCase()} breakdown:`);
  const sorted = Object.entries(debugTimers).sort((a, b) => b[1].total - a[1].total);
  for (const [label, stats] of sorted) {
    if (stats.total > 0) {
      console.log(
        `  ${label}: ${stats.total}ms total, ${stats.count} calls, avg ${(stats.total / stats.count).toFixed(1)}ms, max ${stats.max}ms`
      );
    }
  }
  console.log("");
};
// ========== END DEBUG TIMING SYSTEM ==========

// ✅ Using centralized piece values from gameConfig

export interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
  pieceCode?: string;
  capturedPieceCode?: string | null;
  isEnPassant?: boolean;
  isPromotion?: boolean;
  enPassantTarget?: EnPassantTarget | null;
}

const QUIESCENCE_MAX_DEPTH_DEFAULT = 2;
const NULL_MOVE_REDUCTION = 2;
const KING_SAFETY_VALUE = 30;
const KING_PAWN_SHIELD_BONUS = 0.5; // Bonus per pawn near king
const KING_ATTACKER_PENALTY = 1.5; // Penalty per attacker near king zone
const KING_IN_CHECK_PENALTY = 3; // Penalty for being in check
const PST_WEIGHT = 0.15; // Weight for piece-square table bonuses
const DELTA_PRUNING_BUFFER = 3;
const CAPTURE_EVAL_BONUS_FACTOR = 0.5;
const EARLY_GAME_PIECE_THRESHOLD = 48;
const QUEEN_EARLY_CAPTURE_PENALTY_FACTOR = 0.6;
const QUEEN_EARLY_TRADE_PENALTY = 3;
const HANGING_PENALTY_DEFENDED = 0.25;
const HANGING_PENALTY_UNDEFENDED = 0.8;
const HANGING_PAWN_MULTIPLIER = 0.5;
const CHECKMATE_SCORE = 200;
const QUIET_MOVE_LIMIT = 12;
const HANGING_PENALTY_FACTOR = 0.9;
const CENTER_WEIGHT = 0.4;
const KING_MOVE_PENALTY = 1.5;
const CHECK_MOVE_CANDIDATE_LIMIT = 8;
const CHECK_MOVE_PIECE_TYPES = new Set(["Q", "R", "B", "N"]);
const SEARCH_TIME_GUARD_MS = 500;
const KILLER_MOVE_SLOTS = 2;
const TT_MAX_SIZE = 50000;

type TTEntry = { depth: number; score: number; move: MoveOption | null };

const killerMovesByDepth: Record<number, string[]> = {};
const transpositionTable = new Map<bigint, TTEntry>();

// History Heuristic: Track which quiet moves have caused cutoffs
// Indexed by piece code (e.g., "rN") and destination square (0-195)
const historyTable: Record<string, number[]> = {};
const HISTORY_MAX = 10000;

const getHistoryScore = (pieceCode: string, toSquare: number): number => {
  return historyTable[pieceCode]?.[toSquare] ?? 0;
};

const updateHistoryScore = (pieceCode: string, toSquare: number, depth: number): void => {
  if (!historyTable[pieceCode]) {
    historyTable[pieceCode] = new Array(196).fill(0);
  }
  // Increase by depth^2 (deeper cutoffs are more valuable)
  historyTable[pieceCode][toSquare] += depth * depth;
  // Cap to prevent overflow
  if (historyTable[pieceCode][toSquare] > HISTORY_MAX) {
    // Age all history scores when we hit the cap
    Object.keys(historyTable).forEach((code) => {
      for (let i = 0; i < 196; i++) {
        historyTable[code][i] = Math.floor(historyTable[code][i] / 2);
      }
    });
  }
};

const clearHistoryTable = (): void => {
  Object.keys(historyTable).forEach((key) => {
    delete historyTable[key];
  });
};

const PIECE_CODES = [
  "rP",
  "rN",
  "rB",
  "rR",
  "rQ",
  "rK",
  "bP",
  "bN",
  "bB",
  "bR",
  "bQ",
  "bK",
  "yP",
  "yN",
  "yB",
  "yR",
  "yQ",
  "yK",
  "gP",
  "gN",
  "gB",
  "gR",
  "gQ",
  "gK",
];

const HAS_MOVED_KEYS = [
  "rK",
  "rR1",
  "rR2",
  "bK",
  "bR1",
  "bR2",
  "yK",
  "yR1",
  "yR2",
  "gK",
  "gR1",
  "gR2",
];

const PIECE_INDEX: Record<string, number> = PIECE_CODES.reduce(
  (acc, code, idx) => {
    acc[code] = idx;
    return acc;
  },
  {} as Record<string, number>
);

const mulberry32 = (seed: number) => () => {
  let t = (seed += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (t ^ (t >>> 14)) >>> 0;
};

const rand32 = mulberry32(0xc0ffee);
const random64 = () => (BigInt(rand32()) << 32n) | BigInt(rand32());

const ZOBRIST_TABLE: bigint[][] = Array.from({ length: 196 }, () =>
  PIECE_CODES.map(() => random64())
);
const ZOBRIST_TURN: bigint[] = TURN_ORDER.map(() => random64());
const ZOBRIST_HAS_MOVED: bigint[] = HAS_MOVED_KEYS.map(() => random64());
const ZOBRIST_ELIMINATED: bigint[] = TURN_ORDER.map(() => random64());
const ZOBRIST_EN_PASSANT: bigint[] = Array.from({ length: 196 }, () => random64());

const moveKey = (move: MoveOption): string => {
  const promo = move.isPromotion ? "p" : "";
  const ep = move.isEnPassant ? "e" : "";
  return `${move.from.row},${move.from.col}:${move.to.row},${move.to.col}${promo}${ep}`;
};

const buildPreferredMoveKeys = (
  preferredKey?: string,
  tableKey?: string,
  killerKeys?: string[]
): string[] => {
  const keys: string[] = [];
  const add = (key?: string) => {
    if (!key) return;
    if (!keys.includes(key)) keys.push(key);
  };
  add(preferredKey);
  add(tableKey);
  killerKeys?.forEach((key) => add(key));
  return keys;
};

const registerKillerMove = (depth: number, move: MoveOption) => {
  const key = moveKey(move);
  const list = killerMovesByDepth[depth] ?? [];
  if (list.includes(key)) return;
  list.unshift(key);
  if (list.length > KILLER_MOVE_SLOTS) {
    list.length = KILLER_MOVE_SLOTS;
  }
  killerMovesByDepth[depth] = list;
};

const getZobristHash = (state: GameState): bigint => {
  let hash = 0n;

  for (const [code, bb] of Object.entries(state.bitboardState.pieces)) {
    const idx = PIECE_INDEX[code];
    if (idx === undefined || bb === 0n) continue;
    let temp = bb;
    while (temp > 0n) {
      const sq = Number(bitScanForward(temp));
      hash ^= ZOBRIST_TABLE[sq][idx];
      temp &= temp - 1n;
    }
  }

  const turnIdx = TURN_ORDER.indexOf(
    state.currentPlayerTurn as (typeof TURN_ORDER)[number]
  );
  if (turnIdx >= 0) {
    hash ^= ZOBRIST_TURN[turnIdx];
  }

  HAS_MOVED_KEYS.forEach((key, idx) => {
    if (state.hasMoved[key as keyof typeof state.hasMoved]) {
      hash ^= ZOBRIST_HAS_MOVED[idx];
    }
  });

  TURN_ORDER.forEach((color, idx) => {
    if (state.eliminatedPlayers.includes(color)) {
      hash ^= ZOBRIST_ELIMINATED[idx];
    }
  });

  let ep = state.bitboardState.enPassantTarget;
  while (ep > 0n) {
    const sq = Number(bitScanForward(ep));
    hash ^= ZOBRIST_EN_PASSANT[sq];
    ep &= ep - 1n;
  }

  return hash;
};

const countSetBits = (bb: bigint): number => {
  let count = 0;
  let temp = bb;
  while (temp > 0n) {
    temp &= temp - 1n;
    count += 1;
  }
  return count;
};

const getNextPlayer = (currentPlayer: string, eliminatedPlayers: string[]): string => {
  const startIndex = TURN_ORDER.indexOf(currentPlayer as (typeof TURN_ORDER)[number]);
  let nextIndex = startIndex === -1 ? 0 : (startIndex + 1) % TURN_ORDER.length;
  let nextPlayer = TURN_ORDER[nextIndex];
  let safety = 0;

  while (eliminatedPlayers.includes(nextPlayer) && safety < TURN_ORDER.length) {
    nextIndex = (nextIndex + 1) % TURN_ORDER.length;
    nextPlayer = TURN_ORDER[nextIndex];
    safety += 1;
  }

  return nextPlayer;
};

// Build a square-to-piece lookup table for O(1) access
// Returns array of 196 elements, each is pieceCode or null
const buildPieceLookup = (pieces: Record<string, bigint>): (string | null)[] => {
  const lookup: (string | null)[] = new Array(196).fill(null);
  for (const [code, bb] of Object.entries(pieces)) {
    if (bb === 0n) continue;
    let temp = bb;
    while (temp !== 0n) {
      const idx = Number(bitScanForward(temp));
      lookup[idx] = code;
      temp &= temp - 1n; // Clear lowest bit
    }
  }
  return lookup;
};

// O(1) lookup using prebuilt table - use when you have the lookup table
const getPieceCodeAtFast = (lookup: (string | null)[], idx: number): string | null => {
  return lookup[idx] ?? null;
};

// O(24) fallback - iterates through piece bitboards (use sparingly)
const getPieceCodeAt = (pieces: Record<string, bigint>, mask: bigint): string | null => {
  if (mask === 0n) return null;
  for (const [code, bb] of Object.entries(pieces)) {
    if ((bb & mask) !== 0n) {
      return code;
    }
  }
  return null;
};

// Game Phase Detection
// 4-player chess starts with 64 pieces (16 per player)
type GamePhase = "opening" | "middlegame" | "endgame";

const getGamePhase = (totalPieces: number): GamePhase => {
  if (totalPieces >= 48) return "opening";      // 75%+ pieces remain
  if (totalPieces >= 24) return "middlegame";   // 37-75% pieces remain
  return "endgame";                              // <37% pieces remain
};

// Piece-Square Tables: Positional bonuses based on piece location
// For 14x14 4-player board, we use center-distance based scoring
const CENTER_ROW = 6.5;
const CENTER_COL = 6.5;

// Get distance from center (0 = center, higher = edge)
const getCenterDistance = (row: number, col: number): number => {
  return Math.abs(row - CENTER_ROW) + Math.abs(col - CENTER_COL);
};

// Piece-specific positional bonuses
const getPieceSquareBonus = (
  pieceType: string,
  color: string,
  row: number,
  col: number,
  gamePhase: GamePhase
): number => {
  const centerDist = getCenterDistance(row, col);
  const maxDist = 13; // Max possible distance from center
  const centralityScore = (maxDist - centerDist) / maxDist; // 0-1, higher = more central

  switch (pieceType) {
    case "N": // Knights love the center - more squares to attack
      return centralityScore * 3;

    case "B": // Bishops prefer center for diagonal control
      return centralityScore * 2;

    case "R": // Rooks are neutral - open files matter more than position
      return 0;

    case "Q": {
      // Queens: careful in opening, more active later
      if (gamePhase === "opening") {
        return centralityScore * 0.5; // Don't develop queen too aggressively
      }
      return centralityScore * 1.5;
    }

    case "P": {
      // Pawns prefer advancing toward enemy territory
      // Each color has a different "forward" direction
      let advanceBonus = 0;
      switch (color) {
        case "r": advanceBonus = (13 - row) / 13; break; // Red advances up (lower row)
        case "y": advanceBonus = row / 13; break;        // Yellow advances down
        case "b": advanceBonus = col / 13; break;        // Blue advances right
        case "g": advanceBonus = (13 - col) / 13; break; // Green advances left
      }
      // Also slight center preference for pawn control
      return advanceBonus * 1.5 + centralityScore * 0.5;
    }

    case "K": {
      switch (gamePhase) {
        case "opening":
          // Opening: king should stay very safe (edges/corners)
          return -centralityScore * 3;
        case "middlegame":
          // Middlegame: still prefer safety but can be slightly flexible
          return -centralityScore * 2;
        case "endgame":
          // Endgame: king becomes active, should go to center
          return centralityScore * 2;
      }
    }

    default:
      return 0;
  }
};

// Calculate total PST bonus for a color
const getPSTScore = (
  pieces: Record<string, bigint>,
  color: string,
  gamePhase: GamePhase
): number => {
  let score = 0;
  const pieceTypes = ["P", "N", "B", "R", "Q", "K"];

  for (const type of pieceTypes) {
    let bb = pieces[`${color}${type}`] ?? 0n;
    while (bb > 0n) {
      const sq = Number(bitScanForward(bb));
      const row = Math.floor(sq / 14);
      const col = sq % 14;
      score += getPieceSquareBonus(type, color, row, col, gamePhase);
      bb &= bb - 1n;
    }
  }

  return score * PST_WEIGHT;
};

// King Safety: Evaluate how safe the king is
// Behavior varies by game phase
const getKingSafetyScore = (
  gameState: GameState,
  color: string,
  gamePhase: GamePhase
): number => {
  const pieces = gameState.bitboardState.pieces;
  const kingBB = pieces[`${color}K`] ?? 0n;
  if (kingBB === 0n) return 0;

  const kingSq = Number(bitScanForward(kingBB));
  const kingRow = Math.floor(kingSq / 14);
  const kingCol = kingSq % 14;

  let safetyScore = 0;

  // Check Penalty applies in ALL phases - being in check is always bad
  if (gameState.checkStatus[color as keyof typeof gameState.checkStatus]) {
    safetyScore -= KING_IN_CHECK_PENALTY;
  }

  // In endgame, only check penalty matters - king should be active
  if (gamePhase === "endgame") {
    return safetyScore;
  }

  // Opening & Middlegame: Full king safety evaluation
  const pawnShieldWeight = gamePhase === "opening" ? 1.0 : 0.7;
  const attackerWeight = gamePhase === "opening" ? 1.0 : 0.8;

  // 1. Pawn Shield: Count friendly pawns near the king
  const pawnBB = pieces[`${color}P`] ?? 0n;
  let pawnShieldCount = 0;
  for (let dr = -2; dr <= 2; dr++) {
    for (let dc = -2; dc <= 2; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = kingRow + dr;
      const c = kingCol + dc;
      if (r < 0 || r >= 14 || c < 0 || c >= 14) continue;
      const sqMask = squareBit(r * 14 + c);
      if ((pawnBB & sqMask) !== 0n) {
        pawnShieldCount++;
      }
    }
  }
  safetyScore += pawnShieldCount * KING_PAWN_SHIELD_BONUS * pawnShieldWeight;

  // 2. Enemy Attackers: Penalize if enemies attack squares near king
  const enemyColors = TURN_ORDER.filter(
    (c) => c !== color && !gameState.eliminatedPlayers.includes(c)
  );
  let enemyAttacksNearKing = 0n;
  for (const enemy of enemyColors) {
    enemyAttacksNearKing |= gameState.bitboardState.attackMaps[enemy];
  }

  // Count enemy attacks in king zone (3x3 around king)
  let attackedSquares = 0;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      const r = kingRow + dr;
      const c = kingCol + dc;
      if (r < 0 || r >= 14 || c < 0 || c >= 14) continue;
      const sqMask = squareBit(r * 14 + c);
      if ((enemyAttacksNearKing & sqMask) !== 0n) {
        attackedSquares++;
      }
    }
  }
  safetyScore -= attackedSquares * KING_ATTACKER_PENALTY * attackerWeight;

  return safetyScore;
};

const evaluateBoard = (gameState: GameState): Record<string, number> => {
  const evalStart = startTimer();
  const scores = { r: 0, b: 0, y: 0, g: 0 };
  const pieces = gameState.bitboardState.pieces;

  // Count total pieces to determine game phase
  const totalPieces = countSetBits(
    gameState.bitboardState.occupancy ?? gameState.bitboardState.allPieces
  );
  const gamePhase = getGamePhase(totalPieces);

  Object.entries(pieces).forEach(([code, bb]) => {
    if (bb === 0n) return;
    const color = code[0] as keyof typeof scores;
    const type = code[1] as keyof typeof PIECE_VALUES;
    const value = PIECE_VALUES[type] || 0;
    scores[color] += countSetBits(bb) * value;
  });

  // Add Piece-Square Table bonuses and King Safety
  (['r', 'b', 'y', 'g'] as const).forEach((color) => {
    if (!gameState.eliminatedPlayers.includes(color)) {
      scores[color] += getPSTScore(pieces, color, gamePhase);
      scores[color] += getKingSafetyScore(gameState, color, gamePhase);
    }
  });

  (['r', 'b', 'y', 'g'] as const).forEach((color) => {
    const kingBB = pieces[`${color}K`];
    if (kingBB && kingBB !== 0n) {
      scores[color] += KING_SAFETY_VALUE;
    }
  });

  applyHangingPiecePenalty(gameState, scores);

  if (gameState.gameStatus === "checkmate") {
    const checkmatingPlayer = gameState.lastMove?.playerColor;
    if (
      checkmatingPlayer &&
      !gameState.eliminatedPlayers.includes(checkmatingPlayer)
    ) {
      scores[checkmatingPlayer as keyof typeof scores] += 20;
    }
  }

  (['r', 'b', 'y', 'g'] as const).forEach((color) => {
    if (!gameState.eliminatedPlayers.includes(color)) {
      scores[color] +=
        countSetBits(gameState.bitboardState.attackMaps[color]) * 0.1;
    }
  });

  recordTime("evaluateBoard", evalStart);
  return scores;
};

const getBotEvaluation = (
  gameState: GameState,
  botColor: string,
  movedPieceType?: string,
  movedPieceTarget?: { row: number; col: number }
): number => {
  const scores = evaluateBoard(gameState);

  // Team Mode: All bots cooperate against human players
  const isTeamMode = gameState.botTeamMode;
  const botPlayers = gameState.botPlayers || [];
  const humanPlayers = TURN_ORDER.filter((c) => !botPlayers.includes(c) && !gameState.eliminatedPlayers.includes(c));

  let evaluation: number;

  if (isTeamMode && botPlayers.includes(botColor)) {
    // Bot in team mode: maximize bot team score, minimize human score
    const botTeamScore = botPlayers
      .filter((c) => !gameState.eliminatedPlayers.includes(c))
      .reduce((sum, c) => sum + scores[c as keyof typeof scores], 0);
    const humanScore = humanPlayers.reduce((sum, c) => sum + scores[c as keyof typeof scores], 0);
    evaluation = botTeamScore - humanScore;
  } else {
    // Normal mode: each player for themselves
    const opponents = TURN_ORDER.filter((color) => color !== botColor);
    const opponentScore = opponents.reduce((sum, color) => sum + scores[color], 0);
    evaluation = scores[botColor as keyof typeof scores] - opponentScore;
  }

  const capturedPiece = gameState.lastMove?.capturedPiece;
  if (capturedPiece) {
    const capturedType = capturedPiece[1] as keyof typeof PIECE_VALUES;
    const capturedValue = PIECE_VALUES[capturedType] || 0;
    const bonus = capturedValue * CAPTURE_EVAL_BONUS_FACTOR;
    if (gameState.lastMove?.playerColor === botColor) {
      evaluation += bonus;
    } else {
      evaluation -= bonus;
    }
  }

  if (gameState.gameStatus !== "checkmate") {
    const totalPieces = countSetBits(
      gameState.bitboardState.occupancy ?? gameState.bitboardState.allPieces
    );
    const moverType = gameState.lastMove?.pieceCode?.[1];
    if (moverType === "Q" && totalPieces >= EARLY_GAME_PIECE_THRESHOLD) {
      const capturedType = gameState.lastMove?.capturedPiece?.[1];
      const capturedValue = capturedType
        ? PIECE_VALUES[capturedType as keyof typeof PIECE_VALUES] || 0
        : 0;
      if (capturedType === "Q") {
        evaluation -= QUEEN_EARLY_TRADE_PENALTY;
      } else if (capturedValue < PIECE_VALUES.R) {
        evaluation -=
          (PIECE_VALUES.Q - capturedValue) *
          QUEEN_EARLY_CAPTURE_PENALTY_FACTOR;
      }
    }
  }

  if (movedPieceType && movedPieceTarget) {
    const enemyAttacks = getEnemyAttacks(gameState, botColor);
    const friendlyAttacks =
      gameState.bitboardState.attackMaps[botColor as "r" | "b" | "y" | "g"];
    const targetBit = squareBit(
      movedPieceTarget.row * 14 + movedPieceTarget.col
    );
    const pieceValue =
      PIECE_VALUES[movedPieceType as keyof typeof PIECE_VALUES] || 0;
    if ((enemyAttacks & targetBit) !== 0n && (friendlyAttacks & targetBit) === 0n) {
      evaluation -= pieceValue * HANGING_PENALTY_FACTOR;
    }
  }

  return evaluation;
};

const buildEnPassantMask = (targets: EnPassantTarget[]): bigint => {
  let mask = 0n;
  targets.forEach((target) => {
    const { row, col } = target.position;
    mask |= squareBit(row * 14 + col);
  });
  return mask;
};

// ✅ BITBOARD ONLY: Ensure occupancy, attack maps, and checks are consistent
const syncStateForSearch = (state: GameState): GameState => {
  const pieces = state.bitboardState.pieces;

  // Rebuild occupancy + color bitboards from pieces
  let occupancy = 0n;
  const colorBits = { r: 0n, b: 0n, y: 0n, g: 0n };
  Object.entries(pieces).forEach(([code, bb]) => {
    if (bb === 0n) return;
    occupancy |= bb;
    const color = code[0] as keyof typeof colorBits;
    if (colorBits[color] !== undefined) {
      colorBits[color] |= bb;
    }
  });

  // Rebuild en passant mask from targets
  const enPassantMask = buildEnPassantMask(state.enPassantTargets || []);

  // Rebuild attack maps from pieces/occupancy (critical for correct check detection)
  const nextAttackMaps = {
    r: state.eliminatedPlayers.includes("r") ? 0n : generateAttackMap("r", pieces, occupancy),
    b: state.eliminatedPlayers.includes("b") ? 0n : generateAttackMap("b", pieces, occupancy),
    y: state.eliminatedPlayers.includes("y") ? 0n : generateAttackMap("y", pieces, occupancy),
    g: state.eliminatedPlayers.includes("g") ? 0n : generateAttackMap("g", pieces, occupancy),
  };

  const nextState: GameState = {
    ...state,
    bitboardState: {
      ...state.bitboardState,
      allPieces: occupancy,
      occupancy,
      enPassantTarget: enPassantMask,
      r: colorBits.r,
      b: colorBits.b,
      y: colorBits.y,
      g: colorBits.g,
      attackMaps: nextAttackMaps,
    },
  };
  const nextCheckStatus = updateAllCheckStatus(nextState);
  const nextPinnedMask = getPinnedPiecesMask(nextState, nextState.currentPlayerTurn);

  return {
    ...nextState,
    checkStatus: nextCheckStatus,
    bitboardState: {
      ...nextState.bitboardState,
      pinnedMask: nextPinnedMask,
    },
  };
};

const getEnemyAttacks = (state: GameState, playerColor: string): bigint => {
  return TURN_ORDER.reduce((attacks, color) => {
    if (color === playerColor || state.eliminatedPlayers.includes(color)) {
      return attacks;
    }
    return attacks | state.bitboardState.attackMaps[color];
  }, 0n);
};

const isMoveHangingAfter = (
  nextState: GameState,
  move: MoveOption,
  playerColor: string
): boolean => {
  const enemyAttacks = getEnemyAttacks(nextState, playerColor);
  const friendlyAttacks =
    nextState.bitboardState.attackMaps[playerColor as "r" | "b" | "y" | "g"];
  const targetBit = squareBit(move.to.row * 14 + move.to.col);
  const attacked = (enemyAttacks & targetBit) !== 0n;
  const defended = (friendlyAttacks & targetBit) !== 0n;
  return attacked && !defended;
};

const applyHangingPiecePenalty = (
  gameState: GameState,
  scores: Record<string, number>
) => {
  const pieces = gameState.bitboardState.pieces;
  const pieceTypes = ["P", "N", "B", "R", "Q"] as const;

  TURN_ORDER.forEach((color) => {
    if (gameState.eliminatedPlayers.includes(color)) return;
    const enemyAttacks = getEnemyAttacks(gameState, color);
    const friendlyAttacks =
      gameState.bitboardState.attackMaps[color as "r" | "b" | "y" | "g"];

    pieceTypes.forEach((type) => {
      let bb = pieces[`${color}${type}`] ?? 0n;
      while (bb > 0n) {
        const sq = Number(bitScanForward(bb));
        const sqBit = squareBit(sq);
        if ((enemyAttacks & sqBit) !== 0n) {
          const defended = (friendlyAttacks & sqBit) !== 0n;
          const baseValue = PIECE_VALUES[type] || 0;
          const scale = type === "P" ? HANGING_PAWN_MULTIPLIER : 1;
          const penalty =
            baseValue *
            scale *
            (defended ? HANGING_PENALTY_DEFENDED : HANGING_PENALTY_UNDEFENDED);
          scores[color as keyof typeof scores] -= penalty;
        }
        bb &= bb - 1n;
      }
    });
  });
};

// Piece type order for SEE (lowest to highest value)
const SEE_PIECE_ORDER = ["P", "N", "B", "R", "Q", "K"] as const;

/**
 * Static Exchange Evaluation (SEE)
 * Calculates the outcome of a capture sequence on a single square.
 * Returns positive if the attacker wins material, negative if loses.
 */
const see = (
  state: GameState,
  move: MoveOption,
  attackerColor: string
): number => {
  const seeStart = startTimer();
  const toIdx = move.to.row * 14 + move.to.col;
  const toMask = squareBit(toIdx);
  const fromIdx = move.from.row * 14 + move.from.col;
  const fromMask = squareBit(fromIdx);

  const attackerType = move.pieceCode?.[1] as keyof typeof PIECE_VALUES;
  if (!attackerType) {
    recordTime("see", seeStart);
    return 0;
  }

  // Get initial captured piece value
  const capturedType = move.capturedPieceCode?.[1] as keyof typeof PIECE_VALUES;
  const capturedValue = capturedType ? PIECE_VALUES[capturedType] || 0 : 0;

  if (capturedValue === 0 && !move.isEnPassant) {
    recordTime("see", seeStart);
    return 0;
  }

  const initialGain = move.isEnPassant ? PIECE_VALUES.P : capturedValue;

  // Build a list of all pieces that can attack this square
  const pieces = { ...state.bitboardState.pieces };
  const occupancy = state.bitboardState.occupancy ?? state.bitboardState.allPieces;

  // Remove the initial attacker from its square
  let currentOccupancy = occupancy ^ fromMask;
  const attackerPieceCode = `${attackerColor}${attackerType}`;
  pieces[attackerPieceCode] = (pieces[attackerPieceCode] ?? 0n) ^ fromMask;

  // Track gains at each depth of the exchange
  const gains: number[] = [initialGain];
  let depth = 0;
  let sideToMove = attackerColor;
  let pieceOnSquare = attackerType;

  // Iterate exchanges
  for (let iter = 0; iter < 32; iter++) {
    depth++;

    // Find the least valuable attacker for the opponent
    const defenders = TURN_ORDER.filter(
      (c) => c !== sideToMove && !state.eliminatedPlayers.includes(c)
    );

    let leastValuableAttacker: { color: string; type: keyof typeof PIECE_VALUES; mask: bigint } | null = null;

    for (const defColor of defenders) {
      for (const pieceType of SEE_PIECE_ORDER) {
        const pieceBB = pieces[`${defColor}${pieceType}`] ?? 0n;
        if (pieceBB === 0n) continue;

        // Check if this piece type can attack the target square
        let attackers = 0n;
        let temp = pieceBB & currentOccupancy;

        while (temp > 0n) {
          const sq = Number(bitScanForward(temp));
          const sqMask = squareBit(sq);

          // Check if this piece attacks the target
          if (canPieceAttackSquare(pieceType, defColor, sq, toIdx, currentOccupancy)) {
            attackers |= sqMask;
          }
          temp &= temp - 1n;
        }

        if (attackers !== 0n) {
          // Found an attacker - use the first one
          const attackerMask = squareBit(Number(bitScanForward(attackers)));
          leastValuableAttacker = { color: defColor, type: pieceType, mask: attackerMask };
          break;
        }
      }
      if (leastValuableAttacker) break;
    }

    if (!leastValuableAttacker) {
      // No more attackers - exchange ends
      break;
    }

    // Capture the piece on the square
    const captureValue = PIECE_VALUES[pieceOnSquare as keyof typeof PIECE_VALUES] || 0;
    gains.push(captureValue - gains[depth - 1]);

    // Update state for next iteration
    pieceOnSquare = leastValuableAttacker.type;
    sideToMove = leastValuableAttacker.color;
    currentOccupancy ^= leastValuableAttacker.mask;
    const defenderCode = `${leastValuableAttacker.color}${leastValuableAttacker.type}`;
    pieces[defenderCode] = (pieces[defenderCode] ?? 0n) ^ leastValuableAttacker.mask;

    // King cannot be captured - end exchange
    if (pieceOnSquare === "K") {
      break;
    }
  }

  // Minimax the gains from the end
  while (depth > 1) {
    depth--;
    gains[depth - 1] = -Math.max(-gains[depth - 1], gains[depth]);
  }

  recordTime("see", seeStart);
  return gains[0];
};

/**
 * Check if a piece at a given square can attack a target square.
 */
const canPieceAttackSquare = (
  pieceType: string,
  pieceColor: string,
  fromSq: number,
  toSq: number,
  occupancy: bigint
): boolean => {
  const fromRow = Math.floor(fromSq / 14);
  const fromCol = fromSq % 14;
  const toRow = Math.floor(toSq / 14);
  const toCol = toSq % 14;
  const rowDiff = toRow - fromRow;
  const colDiff = toCol - fromCol;

  switch (pieceType) {
    case "P": {
      // Pawn attacks depend on color
      switch (pieceColor) {
        case "r": return rowDiff === -1 && Math.abs(colDiff) === 1;
        case "y": return rowDiff === 1 && Math.abs(colDiff) === 1;
        case "b": return colDiff === 1 && Math.abs(rowDiff) === 1;
        case "g": return colDiff === -1 && Math.abs(rowDiff) === 1;
        default: return false;
      }
    }
    case "N": {
      const absRow = Math.abs(rowDiff);
      const absCol = Math.abs(colDiff);
      return (absRow === 2 && absCol === 1) || (absRow === 1 && absCol === 2);
    }
    case "K": {
      return Math.abs(rowDiff) <= 1 && Math.abs(colDiff) <= 1;
    }
    case "R": {
      if (rowDiff !== 0 && colDiff !== 0) return false;
      return isPathClear(fromSq, toSq, occupancy);
    }
    case "B": {
      if (Math.abs(rowDiff) !== Math.abs(colDiff)) return false;
      return isPathClear(fromSq, toSq, occupancy);
    }
    case "Q": {
      if (rowDiff !== 0 && colDiff !== 0 && Math.abs(rowDiff) !== Math.abs(colDiff)) {
        return false;
      }
      return isPathClear(fromSq, toSq, occupancy);
    }
    default:
      return false;
  }
};

const isCornerSquare = (row: number, col: number): boolean => {
  return (row < 3 || row > 10) && (col < 3 || col > 10);
};

/**
 * Check if the path between two squares is clear (for sliding pieces).
 * Treat 3x3 corner holes as blocked squares.
 */
const isPathClear = (fromSq: number, toSq: number, occupancy: bigint): boolean => {
  const fromRow = Math.floor(fromSq / 14);
  const fromCol = fromSq % 14;
  const toRow = Math.floor(toSq / 14);
  const toCol = toSq % 14;

  if (isCornerSquare(toRow, toCol)) {
    return false;
  }

  const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
  const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;

  let r = fromRow + rowStep;
  let c = fromCol + colStep;

  while (r !== toRow || c !== toCol) {
    if (isCornerSquare(r, c)) {
      return false;
    }
    const sqMask = squareBit(r * 14 + c);
    if ((occupancy & sqMask) !== 0n) {
      return false;
    }
    r += rowStep;
    c += colStep;
  }

  return true;
};

const scoreQuietMove = (
  move: MoveOption,
  pieceCode: string,
  enemyAttacks: bigint,
  friendlyAttacks: bigint
): number => {
  const targetBit = squareBit(move.to.row * 14 + move.to.col);
  const rowCenter = 6.5;
  const colCenter = 6.5;
  const dist =
    Math.abs(move.to.row - rowCenter) + Math.abs(move.to.col - colCenter);
  let score = -dist * CENTER_WEIGHT;

  const pieceType = pieceCode[1] as keyof typeof PIECE_VALUES;
  const pieceValue = PIECE_VALUES[pieceType] || 0;

  if (pieceType === "N" || pieceType === "B") {
    score += 0.6;
  }
  if (pieceType === "K") {
    score -= KING_MOVE_PENALTY;
  }

  if ((enemyAttacks & targetBit) !== 0n && (friendlyAttacks & targetBit) === 0n) {
    score -= pieceValue * HANGING_PENALTY_FACTOR;
  }

  return score;
};

const givesCheckAfterMove = (state: GameState, move: MoveOption): boolean => {
  const pieceCode = move.pieceCode;
  if (!pieceCode) return false;
  const playerColor = pieceCode[0];
  const pieceType = pieceCode[1];
  const fromMask = squareBit(move.from.row * 14 + move.from.col);
  const toMask = squareBit(move.to.row * 14 + move.to.col);
  const nextPieces = { ...state.bitboardState.pieces };

  let capturedPos: Position | null = null;
  if (move.isEnPassant && move.enPassantTarget) {
    const createdByColor = move.enPassantTarget.createdBy.charAt(0);
    const { row: skippedRow, col: skippedCol } = move.enPassantTarget.position;
    switch (createdByColor) {
      case "r":
        capturedPos = { row: skippedRow - 1, col: skippedCol };
        break;
      case "y":
        capturedPos = { row: skippedRow + 1, col: skippedCol };
        break;
      case "b":
        capturedPos = { row: skippedRow, col: skippedCol + 1 };
        break;
      case "g":
        capturedPos = { row: skippedRow, col: skippedCol - 1 };
        break;
      default:
        capturedPos = null;
        break;
    }
  } else if (move.to.isCapture) {
    capturedPos = { row: move.to.row, col: move.to.col };
  }

  if (capturedPos) {
    const capturedIdx = capturedPos.row * 14 + capturedPos.col;
    const capturedMask = squareBit(capturedIdx);
    // Use move.capturedPieceCode (set by generators) or fast O(1) lookup
    const capturedPiece = move.capturedPieceCode ??
      getPieceCodeAt(nextPieces, capturedMask);  // O(24) fallback for rare cases
    if (capturedPiece) {
      nextPieces[capturedPiece] ^= capturedMask;
    }
  }

  if (move.isPromotion && pieceType === "P") {
    nextPieces[pieceCode] ^= fromMask;
    const promotedCode = `${playerColor}Q`;
    nextPieces[promotedCode] = (nextPieces[promotedCode] ?? 0n) | toMask;
  } else {
    nextPieces[pieceCode] ^= fromMask | toMask;
  }

  if (
    isCastlingMove(
      pieceCode,
      move.from.row,
      move.from.col,
      move.to.row,
      move.to.col
    )
  ) {
    const rookCoords = getRookCastlingCoords(
      playerColor,
      move.to
    );
    if (rookCoords) {
      const rookFromMask = squareBit(
        rookCoords.rookFrom.row * 14 + rookCoords.rookFrom.col
      );
      const rookToMask = squareBit(
        rookCoords.rookTo.row * 14 + rookCoords.rookTo.col
      );
      nextPieces[`${playerColor}R`] ^= rookFromMask | rookToMask;
    }
  }

  let nextOccupancy = 0n;
  Object.values(nextPieces).forEach((bb) => {
    nextOccupancy |= bb;
  });

  const moverAttacks = generateAttackMap(
    playerColor,
    nextPieces,
    nextOccupancy
  );

  for (const opponent of TURN_ORDER) {
    if (opponent === playerColor || state.eliminatedPlayers.includes(opponent)) {
      continue;
    }
    const kingBB = nextPieces[`${opponent}K`] ?? 0n;
    if ((moverAttacks & kingBB) !== 0n) {
      return true;
    }
  }

  return false;
};

const buildAttackMaps = (
  pieces: Record<string, bigint>,
  occupancy: bigint,
  eliminatedPlayers: string[]
) => {
  const bamStart = startTimer();
  const result = {
    r: eliminatedPlayers.includes("r") ? 0n : generateAttackMap("r", pieces, occupancy),
    b: eliminatedPlayers.includes("b") ? 0n : generateAttackMap("b", pieces, occupancy),
    y: eliminatedPlayers.includes("y") ? 0n : generateAttackMap("y", pieces, occupancy),
    g: eliminatedPlayers.includes("g") ? 0n : generateAttackMap("g", pieces, occupancy),
  };
  recordTime("buildAttackMaps", bamStart);
  return result;
};

const simulateMoveBitboard = (
  state: GameState,
  move: MoveOption
): GameState => {
  const simStart = startTimer();
  const fromIdx = move.from.row * 14 + move.from.col;
  const toIdx = move.to.row * 14 + move.to.col;
  const fromMask = squareBit(fromIdx);
  const toMask = squareBit(toIdx);
  const pieceCode =
    move.pieceCode ?? getPieceCodeAt(state.bitboardState.pieces, fromMask);

  if (!pieceCode) {
    recordTime("simulateMoveBitboard", simStart);
    return state;
  }

  const playerColor = pieceCode[0] as "r" | "b" | "y" | "g";
  const pieceType = pieceCode[1];
  const nextPieces = { ...state.bitboardState.pieces };
  // FIX: Only copy existing hasMoved state, don't set all kings to moved
  const nextHasMoved = { ...state.hasMoved };

  if (pieceType === "K") {
    nextHasMoved[`${playerColor}K` as keyof typeof nextHasMoved] = true;
  } else if (pieceType === "R") {
    const rookId = getRookIdentifier(playerColor, move.from.row, move.from.col);
    if (rookId) {
      nextHasMoved[rookId as keyof typeof nextHasMoved] = true;
    }
  }

  let capturedPos: Position | null = null;
  if (move.isEnPassant && move.enPassantTarget) {
    const createdByColor = move.enPassantTarget.createdBy.charAt(0);
    const { row: skippedRow, col: skippedCol } = move.enPassantTarget.position;
    switch (createdByColor) {
      case "r":
        capturedPos = { row: skippedRow - 1, col: skippedCol };
        break;
      case "y":
        capturedPos = { row: skippedRow + 1, col: skippedCol };
        break;
      case "b":
        capturedPos = { row: skippedRow, col: skippedCol + 1 };
        break;
      case "g":
        capturedPos = { row: skippedRow, col: skippedCol - 1 };
        break;
      default:
        capturedPos = null;
        break;
    }
  } else if (move.to.isCapture) {
    capturedPos = { row: move.to.row, col: move.to.col };
  }

  if (capturedPos) {
    const capturedIdx = capturedPos.row * 14 + capturedPos.col;
    const capturedMask = squareBit(capturedIdx);
    const capturedPiece =
      move.capturedPieceCode ?? getPieceCodeAt(nextPieces, capturedMask);

    if (capturedPiece) {
      nextPieces[capturedPiece] ^= capturedMask;
      if (capturedPiece[1] === "R") {
        const rookId = getRookIdentifier(
          capturedPiece[0],
          capturedPos.row,
          capturedPos.col
        );
        if (rookId) {
          nextHasMoved[rookId as keyof typeof nextHasMoved] = true;
        }
      }
    }
  }

  if (move.isPromotion && pieceType === "P") {
    nextPieces[pieceCode] ^= fromMask;
    const promotedCode = `${playerColor}Q`;
    nextPieces[promotedCode] = (nextPieces[promotedCode] ?? 0n) | toMask;
  } else {
    nextPieces[pieceCode] ^= fromMask | toMask;
  }

  if (
    isCastlingMove(
      pieceCode,
      move.from.row,
      move.from.col,
      move.to.row,
      move.to.col
    )
  ) {
    const rookCoords = getRookCastlingCoords(playerColor, move.to);
    if (rookCoords) {
      const rookFromMask = squareBit(
        rookCoords.rookFrom.row * 14 + rookCoords.rookFrom.col
      );
      const rookToMask = squareBit(
        rookCoords.rookTo.row * 14 + rookCoords.rookTo.col
      );
      nextPieces[`${playerColor}R`] ^= rookFromMask | rookToMask;
      const rookId = getRookIdentifier(
        playerColor,
        rookCoords.rookFrom.row,
        rookCoords.rookFrom.col
      );
      if (rookId) {
        nextHasMoved[rookId as keyof typeof nextHasMoved] = true;
      }
    }
  }

  let nextAllPieces = 0n;
  const nextColorBits = { r: 0n, b: 0n, y: 0n, g: 0n };
  Object.entries(nextPieces).forEach(([code, bb]) => {
    if (bb === 0n) return;
    nextAllPieces |= bb;
    const color = code[0] as "r" | "b" | "y" | "g";
    nextColorBits[color] |= bb;
  });

  const nextAttackMaps = buildAttackMaps(
    nextPieces,
    nextAllPieces,
    state.eliminatedPlayers
  );
  const nextPlayer = getNextPlayer(playerColor, state.eliminatedPlayers);

  const interimState: GameState = {
    ...state,
    currentPlayerTurn: nextPlayer,
    bitboardState: {
      ...state.bitboardState,
      pieces: nextPieces,
      allPieces: nextAllPieces,
      occupancy: nextAllPieces,
      r: nextColorBits.r,
      b: nextColorBits.b,
      y: nextColorBits.y,
      g: nextColorBits.g,
      red: nextColorBits.r,
      blue: nextColorBits.b,
      yellow: nextColorBits.y,
      green: nextColorBits.g,
      enPassantTarget: 0n,
      attackMaps: nextAttackMaps,
      pinnedMask: 0n,
    },
    enPassantTargets: [],
    hasMoved: nextHasMoved,
  };

  const nextCheckStatus = updateAllCheckStatus(interimState);
  const nextPinnedMask = getPinnedPiecesMask(interimState, nextPlayer);

  let updatedState: GameState = {
    ...interimState,
    checkStatus: nextCheckStatus,
    bitboardState: {
      ...interimState.bitboardState,
      pinnedMask: nextPinnedMask,
    },
    lastMove: {
      from: move.from,
      to: { row: move.to.row, col: move.to.col },
      pieceCode,
      playerColor,
      timestamp: 0,
      capturedPiece: move.capturedPieceCode ?? null,
    },
  };

  recordTime("simulateMoveBitboard", simStart);
  return updatedState;
};

// Fast capture-only generator for quiescence search - avoids expensive ordering
const getCapturesOnly = (
  playerColor: string,
  gameState: GameState,
  cancellationToken?: { cancelled: boolean }
): MoveOption[] => {
  const captures: MoveOption[] = [];
  const pieces = gameState.bitboardState.pieces;
  // Build O(1) lookup table once at start
  const pieceLookup = buildPieceLookup(pieces);

  for (const [pieceCode, bb] of Object.entries(pieces)) {
    if (!pieceCode.startsWith(playerColor)) continue;
    let temp = bb;

    while (temp > 0n) {
      if (cancellationToken?.cancelled) return captures;

      const sq = Number(bitScanForward(temp));
      const row = Math.floor(sq / 14);
      const col = sq % 14;
      const movesBB = getValidMovesBB(pieceCode, { row, col }, gameState);

      if (movesBB !== 0n) {
        const moveInfos = bitboardToMoveInfo(movesBB, playerColor, pieceCode[1], gameState);

        for (const moveInfo of moveInfos) {
          const targetIdx = moveInfo.row * 14 + moveInfo.col;
          const boardTarget = getPieceCodeAtFast(pieceLookup, targetIdx);
          const isCapture =
            moveInfo.isCapture ||
            (boardTarget != null && boardTarget[0] !== playerColor);

          if (isCapture) {
            const enPassantTarget = moveInfo.isEnPassant
              ? gameState.enPassantTargets.find(
                (t) => t.position.row === moveInfo.row && t.position.col === moveInfo.col
              ) || null
              : null;
            const capturedPieceCode = !moveInfo.isEnPassant ? boardTarget : null;

            captures.push({
              from: { row, col },
              to: { row: moveInfo.row, col: moveInfo.col, isCapture: true },
              pieceCode,
              capturedPieceCode,
              isEnPassant: moveInfo.isEnPassant,
              isPromotion: moveInfo.isPromotion,
              enPassantTarget,
            });
          }
        }
      }
      temp &= temp - 1n;
    }
  }

  // MVV-LVA sort: Most Valuable Victim - Least Valuable Attacker
  // Prioritize: High victim value, low attacker value
  // Score = victim_value * 10 - attacker_value (ensures victim is more important)
  return captures.sort((a, b) => {
    const victimA = PIECE_VALUES[(a.capturedPieceCode?.[1] || "P") as keyof typeof PIECE_VALUES] || 0;
    const victimB = PIECE_VALUES[(b.capturedPieceCode?.[1] || "P") as keyof typeof PIECE_VALUES] || 0;
    const attackerA = PIECE_VALUES[(a.pieceCode?.[1] || "P") as keyof typeof PIECE_VALUES] || 0;
    const attackerB = PIECE_VALUES[(b.pieceCode?.[1] || "P") as keyof typeof PIECE_VALUES] || 0;

    // MVV-LVA score: prioritize high victim, penalize high attacker
    const scoreA = victimA * 10 - attackerA;
    const scoreB = victimB * 10 - attackerB;
    return scoreB - scoreA;
  });
};

const getAllLegalMoves = (
  playerColor: string,
  gameState: GameState,
  maxMoves?: number,
  cancellationToken?: { cancelled: boolean }
): MoveOption[] => {
  const fnStart = startTimer();
  const botConfig = getBotConfig(
    resolveBotConfigMode(gameState.gameMode),
    gameState.botDifficulty
  );
  const maxMovesToCalculate = maxMoves ?? botConfig.MAX_MOVES_TO_CALCULATE;
  const captures: MoveOption[] = [];
  const checks: MoveOption[] = [];
  const quietCandidates: { move: MoveOption; score: number }[] = [];
  const pieces = gameState.bitboardState.pieces;
  const enemyAttacks = getEnemyAttacks(gameState, playerColor);
  const friendlyAttacks =
    gameState.bitboardState.attackMaps[playerColor as "r" | "b" | "y" | "g"];
  // Build O(1) lookup table once at start
  const pieceLookup = buildPieceLookup(pieces);

  // ✅ FIX: Track if we were cancelled - return partial results instead of empty
  let wasCancelled = false;

  // ✅ SANITY CHECK: Verify current turn matches playerColor
  if (gameState.currentPlayerTurn !== playerColor) {
    console.error(`[BOT BUG] getAllLegalMoves called for ${playerColor} but currentTurn is ${gameState.currentPlayerTurn}`);
    // Return empty - this is a bug, don't generate wrong moves
    recordTime("getAllLegalMoves", fnStart);
    return [];
  }

  for (const [pieceCode, bb] of Object.entries(pieces)) {
    if (!pieceCode.startsWith(playerColor)) continue;
    // Debug: Skip if piece type has no pieces
    if (bb === 0n) continue;
    let temp = bb;

    while (temp > 0n) {
      if (cancellationToken?.cancelled) {
        wasCancelled = true;
        break; // ✅ FIX: Break loop instead of returning empty
      }

      const sq = Number(bitScanForward(temp));
      const row = Math.floor(sq / 14);
      const col = sq % 14;
      const movesBB = getValidMovesBB(pieceCode, { row, col }, gameState);

      if (movesBB !== 0n) {
        const moveInfos = bitboardToMoveInfo(
          movesBB,
          playerColor,
          pieceCode[1],
          gameState
        );

        for (const moveInfo of moveInfos) {
          if (cancellationToken?.cancelled) {
            wasCancelled = true;
            break; // ✅ FIX: Break loop instead of returning empty
          }

          const targetIdx = moveInfo.row * 14 + moveInfo.col;
          const boardTarget = getPieceCodeAtFast(pieceLookup, targetIdx);
          const isCapture =
            moveInfo.isCapture ||
            (boardTarget != null && boardTarget[0] !== playerColor);
          const enPassantTarget = moveInfo.isEnPassant
            ? gameState.enPassantTargets.find(
              (target) =>
                target.position.row === moveInfo.row &&
                target.position.col === moveInfo.col
            ) || null
            : null;
          const capturedPieceCode =
            isCapture && !moveInfo.isEnPassant ? boardTarget : null;

          const moveOption: MoveOption = {
            from: { row, col },
            to: {
              row: moveInfo.row,
              col: moveInfo.col,
              isCapture,
            },
            pieceCode,
            capturedPieceCode,
            isEnPassant: moveInfo.isEnPassant,
            isPromotion: moveInfo.isPromotion,
            enPassantTarget,
          };

          if (isCapture) {
            captures.push(moveOption);
          } else {
            const score = scoreQuietMove(
              moveOption,
              pieceCode,
              enemyAttacks,
              friendlyAttacks
            );
            quietCandidates.push({ move: moveOption, score });
          }
        }

        // ✅ FIX: Break out of while loop if cancelled in inner for loop
        if (wasCancelled) break;
      }

      temp &= temp - 1n;
    }

    // ✅ FIX: Break out of outer for loop if cancelled
    if (wasCancelled) break;
  }

  const quietLimit = maxMovesToCalculate
    ? Math.max(
      0,
      Math.min(
        QUIET_MOVE_LIMIT,
        maxMovesToCalculate - captures.length - checks.length
      )
    )
    : QUIET_MOVE_LIMIT;

  quietCandidates.sort((a, b) => b.score - a.score);
  const quiets = quietCandidates.slice(0, quietLimit).map((entry) => entry.move);

  // ✅ FIX: Skip expensive check calculation if cancelled - just return what we have
  if (!wasCancelled) {
    const checkCandidates = quietCandidates
      .filter((entry) => CHECK_MOVE_PIECE_TYPES.has(entry.move.pieceCode?.[1] || ""))
      .slice(0, CHECK_MOVE_CANDIDATE_LIMIT)
      .map((entry) => entry.move);

    checkCandidates.forEach((move) => {
      if (givesCheckAfterMove(gameState, move)) {
        checks.push(move);
      }
    });
  }

  let result: MoveOption[];
  if (!maxMovesToCalculate) {
    result = captures.concat(checks, quiets);
  } else if (captures.length >= maxMovesToCalculate) {
    result = captures.slice(0, maxMovesToCalculate);
  } else {
    const remainingAfterCaptures = maxMovesToCalculate - captures.length;
    const checksTrimmed = checks.slice(0, remainingAfterCaptures);
    const remainingAfterChecks = remainingAfterCaptures - checksTrimmed.length;
    result = captures
      .concat(checksTrimmed)
      .concat(quiets.slice(0, remainingAfterChecks));
  }
  recordTime("getAllLegalMoves", fnStart);
  return result;
};

const getOrderedMoves = (
  playerColor: string,
  gameState: GameState,
  maxMoves?: number,
  cancellationToken?: { cancelled: boolean },
  preferredMoveKeys: string[] = [],
  orderingContext?: { isRoot?: boolean }
): MoveOption[] => {
  const orderStart = startTimer();
  const moves = getAllLegalMoves(
    playerColor,
    gameState,
    maxMoves,
    cancellationToken
  );
  const preferredRanks = new Map<string, number>();
  preferredMoveKeys.forEach((key, idx) => {
    if (!preferredRanks.has(key)) {
      preferredRanks.set(key, idx);
    }
  });

  const captureValue = (move: MoveOption): number => {
    if (!move.to.isCapture) return 0;
    if (move.isEnPassant) return PIECE_VALUES.P;
    const capturedType = move.capturedPieceCode?.[1] as keyof typeof PIECE_VALUES;
    return capturedType ? PIECE_VALUES[capturedType] || 0 : 0;
  };

  const captureTier = (move: MoveOption): number => {
    if (!move.to.isCapture) return 0;
    const capturedType = move.capturedPieceCode?.[1];
    if (capturedType === "Q") return 4;
    if (capturedType === "R" || capturedType === "B") return 3;
    if (capturedType === "N") return 2;
    if (capturedType === "P") return 1;
    return 0;
  };

  const moverValue = (move: MoveOption): number => {
    const moverType = move.pieceCode?.[1] as keyof typeof PIECE_VALUES;
    return moverType ? PIECE_VALUES[moverType] || 0 : 0;
  };

  const wasInCheck =
    gameState.checkStatus[playerColor as keyof typeof gameState.checkStatus];
  const shouldCheckmateOrder = orderingContext?.isRoot ?? false;

  const decorated = moves.map((move) => {
    let nextState: GameState | null = null;
    const ensureNextState = () => {
      if (!nextState) {
        nextState = simulateMoveBitboard(gameState, move);
      }
      return nextState;
    };

    const moveIsKing = move.pieceCode?.[1] === "K";
    let defensiveScore = 0;
    if (wasInCheck || moveIsKing || shouldCheckmateOrder) {
      const stateAfter = ensureNextState();
      const stillInCheck =
        stateAfter.checkStatus[playerColor as keyof typeof stateAfter.checkStatus];
      if (wasInCheck && !stillInCheck) {
        defensiveScore += 2;
      }
      if (moveIsKing) {
        const enemyAttacks = getEnemyAttacks(stateAfter, playerColor);
        const targetBit = squareBit(move.to.row * 14 + move.to.col);
        if ((enemyAttacks & targetBit) === 0n) {
          defensiveScore += 1;
        }
      }
    }

    let isCheckmateMove = false;
    if (shouldCheckmateOrder) {
      const stateAfter = ensureNextState();
      const opponents = TURN_ORDER.filter(
        (color) => color !== playerColor && !stateAfter.eliminatedPlayers.includes(color)
      );
      const opponentsInCheck = opponents.filter(
        (color) =>
          stateAfter.checkStatus[color as keyof typeof stateAfter.checkStatus]
      );
      if (opponentsInCheck.length > 0) {
        for (const opponent of opponentsInCheck) {
          if (!hasAnyLegalMoves(opponent, stateAfter)) {
            isCheckmateMove = true;
            break;
          }
        }
      }
    }

    // Calculate SEE for captures to identify good vs bad captures
    const seeValue = move.to.isCapture ? see(gameState, move, playerColor) : 0;
    const isGoodCapture = move.to.isCapture && seeValue >= 0;
    const isBadCapture = move.to.isCapture && seeValue < 0;

    // History heuristic for quiet moves
    const historyScore = !move.to.isCapture && move.pieceCode
      ? getHistoryScore(move.pieceCode, move.to.row * 14 + move.to.col)
      : 0;

    return {
      move,
      isCheckmateMove,
      isGoodCapture,
      isBadCapture,
      seeValue,
      captureTier: captureTier(move),
      captureValue: captureValue(move),
      moverValue: moverValue(move),
      defensiveScore,
      preferredRank: preferredRanks.get(moveKey(move)),
      historyScore,
    };
  });

  const sorted = decorated.sort((a, b) => {
    // Checkmate moves first
    if (a.isCheckmateMove !== b.isCheckmateMove) {
      return a.isCheckmateMove ? -1 : 1;
    }

    // Good captures (SEE >= 0) before quiet moves
    if (a.isGoodCapture !== b.isGoodCapture) {
      return a.isGoodCapture ? -1 : 1;
    }

    // Among good captures, sort by SEE value (higher is better)
    if (a.isGoodCapture && b.isGoodCapture) {
      if (a.seeValue !== b.seeValue) {
        return b.seeValue - a.seeValue;
      }
    }

    // Defensive moves
    if (a.defensiveScore !== b.defensiveScore) {
      return b.defensiveScore - a.defensiveScore;
    }

    // Preferred moves (killer moves, hash moves)
    if (preferredRanks.size > 0) {
      const rankA = a.preferredRank;
      const rankB = b.preferredRank;
      if (rankA !== undefined || rankB !== undefined) {
        return (rankA ?? Number.MAX_SAFE_INTEGER) - (rankB ?? Number.MAX_SAFE_INTEGER);
      }
    }

    // History heuristic for quiet moves (higher history = better)
    if (!a.move.to.isCapture && !b.move.to.isCapture) {
      if (a.historyScore !== b.historyScore) {
        return b.historyScore - a.historyScore;
      }
    }

    // Quiet moves before bad captures
    if (a.isBadCapture !== b.isBadCapture) {
      return a.isBadCapture ? 1 : -1;
    }

    // Among bad captures, less negative SEE is better
    if (a.isBadCapture && b.isBadCapture) {
      return b.seeValue - a.seeValue;
    }

    return 0;
  }).map((entry) => entry.move);

  recordTime("getOrderedMoves", orderStart);
  return sorted;
};

const deltaPruning = (
  standPat: number,
  alpha: number,
  pieceValue: number
): boolean => standPat + pieceValue + DELTA_PRUNING_BUFFER < alpha;

const quiescenceSearch = (
  gameState: GameState,
  alpha: number,
  beta: number,
  botColor: string,
  depth: number,
  cancellationToken?: { cancelled: boolean },
  maxQuiescenceDepth: number = QUIESCENCE_MAX_DEPTH_DEFAULT
): { score: number; move: MoveOption | null } => {
  const qsStart = startTimer();
  const currentPlayer = gameState.currentPlayerTurn;
  const isInCheck =
    gameState.checkStatus[currentPlayer as keyof typeof gameState.checkStatus];
  if (isInCheck && !hasAnyLegalMoves(currentPlayer, gameState)) {
    const score = currentPlayer === botColor ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
    return { score, move: null };
  }

  const standPat = getBotEvaluation(gameState, botColor);

  if (cancellationToken?.cancelled) {
    return { score: standPat, move: null };
  }

  const isBotTurn = gameState.currentPlayerTurn === botColor;

  if (isBotTurn) {
    if (standPat >= beta) return { score: beta, move: null };
    if (standPat > alpha) alpha = standPat;
  } else {
    if (standPat <= alpha) return { score: alpha, move: null };
    if (standPat < beta) beta = standPat;
  }

  if (depth >= maxQuiescenceDepth) {
    recordTime("quiescenceSearch", qsStart);
    return { score: standPat, move: null };
  }

  // Use fast capture-only generator (avoids expensive getOrderedMoves)
  const captureMoves = getCapturesOnly(
    gameState.currentPlayerTurn,
    gameState,
    cancellationToken
  );

  if (captureMoves.length === 0) {
    recordTime("quiescenceSearch", qsStart);
    return { score: standPat, move: null };
  }

  let bestScore = standPat;
  let bestMove: MoveOption | null = null;

  for (const move of captureMoves) {
    if (cancellationToken?.cancelled) break;

    // SEE pruning: skip captures that lose material
    // ✅ FIX: Even more aggressive in quiescence - we're only looking at captures here
    const seeValue = see(gameState, move, currentPlayer);
    if (seeValue < 0) {
      continue;
    }

    if (isBotTurn) {
      const capturedType = move.isEnPassant
        ? "P"
        : (move.capturedPieceCode?.[1] as keyof typeof PIECE_VALUES | undefined);
      const captureValue = capturedType ? PIECE_VALUES[capturedType] || 0 : 0;

      if (deltaPruning(standPat, alpha, captureValue)) {
        continue;
      }
    }

    const nextState = simulateMoveBitboard(gameState, move);
    const result = quiescenceSearch(
      nextState,
      alpha,
      beta,
      botColor,
      depth + 1,
      cancellationToken,
      maxQuiescenceDepth
    ).score;

    if (isBotTurn) {
      if (result > bestScore) {
        bestScore = result;
        bestMove = move;
      }
      if (result > alpha) alpha = result;
    } else {
      if (result < bestScore) {
        bestScore = result;
        bestMove = move;
      }
      if (result < beta) beta = result;
    }

    if (beta <= alpha) {
      break;
    }
  }

  recordTime("quiescenceSearch", qsStart);
  return { score: bestScore, move: bestMove };
};

const minimax = (
  gameState: GameState,
  depth: number,
  alpha: number,
  beta: number,
  botColor: string,
  cancellationToken?: { cancelled: boolean },
  preferredMoveKey?: string,
  rootDepth?: number,
  rootScores?: { move: MoveOption; score: number }[],
  quiescenceDepth: number = QUIESCENCE_MAX_DEPTH_DEFAULT,
  nullMoveAllowed: boolean = true,
  isRootNode: boolean = false
): { score: number; move: MoveOption | null } => {
  if (cancellationToken?.cancelled) {
    return { score: -Infinity, move: null };
  }

  const currentPlayer = gameState.currentPlayerTurn;
  const isInCheck =
    gameState.checkStatus[currentPlayer as keyof typeof gameState.checkStatus];
  if (isInCheck && !hasAnyLegalMoves(currentPlayer, gameState)) {
    const score = currentPlayer === botColor ? -CHECKMATE_SCORE : CHECKMATE_SCORE;
    return { score, move: null };
  }

  const hash = getZobristHash(gameState);
  const tableEntry = transpositionTable.get(hash);

  // ✅ FIX: Only use TT for cutoff at non-root nodes
  // At root, we must generate legal moves to ensure the chosen move is valid
  // TT moves can be stale/invalid (especially when player just got put in check)
  const isRoot = isRootNode;
  if (tableEntry && tableEntry.depth >= depth && !isRoot) {
    return { score: tableEntry.score, move: tableEntry.move };
  }

  if (depth === 0 || gameState.gameStatus === "finished") {
    return quiescenceSearch(gameState, alpha, beta, botColor, 0, cancellationToken, quiescenceDepth);
  }

  const isBotTurn = gameState.currentPlayerTurn === botColor;

  // Null Move Pruning: Skip a turn and search with reduced depth
  // If opponent can't punish even with a free move, prune this branch
  if (
    nullMoveAllowed &&
    depth >= 3 &&
    !isInCheck &&
    isBotTurn
  ) {
    // Create a null move state (skip our turn, give opponent the move)
    const nextPlayer = getNextPlayer(currentPlayer, gameState.eliminatedPlayers);
    const nullMoveState: GameState = {
      ...gameState,
      currentPlayerTurn: nextPlayer,
    };

    const nullMoveResult = minimax(
      nullMoveState,
      depth - 1 - NULL_MOVE_REDUCTION,
      beta - 1,
      beta,
      botColor,
      cancellationToken,
      undefined,
      rootDepth,
      undefined,
      quiescenceDepth,
      false, // Don't allow consecutive null moves
      false
    );

    // FIX: No negation needed - scores are always from bot's perspective
    // If even with a free move for opponent, our score >= beta, we can prune
    if (nullMoveResult.score >= beta) {
      return { score: beta, move: null };
    }
  }

  const baseMaxMoves = getBotConfig(
    resolveBotConfigMode(gameState.gameMode),
    gameState.botDifficulty
  ).MAX_MOVES_TO_CALCULATE;
  const depthMaxMoves =
    depth <= 1
      ? Math.min(baseMaxMoves, 8)
      : depth === 2
        ? Math.min(baseMaxMoves, 12)
        : undefined;
  const preferredKeys = buildPreferredMoveKeys(
    preferredMoveKey,
    tableEntry?.move ? moveKey(tableEntry.move) : undefined,
    killerMovesByDepth[depth]
  );
  // isRoot already defined above for TT check
  // ✅ SANITY CHECK: At root, current turn must match bot color
  if (isRoot && gameState.currentPlayerTurn !== botColor) {
    console.error(`[BOT BUG] Root minimax called with wrong turn: currentTurn=${gameState.currentPlayerTurn}, botColor=${botColor}`);
  }

  let moves = getOrderedMoves(
    gameState.currentPlayerTurn,
    gameState,
    depthMaxMoves,
    cancellationToken,
    preferredKeys,
    { isRoot }
  );

  // Debug: Log root move count
  if (isRoot && moves.length < 3) {
    console.warn(`[BOT DEBUG] ${botColor.toUpperCase()} Root only ${moves.length} moves found!`);
  }

  // ✅ Root safety filter: avoid hanging moves if any safe moves exist
  if (isRoot && !isInCheck && moves.length > 0) {
    const safeMoves: MoveOption[] = [];
    for (const move of moves) {
      if (move.pieceCode?.[1] === "K") {
        safeMoves.push(move);
        continue;
      }
      const nextState = simulateMoveBitboard(gameState, move);
      if (!isMoveHangingAfter(nextState, move, currentPlayer)) {
        safeMoves.push(move);
      }
    }
    if (safeMoves.length > 0) {
      moves = safeMoves;
    } else if (moves.length > 0) {
      // Debug: All moves were filtered as hanging!
      console.warn(`[BOT DEBUG] ${botColor.toUpperCase()} All ${moves.length} root moves filtered as hanging!`);
    }
  }

  if (moves.length === 0) {
    // Debug: Log when no moves found at root
    if (isRoot) {
      const pieceEntries = Object.entries(gameState.bitboardState.pieces).filter(([k]) => k.startsWith(botColor));
      const totalPieces = pieceEntries.reduce((sum, [, bb]) => sum + Number(bb !== 0n ? (bb as bigint).toString(2).replace(/0/g, '').length : 0), 0);
      console.warn(`[BOT DEBUG] ${botColor.toUpperCase()} Root no moves! pieces=${totalPieces}, isInCheck=${isInCheck}, currentTurn=${gameState.currentPlayerTurn}`);
    }
    const terminalScore = isInCheck
      ? currentPlayer === botColor
        ? -CHECKMATE_SCORE
        : CHECKMATE_SCORE
      : 0;
    const result = { score: terminalScore, move: null };
    if (transpositionTable.size > TT_MAX_SIZE) {
      transpositionTable.clear();
    }
    transpositionTable.set(hash, { depth, ...result });
    return result;
  }

  let bestScore = isBotTurn ? -Infinity : Infinity;
  let bestMove: MoveOption | null = null;

  for (const move of moves) {
    if (cancellationToken?.cancelled) break;

    // SEE Pruning: Skip losing captures everywhere (including root when not in check)
    // A losing capture is never the best move unless we're in check and have no choice
    if (!isInCheck && move.to.isCapture) {
      const seeValue = see(gameState, move, currentPlayer);
      // Skip any losing trade
      if (seeValue < 0) {
        continue;
      }
    }

    const nextState = simulateMoveBitboard(gameState, move);

    // Check Extension: If the move puts opponent in check, extend by 1 ply
    // Cap the extended depth to prevent search explosion (max 2 ply extension from root)
    const nextPlayer = nextState.currentPlayerTurn;
    const nextPlayerInCheck = nextState.checkStatus[nextPlayer as keyof typeof nextState.checkStatus];
    const maxDepth = rootDepth ?? depth;
    const newDepth = depth - 1 + (nextPlayerInCheck ? 1 : 0);
    const cappedDepth = Math.min(newDepth, maxDepth + 2);

    const evaluation = minimax(
      nextState,
      cappedDepth,
      alpha,
      beta,
      botColor,
      cancellationToken,
      undefined,
      rootDepth,
      rootScores,
      quiescenceDepth,
      true, // Allow null move in child nodes
      false
    ).score;

    if (rootScores && isRoot) {
      // ✅ SANITY CHECK: At root, all moves must be for the bot
      const moveColor = move.pieceCode?.[0];
      if (moveColor !== botColor) {
        console.error(`[BOT BUG] Root move for wrong color: move.pieceCode=${move.pieceCode}, botColor=${botColor}, currentTurn=${gameState.currentPlayerTurn}`);
        continue; // Skip this invalid move
      }

      const score = getBotEvaluation(
        nextState,
        botColor,
        move.pieceCode?.[1],
        move.to
      );
      rootScores.push({ move, score: evaluation + score * 0.01 });
    }

    if (isBotTurn) {
      if (evaluation > bestScore) {
        bestScore = evaluation;
        bestMove = move;
      }
      alpha = Math.max(alpha, evaluation);
    } else {
      if (evaluation < bestScore) {
        bestScore = evaluation;
        bestMove = move;
      }
      beta = Math.min(beta, evaluation);
    }

    if (beta <= alpha) {
      registerKillerMove(depth, move);
      // Update history for quiet moves that caused cutoffs
      if (!move.to.isCapture && move.pieceCode) {
        const toSquare = move.to.row * 14 + move.to.col;
        updateHistoryScore(move.pieceCode, toSquare, depth);
      }
      break;
    }
  }

  const result = { score: bestScore, move: bestMove };

  if (transpositionTable.size > TT_MAX_SIZE) {
    transpositionTable.clear();
  }
  transpositionTable.set(hash, { depth, ...result });

  return result;
};

const MAX_BOT_RETRIES = 3; // Increased from 2 to allow more recovery attempts

const resolveBotConfigMode = (gameMode: GameState["gameMode"]) =>
  gameMode === "online" || gameMode === "p2p" ? "single" : gameMode;

const isBotLocalMode = (gameMode: GameState["gameMode"]) =>
  gameMode === "solo" ||
  gameMode === "single" ||
  gameMode === "local" ||
  gameMode === "online" ||
  gameMode === "p2p";

const canBotStartTurn = (gameState: GameState, botColor: string): boolean => {
  if (!gameState) return false;
  if (gameState.gameStatus !== "active") return false;
  if (gameState.promotionState.isAwaiting) return false;
  if (gameState.currentPlayerTurn !== botColor) return false;
  if (gameState.eliminatedPlayers.includes(botColor)) return false;
  return true;
};

export const computeBestMove = (
  gameState: GameState,
  botColor: string,
  cancellationToken?: { cancelled: boolean },
  timeBudgetOverrideMs?: number
): MoveOption | null => {
  const searchState = syncStateForSearch(gameState);
  const botConfigMode = resolveBotConfigMode(searchState.gameMode);
  const botConfig = getBotConfig(botConfigMode, searchState.botDifficulty);
  const timeBudgetMs = timeBudgetOverrideMs ?? botConfig.BRAIN_TIMEOUT ?? 1200;
  const timeGuardMs = Math.max(50, Math.floor(timeBudgetMs * 0.25));
  const isLocalMode = isBotLocalMode(botConfigMode);

  const searchStartTime = Date.now();
  const maxDepth = botConfig.MAX_DEPTH ?? (isLocalMode ? 2 : 2);
  const quiescenceDepth = botConfig.QUIESCENCE_DEPTH ?? QUIESCENCE_MAX_DEPTH_DEFAULT;
  let chosenMove: MoveOption | null = null;
  let lastRootScores: { move: MoveOption; score: number }[] | null = null;

  resetDebugTimers();

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const timeLeft = timeBudgetMs - (Date.now() - searchStartTime);
    if (timeLeft < timeGuardMs) {
      break;
    }

    const rootScores: { move: MoveOption; score: number }[] = [];
    const result = minimax(
      searchState,
      depth,
      -Infinity,
      Infinity,
      botColor,
      cancellationToken,
      chosenMove ? moveKey(chosenMove) : undefined,
      depth,
      rootScores,
      quiescenceDepth,
      true,
      true
    );

    if (cancellationToken?.cancelled) {
      break;
    }

    if (result.move) {
      const pieceAtFrom = getPieceAtFromBitboard(
        searchState.bitboardState.pieces,
        result.move.from.row,
        result.move.from.col
      );
      if (pieceAtFrom && pieceAtFrom[0] === botColor) {
        chosenMove = result.move;
        lastRootScores = rootScores;
      }
    }
  }

  printDebugTimers(botColor);

  if (isLocalMode && lastRootScores && lastRootScores.length > 1) {
    lastRootScores.sort((a, b) => b.score - a.score);

    const validRootScores = lastRootScores.filter((entry) => {
      const move = entry.move;
      if (!move) return false;
      const pieceAtFrom = getPieceAtFromBitboard(
        searchState.bitboardState.pieces,
        move.from.row,
        move.from.col
      );
      return pieceAtFrom && pieceAtFrom[0] === botColor;
    });

    if (validRootScores.length >= 2) {
      const topCount = botConfig.RANDOMNESS_TOP ?? 3;
      const topMoves = validRootScores.slice(0, topCount);
      const scoreGap =
        topMoves.length > 1 ? topMoves[0].score - topMoves[1].score : Infinity;
      const randomnessGap = botConfig.RANDOMNESS_SCORE_GAP ?? 3;
      if (scoreGap < randomnessGap) {
        const minScore = Math.min(...topMoves.map((entry) => entry.score));
        const weights = topMoves.map((entry) => entry.score - minScore + 1);
        const total = weights.reduce((sum, w) => sum + w, 0);
        let pick = Math.random() * total;
        for (let i = 0; i < topMoves.length; i += 1) {
          pick -= weights[i];
          if (pick <= 0) {
            chosenMove = topMoves[i].move;
            break;
          }
        }
      } else if (Math.random() < 0.1 && validRootScores.length > 1) {
        chosenMove = validRootScores[1].move;
      }
    }
  }

  return chosenMove;
};

const makeBotMove = (botColor: string, retryCount: number = 0) => {

  // ✅ CRITICAL: Prevent multiple bots from moving simultaneously
  if (botMoveInProgress) {
    return;
  }

  // Prevent infinite retry loops - force resignation to advance the game
  if (retryCount >= MAX_BOT_RETRIES) {
    console.warn(`Bot ${botColor} exceeded max retries, forcing resignation`);

    // ✅ FIX: Don't leave game stuck - resign to advance the turn
    try {
      const notificationService = require('./notificationService').default;
      notificationService.show(`Bot ${botColor.toUpperCase()} failed to move and resigns!`, "warning", 4000);
    } catch (notificationError) {
      console.warn("Failed to show bot resignation notification:", notificationError);
    }

    store.dispatch(resignGame(botColor));
    return;
  }

  const baseState = store.getState().game;
  const gameState = syncStateForSearch(baseState);

  if (!canBotStartTurn(gameState, botColor)) {
    return;
  }

  // Get the appropriate bot configuration based on game mode
  const botConfig = getBotConfig(
    resolveBotConfigMode(gameState.gameMode),
    gameState.botDifficulty
  );

  // Set the lock
  botMoveInProgress = true;

  Object.keys(killerMovesByDepth).forEach((key) => {
    delete killerMovesByDepth[Number(key)];
  });

  // ✅ FIX: Clear TT when bot is in check to ensure fresh check escape calculations
  // Stale TT entries can cause invalid moves to be returned
  const botInCheck = gameState.checkStatus[botColor as keyof typeof gameState.checkStatus];
  if (botInCheck) {
    transpositionTable.clear();
  }

  const timingLabel = `bot-move-${botColor}-${Date.now()}`;
  const timingStart = Date.now();
  let timingActive = true;
  const endTiming = (reason?: string) => {
    if (!timingActive) return;
    timingActive = false;
    const elapsed = Date.now() - timingStart;
    try {
      console.timeEnd(timingLabel);
    } catch {
      // ignore if time label isn't supported
    }
    console.log(
      `[BOT TIMING] ${botColor.toUpperCase()} ${elapsed}ms${reason ? ` (${reason})` : ""}`
    );
  };
  try {
    console.time(timingLabel);
  } catch {
    // ignore if time label isn't supported
  }

  const isLocalMode = isBotLocalMode(resolveBotConfigMode(gameState.gameMode));
  const timeBudgetMs = botConfig.BRAIN_TIMEOUT;
  const timeGuardMs = Math.min(
    SEARCH_TIME_GUARD_MS,
    Math.floor(timeBudgetMs * 0.25)
  );

  // ⚡ PERFORMANCE FIX: Set a timeout to prevent bot from taking too long
  const cancellationToken = { cancelled: false };
  const moveTimeout = setTimeout(() => {
    cancellationToken.cancelled = true;
    endTiming("timeout");

    // Notify user about bot thinking hard
    try {
      const notificationService = require('./notificationService').default;
      notificationService.show(`Bot ${botColor.toUpperCase()} is thinking hard...`, "info", 3000);
    } catch (notificationError) {
      console.warn("Failed to show bot thinking notification:", notificationError);
    }
  }, timeBudgetMs);

  const searchStartTime = Date.now();
  const maxDepth = botConfig.MAX_DEPTH ?? (isLocalMode ? 2 : 2);
  const quiescenceDepth = botConfig.QUIESCENCE_DEPTH ?? QUIESCENCE_MAX_DEPTH_DEFAULT;
  let chosenMove: MoveOption | null = null;
  let lastRootScores: { move: MoveOption; score: number }[] | null = null;

  // Reset debug timers for this move
  resetDebugTimers();

  for (let depth = 1; depth <= maxDepth; depth += 1) {
    const timeLeft = timeBudgetMs - (Date.now() - searchStartTime);
    if (timeLeft < timeGuardMs) {
      break;
    }

    const depthStart = Date.now();
    const rootScores: { move: MoveOption; score: number }[] = [];
    const result = minimax(
      gameState,
      depth,
      -Infinity,
      Infinity,
      botColor,
      cancellationToken,
      chosenMove ? moveKey(chosenMove) : undefined,
      depth,
      rootScores,
      quiescenceDepth,
      true,
      true
    );
    console.log(
      `[BOT TIMING] ${botColor.toUpperCase()} depth ${depth} ${Date.now() - depthStart}ms`
    );

    if (cancellationToken.cancelled) {
      break;
    }

    if (result.move) {
      // ✅ FIX: Validate the move from search before accepting it
      const pieceAtFrom = getPieceAtFromBitboard(gameState.bitboardState.pieces, result.move.from.row, result.move.from.col);
      if (pieceAtFrom && pieceAtFrom[0] === botColor) {
        chosenMove = result.move;
        lastRootScores = rootScores;
      } else {
        console.warn(`[BOT DEBUG] Search returned invalid move for ${botColor}: piece at (${result.move.from.row},${result.move.from.col}) is ${pieceAtFrom}, not ${botColor}`);
        // Keep previous chosenMove if valid, or null
      }
    }
  }

  // Print debug timing breakdown
  printDebugTimers(botColor);

  if (isLocalMode && lastRootScores && lastRootScores.length > 1) {
    lastRootScores.sort((a, b) => b.score - a.score);

    // ✅ FIX: Filter out any moves that aren't valid for this bot's pieces
    // This prevents stale/invalid moves from being selected
    const validRootScores = lastRootScores.filter((entry) => {
      const move = entry.move;
      if (!move) return false;
      const pieceAtFrom = getPieceAtFromBitboard(gameState.bitboardState.pieces, move.from.row, move.from.col);
      return pieceAtFrom && pieceAtFrom[0] === botColor;
    });

    if (validRootScores.length < 2) {
      // Not enough valid moves for randomization, keep chosenMove from search
    } else {
      const topCount = botConfig.RANDOMNESS_TOP ?? 3;
      const topMoves = validRootScores.slice(0, topCount);
      const scoreGap =
        topMoves.length > 1 ? topMoves[0].score - topMoves[1].score : Infinity;
      const randomnessGap = botConfig.RANDOMNESS_SCORE_GAP ?? 3;
      if (scoreGap < randomnessGap) {
        const minScore = Math.min(...topMoves.map((entry) => entry.score));
        const weights = topMoves.map((entry) => entry.score - minScore + 1);
        const total = weights.reduce((sum, w) => sum + w, 0);
        let pick = Math.random() * total;
        for (let i = 0; i < topMoves.length; i += 1) {
          pick -= weights[i];
          if (pick <= 0) {
            chosenMove = topMoves[i].move;
            break;
          }
        }
      } else if (Math.random() < 0.1 && validRootScores.length > 1) {
        chosenMove = validRootScores[1].move;
      }
    }
  }

  // ✅ DEBUG: Log chosen move details to diagnose invalid-piece issues
  if (chosenMove) {
    // ✅ BITBOARD ONLY: Read from bitboards
    const debugBitboardPiece = getPieceAtFromBitboard(gameState.bitboardState.pieces, chosenMove.from.row, chosenMove.from.col);
    if (debugBitboardPiece !== chosenMove.pieceCode) {
      console.warn(`[BOT DEBUG] State mismatch for ${botColor}: move says ${chosenMove.pieceCode} at (${chosenMove.from.row},${chosenMove.from.col}), bitboard has: ${debugBitboardPiece}`);
    }
  }

  // Check if calculation was cancelled due to timeout (brain overheated)
  if (cancellationToken.cancelled && !chosenMove) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
    endTiming("cancelled");

    // FIX: Retry instead of getting stuck - the bot should always try to make a move
    if (store.getState().game.currentPlayerTurn === botColor && retryCount < MAX_BOT_RETRIES) {
      console.log(`Bot ${botColor} timed out, retrying...`);
      setTimeout(() => makeBotMove(botColor, retryCount + 1), 100);
    } else if (store.getState().game.currentPlayerTurn === botColor) {
      // ✅ FIX: Retries exhausted - resign to advance the game
      console.warn(`Bot ${botColor} timed out with no move after all retries, forcing resignation`);
      store.dispatch(resignGame(botColor));
    }
    return;
  }

  if (!chosenMove) {
    // Bot has no legal moves - check if it's checkmate or stalemate
    const { isKingInCheck } = require("../src/logic/bitboardLogic");
    const isInCheck = isKingInCheck(botColor, gameState);

    // In 4-player chess, having no legal moves = elimination (checkmate or stalemate)
    // Both cases should eliminate the player
    const eliminationReason = isInCheck ? "checkmated" : "stalemated";

    // Notify user about bot elimination
    try {
      const notificationService = require('./notificationService').default;
      notificationService.show(
        `Bot ${botColor.toUpperCase()} ${eliminationReason}!`,
        isInCheck ? "error" : "warning",
        4000
      );
    } catch (notificationError) {
      console.warn("Failed to show bot elimination notification:", notificationError);
    }

    // Auto-eliminate the bot by dispatching a resign action
    // This advances the turn to the next player
    store.dispatch(resignGame(botColor));

    clearTimeout(moveTimeout);
    botMoveInProgress = false; // Release the lock
    endTiming("no-legal-move");
    return;
  }

  // Re-validate move at execution time to ensure it's still legal
  const currentGameState = store.getState().game;
  // ✅ BITBOARD ONLY: Read from bitboards
  const pieceCode = getPieceAtFromBitboard(currentGameState.bitboardState.pieces, chosenMove.from.row, chosenMove.from.col);

  if (!pieceCode || pieceCode[0] !== botColor) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
    endTiming("invalid-piece");

    // ✅ FIX: Clear TT before retry - the cached move is stale/invalid
    transpositionTable.clear();
    console.warn(`Bot ${botColor} invalid-piece at (${chosenMove.from.row}, ${chosenMove.from.col}), expected ${botColor} piece, got: ${pieceCode || 'null'}`);

    // Retry with fresh state if it's still our turn
    if (currentGameState.currentPlayerTurn === botColor && retryCount < MAX_BOT_RETRIES) {
      setTimeout(() => makeBotMove(botColor, retryCount + 1), 50);
    } else if (currentGameState.currentPlayerTurn === botColor) {
      // ✅ FIX: Retries exhausted - resign to advance the game
      console.warn(`Bot ${botColor} failed to validate move after all retries, forcing resignation`);
      store.dispatch(resignGame(botColor));
    }
    return;
  }

  // Check if it's still this bot's turn
  if (currentGameState.currentPlayerTurn !== botColor) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
    endTiming("turn-mismatch");
    return;
  }

  // ✅ FIX: Re-validate the move is still legal before dispatching
  // This catches cases where getValidMovesBB returns moves that don't actually resolve check
  const moveStillValid = isValidMove(
    pieceCode,
    chosenMove.from,
    { row: chosenMove.to.row, col: chosenMove.to.col },
    currentGameState
  );

  if (!moveStillValid) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
    endTiming("move-no-longer-valid");

    // Clear TT and retry - the position might have changed
    transpositionTable.clear();
    console.warn(`Bot ${botColor} move from (${chosenMove.from.row},${chosenMove.from.col}) to (${chosenMove.to.row},${chosenMove.to.col}) is no longer valid, retrying...`);

    // Retry with fresh state if it's still our turn
    if (currentGameState.currentPlayerTurn === botColor && retryCount < MAX_BOT_RETRIES) {
      setTimeout(() => makeBotMove(botColor, retryCount + 1), 50);
    } else if (currentGameState.currentPlayerTurn === botColor) {
      // Retries exhausted - resign to advance the game
      console.warn(`Bot ${botColor} failed to find valid move after all retries, forcing resignation`);
      store.dispatch(resignGame(botColor));
    }
    return;
  }

  // Execute the chosen move - handle different game modes
  if (currentGameState.gameMode === 'p2p') {
    // In P2P mode, send the move over the network
    const moveData = {
      from: chosenMove.from,
      to: { row: chosenMove.to.row, col: chosenMove.to.col },
      pieceCode: pieceCode,
      playerColor: botColor,
    };
    p2pGameService.makeMove(moveData).catch(err => {
      console.error("Bot failed to send P2P move:", err);
    });
  } else {
    // In Single Player ('solo') mode, dispatch the move locally
    // Note: No need to play sounds here since makeMove action will handle it
    store.dispatch(
      makeMove({
        from: chosenMove.from,
        to: { row: chosenMove.to.row, col: chosenMove.to.col },
      })
    );
  }

  // ✅ Animation is now handled automatically by the Board component
  // when it detects the lastMove state change from the dispatched makeMove action

  // Cancel any thinking notifications immediately since move is complete
  try {
    const notificationService = require('./notificationService').default;
    notificationService.clearByPattern('is thinking hard');
  } catch (notificationError) {
    // Ignore notification service errors
  }

  // Release the lock and clear timeout
  clearTimeout(moveTimeout);
  botMoveInProgress = false;
  endTiming("move-complete");
};

// NOTE: skipBotTurn was removed - invalid moves don't advance turns
// If bot times out, it should either retry or let the game handle it

// Handle bot pawn promotion
const handleBotPromotion = (botColor: string) => {
  const gameState = store.getState().game;

  // Check if there's a pending promotion for this bot
  if (gameState.promotionState.isAwaiting &&
    gameState.promotionState.color === botColor) {

    // Bot always promotes to Queen (most valuable piece)
    store.dispatch(completePromotion({ pieceType: 'Q' }));
    return true;
  }

  return false;
};

export const botService = {
  makeBotMove,
  handleBotPromotion,
  cancelAllBotMoves: () => {
    // For local bot service, we don't need to clear any processing flags
    // since local bots don't use persistent processing flags
    console.log("BotService: All bot moves cancelled");
  },
};
