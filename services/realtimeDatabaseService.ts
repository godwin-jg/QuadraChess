import { getAuth, onAuthStateChanged, signInAnonymously } from "@react-native-firebase/auth";
import {
  equalTo,
  get,
  getDatabase,
  increment,
  limitToFirst,
  onChildAdded,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  runTransaction,
  serverTimestamp,
  set,
  update,
} from "@react-native-firebase/database";
import { ensureFirebaseApp } from "./firebaseInit";
import { GameState, SerializedGameState, turnOrder } from "../state/types";
import { Player } from "../app/services/networkService";
import { BOT_CONFIG, GAME_BONUSES, PIECE_VALUES } from "../config/gameConfig";
import { settingsService } from "./settingsService";
import {
  createEmptyPieceBitboards,
  deserializeBitboardPieces,
  rebuildBitboardStateFromPieces,
  serializeBitboardPieces,
} from "../src/logic/bitboardSerialization";
import {
  bitboardToArray,
  getPieceAtFromBitboard,
  squareBit,
  PROMOTION_MASKS,
} from "../src/logic/bitboardUtils";
import { getPinnedPiecesMask, isKingInCheck } from "../src/logic/bitboardLogic";
import {
  getRookCastlingCoords,
  getRookIdentifier,
  isCastlingMove,
  updateAllCheckStatus,
} from "../state/gameHelpers";
import { hasAnyLegalMoves } from "../src/logic/gameLogic";
import { getValidMovesBB } from "../src/logic/moveGeneration";
import { syncBitboardsFromArray } from "../state/gameSlice";

ensureFirebaseApp();
const authInstance = getAuth();
const db = getDatabase();

const DEFAULT_TIME_CONTROL = { baseMs: 5 * 60 * 1000, incrementMs: 0 };
const CLOCK_COLORS = ["r", "b", "y", "g"] as const;
type ClockColor = (typeof CLOCK_COLORS)[number];
const DEFAULT_TEAM_ASSIGNMENTS = { r: "A", y: "A", b: "B", g: "B" } as const;
const TEAM_IDS = ["A", "B"] as const;
type TeamId = (typeof TEAM_IDS)[number];
type TeamAssignments = { r: TeamId; b: TeamId; y: TeamId; g: TeamId };

const normalizeTeamAssignments = (assignments?: TeamAssignments): TeamAssignments => {
  const base = { ...DEFAULT_TEAM_ASSIGNMENTS } as TeamAssignments;
  if (!assignments) return base;
  CLOCK_COLORS.forEach((color) => {
    const team = assignments[color];
    base[color] = team === "A" || team === "B" ? team : DEFAULT_TEAM_ASSIGNMENTS[color];
  });
  return base;
};

const getTeamForColor = (assignments: TeamAssignments, color: ClockColor): TeamId =>
  assignments[color];

const getTeamColors = (assignments: TeamAssignments, teamId: TeamId): ClockColor[] =>
  CLOCK_COLORS.filter((color) => assignments[color] === teamId);

const getOpposingTeam = (teamId: TeamId): TeamId => (teamId === "A" ? "B" : "A");

// ✅ REMOVED: syncTeamClocks - each player now has individual clock
// Team mode only affects elimination, not clock synchronization

export interface RealtimeGame {
  id: string;
  hostId: string;
  hostName: string;
  players: { [playerId: string]: Player };
  gameState: GameState;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  maxPlayers: number;
  currentPlayerTurn: string;
  winner: string | null;
  joinCode?: string; // 4-digit join code for easy sharing
  lastMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
    playerId: string;
    timestamp: number;
    moveNumber?: number;
  } | null;
  lastActivity?: number;
}

export interface RealtimeMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  pieceCode: string;
  playerColor: string;
  playerId: string;
  timestamp: number;
  moveNumber: number;
}

class RealtimeDatabaseService {
  private currentUser: any = null;
  private gameUnsubscribe: (() => void) | null = null;
  private movesUnsubscribe: (() => void) | null = null;
  private serverTimeOffsetMs = 0;
  private serverTimeOffsetUnsubscribe: (() => void) | null = null;

  private ensureGameState(gameData: any, context: string): GameState | null {
    if (!gameData?.gameState) {
      console.warn(`[RealtimeDB] Missing gameState in ${context}`);
      return null;
    }
    return gameData.gameState as GameState;
  }

  getServerNow(): number {
    return Date.now() + (this.serverTimeOffsetMs || 0);
  }

  private startServerTimeOffsetListener(): void {
    if (this.serverTimeOffsetUnsubscribe) return;
    const offsetRef = ref(db, ".info/serverTimeOffset");
    this.serverTimeOffsetUnsubscribe = onValue(
      offsetRef,
      (snapshot) => {
        const offset = snapshot.val();
        this.serverTimeOffsetMs = typeof offset === "number" ? offset : 0;
      },
      (error) => {
        console.warn("[RealtimeDB] Failed to read server time offset:", error);
      }
    );
  }

  // Generate a 4-digit join code
  private generateJoinCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }

  private buildBitboardStateFromSnapshot(
    rawState: SerializedGameState,
    gameId?: string
  ): GameState {
    const eliminatedPlayers = rawState.eliminatedPlayers || [];
    let pieces = deserializeBitboardPieces(rawState.bitboardState?.pieces);

    if (
      (!rawState.bitboardState || !rawState.bitboardState.pieces) &&
      Array.isArray(rawState.boardState)
    ) {
      const fallbackBitboards = syncBitboardsFromArray(
        rawState.boardState,
        eliminatedPlayers
      );
      pieces = fallbackBitboards.pieces;

      if (gameId) {
        const backfillRef = ref(
          db,
          `games/${gameId}/gameState/bitboardState/pieces`
        );
        set(backfillRef, serializeBitboardPieces(pieces)).catch((error) => {
          console.warn("Failed to backfill bitboard pieces:", error);
        });
      }
    }

    const bitboardState = rebuildBitboardStateFromPieces(
      pieces,
      eliminatedPlayers,
      rawState.enPassantTargets || []
    );

    const boardState = bitboardToArray(
      bitboardState.pieces,
      rawState.eliminatedPieceBitboards
        ? deserializeBitboardPieces(rawState.eliminatedPieceBitboards as any)
        : undefined
    );
    const eliminatedPieceBitboards = rawState.eliminatedPieceBitboards
      ? deserializeBitboardPieces(rawState.eliminatedPieceBitboards as any)
      : createEmptyPieceBitboards();

    const baseMs = rawState.timeControl?.baseMs ?? DEFAULT_TIME_CONTROL.baseMs;
    const teamAssignments = normalizeTeamAssignments(rawState.teamAssignments as TeamAssignments);
    const teamMode = !!rawState.teamMode;
    const winningTeam = rawState.winningTeam ?? null;
    const gameState: GameState = {
      ...(rawState as unknown as GameState),
      boardState,
      bitboardState,
      eliminatedPieceBitboards,
      eliminatedPlayers,
      timeControl: rawState.timeControl ?? { baseMs, incrementMs: 0 },
      clocks: rawState.clocks ?? {
        r: baseMs,
        b: baseMs,
        y: baseMs,
        g: baseMs,
      },
      turnStartedAt: rawState.turnStartedAt ?? null,
      teamMode,
      teamAssignments,
      winningTeam,
    };

    gameState.checkStatus = updateAllCheckStatus(gameState);
    gameState.bitboardState.pinnedMask = getPinnedPiecesMask(
      gameState,
      gameState.currentPlayerTurn
    );

    return gameState;
  }

  private toSerializedGameState(
    state: GameState,
    pieces: Record<string, bigint>
  ): SerializedGameState {
    const { boardState, eliminatedPieceBitboards, bitboardState, ...rest } = state;
    return {
      ...rest,
      bitboardState: { pieces: serializeBitboardPieces(pieces) },
      eliminatedPieceBitboards: serializeBitboardPieces(
        eliminatedPieceBitboards || createEmptyPieceBitboards()
      ),
    };
  }

  private applyMoveWithBitboards(
    gameData: any,
    moveData: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
      isEnPassant?: boolean;
      enPassantTarget?: any;
    },
    playerId: string
  ) {
    const gameState = gameData.gameState as GameState;
    gameState.eliminatedPlayers = gameState.eliminatedPlayers || [];
    gameState.enPassantTargets = gameState.enPassantTargets || [];
    if (!gameState.capturedPieces || typeof gameState.capturedPieces !== "object" || Array.isArray(gameState.capturedPieces)) {
      gameState.capturedPieces = { r: [], b: [], y: [], g: [] };
    }
    (["r", "b", "y", "g"] as const).forEach((color) => {
      if (!Array.isArray(gameState.capturedPieces[color])) {
        gameState.capturedPieces[color] = [];
      }
    });
    gameState.scores = gameState.scores || { r: 0, b: 0, y: 0, g: 0 };
    gameState.hasMoved = gameState.hasMoved || {
      rK: false, rR1: false, rR2: false,
      bK: false, bR1: false, bR2: false,
      yK: false, yR1: false, yR2: false,
      gK: false, gR1: false, gR2: false,
    };
    gameState.gameOverState = gameState.gameOverState || {
      isGameOver: false,
      status: null,
      eliminatedPlayer: null,
    };
    gameState.promotionState = gameState.promotionState || {
      isAwaiting: false,
      position: null,
      color: null,
    };
    const baseMs = gameState.timeControl?.baseMs ?? DEFAULT_TIME_CONTROL.baseMs;
    const incrementMs =
      gameState.timeControl?.incrementMs ?? DEFAULT_TIME_CONTROL.incrementMs;
    gameState.timeControl = { baseMs, incrementMs };
    gameState.teamMode = !!gameState.teamMode;
    gameState.teamAssignments = normalizeTeamAssignments(
      gameState.teamAssignments as TeamAssignments
    );
    if (gameState.winningTeam === undefined) {
      gameState.winningTeam = null;
    }
    if (!gameState.clocks || typeof gameState.clocks !== "object" || Array.isArray(gameState.clocks)) {
      gameState.clocks = { r: baseMs, b: baseMs, y: baseMs, g: baseMs };
    }
    CLOCK_COLORS.forEach((color) => {
      if (typeof gameState.clocks[color] !== "number") {
        gameState.clocks[color] = baseMs;
      }
    });
    if (gameState.turnStartedAt === undefined) {
      gameState.turnStartedAt = null;
    }
    gameState.justEliminated = null;

    let pieces = deserializeBitboardPieces(gameState.bitboardState?.pieces);
    const eliminatedPieceBitboards = gameState.eliminatedPieceBitboards
      ? deserializeBitboardPieces(gameState.eliminatedPieceBitboards as any)
      : createEmptyPieceBitboards();
    if (
      (!gameState.bitboardState || !gameState.bitboardState.pieces) &&
      Array.isArray(gameState.boardState)
    ) {
      const normalizedBoard = this.convertBoardState(gameState.boardState, false);
      const fallbackBitboards = syncBitboardsFromArray(
        normalizedBoard,
        gameState.eliminatedPlayers
      );
      pieces = fallbackBitboards.pieces;
      gameState.bitboardState = {
        pieces: serializeBitboardPieces(pieces),
      } as any;
    }
    let workingState: GameState = {
      ...gameState,
      boardState: bitboardToArray(pieces),
      bitboardState: rebuildBitboardStateFromPieces(
        pieces,
        gameState.eliminatedPlayers,
        gameState.enPassantTargets
      ),
      eliminatedPieceBitboards,
    };

    workingState.checkStatus = updateAllCheckStatus(workingState);
    workingState.bitboardState.pinnedMask = getPinnedPiecesMask(
      workingState,
      workingState.currentPlayerTurn
    );

    const { from, to } = moveData;
    if (
      from.row < 0 ||
      from.row >= 14 ||
      from.col < 0 ||
      from.col >= 14 ||
      to.row < 0 ||
      to.row >= 14 ||
      to.col < 0 ||
      to.col >= 14
    ) {
      return gameData;
    }

    if (moveData.playerColor !== workingState.currentPlayerTurn) {
      return gameData;
    }

    if (gameState.eliminatedPlayers.includes(moveData.playerColor)) {
      return gameData;
    }

    const pieceCode = getPieceAtFromBitboard(pieces, from.row, from.col);
    if (!pieceCode || pieceCode !== moveData.pieceCode) {
      return gameData;
    }

    if (pieceCode[0] !== moveData.playerColor) {
      return gameData;
    }

    const now = this.getServerNow();
    const moverColor = moveData.playerColor as ClockColor;
    if (!CLOCK_COLORS.includes(moverColor)) {
      return gameData;
    }
    if (gameState.turnStartedAt === null) {
      gameState.turnStartedAt = now;
    }
    const elapsedMs = Math.max(0, now - (gameState.turnStartedAt ?? now));
    // ✅ UPDATED: Each player has their own individual clock (even in team mode)
    // Team mode only affects elimination - if one player times out, the whole team is eliminated
    const remainingMs = Math.max(0, gameState.clocks[moverColor] - elapsedMs);
    gameState.clocks[moverColor] = remainingMs;
    if (remainingMs <= 0) {
      return this.applyTimeoutToGameData(
        gameData,
        moverColor,
        now,
        pieces,
        eliminatedPieceBitboards
      );
    }

    const validMoves = getValidMovesBB(pieceCode, from, workingState);
    const targetBit = squareBit(to.row * 14 + to.col);
    if ((validMoves & targetBit) === 0n) {
      return gameData;
    }

    gameState.enPassantTargets = gameState.enPassantTargets.filter(
      (target) => target.createdByTurn !== gameState.currentPlayerTurn
    );

    const pieceType = pieceCode[1];
    const isCastling = isCastlingMove(
      pieceCode,
      from.row,
      from.col,
      to.row,
      to.col
    );
    const enPassantTarget = gameState.enPassantTargets.find(
      (target) =>
        target.position.row === to.row &&
        target.position.col === to.col &&
        pieceType === "P" &&
        target.createdBy.charAt(0) !== moveData.playerColor
    );
    const isEnPassant = !!enPassantTarget;

    let capturedPiece: string | null = null;
    let capturedRow = to.row;
    let capturedCol = to.col;

    if (isEnPassant && enPassantTarget) {
      switch (enPassantTarget.createdBy.charAt(0)) {
        case "r":
          capturedRow = enPassantTarget.position.row - 1;
          capturedCol = enPassantTarget.position.col;
          break;
        case "y":
          capturedRow = enPassantTarget.position.row + 1;
          capturedCol = enPassantTarget.position.col;
          break;
        case "b":
          capturedRow = enPassantTarget.position.row;
          capturedCol = enPassantTarget.position.col + 1;
          break;
        case "g":
          capturedRow = enPassantTarget.position.row;
          capturedCol = enPassantTarget.position.col - 1;
          break;
        default:
          break;
      }
      capturedPiece = getPieceAtFromBitboard(pieces, capturedRow, capturedCol);
    } else {
      capturedPiece = getPieceAtFromBitboard(pieces, to.row, to.col);
    }

    if (capturedPiece && capturedPiece[1] === "K") {
      const targetColor = capturedPiece[0];
      if (!gameState.eliminatedPlayers.includes(targetColor)) {
        return gameData;
      }
    }

    const fromIdx = from.row * 14 + from.col;
    const toIdx = to.row * 14 + to.col;
    const moveMask = squareBit(fromIdx) | squareBit(toIdx);
    pieces[pieceCode] ^= moveMask;

    if (capturedPiece) {
      const capturedMask = squareBit(capturedRow * 14 + capturedCol);
      pieces[capturedPiece] ^= capturedMask;
    }

    if (isCastling) {
      const rookCoords = getRookCastlingCoords(moveData.playerColor, {
        row: to.row,
        col: to.col,
      });
      if (rookCoords) {
        const rookCode = `${moveData.playerColor}R`;
        const rookFromIdx = rookCoords.rookFrom.row * 14 + rookCoords.rookFrom.col;
        const rookToIdx = rookCoords.rookTo.row * 14 + rookCoords.rookTo.col;
        pieces[rookCode] ^= squareBit(rookFromIdx) | squareBit(rookToIdx);
        const rookId = getRookIdentifier(
          moveData.playerColor,
          rookCoords.rookFrom.row,
          rookCoords.rookFrom.col
        );
        if (rookId) {
          gameState.hasMoved[rookId as keyof typeof gameState.hasMoved] = true;
        }
      }
    }

    if (pieceType === "K") {
      gameState.hasMoved[`${moveData.playerColor}K` as keyof typeof gameState.hasMoved] = true;
    } else if (pieceType === "R") {
      const rookId = getRookIdentifier(moveData.playerColor, from.row, from.col);
      if (rookId) {
        gameState.hasMoved[rookId as keyof typeof gameState.hasMoved] = true;
      }
    }

    if (capturedPiece && capturedPiece[1] === "R") {
      const capturedRookId = getRookIdentifier(
        capturedPiece[0],
        capturedRow,
        capturedCol
      );
      if (capturedRookId) {
        gameState.hasMoved[capturedRookId as keyof typeof gameState.hasMoved] = true;
      }
    }

    if (capturedPiece && !gameState.eliminatedPlayers.includes(capturedPiece[0])) {
      gameState.capturedPieces[moveData.playerColor as keyof typeof gameState.capturedPieces].push(
        capturedPiece
      );
      const capturedValue =
        PIECE_VALUES[capturedPiece[1] as keyof typeof PIECE_VALUES] || 0;
      gameState.scores[moveData.playerColor as keyof typeof gameState.scores] += capturedValue;
    }

    if (pieceType === "P") {
      const isTwoSquareMove =
        (Math.abs(to.row - from.row) === 2 && to.col === from.col) ||
        (Math.abs(to.col - from.col) === 2 && to.row === from.row);
      if (isTwoSquareMove) {
        const skippedSquare = (() => {
          switch (moveData.playerColor) {
            case "r":
              return { row: to.row + 1, col: to.col };
            case "y":
              return { row: to.row - 1, col: to.col };
            case "b":
              return { row: to.row, col: to.col - 1 };
            case "g":
              return { row: to.row, col: to.col + 1 };
            default:
              return null;
          }
        })();
        if (skippedSquare) {
          gameState.enPassantTargets.push({
            position: skippedSquare,
            createdBy: pieceCode,
            createdByTurn: moveData.playerColor,
          });
        }
      }
    }

    const isPromotion =
      pieceType === "P" &&
      (squareBit(to.row * 14 + to.col) & PROMOTION_MASKS[moveData.playerColor]) !== 0n;

    if (isPromotion) {
      gameState.promotionState = {
        isAwaiting: true,
        position: { row: to.row, col: to.col },
        color: moveData.playerColor,
      };
      gameState.gameStatus = "promotion";
    }

    const rebuiltState = rebuildBitboardStateFromPieces(
      pieces,
      gameState.eliminatedPlayers,
      gameState.enPassantTargets
    );
    const hydratedState: GameState = {
      ...gameState,
      bitboardState: rebuiltState,
      boardState: bitboardToArray(rebuiltState.pieces, eliminatedPieceBitboards),
      eliminatedPieceBitboards,
    };
    hydratedState.checkStatus = updateAllCheckStatus(hydratedState);
    hydratedState.bitboardState.pinnedMask = getPinnedPiecesMask(
      hydratedState,
      hydratedState.currentPlayerTurn
    );

    if (!hydratedState.promotionState.isAwaiting) {
      const otherPlayers = turnOrder.filter(
        (player) =>
          player !== moveData.playerColor &&
          !hydratedState.eliminatedPlayers.includes(player)
      );

      for (const opponent of otherPlayers) {
        // Safety check: verify opponent has pieces before checking legal moves
        // This prevents false eliminations due to corrupted/empty bitboard state
        const opponentHasPieces = this.playerHasPiecesOnBoard(rebuiltState.pieces, opponent);
        if (!opponentHasPieces) {
          console.warn(
            `[RealtimeDB] Skipping legal move check for ${opponent} - no pieces found in bitboard. ` +
            `This may indicate corrupted state. Move: ${moveData.playerColor} ${pieceCode} to (${to.row},${to.col})`
          );
          continue; // Skip this opponent - don't eliminate based on corrupted data
        }

        const opponentHasMoves = hasAnyLegalMoves(opponent, hydratedState);
        if (!opponentHasMoves) {
          const inCheck = isKingInCheck(opponent, hydratedState);
          const status = inCheck ? "checkmate" : "stalemate";

          console.log(
            `[RealtimeDB] Player ${opponent} has no legal moves. ` +
            `inCheck=${inCheck}, status=${status}, teamMode=${hydratedState.teamMode}`
          );

          if (hydratedState.teamMode) {
            return this.applyTeamEliminationToGameData(
              gameData,
              opponent as ClockColor,
              status,
              now,
              rebuiltState.pieces,
              hydratedState.eliminatedPieceBitboards,
              {
                from,
                to,
                pieceCode,
                playerColor: moveData.playerColor,
                playerId,
                capturedPiece: capturedPiece ?? null,
              }
            );
          }
          hydratedState.gameStatus = status;
          hydratedState.eliminatedPlayers.push(opponent);
          hydratedState.justEliminated = opponent;
          this.captureEliminatedPieces(
            hydratedState.eliminatedPieceBitboards,
            rebuiltState.pieces,
            opponent as ClockColor
          );
          hydratedState.gameOverState = {
            isGameOver: true,
            status,
            eliminatedPlayer: opponent,
          };

          if (inCheck) {
            hydratedState.scores[moveData.playerColor as keyof typeof hydratedState.scores] +=
              GAME_BONUSES.CHECKMATE;
          } else {
            const remainingPlayers = turnOrder.filter(
              (player) => !hydratedState.eliminatedPlayers.includes(player)
            );
            hydratedState.scores[moveData.playerColor as keyof typeof hydratedState.scores] +=
              remainingPlayers.length * GAME_BONUSES.STALEMATE_PER_PLAYER;
          }
          break;
        }
      }

      const nextPlayer = this.getNextPlayer(
        moveData.playerColor,
        hydratedState.eliminatedPlayers
      );
      hydratedState.currentPlayerTurn = nextPlayer;
      gameData.currentPlayerTurn = nextPlayer;

      if (hydratedState.eliminatedPlayers.length >= 3) {
        const winner = turnOrder.find(
          (player) => !hydratedState.eliminatedPlayers.includes(player)
        );
        if (winner) {
          hydratedState.winner = winner;
          hydratedState.gameStatus = "finished";
          hydratedState.gameOverState = {
            isGameOver: true,
            status: "finished",
            eliminatedPlayer: null,
          };
          gameData.winner = winner;
          gameData.status = "finished";
        }
      } else if (hydratedState.gameStatus !== "promotion") {
        hydratedState.gameStatus = "active";
      }
    }

    if (hydratedState.timeControl.incrementMs > 0) {
      // ✅ UPDATED: Only add increment to the mover's individual clock
      hydratedState.clocks[moverColor] = Math.max(
        0,
        hydratedState.clocks[moverColor] + hydratedState.timeControl.incrementMs
      );
    }
    if (
      hydratedState.gameStatus === "finished" ||
      hydratedState.gameStatus === "checkmate" ||
      hydratedState.gameStatus === "stalemate"
    ) {
      hydratedState.turnStartedAt = null;
    } else {
      hydratedState.turnStartedAt = now;
    }

    const finalBitboards = rebuildBitboardStateFromPieces(
      rebuiltState.pieces,
      hydratedState.eliminatedPlayers,
      hydratedState.enPassantTargets
    );
    hydratedState.bitboardState = finalBitboards;
    hydratedState.checkStatus = updateAllCheckStatus(hydratedState);
    hydratedState.bitboardState.pinnedMask = getPinnedPiecesMask(
      hydratedState,
      hydratedState.currentPlayerTurn
    );

    hydratedState.version = (hydratedState.version ?? 0) + 1;
    gameData.gameState = this.toSerializedGameState(
      hydratedState,
      finalBitboards.pieces
    );
    gameData.lastMove = {
      from,
      to,
      pieceCode,
      playerColor: moveData.playerColor,
      playerId: playerId,
      timestamp: now,
      capturedPiece: capturedPiece ?? null,
    };
    gameData.lastActivity = now;

    return gameData;
  }

  private applyTimeoutToGameData(
    gameData: any,
    playerColor: ClockColor,
    now: number,
    pieces?: Record<string, bigint>,
    eliminatedPieceBitboards?: Record<string, bigint>
  ) {
    const gameState = gameData.gameState as GameState;

    // ✅ Guard: Normalize clock state to avoid false timeouts from corrupted data
    const baseMs = gameState.timeControl?.baseMs ?? DEFAULT_TIME_CONTROL.baseMs;
    if (!gameState.clocks || typeof gameState.clocks !== "object" || Array.isArray(gameState.clocks)) {
      gameState.clocks = { r: baseMs, b: baseMs, y: baseMs, g: baseMs };
    }
    CLOCK_COLORS.forEach((color) => {
      if (!Number.isFinite(gameState.clocks?.[color])) {
        gameState.clocks[color] = baseMs;
      }
    });
    if (gameState.turnStartedAt !== null && typeof gameState.turnStartedAt !== "number") {
      gameState.turnStartedAt = null;
    }

    // ✅ CRITICAL FIX: Server-side validation of timeout
    // Calculate actual remaining time before accepting client's timeout request
    const turnStartedAt = gameState.turnStartedAt ?? now;
    const elapsedMs = Math.max(0, now - turnStartedAt);

    let actualRemainingMs: number;
    // ✅ UPDATED: Each player has their own individual clock
    // Only check the current player's clock for timeout validation
    actualRemainingMs = Math.max(0, (gameState.clocks?.[playerColor] ?? 0) - elapsedMs);

    console.log(
      `[RealtimeDB] Timeout request for player ${playerColor}. ` +
      `teamMode=${gameState.teamMode}, storedClock=${gameState.clocks?.[playerColor]}ms, ` +
      `elapsed=${elapsedMs}ms, actualRemaining=${actualRemainingMs}ms`
    );

    // Reject timeout if player still has time (with 500ms grace period for network latency)
    if (actualRemainingMs > 500) {
      console.log(
        `[RealtimeDB] Rejecting premature timeout - ${playerColor} has ${actualRemainingMs}ms remaining`
      );
      return gameData;
    }

    console.log(
      `[RealtimeDB] Applying timeout for player ${playerColor}. ` +
      `teamMode=${gameState.teamMode}, clock=${gameState.clocks?.[playerColor]}ms`
    );

    if (gameState.teamMode) {
      const resolvedPieces =
        pieces ?? deserializeBitboardPieces(gameState.bitboardState?.pieces);
      const resolvedEliminatedPieces =
        eliminatedPieceBitboards ??
        (gameState.eliminatedPieceBitboards
          ? deserializeBitboardPieces(gameState.eliminatedPieceBitboards as any)
          : createEmptyPieceBitboards());

      console.log(
        `[RealtimeDB] Team timeout elimination triggered for ${playerColor} (team mode)`
      );

      return this.applyTeamEliminationToGameData(
        gameData,
        playerColor,
        "finished",
        now,
        resolvedPieces,
        resolvedEliminatedPieces
      );
    }
    gameState.eliminatedPlayers = gameState.eliminatedPlayers || [];
    gameState.enPassantTargets = gameState.enPassantTargets || [];
    gameState.scores = gameState.scores || { r: 0, b: 0, y: 0, g: 0 };
    gameState.hasMoved = gameState.hasMoved || {
      rK: false, rR1: false, rR2: false,
      bK: false, bR1: false, bR2: false,
      yK: false, yR1: false, yR2: false,
      gK: false, gR1: false, gR2: false,
    };
    gameState.gameOverState = gameState.gameOverState || {
      isGameOver: false,
      status: null,
      eliminatedPlayer: null,
    };
    gameState.promotionState = { isAwaiting: false, position: null, color: null };

    let resolvedPieces =
      pieces ?? deserializeBitboardPieces(gameState.bitboardState?.pieces);
    if (
      (!gameState.bitboardState || !gameState.bitboardState.pieces) &&
      Array.isArray(gameState.boardState)
    ) {
      const normalizedBoard = this.convertBoardState(gameState.boardState, false);
      const fallbackBitboards = syncBitboardsFromArray(
        normalizedBoard,
        gameState.eliminatedPlayers
      );
      resolvedPieces = fallbackBitboards.pieces;
      gameState.bitboardState = {
        pieces: serializeBitboardPieces(resolvedPieces),
      } as any;
    }

    const resolvedEliminatedPieces =
      eliminatedPieceBitboards ??
      (gameState.eliminatedPieceBitboards
        ? deserializeBitboardPieces(gameState.eliminatedPieceBitboards as any)
        : createEmptyPieceBitboards());

    gameState.clocks[playerColor] = 0;

    if (!gameState.eliminatedPlayers.includes(playerColor)) {
      gameState.eliminatedPlayers.push(playerColor);
      gameState.justEliminated = playerColor;
      this.captureEliminatedPieces(
        resolvedEliminatedPieces,
        resolvedPieces,
        playerColor,
        true
      );
    }

    // Remove en passant targets created by the eliminated player
    gameState.enPassantTargets = gameState.enPassantTargets.filter(
      (target) => target.createdBy?.charAt(0) !== playerColor
    );

    const finalBitboards = rebuildBitboardStateFromPieces(
      resolvedPieces,
      gameState.eliminatedPlayers,
      gameState.enPassantTargets
    );

    const hydratedState: GameState = {
      ...gameState,
      boardState: bitboardToArray(finalBitboards.pieces, resolvedEliminatedPieces),
      bitboardState: finalBitboards,
      eliminatedPieceBitboards: resolvedEliminatedPieces,
    };

    hydratedState.checkStatus = updateAllCheckStatus(hydratedState);
    hydratedState.bitboardState.pinnedMask = getPinnedPiecesMask(
      hydratedState,
      hydratedState.currentPlayerTurn
    );

    if (hydratedState.eliminatedPlayers.length >= 3) {
      const winner = turnOrder.find(
        (player) => !hydratedState.eliminatedPlayers.includes(player)
      );
      if (winner) {
        hydratedState.winner = winner;
        hydratedState.gameStatus = "finished";
        hydratedState.gameOverState = {
          isGameOver: true,
          status: "finished",
          eliminatedPlayer: null,
        };
        gameData.winner = winner;
        gameData.status = "finished";
      }
      hydratedState.turnStartedAt = null;
    } else {
      const nextPlayer = this.getNextPlayer(playerColor, hydratedState.eliminatedPlayers);
      hydratedState.currentPlayerTurn = nextPlayer;
      gameData.currentPlayerTurn = nextPlayer;
      hydratedState.gameStatus = "active";
      hydratedState.turnStartedAt = now;
    }

    hydratedState.version = (hydratedState.version ?? 0) + 1;
    gameData.gameState = this.toSerializedGameState(
      hydratedState,
      finalBitboards.pieces
    );
    gameData.lastActivity = now;

    return gameData;
  }

  private applyNoMoveEliminationToGameData(
    gameData: any,
    playerColor: ClockColor,
    status: "checkmate" | "stalemate",
    now: number,
    pieces?: Record<string, bigint>,
    eliminatedPieceBitboards?: Record<string, bigint>
  ) {
    const gameState = gameData.gameState as GameState;
    gameState.eliminatedPlayers = gameState.eliminatedPlayers || [];
    gameState.enPassantTargets = gameState.enPassantTargets || [];
    gameState.scores = gameState.scores || { r: 0, b: 0, y: 0, g: 0 };
    gameState.hasMoved = gameState.hasMoved || {
      rK: false, rR1: false, rR2: false,
      bK: false, bR1: false, bR2: false,
      yK: false, yR1: false, yR2: false,
      gK: false, gR1: false, gR2: false,
    };
    gameState.gameOverState = gameState.gameOverState || {
      isGameOver: false,
      status: null,
      eliminatedPlayer: null,
    };
    gameState.promotionState = { isAwaiting: false, position: null, color: null };

    const baseMs = gameState.timeControl?.baseMs ?? DEFAULT_TIME_CONTROL.baseMs;
    const incrementMs =
      gameState.timeControl?.incrementMs ?? DEFAULT_TIME_CONTROL.incrementMs;
    gameState.timeControl = { baseMs, incrementMs };
    if (!gameState.clocks || typeof gameState.clocks !== "object" || Array.isArray(gameState.clocks)) {
      gameState.clocks = { r: baseMs, b: baseMs, y: baseMs, g: baseMs };
    }
    CLOCK_COLORS.forEach((color) => {
      if (typeof gameState.clocks[color] !== "number") {
        gameState.clocks[color] = baseMs;
      }
    });

    let resolvedPieces =
      pieces ?? deserializeBitboardPieces(gameState.bitboardState?.pieces);
    if (
      (!gameState.bitboardState || !gameState.bitboardState.pieces) &&
      Array.isArray(gameState.boardState)
    ) {
      const normalizedBoard = this.convertBoardState(gameState.boardState, false);
      const fallbackBitboards = syncBitboardsFromArray(
        normalizedBoard,
        gameState.eliminatedPlayers
      );
      resolvedPieces = fallbackBitboards.pieces;
      gameState.bitboardState = {
        pieces: serializeBitboardPieces(resolvedPieces),
      } as any;
    }

    const resolvedEliminatedPieces =
      eliminatedPieceBitboards ??
      (gameState.eliminatedPieceBitboards
        ? deserializeBitboardPieces(gameState.eliminatedPieceBitboards as any)
        : createEmptyPieceBitboards());

    if (gameState.teamMode) {
      return this.applyTeamEliminationToGameData(
        gameData,
        playerColor,
        status,
        now,
        resolvedPieces,
        resolvedEliminatedPieces
      );
    }

    if (!gameState.eliminatedPlayers.includes(playerColor)) {
      gameState.eliminatedPlayers.push(playerColor);
      gameState.justEliminated = playerColor;
      this.captureEliminatedPieces(
        resolvedEliminatedPieces,
        resolvedPieces,
        playerColor,
        true
      );
    }

    // Remove en passant targets created by the eliminated player
    gameState.enPassantTargets = gameState.enPassantTargets.filter(
      (target) => target.createdBy?.charAt(0) !== playerColor
    );

    const scoringPlayer = gameData.lastMove?.playerColor;
    if (
      scoringPlayer &&
      scoringPlayer !== playerColor &&
      CLOCK_COLORS.includes(scoringPlayer as ClockColor) &&
      !gameState.eliminatedPlayers.includes(scoringPlayer)
    ) {
      if (status === "checkmate") {
        gameState.scores[scoringPlayer as ClockColor] += GAME_BONUSES.CHECKMATE;
      } else {
        const remainingPlayers = turnOrder.filter(
          (player) => !gameState.eliminatedPlayers.includes(player)
        );
        gameState.scores[scoringPlayer as ClockColor] +=
          remainingPlayers.length * GAME_BONUSES.STALEMATE_PER_PLAYER;
      }
    }

    const finalBitboards = rebuildBitboardStateFromPieces(
      resolvedPieces,
      gameState.eliminatedPlayers,
      gameState.enPassantTargets
    );

    const hydratedState: GameState = {
      ...gameState,
      boardState: bitboardToArray(finalBitboards.pieces, resolvedEliminatedPieces),
      bitboardState: finalBitboards,
      eliminatedPieceBitboards: resolvedEliminatedPieces,
    };

    hydratedState.checkStatus = updateAllCheckStatus(hydratedState);
    hydratedState.bitboardState.pinnedMask = getPinnedPiecesMask(
      hydratedState,
      hydratedState.currentPlayerTurn
    );

    hydratedState.gameOverState = {
      isGameOver: true,
      status,
      eliminatedPlayer: playerColor,
    };
    hydratedState.gameStatus = status;

    if (hydratedState.eliminatedPlayers.length >= 3) {
      const winner = turnOrder.find(
        (player) => !hydratedState.eliminatedPlayers.includes(player)
      );
      if (winner) {
        hydratedState.winner = winner;
        hydratedState.gameStatus = "finished";
        hydratedState.gameOverState = {
          isGameOver: true,
          status: "finished",
          eliminatedPlayer: null,
        };
        gameData.winner = winner;
        gameData.status = "finished";
      }
      hydratedState.turnStartedAt = null;
    } else {
      const nextPlayer = this.getNextPlayer(playerColor, hydratedState.eliminatedPlayers);
      hydratedState.currentPlayerTurn = nextPlayer;
      gameData.currentPlayerTurn = nextPlayer;
      hydratedState.gameStatus = "active";
      hydratedState.turnStartedAt = now;
    }

    hydratedState.version = (hydratedState.version ?? 0) + 1;
    gameData.gameState = this.toSerializedGameState(
      hydratedState,
      finalBitboards.pieces
    );
    gameData.lastActivity = now;

    return gameData;
  }

  private applyTeamEliminationToGameData(
    gameData: any,
    losingColor: ClockColor,
    status: "checkmate" | "stalemate" | "finished",
    now: number,
    pieces: Record<string, bigint>,
    eliminatedPieceBitboards: Record<string, bigint>,
    lastMove?: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
      playerId: string;
      capturedPiece?: string | null;
    }
  ) {
    const gameState = gameData.gameState as GameState;
    const baseMs = gameState.timeControl?.baseMs ?? DEFAULT_TIME_CONTROL.baseMs;
    const incrementMs =
      gameState.timeControl?.incrementMs ?? DEFAULT_TIME_CONTROL.incrementMs;
    gameState.timeControl = { baseMs, incrementMs };
    if (!gameState.clocks || typeof gameState.clocks !== "object" || Array.isArray(gameState.clocks)) {
      gameState.clocks = { r: baseMs, b: baseMs, y: baseMs, g: baseMs };
    }
    CLOCK_COLORS.forEach((color) => {
      if (typeof gameState.clocks[color] !== "number") {
        gameState.clocks[color] = baseMs;
      }
    });
    // Initialize required arrays if they don't exist
    if (!Array.isArray(gameState.eliminatedPlayers)) {
      gameState.eliminatedPlayers = [];
    }
    if (!Array.isArray(gameState.enPassantTargets)) {
      gameState.enPassantTargets = [];
    }
    gameState.teamMode = !!gameState.teamMode;
    gameState.teamAssignments = normalizeTeamAssignments(
      gameState.teamAssignments as TeamAssignments
    );
    const losingTeam = getTeamForColor(gameState.teamAssignments, losingColor);
    const winningTeam = getOpposingTeam(losingTeam);
    const losingColors = getTeamColors(gameState.teamAssignments, losingTeam);
    const winningColors = getTeamColors(gameState.teamAssignments, winningTeam);

    console.log(
      `[RealtimeDB] TEAM ELIMINATION: Player ${losingColor} triggered ${status}. ` +
      `Losing team ${losingTeam} (${losingColors.join(",")}), ` +
      `Winning team ${winningTeam} (${winningColors.join(",")})` +
      (lastMove ? `, after move: ${lastMove.pieceCode} to (${lastMove.to.row},${lastMove.to.col})` : "")
    );

    // ✅ UPDATED: Set each eliminated player's clock to 0 individually
    losingColors.forEach((color) => {
      gameState.clocks[color] = 0;
    });

    losingColors.forEach((color) => {
      if (!gameState.eliminatedPlayers.includes(color)) {
        gameState.eliminatedPlayers.push(color);
        this.captureEliminatedPieces(eliminatedPieceBitboards, pieces, color, true);
      }
    });

    gameState.justEliminated = losingColor;
    gameState.winningTeam = winningTeam;
    gameState.winner = winningColors[0] ?? null;
    // In team mode, game ends when a team is eliminated, so always set "finished"
    gameState.gameStatus = "finished";
    gameState.gameOverState = {
      isGameOver: true,
      status: "finished",
      eliminatedPlayer: losingColor,
    };
    gameState.currentPlayerTurn = winningColors[0] ?? gameState.currentPlayerTurn;
    gameState.turnStartedAt = null;
    gameData.currentPlayerTurn = gameState.currentPlayerTurn;
    gameData.status = "finished";

    // Remove en passant targets created by losing team
    gameState.enPassantTargets = gameState.enPassantTargets.filter(
      (target) => !losingColors.includes(target.createdBy?.charAt(0) as ClockColor)
    );

    const finalBitboards = rebuildBitboardStateFromPieces(
      pieces,
      gameState.eliminatedPlayers,
      gameState.enPassantTargets
    );

    const hydratedState: GameState = {
      ...gameState,
      boardState: bitboardToArray(finalBitboards.pieces, eliminatedPieceBitboards),
      bitboardState: finalBitboards,
      eliminatedPieceBitboards,
    };

    hydratedState.checkStatus = updateAllCheckStatus(hydratedState);
    hydratedState.bitboardState.pinnedMask = getPinnedPiecesMask(
      hydratedState,
      hydratedState.currentPlayerTurn
    );
    hydratedState.version = (hydratedState.version ?? 0) + 1;

    gameData.gameState = this.toSerializedGameState(
      hydratedState,
      finalBitboards.pieces
    );

    if (lastMove) {
      gameData.lastMove = {
        ...lastMove,
        timestamp: now,
        capturedPiece: lastMove.capturedPiece ?? null,
      };
    }
    gameData.lastActivity = now;

    return gameData;
  }

  // OPTIMIZATION: Connection keep-alive
  private keepAliveInterval: ReturnType<typeof setInterval> | null = null;
  private readonly KEEP_ALIVE_INTERVAL = 30000; // 30 seconds

  // Authentication methods with lightweight auth monitoring
  async signInAnonymously(): Promise<string> {
    const withTimeout = async <T>(
      promise: Promise<T>,
      timeoutMs: number,
      label: string
    ): Promise<T> => {
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs);
      });
      try {
        return await Promise.race([promise, timeoutPromise]);
      } finally {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      }
    };

    try {

      const currentUser = authInstance.currentUser;
      if (currentUser) {
        this.currentUser = currentUser;
        this.setupLightweightAuthListener();
        this.startServerTimeOffsetListener();
        this.startKeepAlive();
        return currentUser.uid;
      }

      // Sign in anonymously
      const userCredential = await withTimeout(
        signInAnonymously(authInstance),
        10000,
        "Authentication"
      );
      this.currentUser = userCredential.user;

      // Set up lightweight auth state listener (minimal overhead)
      this.setupLightweightAuthListener();
      this.startServerTimeOffsetListener();

      // OPTIMIZATION: Start keep-alive to maintain connection
      this.startKeepAlive();

      return userCredential.user.uid;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      // Don't fall back to mock user - throw the error so calling code can handle it
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to authenticate: ${errorMessage}`);
    }
  }

  // Lightweight auth state listener - minimal performance impact
  private setupLightweightAuthListener(): void {
    // Only set up listener once
    if (this.authListenerSetup) return;
    this.authListenerSetup = true;

    onAuthStateChanged(authInstance, (user) => {
      if (user) {
        this.currentUser = user;
      } else {
        this.currentUser = null;

        // Non-blocking reconnection attempt
        this.attemptLightweightReconnection();
      }
    });
  }

  private authListenerSetup = false;

  // Non-blocking reconnection attempt
  private async attemptLightweightReconnection(): Promise<void> {
    try {
      // Only attempt if we were in a game (avoid unnecessary reconnections)
      if (this.gameUnsubscribe) {
        // Use setTimeout to make it non-blocking
        setTimeout(async () => {
          try {
            await this.signInAnonymously();
          } catch (error) {
            console.warn("Lightweight reconnection failed:", error);
          }
        }, 1000); // 1 second delay to avoid immediate retry
      }
    } catch (error) {
      console.warn("Lightweight reconnection setup failed:", error);
    }
  }

  getCurrentUser() {
    return this.currentUser || authInstance.currentUser;
  }

  // Check authentication status
  async checkAuthStatus(): Promise<boolean> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        return false;
      }


      // Test a simple read operation with better error handling
      try {
        const testRef = ref(db, "games");
        const snapshot = await get(query(testRef, limitToFirst(1)));

        if (snapshot.exists()) {
          return true;
        } else {
          return true; // Still authenticated, just no data
        }
      } catch (dbError) {
        console.error("❌ Database access error:", dbError);
        return false;
      }
    } catch (error) {
      console.error("❌ Authentication check failed:", error);
      return false;
    }
  }


  // Create game directly in database (Cloud Functions temporarily disabled)
  async createGame(hostName: string, botColors: string[] = []): Promise<string> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");


      // Use direct database creation method
      return await this.createGameDirectly(hostName, botColors);
    } catch (error) {
      console.error("Error creating game:", error);
      throw error;
    }
  }

  // Fallback method to create game directly in database
  private async createGameDirectly(hostName: string, botColors: string[] = []): Promise<string> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("User not authenticated");


    // Import initial board state
    const { initialBoardState } = require("../state/boardState");

    const initialBitboards = syncBitboardsFromArray(initialBoardState);
    const serializedPieces = serializeBitboardPieces(initialBitboards.pieces);

    const settings = settingsService.getSettings();
    const botDifficulty =
      settings?.game?.botDifficulty ?? BOT_CONFIG.DEFAULT_DIFFICULTY;
    const botTeamMode = settings?.game?.botTeamMode ?? false;

    const newGameState: SerializedGameState = {
      bitboardState: { pieces: serializedPieces },
      eliminatedPieceBitboards: serializeBitboardPieces(createEmptyPieceBitboards()),
      currentPlayerTurn: "r",
      gameStatus: "waiting",
      version: 0,
      selectedPiece: null,
      validMoves: [],
      capturedPieces: { r: [], b: [], y: [], g: [] },
      checkStatus: { r: false, b: false, y: false, g: false },
      winner: null,
      eliminatedPlayers: [],
      justEliminated: null,
      scores: { r: 0, b: 0, y: 0, g: 0 },
      timeControl: { baseMs: DEFAULT_TIME_CONTROL.baseMs, incrementMs: DEFAULT_TIME_CONTROL.incrementMs },
      clocks: {
        r: DEFAULT_TIME_CONTROL.baseMs,
        b: DEFAULT_TIME_CONTROL.baseMs,
        y: DEFAULT_TIME_CONTROL.baseMs,
        g: DEFAULT_TIME_CONTROL.baseMs,
      },
      turnStartedAt: null,
      teamMode: false,
      teamAssignments: { ...DEFAULT_TEAM_ASSIGNMENTS },
      winningTeam: null,
      promotionState: { isAwaiting: false, position: null, color: null },
      hasMoved: {
        rK: false,
        rR1: false,
        rR2: false,
        bK: false,
        bR1: false,
        bR2: false,
        yK: false,
        yR1: false,
        yR2: false,
        gK: false,
        gR1: false,
        gR2: false,
      },
      enPassantTargets: [],
      gameOverState: {
        isGameOver: false,
        status: null,
        eliminatedPlayer: null,
      },
      history: [],
      historyIndex: 0,
      viewingHistoryIndex: null,
      lastMove: null,
      players: [],
      isHost: true,
      canStartGame: false,
      gameMode: "online",
      botPlayers: [],
      botDifficulty,
      botTeamMode,
      currentGame: null,
      discoveredGames: [],
      isDiscovering: false,
      isLoading: false,
      isConnected: false,
      connectionError: null,
      isEditingName: false,
      tempName: "",
    };

    const hostPlayer = {
      id: user.uid,
      name: hostName,
      color: "r",
      isHost: true,
      isOnline: true,
      lastSeen: Date.now(),
    };

    const gameData = {
      id: "", // Will be set by Firebase
      hostId: user.uid,
      hostName: hostName,
      players: { [user.uid]: hostPlayer },
      gameState: newGameState,
      status: "waiting", // CRITICAL: This must be "waiting" for games to show in lobby
      createdAt: serverTimestamp(),
      maxPlayers: 4,
      currentPlayerTurn: "r",
      winner: null,
      joinCode: this.generateJoinCode(), // Generate 4-digit join code
      lastMove: null,
      lastActivity: Date.now(),
    };

    // Creating game with data

    // Push the new game to the database
    const gameRef = push(ref(db, "games"));
    await set(gameRef, gameData);
    const gameId = gameRef.key as string;

    // Update the game with its ID
    await update(gameRef, { id: gameId });

    // Add bots if requested
    if (botColors.length > 0) {
      await this.addBotsToGame(gameId, botColors);
    }


    // Verify the game was created correctly
    const verifySnapshot = await get(gameRef);
    if (verifySnapshot.exists()) {
      const createdGame = verifySnapshot.val();
    } else {
      console.error(`❌ Game verification failed: ${gameId} not found after creation`);
    }

    return gameId;
  }

  async joinGame(gameId: string, playerName: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    const gameRef = ref(db, `games/${gameId}`);

    // Use transaction to atomically check and join game
    const result = await runTransaction(gameRef, (gameData) => {
      if (gameData === null) {
        // Game doesn't exist - abort transaction
        return undefined;
      }

      const gameState = this.ensureGameState(gameData, "joinGame");
      if (!gameState) {
        return undefined;
      }

      // Check if game is full (4 players max including bots)
      const playerCount = Object.keys(gameData.players || {}).length;
      if (playerCount >= (gameData.maxPlayers || 4)) {
        // Game is full - abort transaction by returning undefined
        return undefined;
      }

      // Check if game is still in waiting status
      if (gameData.status !== "waiting") {
        return undefined;
      }

      // Check if player is already in the game
      if (gameData.players && gameData.players[user.uid]) {
        return gameData; // Player already in game, no changes needed
      }

      // Assign color based on order of joining (first available color)
      const colors = ["r", "b", "y", "g"];
      const usedColors = Object.values(gameData.players || {}).map((p: any) => p.color);
      const availableColor = colors.find((color) => !usedColors.includes(color));

      if (!availableColor) {
        // No available colors - game is effectively full
        return undefined;
      }

      const newPlayer: Player = {
        id: user.uid,
        name: playerName,
        color: availableColor,
        isHost: false,
        isOnline: true,
        lastSeen: Date.now(),
      };

      // Initialize players object if it doesn't exist
      if (!gameData.players) {
        gameData.players = {};
      }

      gameData.players[user.uid] = newPlayer;
      gameData.lastActivity = Date.now();
      gameState.version = (gameState.version || 0) + 1;

      return gameData;
    });

    // Check transaction result
    if (!result.committed) {
      // Transaction was aborted - need to determine why
      const snapshot = await get(gameRef);
      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      const playerCount = Object.keys(gameData.players || {}).length;

      if (playerCount >= (gameData.maxPlayers || 4)) {
        throw new Error("Game is full");
      }
      if (gameData.status !== "waiting") {
        throw new Error("Game is not available for joining");
      }

      throw new Error("Failed to join game. Please try again.");
    }
  }

  async leaveGame(gameId: string, onCriticalError?: (error: string) => void): Promise<void> {
    try {
      // Ensure authentication before proceeding
      let user = this.getCurrentUser();
      if (!user) {
        await this.signInAnonymously();
        user = this.getCurrentUser();
        if (!user) throw new Error("Failed to authenticate user");
      }


      // Use direct database leave method
      await this.leaveGameDirectly(gameId, onCriticalError);
    } catch (error: any) {
      console.error("Error calling leave game:", error);

      // Don't treat max-retries as critical - just log and continue
      if (error.message?.includes('max-retries') || error.message?.includes('too many retries')) {
        console.warn("Max retries exceeded for leaveGame, but continuing:", error.message);
        return; // Don't throw - let the caller handle gracefully
      }

      throw error;
    }
  }

  // Fallback method to leave game directly in database with proper error handling
  private async leaveGameDirectly(gameId: string, onCriticalError?: (error: string) => void): Promise<void> {
    // Ensure authentication before proceeding
    let user = this.getCurrentUser();
    if (!user) {
      await this.signInAnonymously();
      user = this.getCurrentUser();
      if (!user) throw new Error("Failed to authenticate user");
    }

    // ✅ CRITICAL FIX: Check if game exists before attempting to leave
    try {
      const gameSnapshot = await get(ref(db, `games/${gameId}`));
      if (!gameSnapshot.exists()) {
        console.log(`Game ${gameId} does not exist - player already left or game was deleted`);
        return; // Game doesn't exist, consider this success
      }
    } catch (error) {
      console.warn(`Failed to check game existence for ${gameId}:`, error);
      // Continue with leave attempt anyway
    }

    const gameRef = ref(db, `games/${gameId}`);

    // Add retry logic with exponential backoff and max retries
    let retryCount = 0;
    const maxRetries = 2; // Reduced from 3 to 2 for faster failure
    const baseDelay = 1000; // 1 second base delay

    while (retryCount < maxRetries) {
      try {
        const result = await runTransaction(gameRef, (gameData) => {
          if (gameData === null) {
            console.warn(`Game ${gameId} not found`);
            return null;
          }

          const player = gameData.players[user.uid];
          if (!player) {
            console.log(`Player ${user.uid} not found in game ${gameId} - already left or never joined`);
            return null; // Consider this success - player is not in the game
          }

          // Remove the player from the game
          delete gameData.players[user.uid];

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            return null; // This will delete the game
          }

          // Check if only bots remain - if so, delete the game
          const remainingPlayers = Object.values(gameData.players);
          const hasHumanPlayers = remainingPlayers.some((p: any) => !p.isBot);
          if (!hasHumanPlayers) {
            return null; // This will delete the game
          }

          // If host left, assign new host
          if (gameData.hostId === user.uid) {
            const newHostId = Object.keys(gameData.players)[0];
            const newHost = gameData.players[newHostId];
            gameData.hostId = newHostId;
            gameData.hostName = newHost.name;
            gameData.players[newHostId].isHost = true;
          }

          if (gameData.gameState) {
            gameData.gameState.version = (gameData.gameState.version ?? 0) + 1;
          } else {
            console.warn("[RealtimeDB] Missing gameState in leaveGame");
          }
          gameData.lastActivity = Date.now();

          return gameData;
        });

        if (result.committed) {
          return; // Success!
        } else {
          throw new Error("Transaction failed to commit");
        }
      } catch (error: any) {
        retryCount++;
        console.warn(`Leave game attempt ${retryCount} failed:`, error.message);

        // Check for specific Firebase errors that should not be retried
        if (error.code === 'database/max-retries' ||
          error.message?.includes('max-retries') ||
          error.message?.includes('too many retries')) {
          console.warn(`Max retries exceeded for leaving game ${gameId} - treating as success to avoid game restart`);
          return; // Treat this as success - game probably doesn't exist
        }

        // Check if player is already not in the game (success case)
        if (error.message?.includes('Player') && error.message?.includes('not found')) {
          return; // This is actually success - player is already out
        }

        if (retryCount >= maxRetries) {
          console.error(`Failed to leave game ${gameId} after ${maxRetries} attempts`);
          throw new Error(`Failed to leave game after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  async startGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = ref(db, `games/${gameId}`);
      const gameSnapshot = await get(gameRef);

      if (!gameSnapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameSnapshot.val() as RealtimeGame;

      if (gameData.hostId !== user.uid) {
        throw new Error("Only host can start the game");
      }

      if (Object.keys(gameData.players).length !== 4) {
        throw new Error("Need exactly 4 players to start");
      }

      const existingTimeControl = gameData.gameState?.timeControl ?? DEFAULT_TIME_CONTROL;
      const baseMs =
        typeof existingTimeControl.baseMs === "number"
          ? existingTimeControl.baseMs
          : DEFAULT_TIME_CONTROL.baseMs;
      const incrementMs =
        typeof existingTimeControl.incrementMs === "number"
          ? existingTimeControl.incrementMs
          : DEFAULT_TIME_CONTROL.incrementMs;

      // Get the host's assigned color to start the game with their turn
      const hostPlayer = gameData.players[user.uid];
      const startingColor = hostPlayer?.color || "r";

      await update(gameRef, {
        status: "playing",
        currentPlayerTurn: startingColor,
        "gameState/gameStatus": "active",
        "gameState/currentPlayerTurn": startingColor,
        "gameState/version": increment(1),
        "gameState/timeControl": {
          baseMs,
          incrementMs,
        },
        "gameState/clocks": {
          r: baseMs,
          b: baseMs,
          y: baseMs,
          g: baseMs,
        },
        "gameState/turnStartedAt": this.getServerNow(),
      });

    } catch (error) {
      console.error("Error starting game:", error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToGame(
    gameId: string,
    onUpdate: (game: RealtimeGame | null) => void
  ): () => void {
    const gameRef = ref(db, `games/${gameId}`);

    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (snapshot.exists()) {
        const gameData = { id: gameId, ...snapshot.val() } as RealtimeGame;

        // Ensure all players have required fields
        const processedPlayers: { [playerId: string]: Player } = {};
        Object.entries(gameData.players).forEach(([playerId, player]) => {
          if (player && typeof player === "object") {
            processedPlayers[playerId] = {
              id: playerId,
              name: player.name || `Player ${playerId.slice(0, 8)}`,
              color: player.color || "g", // Default to green if missing
              isHost: player.isHost || false,
              isOnline: player.isOnline || false,
              isBot: player.isBot || false, // Add missing isBot property
              lastSeen: player.lastSeen || Date.now(),
            } as Player;
          }
        });

        gameData.players = processedPlayers;
        if (gameData.gameState) {
          gameData.gameState = this.buildBitboardStateFromSnapshot(
            gameData.gameState as unknown as SerializedGameState,
            gameId
          );
        }

        onUpdate(gameData);
      } else {
        onUpdate(null);
      }
    });

    return () => unsubscribe();
  }

  subscribeToAvailableGames(
    onUpdate: (games: RealtimeGame[]) => void
  ): () => void {
    const gamesRef = query(
      ref(db, "games"),
      orderByChild("status"),
      equalTo("waiting")
    );

    const unsubscribe = onValue(gamesRef, (snapshot) => {
      const games: RealtimeGame[] = [];
      if (snapshot && snapshot.exists()) {
        // ✅ CRITICAL FIX: Replace problematic forEach with Object.entries for better reliability
        const gamesData = snapshot.val();
        if (gamesData && typeof gamesData === 'object') {
          Object.entries(gamesData).forEach(([gameId, gameData]: [string, any]) => {
            if (gameData && typeof gameData === 'object') {
              // Only include games with valid players
              const players = gameData.players || {};
              const validPlayers = Object.values(players).filter((player: any) =>
                player && player.id && player.name && player.color
              );

              if (validPlayers.length > 0) {
                games.push({
                  id: gameId,
                  ...gameData,
                });
              }
            }
          });
        }
      }
      onUpdate(games);
    });

    return () => unsubscribe();
  }

  // Make a promotion move in online game
  async makePromotion(
    gameId: string,
    promotionData: {
      position: { row: number; col: number };
      pieceType: string;
      playerColor: string;
    }
  ): Promise<void> {
    const gameRef = ref(db, `games/${gameId}`);
    const user = this.getCurrentUser();

    if (!user) {
      throw new Error("User not authenticated");
    }


    try {
      const result = await runTransaction(gameRef, (gameData) => {
        if (gameData === null) {
          console.warn(`Promotion failed: Game ${gameId} not found`);
          return null;
        }

        const gameState = gameData.gameState as GameState;
        gameState.promotionState = gameState.promotionState || {
          isAwaiting: false,
          position: null,
          color: null,
        };
        gameState.eliminatedPlayers = gameState.eliminatedPlayers || [];
        gameState.enPassantTargets = gameState.enPassantTargets || [];

        const awaitingPromotion = !!gameState.promotionState.isAwaiting;
        const promotionColor = gameState.promotionState.color;

        if (awaitingPromotion) {
          if (promotionColor !== promotionData.playerColor) {
            console.warn(
              `Promotion validation failed: expected=${promotionColor}, received=${promotionData.playerColor}`
            );
            return gameData;
          }
          if (gameState.promotionState.position) {
            const expected = gameState.promotionState.position;
            if (
              expected.row !== promotionData.position.row ||
              expected.col !== promotionData.position.col
            ) {
              console.warn(
                `Promotion position mismatch: expected=(${expected.row},${expected.col}), received=(${promotionData.position.row},${promotionData.position.col})`
              );
              return gameData;
            }
          }
        } else if (gameState.currentPlayerTurn !== promotionData.playerColor) {
          console.warn(
            `Promotion validation failed: player=${promotionData.playerColor}, currentTurn=${gameState.currentPlayerTurn}`
          );
          return gameData;
        }

        // Validate promotion position
        const { row, col } = promotionData.position;
        if (row < 0 || row >= 14 || col < 0 || col >= 14) {
          console.warn(`Invalid promotion coordinates: (${row}, ${col})`);
          return gameData;
        }

        let pieces = deserializeBitboardPieces(gameState.bitboardState?.pieces);
        if (
          (!gameState.bitboardState || !gameState.bitboardState.pieces) &&
          Array.isArray(gameState.boardState)
        ) {
          const normalizedBoard = this.convertBoardState(gameState.boardState, false);
          const fallbackBitboards = syncBitboardsFromArray(
            normalizedBoard,
            gameState.eliminatedPlayers || []
          );
          pieces = fallbackBitboards.pieces;
          gameState.bitboardState = {
            pieces: serializeBitboardPieces(pieces),
          } as any;
        }
        const pieceCode = getPieceAtFromBitboard(pieces, row, col);

        if (!pieceCode || pieceCode[0] !== promotionData.playerColor || pieceCode[1] !== "P") {
          console.warn(`Invalid promotion: piece=${pieceCode}, playerColor=${promotionData.playerColor}`);
          return gameData;
        }

        if (gameState.promotionState?.color !== promotionData.playerColor) {
          console.warn(`Promotion color mismatch: state=${gameState.promotionState?.color}`);
          return gameData;
        }

        const promotionBit = squareBit(row * 14 + col);
        pieces[pieceCode] ^= promotionBit;
        const promotedCode = `${promotionData.playerColor}${promotionData.pieceType}`;
        pieces[promotedCode] = (pieces[promotedCode] ?? 0n) | promotionBit;

        // Clear promotion state
        gameState.promotionState = { isAwaiting: false, position: null, color: null };
        gameState.gameStatus = "active";

        const now = this.getServerNow();
        // Update turn
        const currentTurn = gameState.currentPlayerTurn;
        const nextPlayer = this.getNextPlayer(currentTurn, gameState.eliminatedPlayers || []);
        gameState.currentPlayerTurn = nextPlayer;
        gameData.currentPlayerTurn = nextPlayer;
        gameState.turnStartedAt = now;

        // ✅ CRITICAL FIX: Detect bot moves and set correct playerId for promotions
        // Check if this is a bot move by looking at the player's bot status
        const player = gameData.players[user.uid];
        const isBotMove = player && player.isBot;
        const playerId = isBotMove ? `bot_${promotionData.playerColor}` : user.uid;

        // Update move history
        gameData.lastMove = {
          from: { row: -1, col: -1 }, // Special promotion move
          to: promotionData.position,
          pieceCode: promotedCode,
          playerColor: promotionData.playerColor,
          playerId: playerId,
          timestamp: now,
        };
        gameData.lastActivity = now;
        gameState.version = (gameState.version ?? 0) + 1;
        const rebuiltState = rebuildBitboardStateFromPieces(
          pieces,
          gameState.eliminatedPlayers || [],
          gameState.enPassantTargets || []
        );
        const hydratedState: GameState = {
          ...gameState,
          bitboardState: rebuiltState,
        };
        hydratedState.checkStatus = updateAllCheckStatus(hydratedState);
        hydratedState.bitboardState.pinnedMask = getPinnedPiecesMask(
          hydratedState,
          hydratedState.currentPlayerTurn
        );
        gameData.gameState = this.toSerializedGameState(hydratedState, rebuiltState.pieces);

        return gameData;
      });

      if (!result.committed) {
        const snapshotValue = result.snapshot?.val?.();
        const snapshotState = snapshotValue?.gameState as GameState | undefined;
        const promotionResolved = (() => {
          if (!snapshotState) return false;
          if (!snapshotState.promotionState?.isAwaiting) {
            return true;
          }
          if (!snapshotState.bitboardState?.pieces) {
            return false;
          }
          const snapshotPieces = deserializeBitboardPieces(
            snapshotState.bitboardState.pieces
          );
          const pieceAt = getPieceAtFromBitboard(
            snapshotPieces,
            promotionData.position.row,
            promotionData.position.col
          );
          return pieceAt !== `${promotionData.playerColor}P`;
        })();

        if (promotionResolved) {
          return;
        }

        console.error("Promotion transaction failed:", result);
        throw new Error(`Promotion transaction failed: Transaction not committed`);
      }


    } catch (error) {
      console.error("Failed to make promotion:", error);
      throw error;
    }
  }

  // Ultra-fast move processing (bitboard-based)
  async makeMove(
    gameId: string,
    moveData: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
      isEnPassant?: boolean;
      enPassantTarget?: any;
    }
  ): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = ref(db, `games/${gameId}`);
      const result = await runTransaction(gameRef, (gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }

        const player = gameData.players[user.uid];
        const currentTurn = gameData.gameState.currentPlayerTurn;
        const isTurnBot = Object.values(gameData.players || {}).some(
          (p: any) => p?.isBot && p?.color === currentTurn
        );
        const canActForTurn = player && (player.color === currentTurn || (player.isHost && isTurnBot));
        if (!canActForTurn) {
          console.warn(
            `Move validation failed: player=${player?.color}, currentTurn=${currentTurn}`
          );
          return gameData;
        }
        if (moveData.playerColor !== currentTurn) {
          console.warn(
            `Move validation failed: payloadColor=${moveData.playerColor}, currentTurn=${currentTurn}`
          );
          return gameData;
        }

        const effectivePlayerId = player.isBot
          ? `bot_${moveData.playerColor}`
          : user.uid;

        return this.applyMoveWithBitboards(gameData, moveData, effectivePlayerId);
      });

      if (!result.committed) {
        console.error("Move transaction failed:", result);
        throw new Error(`Move transaction failed: Transaction not committed`);
      }

    } catch (error) {
      console.error("Error processing move:", error);
      throw error;
    }
  }

  // Resolve a bot turn with no legal moves (checkmate/stalemate)
  async resolveNoLegalMoves(
    gameId: string,
    playerColor: string,
    status: "checkmate" | "stalemate"
  ): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = ref(db, `games/${gameId}`);
      const result = await runTransaction(gameRef, (gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }
        if (
          gameData.gameState.gameStatus === "finished" ||
          gameData.gameState.gameStatus === "checkmate" ||
          gameData.gameState.gameStatus === "stalemate"
        ) {
          return gameData;
        }
        if (gameData.gameState.currentPlayerTurn !== playerColor) {
          return gameData;
        }
        if (gameData.gameState.eliminatedPlayers?.includes(playerColor)) {
          return gameData;
        }
        if (!CLOCK_COLORS.includes(playerColor as ClockColor)) {
          return gameData;
        }

        const now = this.getServerNow();
        return this.applyNoMoveEliminationToGameData(
          gameData,
          playerColor as ClockColor,
          status,
          now
        );
      });

      if (!result.committed) {
        console.error("No-move resolution failed:", result);
        throw new Error("No-move resolution failed: Transaction not committed");
      }
    } catch (error) {
      console.error("Error resolving no-legal-moves:", error);
      throw error;
    }
  }

  // Resign game - uses direct database method
  async resignGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");


      // Use direct database resignation method
      await this.resignGameDirectly(gameId);
    } catch (error) {
      console.error("Error calling resign:", error);
      throw error;
    }
  }

  async timeoutPlayer(gameId: string, playerColor: string): Promise<void> {
    try {
      const gameRef = ref(db, `games/${gameId}`);
      const result = await runTransaction(gameRef, (gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }
        if (
          gameData.gameState.gameStatus === "finished" ||
          gameData.gameState.gameStatus === "checkmate" ||
          gameData.gameState.gameStatus === "stalemate"
        ) {
          return gameData;
        }
        if (gameData.gameState.currentPlayerTurn !== playerColor) {
          return gameData;
        }
        if (gameData.gameState.eliminatedPlayers?.includes(playerColor)) {
          return gameData;
        }
        if (!CLOCK_COLORS.includes(playerColor as ClockColor)) {
          return gameData;
        }

        const now = this.getServerNow();
        return this.applyTimeoutToGameData(
          gameData,
          playerColor as ClockColor,
          now
        );
      });

      if (!result.committed) {
        console.error("Timeout transaction failed:", result);
        throw new Error("Timeout transaction failed: Transaction not committed");
      }
    } catch (error) {
      console.error("Error processing timeout:", error);
      throw error;
    }
  }

  // Fallback method to resign game directly in database with proper error handling
  private async resignGameDirectly(gameId: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("User not authenticated");


    const gameRef = ref(db, `games/${gameId}`);

    // Add retry logic with exponential backoff and max retries
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay

    while (retryCount < maxRetries) {
      try {
        const result = await runTransaction(gameRef, (gameData) => {
          if (gameData === null) {
            console.warn(`Game ${gameId} not found`);
            return null;
          }

          const player = gameData.players[user.uid];
          if (!player) {
            console.warn(`Player ${user.uid} not found in game ${gameId}`);
            return gameData;
          }

          // Don't allow resigning if game is already over
          if (
            gameData.gameState.gameStatus === "finished" ||
            gameData.gameState.gameStatus === "checkmate" ||
            gameData.gameState.gameStatus === "stalemate"
          ) {
            console.warn(`Player ${user.uid} cannot resign - game is already over`);
            return gameData;
          }

          // Initialize eliminatedPlayers array if it doesn't exist
          if (!gameData.gameState.eliminatedPlayers) {
            gameData.gameState.eliminatedPlayers = [];
          }

          // Add player to eliminated players
          if (!gameData.gameState.eliminatedPlayers.includes(player.color)) {
            gameData.gameState.eliminatedPlayers.push(player.color);
            gameData.gameState.justEliminated = player.color;
          }

          let pieces = deserializeBitboardPieces(
            gameData.gameState.bitboardState?.pieces
          );
          if (
            (!gameData.gameState.bitboardState ||
              !gameData.gameState.bitboardState.pieces) &&
            Array.isArray(gameData.gameState.boardState)
          ) {
            const normalizedBoard = this.convertBoardState(
              gameData.gameState.boardState,
              false
            );
            const fallbackBitboards = syncBitboardsFromArray(
              normalizedBoard,
              gameData.gameState.eliminatedPlayers
            );
            pieces = fallbackBitboards.pieces;
          }
          const eliminatedPieceBitboards = gameData.gameState.eliminatedPieceBitboards
            ? deserializeBitboardPieces(gameData.gameState.eliminatedPieceBitboards as any)
            : createEmptyPieceBitboards();
          gameData.gameState.teamMode = !!gameData.gameState.teamMode;
          gameData.gameState.teamAssignments = normalizeTeamAssignments(
            gameData.gameState.teamAssignments as TeamAssignments
          );
          if (gameData.gameState.teamMode && CLOCK_COLORS.includes(player.color as ClockColor)) {
            return this.applyTeamEliminationToGameData(
              gameData,
              player.color as ClockColor,
              "finished",
              Date.now(),
              pieces,
              eliminatedPieceBitboards
            );
          }
          if (CLOCK_COLORS.includes(player.color as ClockColor)) {
            this.captureEliminatedPieces(
              eliminatedPieceBitboards,
              pieces,
              player.color as ClockColor,
              true
            );
          }
          gameData.gameState.eliminatedPieceBitboards = serializeBitboardPieces(
            eliminatedPieceBitboards
          );
          gameData.gameState.bitboardState = {
            pieces: serializeBitboardPieces(pieces),
          };

          // Remove the player from the game
          delete gameData.players[user.uid];

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            return null; // This will delete the game
          }

          // Check if only bots remain - if so, delete the game
          const remainingPlayers = Object.values(gameData.players);
          const hasHumanPlayers = remainingPlayers.some((p: any) => !p.isBot);
          if (!hasHumanPlayers) {
            return null; // This will delete the game
          }

          // Update check status for all players
          gameData.gameState.checkStatus = {
            r: false,
            b: false,
            y: false,
            g: false,
          };

          // Check if the entire game is over
          if (gameData.gameState.eliminatedPlayers && gameData.gameState.eliminatedPlayers.length === 3) {
            const turnOrder = ["r", "b", "y", "g"];
            const winner = turnOrder.find(
              (color) => !gameData.gameState.eliminatedPlayers.includes(color)
            );

            if (winner) {
              gameData.gameState.winner = winner;
              gameData.gameState.gameStatus = "finished";
              gameData.gameState.gameOverState = {
                isGameOver: true,
                status: "finished",
                eliminatedPlayer: null,
              };
            }
          } else {
            // Advance to next active player
            const turnOrder = ["r", "b", "y", "g"];
            const currentIndex = turnOrder.indexOf(gameData.gameState.currentPlayerTurn);
            const nextIndex = (currentIndex + 1) % 4;
            const nextPlayerInSequence = turnOrder[nextIndex];

            // Find the next active player (skip eliminated players)
            let nextActivePlayer = nextPlayerInSequence;
            while (gameData.gameState.eliminatedPlayers && gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)) {
              const activeIndex = turnOrder.indexOf(nextActivePlayer);
              const nextActiveIndex = (activeIndex + 1) % 4;
              nextActivePlayer = turnOrder[nextActiveIndex];
            }

            gameData.gameState.currentPlayerTurn = nextActivePlayer;
          }

          const now = this.getServerNow();
          gameData.gameState.turnStartedAt =
            gameData.gameState.gameStatus === "finished" ? null : now;
          gameData.currentPlayerTurn = gameData.gameState.currentPlayerTurn;
          if (gameData.gameState) {
            gameData.gameState.version = (gameData.gameState.version ?? 0) + 1;
          } else {
            console.warn("[RealtimeDB] Missing gameState in resignGame");
          }
          gameData.lastActivity = now;

          return gameData;
        });

        if (result.committed) {
          return; // Success!
        } else {
          throw new Error("Transaction failed to commit");
        }
      } catch (error: any) {
        retryCount++;
        console.warn(`Resign game attempt ${retryCount} failed:`, error.message);

        // Check for specific Firebase errors that should not be retried
        if (error.code === 'database/max-retries' ||
          error.message?.includes('max-retries') ||
          error.message?.includes('too many retries')) {
          console.warn(`Max retries exceeded for resigning game ${gameId} - treating as success to avoid game restart`);
          return; // Treat this as success to avoid game restart
        }

        // Check if player is already not in the game (success case)
        if (error.message?.includes('Player') && error.message?.includes('not found')) {
          return; // This is actually success - player is already out
        }

        if (retryCount >= maxRetries) {
          console.error(`Failed to resign game ${gameId} after ${maxRetries} attempts`);
          throw new Error(`Failed to resign game after ${maxRetries} attempts: ${error.message}`);
        }

        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // CRITICAL: This function is DANGEROUS and causes race conditions
  // Clients should NEVER update the authoritative game state

  // OPTIMIZATION: Enhanced move subscription for faster updates
  subscribeToMoves(
    gameId: string,
    onMove: (move: RealtimeMove) => void
  ): () => void {

    const movesRef = query(
      ref(db, `moves/${gameId}`),
      orderByChild("timestamp")
    );

    const unsubscribe = onChildAdded(movesRef, (snapshot) => {
      const moveData = snapshot.val();
      if (moveData && !moveData.isOptimistic) {
        // Only process non-optimistic moves (server-confirmed)
        onMove({
          from: moveData.from,
          to: moveData.to,
          pieceCode: moveData.pieceCode,
          playerColor: moveData.playerColor,
          playerId: moveData.playerId,
          timestamp: moveData.timestamp,
          moveNumber: moveData.moveNumber,
        });
      }
    });

    return () => unsubscribe();
  }

  // Player presence management
  async updatePlayerPresence(gameId: string, isOnline: boolean): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = ref(db, `games/${gameId}/players/${user.uid}`);
      await update(gameRef, {
        isOnline,
        lastSeen: Date.now(),
      });

    } catch (error) {
      console.error("Error updating player presence:", error);
      throw error;
    }
  }

  // OPTIMIZATION: Connection keep-alive methods
  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }

    this.keepAliveInterval = setInterval(async () => {
      try {
        // Perform a lightweight operation to keep connection alive
        const testRef = ref(db, ".info/connected");
        await get(testRef);
      } catch (error) {
        console.warn("Keep-alive: Connection check failed:", error);
      }
    }, this.KEEP_ALIVE_INTERVAL);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  // Helper functions for direct move processing
  private convertBoardState(boardState: any, toFlattened: boolean): any {
    if (toFlattened) {
      // Convert 2D array to flattened format for Firebase
      return boardState.map((row: any) =>
        row.map((cell: any) => cell === null ? "" : cell)
      );
    } else {
      // Convert flattened format back to 2D array
      return boardState.map((row: any) =>
        row.map((cell: any) => cell === "" ? null : cell)
      );
    }
  }

  /**
   * Check if a player has any pieces on the board.
   * This is a safety check to prevent false eliminations due to corrupted bitboard state.
   */
  private playerHasPiecesOnBoard(pieces: Record<string, bigint>, playerColor: string): boolean {
    const pieceTypes = ["P", "N", "B", "R", "Q", "K"];
    for (const type of pieceTypes) {
      const code = `${playerColor}${type}`;
      const bb = pieces[code];
      if (bb !== undefined && bb !== 0n) {
        return true;
      }
    }
    return false;
  }

  private getNextPlayer(currentPlayer: string, eliminatedPlayers: string[] = []): string {
    const turnOrder = ["r", "b", "y", "g"];
    const currentIndex = turnOrder.indexOf(currentPlayer);
    let nextIndex = (currentIndex + 1) % turnOrder.length;
    let nextPlayer = turnOrder[nextIndex];

    // Skip eliminated players
    while (eliminatedPlayers.includes(nextPlayer)) {
      nextIndex = (nextIndex + 1) % turnOrder.length;
      nextPlayer = turnOrder[nextIndex];
    }

    return nextPlayer;
  }

  private captureEliminatedPieces(
    eliminatedPieceBitboards: Record<string, bigint>,
    pieces: Record<string, bigint>,
    playerColor: ClockColor,
    clearFromPieces = false
  ) {
    Object.keys(pieces).forEach((code) => {
      if (!code.startsWith(playerColor)) return;
      const bb = pieces[code] ?? 0n;
      if (bb && bb !== 0n) {
        eliminatedPieceBitboards[code] =
          (eliminatedPieceBitboards[code] ?? 0n) | bb;
      }
      if (clearFromPieces) {
        pieces[code] = 0n;
      }
    });
  }

  // Create a rematch game with the same players and bots
  async createRematchGame(currentGameId: string): Promise<string> {
    const currentGameRef = ref(db, `games/${currentGameId}`);

    try {
      const snapshot = await get(currentGameRef);
      if (!snapshot.exists()) {
        throw new Error("Current game not found");
      }

      const currentGame = snapshot.val();
      const players = Object.values(currentGame.players || {});

      // Create new game with same host
      const newGameRef = push(ref(db, "games"));
      const newGameId = newGameRef.key;
      if (!newGameId) throw new Error("Failed to generate game ID");

      const { initialBoardState } = require("../state/boardState");
      const initialBitboards = syncBitboardsFromArray(initialBoardState);
      const serializedPieces = serializeBitboardPieces(initialBitboards.pieces);

      // Prepare new game data
      const settings = settingsService.getSettings();
      const botDifficulty =
        currentGame.gameState?.botDifficulty ??
        settings?.game?.botDifficulty ??
        BOT_CONFIG.DEFAULT_DIFFICULTY;
      const botTeamMode =
        currentGame.gameState?.botTeamMode ?? settings?.game?.botTeamMode ?? false;

      const newGameData = {
        id: newGameId,
        hostId: currentGame.hostId,
        hostName: currentGame.hostName,
        status: "waiting",
        createdAt: Date.now(),
        players: {},
        joinCode: this.generateJoinCode(), // Generate new 4-digit join code for rematch
        gameState: {
          bitboardState: { pieces: serializedPieces },
          eliminatedPieceBitboards: serializeBitboardPieces(createEmptyPieceBitboards()),
          currentPlayerTurn: "r",
          gameStatus: "waiting",
          version: 0,
          selectedPiece: null,
          validMoves: [],
          scores: { r: 0, b: 0, y: 0, g: 0 },
          timeControl: { baseMs: DEFAULT_TIME_CONTROL.baseMs, incrementMs: DEFAULT_TIME_CONTROL.incrementMs },
          clocks: {
            r: DEFAULT_TIME_CONTROL.baseMs,
            b: DEFAULT_TIME_CONTROL.baseMs,
            y: DEFAULT_TIME_CONTROL.baseMs,
            g: DEFAULT_TIME_CONTROL.baseMs,
          },
          turnStartedAt: null,
          teamMode: !!currentGame.gameState?.teamMode,
          teamAssignments: normalizeTeamAssignments(currentGame.gameState?.teamAssignments as TeamAssignments),
          winningTeam: null,
          capturedPieces: { r: [], b: [], y: [], g: [] },
          eliminatedPlayers: [],
          justEliminated: null,
          winner: null,
          checkStatus: { r: false, b: false, y: false, g: false },
          promotionState: { isAwaiting: false, position: null, color: null },
          hasMoved: {
            rK: false, rR1: false, rR2: false,
            bK: false, bR1: false, bR2: false,
            yK: false, yR1: false, yR2: false,
            gK: false, gR1: false, gR2: false,
          },
          enPassantTargets: [],
          gameOverState: {
            isGameOver: false,
            status: null,
            eliminatedPlayer: null,
          },
          history: [],
          historyIndex: 0,
          viewingHistoryIndex: null,
          lastMove: null,
          players: [],
          isHost: false,
          canStartGame: false,
          gameMode: "online",
          botPlayers: [],
          botDifficulty,
          botTeamMode,
          currentGame: null,
          discoveredGames: [],
          isDiscovering: false,
          isLoading: false,
          isConnected: false,
          connectionError: null,
          isEditingName: false,
          tempName: "",
        }
      };

      // Add all players from the previous game (including bots)
      const playersToAdd: any = {};
      for (const player of players) {
        const playerData = player as any;
        playersToAdd[playerData.id] = {
          id: playerData.id,
          name: playerData.name,
          color: playerData.color,
          isHost: playerData.isHost,
          isOnline: true,
          isBot: playerData.isBot || false,
          lastSeen: Date.now(),
        };
      }

      newGameData.players = playersToAdd;

      // Create the new game
      await set(newGameRef, newGameData);

      return newGameId;

    } catch (error) {
      console.error('Error creating rematch game:', error);
      throw error;
    }
  }

  // Clear justEliminated flag from server
  async clearJustEliminated(gameId: string): Promise<void> {
    const gameRef = ref(db, `games/${gameId}`);

    try {
      await runTransaction(gameRef, (gameData) => {
        if (gameData === null) {
          console.warn(`RealtimeDatabaseService: Game ${gameId} not found when clearing justEliminated`);
          return null;
        }

        // Clear the justEliminated flag
        if (!gameData.gameState) {
          console.warn(`[RealtimeDB] Missing gameState in clearJustEliminated`);
          return gameData;
        }
        gameData.gameState.justEliminated = null;
        gameData.gameState.version = (gameData.gameState.version ?? 0) + 1;

        return gameData;
      });

    } catch (error) {
      console.error('Error clearing justEliminated flag:', error);
      throw error;
    }
  }

  // Add bots to a game with specific colors
  private async addBotsToGame(gameId: string, botColors: string[]): Promise<void> {
    try {
      const gameRef = ref(db, `games/${gameId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      const usedColors = Object.values(gameData.players).map((p: any) => p.color);

      // Filter out colors that are already taken
      const availableBotColors = botColors.filter(color => !usedColors.includes(color));

      if (availableBotColors.length === 0) {
        return;
      }

      const botUpdates: any = {};

      for (const botColor of availableBotColors) {
        const botId = `bot_${botColor}_${Date.now()}`;

        botUpdates[`players/${botId}`] = {
          id: botId,
          name: `Bot ${botColor.toUpperCase()}`,
          color: botColor,
          isHost: false,
          isOnline: true,
          isBot: true,
          lastSeen: Date.now(),
        };
      }

      await update(gameRef, botUpdates);
    } catch (error) {
      console.error("Error adding bots to game:", error);
      throw error;
    }
  }

  // Update bot configuration for a game (host only)
  async updateBotConfiguration(gameId: string, botColors: string[]): Promise<void> {
    try {
      console.log(`[BotConfig] updateBotConfiguration called with colors:`, botColors);

      const gameRef = ref(db, `games/${gameId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      const currentPlayers = gameData.players || {};
      const allColors = ["r", "b", "y", "g"];

      console.log(`[BotConfig] Current players:`, Object.entries(currentPlayers).map(([id, p]: [string, any]) => ({
        id: id.slice(0, 10),
        color: p.color,
        isBot: p.isBot,
      })));

      // Separate human players from bots
      const humanPlayers: { [id: string]: any } = {};
      const existingBots: { [id: string]: any } = {};

      Object.entries(currentPlayers).forEach(([playerId, player]: [string, any]) => {
        if (player.isBot) {
          existingBots[playerId] = player;
        } else {
          humanPlayers[playerId] = player;
        }
      });

      const humanCount = Object.keys(humanPlayers).length;
      const requestedBotCount = botColors.length;

      // Ensure we don't exceed 4 total players - silently return if would exceed
      if (humanCount + requestedBotCount > 4) {
        console.log(`[BotConfig] Cannot add ${requestedBotCount} bots with ${humanCount} human players. Maximum is 4 total. Ignoring request.`);
        return;
      }

      // Get colors used by humans
      const humanColors = Object.values(humanPlayers).map((p: any) => p.color);

      // Check if any requested bot color conflicts with a human player
      const conflictingColors = botColors.filter(color => humanColors.includes(color));

      const updates: any = {};

      if (conflictingColors.length > 0) {
        console.log(`[BotConfig] Conflict detected: humans on colors ${conflictingColors.join(', ')}`);

        // Find available colors (not used by humans and not requested for bots)
        const availableColors = allColors.filter(
          color => !humanColors.includes(color) && !botColors.includes(color)
        );

        // Reassign conflicting humans to available colors
        for (const conflictColor of conflictingColors) {
          if (availableColors.length === 0) {
            throw new Error(`Cannot add bot to color ${conflictColor}: no available colors for human player`);
          }

          // Find the human player on this color
          const humanEntry = Object.entries(humanPlayers).find(
            ([_, p]: [string, any]) => p.color === conflictColor
          );

          if (humanEntry) {
            const [humanId, humanPlayer] = humanEntry;
            const newColor = availableColors.shift()!;

            console.log(`[BotConfig] Reassigning human ${humanId.slice(0, 10)} from ${conflictColor} to ${newColor}`);

            // Update human player's color
            updates[`players/${humanId}/color`] = newColor;

            // Update our tracking
            humanColors.splice(humanColors.indexOf(conflictColor), 1);
            humanColors.push(newColor);
          }
        }
      }

      // Remove existing bots
      Object.keys(existingBots).forEach(playerId => {
        console.log(`[BotConfig] Removing bot: ${playerId} (color: ${existingBots[playerId].color})`);
        updates[`players/${playerId}`] = null;
      });

      // Add new bots for specified colors
      for (const botColor of botColors) {
        const botId = `bot_${botColor}_${Date.now()}`;
        console.log(`[BotConfig] Adding bot: ${botId} for color: ${botColor}`);
        updates[`players/${botId}`] = {
          id: botId,
          name: `Bot ${botColor.toUpperCase()}`,
          color: botColor,
          isHost: false,
          isOnline: true,
          isBot: true,
          lastSeen: Date.now(),
        };
      }

      console.log(`[BotConfig] Updates to apply:`, Object.keys(updates));
      updates["gameState/version"] = increment(1);
      updates.lastActivity = Date.now();
      await update(gameRef, updates);
      console.log(`[BotConfig] Update complete`);
    } catch (error) {
      console.error("Error updating bot configuration:", error);
      throw error;
    }
  }

  async updateTimeControl(
    gameId: string,
    baseMs: number,
    incrementMs: number
  ): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = ref(db, `games/${gameId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      if (gameData.hostId !== user.uid) {
        throw new Error("Only host can update time control");
      }

      if (gameData.status !== "waiting") {
        throw new Error("Cannot change time control after game has started");
      }

      const safeBaseMs = Number.isFinite(baseMs)
        ? Math.floor(baseMs)
        : DEFAULT_TIME_CONTROL.baseMs;
      const safeIncrementMs = Number.isFinite(incrementMs)
        ? Math.floor(incrementMs)
        : DEFAULT_TIME_CONTROL.incrementMs;
      const normalizedBaseMs = Math.max(60 * 1000, safeBaseMs);
      const normalizedIncrementMs = Math.max(0, safeIncrementMs);

      await update(gameRef, {
        "gameState/timeControl": {
          baseMs: normalizedBaseMs,
          incrementMs: normalizedIncrementMs,
        },
        "gameState/clocks": {
          r: normalizedBaseMs,
          b: normalizedBaseMs,
          y: normalizedBaseMs,
          g: normalizedBaseMs,
        },
        "gameState/turnStartedAt": null,
        "gameState/version": increment(1),
        lastActivity: Date.now(),
      });
    } catch (error) {
      console.error("Error updating time control:", error);
      throw error;
    }
  }

  async updateTeamConfiguration(
    gameId: string,
    teamMode: boolean,
    teamAssignments: TeamAssignments
  ): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = ref(db, `games/${gameId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      if (gameData.hostId !== user.uid) {
        throw new Error("Only host can update team configuration");
      }

      if (gameData.status !== "waiting") {
        throw new Error("Cannot change teams after game has started");
      }

      const normalizedAssignments = normalizeTeamAssignments(teamAssignments);

      await update(gameRef, {
        "gameState/teamMode": teamMode,
        "gameState/teamAssignments": normalizedAssignments,
        "gameState/winningTeam": null,
        "gameState/version": increment(1),
        lastActivity: Date.now(),
      });
    } catch (error) {
      console.error("Error updating team configuration:", error);
      throw error;
    }
  }

  cleanup(): void {
    if (this.gameUnsubscribe) {
      this.gameUnsubscribe();
      this.gameUnsubscribe = null;
    }
    if (this.movesUnsubscribe) {
      this.movesUnsubscribe();
      this.movesUnsubscribe = null;
    }
    if (this.serverTimeOffsetUnsubscribe) {
      this.serverTimeOffsetUnsubscribe();
      this.serverTimeOffsetUnsubscribe = null;
    }
    // OPTIMIZATION: Stop keep-alive
    this.stopKeepAlive();
  }

  // Test Firebase connection (optimized)
  async testConnection(): Promise<boolean> {
    try {

      // Quick connection test - just check if we can access the database
      const gamesRef = ref(db, "games");
      const snapshot = await get(query(gamesRef, limitToFirst(1)));

      return true;
    } catch (error) {
      console.error("❌ Firebase connection failed:", error);
      return false;
    }
  }

  // Enhanced cleanup for corrupted games with comprehensive detection
  async cleanupCorruptedGames(options?: { minAgeMs?: number }): Promise<number> {
    try {
      const gamesRef = ref(db, "games");
      const snapshot = await get(gamesRef);

      if (!snapshot.exists()) {
        return 0;
      }

      const games = snapshot.val();
      const corruptedGames: string[] = [];
      const minAgeMs = options?.minAgeMs ?? 0;
      const now = Date.now();

      const getGameTimestamp = (gameData: any): number | null => {
        if (typeof gameData?.lastActivity === "number") {
          return gameData.lastActivity;
        }
        if (typeof gameData?.createdAt === "number") {
          return gameData.createdAt;
        }
        return null;
      };

      const isOldEnough = (gameData: any): boolean => {
        if (!minAgeMs) {
          return true;
        }
        const timestamp = getGameTimestamp(gameData);
        if (timestamp === null) {
          return true;
        }
        return now - timestamp >= minAgeMs;
      };

      // Track games by host to detect duplicates
      const gamesByHost = new Map<string, string[]>();

      // First pass: collect all games and group by host
      Object.entries(games).forEach(([gameId, gameData]: [string, any]) => {
        if (gameData.hostId) {
          if (!gamesByHost.has(gameData.hostId)) {
            gamesByHost.set(gameData.hostId, []);
          }
          gamesByHost.get(gameData.hostId)!.push(gameId);
        }
      });

      // Second pass: analyze and identify corrupted games
      Object.entries(games).forEach(([gameId, gameData]: [string, any]) => {
        if (!isOldEnough(gameData)) {
          return;
        }

        if (!gameData || typeof gameData !== "object") {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with missing required fields
        if (!gameData.status ||
          !gameData.hostName ||
          !gameData.createdAt ||
          !gameData.gameState) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with no players or invalid player data
        if (!gameData.players || Object.keys(gameData.players).length === 0) {
          corruptedGames.push(gameId);
          return;
        }

        // Check for games with invalid player data
        const players = gameData.players || {};
        const validPlayers = Object.values(players).filter((player: any) =>
          player && player.id && player.name && player.color
        );

        // If no valid players, mark as corrupted
        if (validPlayers.length === 0) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with invalid game state structure
        if (!gameData.gameState.bitboardState ||
          !gameData.gameState.bitboardState.pieces ||
          !gameData.gameState.currentPlayerTurn ||
          !gameData.gameState.gameStatus) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games where host is not in players list
        if (gameData.hostId && !gameData.players[gameData.hostId]) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with duplicate host (keep only the most recent)
        if (gameData.hostId && gamesByHost.has(gameData.hostId)) {
          const hostGames = gamesByHost.get(gameData.hostId)!;
          if (hostGames.length > 1) {
            // Sort by creation time, keep the most recent
            const sortedGames = hostGames.sort((a, b) => {
              const gameA = games[a];
              const gameB = games[b];
              return (gameB.createdAt || 0) - (gameA.createdAt || 0);
            });

            // Delete all but the most recent game
            const gamesToDelete = sortedGames.slice(1);
            if (gamesToDelete.includes(gameId)) {
              corruptedGames.push(gameId);
              return;
            }
          }
        }

        // Clean up games with invalid player colors (not r, b, y, g)
        const validColors = ['r', 'b', 'y', 'g'];
        const invalidColorPlayers = validPlayers.filter((player: any) =>
          !validColors.includes(player.color)
        );
        if (invalidColorPlayers.length > 0) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with duplicate player colors
        const playerColors = validPlayers.map((player: any) => player.color);
        const uniqueColors = [...new Set(playerColors)];
        if (playerColors.length !== uniqueColors.length) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with only 1 player for more than 30 minutes
        if (gameData.status === "waiting" && validPlayers.length === 1 && gameData.lastActivity) {
          const thirtyMinutesAgo = Date.now() - 30 * 60 * 1000; // 30 minutes ago
          if (gameData.lastActivity < thirtyMinutesAgo) {
            corruptedGames.push(gameId);
            return;
          }
        }
      });

      if (corruptedGames.length > 0) {
        // Delete corrupted games
        const updates: { [key: string]: null } = {};
        corruptedGames.forEach(gameId => {
          updates[gameId] = null;
        });

        await update(gamesRef, updates);
        return corruptedGames.length;
      } else {
        return 0;
      }
    } catch (error) {
      console.error("Error cleaning up corrupted games:", error);
      return 0;
    }
  }

}

export default new RealtimeDatabaseService();
