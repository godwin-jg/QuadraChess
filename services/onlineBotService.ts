// services/onlineBotService.ts
// Centralized bot service for online games - single source of truth

import { getDatabase, ref, runTransaction } from '@react-native-firebase/database';
import { GameState, Position } from '../state/types';
import { getBotConfig, PIECE_VALUES } from '../config/gameConfig';
import { getPieceAtFromBitboard, squareBit } from '../src/logic/bitboardUtils';
import { computeBestMove } from "./botService";
import {
  deserializeBitboardPieces,
  serializeBitboardPieces,
} from '../src/logic/bitboardSerialization';
import { isCastlingMove, getRookCastlingCoords, getRookIdentifier } from '../state/gameHelpers';
import { ensureFirebaseApp } from "./firebaseInit";
import realtimeDatabaseService from './realtimeDatabaseService';

ensureFirebaseApp();
const db = getDatabase();

// Team mode helpers
const CLOCK_COLORS = ["r", "b", "y", "g"] as const;
type ClockColor = (typeof CLOCK_COLORS)[number];
type TeamId = "A" | "B";
type TeamAssignments = { r: TeamId; b: TeamId; y: TeamId; g: TeamId };

const getTeamForColor = (assignments: TeamAssignments, color: ClockColor): TeamId =>
  assignments[color];

const getColorName = (color: string): string => {
  const names: Record<string, string> = { r: "Red", b: "Blue", y: "Purple", g: "Green" };
  return names[color] || color.toUpperCase();
};

// O(6) piece count using bitboard popcount - much faster than boardState.flat().filter()
const countPiecesForColor = (pieces: Record<string, bigint>, color: string): number => {
  let count = 0;
  const pieceTypes = ['P', 'N', 'B', 'R', 'Q', 'K'];
  for (const type of pieceTypes) {
    let bb = pieces[`${color}${type}`] ?? 0n;
    while (bb > 0n) {
      count++;
      bb &= bb - 1n; // Clear lowest bit
    }
  }
  return count;
};

interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
  isEliminate?: boolean; // Special flag for auto-elimination
  // Note: capturedPieceCode removed to avoid stale data in multiplayer
}


class OnlineBotService {
  private botProcessingFlags: Map<string, boolean> = new Map(); // Per-bot processing flags


  // Process bot move directly in database
  private async processBotMove(gameId: string, botColor: string, gameState: GameState, expectedVersion: number = 0): Promise<void> {
    const startTime = Date.now();

    // Get the appropriate bot configuration based on game mode
    const botConfig = getBotConfig(gameState.gameMode, gameState.botDifficulty);

    if (this.botProcessingFlags.get(botColor)) {
      return;
    }

    // ✅ CRITICAL FIX: Don't make moves when promotion modal is open
    if (gameState.promotionState.isAwaiting) {
      // Promotion modal is open, skipping bot move
      return;
    }

    this.botProcessingFlags.set(botColor, true);

    // ⚡ SMART TIMEOUT: Adaptive timeout based on game complexity
    const cancellationToken = { cancelled: false };

    // Calculate adaptive timeout based on game state complexity using O(1) bitboard popcount
    const pieceCount = countPiecesForColor(gameState.bitboardState?.pieces || {}, botColor);
    const adaptiveTimeout = Math.max(2000, Math.min(botConfig.BRAIN_TIMEOUT, 2500 + (pieceCount * 50))); // Reduced base timeout and piece multiplier

    const moveTimeout = setTimeout(() => {
      // Bot is thinking hard, show notification and continue
      cancellationToken.cancelled = true;

      // Notify user about bot thinking hard
      try {
        const notificationService = require('./notificationService').default;
        notificationService.show(`Bot ${botColor.toUpperCase()} is thinking hard...`, "info", 3000);
      } catch (notificationError) {
        console.warn("Failed to show bot thinking notification:", notificationError);
      }

      this.botProcessingFlags.set(botColor, false);
    }, adaptiveTimeout);

    try {
      // ✅ CRITICAL FIX: Calculate the move WITHOUT applying it to the database first
      // This prevents intermediate moves from showing in the UI during calculation
      const chosenMove = computeBestMove(gameState, botColor, cancellationToken);

      // Check if calculation was cancelled due to timeout (brain overheated)
      if (cancellationToken.cancelled) {
        console.warn(`Bot ${botColor} timed out`);
        if (chosenMove) {
          console.log(`Bot ${botColor} using partial calculation result`);
          // Continue to execute the best move found so far
        } else {
          // No move found at all explicitly due to timeout - resign/skip to keep game moving
          console.warn(`Bot ${botColor} timed out with no move found - skipping turn`);
          clearTimeout(moveTimeout);
          this.botProcessingFlags.set(botColor, false);

          // Notify user
          try {
            const notificationService = require('./notificationService').default;
            notificationService.show(`Bot ${botColor.toUpperCase()} overheated! Skipping turn.`, "error", 3000);
          } catch (e) { }

          await this.skipBotTurn(gameId, botColor);
          return;
        }
      }

      if (!chosenMove) {
        // No legal moves found - eliminate (checkmate or stalemate)
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);

        const { isKingInCheck } = require("../src/logic/bitboardLogic");
        const isInCheck = isKingInCheck(botColor, gameState);
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

        await realtimeDatabaseService.resolveNoLegalMoves(
          gameId,
          botColor,
          isInCheck ? "checkmate" : "stalemate"
        );
        return;
      }

      // ✅ BITBOARD ONLY: Re-validate move at execution time
      const pieces = gameState.bitboardState?.pieces || {};
      const pieceCode = getPieceAtFromBitboard(pieces, chosenMove.from.row, chosenMove.from.col);
      if (!pieceCode || pieceCode[0] !== botColor) {
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
      }

      // Check if it's still this bot's turn
      if (gameState.currentPlayerTurn !== botColor) {
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
      }

      // Check if bot is eliminated
      if (gameState.eliminatedPlayers.includes(botColor)) {
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
      }

      const moveData = {
        from: chosenMove.from,
        to: { row: chosenMove.to.row, col: chosenMove.to.col },
        pieceCode: pieceCode,
        playerColor: botColor,
      };

      // ✅ BITBOARD ONLY: Store captured piece info for lastMove object
      // This ensures Board component can play correct sound
      const capturedPiece = getPieceAtFromBitboard(pieces, chosenMove.to.row, chosenMove.to.col);
      const isCastling = require('../state/gameHelpers').isCastlingMove(
        pieceCode,
        chosenMove.from.row,
        chosenMove.from.col,
        chosenMove.to.row,
        chosenMove.to.col
      );

      // ✅ CRITICAL FIX: Only apply the final chosen move to the database
      // This ensures no intermediate moves are shown during calculation
      const gameRef = ref(db, `games/${gameId}`);
      let botTimedOut = false;

      // Simplified transaction for faster bot moves
      const result = await runTransaction(gameRef, (gameData) => {
        if (gameData === null) {
          console.warn(`[BotDebug] Game data is null for ${gameId}`);
          return null;
        }

        // ✅ CRITICAL FIX: Check if gameState exists
        if (!gameData.gameState) {
          console.warn(`[BotDebug] No gameState in ${gameId}`);
          return gameData;
        }

        // ✅ CRITICAL FIX: Validate bot turn and prevent multiple moves
        if (gameData.gameState.currentPlayerTurn !== botColor) {
          console.warn(`[BotDebug] Wrong turn. Expected ${botColor}, got ${gameData.gameState.currentPlayerTurn}`);
          return gameData;
        }

        // ✅ CRITICAL FIX: Double-check that this bot hasn't already moved
        if (gameData.lastMove && gameData.lastMove.playerColor === botColor) {
          console.warn(`[BotDebug] Bot ${botColor} already moved`);
          return gameData;
        }

        // ✅ CRITICAL FIX: Verify state hasn't changed while calculating
        // If versions don't match, it means something changed (move made, player joined/left, etc.)
        // We should skip this move and let the system trigger a new calculation on the new state
        if (expectedVersion > 0 && gameData.gameState.version !== expectedVersion) {
          console.warn(`[BotDebug] Stale state detected! Expected v${expectedVersion}, found v${gameData.gameState.version}. Aborting move.`);
          return gameData;
        }

        const moveTimestamp = realtimeDatabaseService.getServerNow();

        // ✅ BITBOARD FIX: Use bitboardState instead of boardState (boardState is not stored in Firebase)
        if (!gameData.gameState.bitboardState?.pieces) {
          console.warn(`[BotDebug] No bitboardState.pieces`);
          return gameData;
        }

        // ✅ BOT CLOCK: Deduct think time from bot's clock
        const baseMs = gameData.gameState.timeControl?.baseMs ?? 5 * 60 * 1000;
        const incrementMs = gameData.gameState.timeControl?.incrementMs ?? 0;
        if (
          !gameData.gameState.clocks ||
          typeof gameData.gameState.clocks !== "object" ||
          Array.isArray(gameData.gameState.clocks)
        ) {
          gameData.gameState.clocks = { r: baseMs, b: baseMs, y: baseMs, g: baseMs };
        }
        const turnStartedAt =
          typeof gameData.gameState.turnStartedAt === "number"
            ? gameData.gameState.turnStartedAt
            : moveTimestamp;
        const elapsedMs = Math.max(0, moveTimestamp - turnStartedAt);
        const rawClock = gameData.gameState.clocks[botColor];
        const currentClock = Number.isFinite(rawClock) ? rawClock : baseMs;
        const remainingMs = Math.max(0, currentClock - elapsedMs);
        if (remainingMs <= 0) {
          botTimedOut = true;
          return gameData;
        }

        // Deserialize bitboard pieces from Firebase
        let pieces = deserializeBitboardPieces(gameData.gameState.bitboardState.pieces);

        // Get capture info before moving
        const capturedPiece = getPieceAtFromBitboard(pieces, moveData.to.row, moveData.to.col);

        // ✅ CRITICAL FIX: Check if this is a capture move and update scores
        if (capturedPiece && capturedPiece[0] !== botColor) {
          // Check if this is a teammate capture in team mode
          const capturedColor = capturedPiece[0] as ClockColor;
          const teamMode = !!gameData.gameState.teamMode;
          const teamAssignments = (gameData.gameState.teamAssignments || { r: "A", y: "A", b: "B", g: "B" }) as TeamAssignments;
          const isTeammateCapture = teamMode && 
            getTeamForColor(teamAssignments, botColor as ClockColor) === 
            getTeamForColor(teamAssignments, capturedColor);

          // Only award points if NOT a teammate capture
          if (!isTeammateCapture) {
            const capturedPieceType = capturedPiece[1] as keyof typeof PIECE_VALUES;
            const points = PIECE_VALUES[capturedPieceType] || 0;

            // Update scores in game state
            if (!gameData.gameState.scores) {
              gameData.gameState.scores = { r: 0, b: 0, y: 0, g: 0 };
            }
            gameData.gameState.scores[botColor as keyof typeof gameData.gameState.scores] += points;
          } else {
            // Show betrayal notification for teammate capture
            try {
              const notificationService = require('./notificationService').default;
              notificationService.show(
                `${getColorName(botColor)} betrayed ${getColorName(capturedColor)}!`,
                "betrayal",
                2500
              );
            } catch (e) {
              // Ignore notification errors
            }
          }

          // Update captured pieces (always track captures regardless of team)
          if (!gameData.gameState.capturedPieces) {
            gameData.gameState.capturedPieces = { r: [], b: [], y: [], g: [] };
          }
          if (!gameData.gameState.capturedPieces[capturedColor]) {
            gameData.gameState.capturedPieces[capturedColor] = [];
          }
          gameData.gameState.capturedPieces[capturedColor].push(capturedPiece);

          // Remove captured piece from bitboards
          const captureMask = squareBit(moveData.to.row * 14 + moveData.to.col);
          pieces[capturedPiece] ^= captureMask;
        }

        // Apply move to bitboards
        const fromIdx = moveData.from.row * 14 + moveData.from.col;
        const toIdx = moveData.to.row * 14 + moveData.to.col;
        const moveMask = squareBit(fromIdx) | squareBit(toIdx);
        pieces[moveData.pieceCode] ^= moveMask;

        // Handle castling
        if (isCastling) {
          const rookCoords = getRookCastlingCoords(botColor, {
            row: moveData.to.row,
            col: moveData.to.col,
          });
          if (rookCoords) {
            const rookCode = `${botColor}R`;
            const rookFromIdx = rookCoords.rookFrom.row * 14 + rookCoords.rookFrom.col;
            const rookToIdx = rookCoords.rookTo.row * 14 + rookCoords.rookTo.col;
            pieces[rookCode] ^= squareBit(rookFromIdx) | squareBit(rookToIdx);
            const rookId = getRookIdentifier(botColor, rookCoords.rookFrom.row, rookCoords.rookFrom.col);
            if (rookId && gameData.gameState.hasMoved) {
              gameData.gameState.hasMoved[rookId as keyof typeof gameData.gameState.hasMoved] = true;
            }
          }
        }

        // Update hasMoved for king/rook
        if (moveData.pieceCode[1] === 'K' && gameData.gameState.hasMoved) {
          gameData.gameState.hasMoved[`${botColor}K` as keyof typeof gameData.gameState.hasMoved] = true;
        } else if (moveData.pieceCode[1] === 'R' && gameData.gameState.hasMoved) {
          const rookId = getRookIdentifier(botColor, moveData.from.row, moveData.from.col);
          if (rookId) {
            gameData.gameState.hasMoved[rookId as keyof typeof gameData.gameState.hasMoved] = true;
          }
        }

        // Serialize pieces back to Firebase format
        gameData.gameState.bitboardState.pieces = serializeBitboardPieces(pieces);

        // ✅ BOT CLOCK: Apply increment after move
        const finalRemainingMs =
          incrementMs > 0 ? Math.max(0, remainingMs + incrementMs) : remainingMs;
        gameData.gameState.clocks[botColor] = finalRemainingMs;

        // Update turn
        const currentTurn = gameData.gameState.currentPlayerTurn;
        const nextPlayer = this.getNextPlayer(currentTurn, gameData.gameState.eliminatedPlayers || []);
        gameData.gameState.currentPlayerTurn = nextPlayer;
        gameData.currentPlayerTurn = nextPlayer;

        // Update move history
        gameData.lastMove = {
          from: moveData.from,
          to: moveData.to,
          pieceCode: moveData.pieceCode,
          playerColor: botColor,
          playerId: `bot_${botColor}`,
          timestamp: moveTimestamp,
          capturedPiece: capturedPiece || null,
        };

        // Setting lastMove for bot
        gameData.lastActivity = moveTimestamp;

        // Update version for sync
        gameData.gameState.version = (gameData.gameState.version ?? 0) + 1;

        // Update turnStartedAt for clock management
        gameData.gameState.turnStartedAt = moveTimestamp;

        return gameData;

      });

      if (botTimedOut) {
        await realtimeDatabaseService.timeoutPlayer(gameId, botColor);
        return;
      }

      if (result && result.committed) {
        console.log(`[BotDebug] Transaction committed for ${botColor}`);
        const totalTime = Date.now() - startTime;
        // Bot move completed successfully

        // Cancel any thinking notifications immediately since move is complete
        try {
          const notificationService = require('./notificationService').default;
          notificationService.clearByPattern('is thinking hard');
        } catch (notificationError) {
          // Ignore notification service errors
        }
      } else {
        console.warn(`[BotDebug] Transaction NOT committed for ${botColor}`);
      }

    } catch (error: any) {
      console.error(`[BotDebug] Transaction error for ${botColor}:`, error);
      // Handle Firebase transaction errors gracefully
      if (error.code === 'database/overridden-by-set' ||
        error.message?.includes('overridden-by-set') ||
        error.message?.includes('transaction was overridden')) {
        // Game state changed during bot calculation - this is normal, just skip this move
        console.log(`[BotDebug] overridden-by-set`);
        return;
      }

      if (error.code === 'database/max-retries' ||
        error.message?.includes('max-retries') ||
        error.message?.includes('too many retries')) {
        // Max retries exceeded for bot move - just skip this move instead of crashing
        console.log(`[BotDebug] max-retries`);
        return; // Skip this bot move instead of throwing error
      }

      if (error.code === 'database/disconnected' ||
        error.message?.includes('disconnected')) {
        // Firebase disconnected during transaction - this can happen due to network issues
        // or app going to background. Just skip this move, bot will retry when reconnected.
        console.log(`[BotDebug] disconnected - will retry when connection restored`);
        return;
      }

    } finally {
      clearTimeout(moveTimeout);
      this.botProcessingFlags.set(botColor, false);

      // ✅ FAIL-SAFE RETRY: If we aborted due to stale state (or any other recoverable reason),
      // we must check if we should still be moving.
      // E.g. If state updated from v1 -> v2 while we were thinking, we skipped the v2 trigger (because we were busy).
      // Now that we're done, we check if the store has a NEWER version than what we just used.
      // If store version > expectedVersion, we missed an update -> Retry immediately.
      // If store version == expectedVersion, we are consistent (or waiting for update) -> Do nothing (wait for update).
      try {
        const currentGameState = require('../state/store').store.getState().game;

        // Only retry if we're active, it's our turn, AND the state has actually changed locally
        // This prevents "spin loops" where we keep retrying on a stale local state while waiting for the server
        if (
          currentGameState &&
          currentGameState.gameStatus === 'active' &&
          currentGameState.currentPlayerTurn === botColor &&
          !currentGameState.eliminatedPlayers.includes(botColor) &&
          (currentGameState.version ?? 0) !== expectedVersion
        ) {
          console.log(`[BotRetry] Local state advanced (v${currentGameState.version} vs v${expectedVersion}). Retrying.`);
          // We use setTimeout to break the promise chain and allow the stack to clear
          setTimeout(() => {
            this.scheduleBotMove(gameId, botColor, currentGameState);
          }, 50);
        }
      } catch (err) {
        console.warn("[BotRetry] Failed to check for retry:", err);
      }
    }
  }

  // Get next player in turn order
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

  // Schedule bot move with delay
  public scheduleBotMove(gameId: string, botColor: string, gameState: GameState): void {

    // ✅ CRITICAL FIX: Check if bot is already processing a move
    if (this.botProcessingFlags.get(botColor)) {
      return;
    }

    // ✅ CRITICAL FIX: Validate game state before scheduling
    if (!gameState || !gameState.bitboardState?.pieces || gameState.currentPlayerTurn !== botColor) {
      return;
    }

    // ✅ IMMEDIATE EXECUTION: No delay for online bots since Firebase transaction provides natural delay
    // Re-validate game state before processing
    const currentGameState = require('../state/store').store.getState().game;

    if (currentGameState.currentPlayerTurn !== botColor) {
      return;
    }

    // Additional validation: Check if bot is still active and game is still active
    if (currentGameState.gameStatus !== 'active' ||
      currentGameState.eliminatedPlayers.includes(botColor) ||
      currentGameState.promotionState.isAwaiting) {
      return;
    }

    // Execute bot move immediately
    this.processBotMove(gameId, botColor, currentGameState, currentGameState.version ?? 0);
  }


  // Skip bot's turn when brain overheats (timeout)
  private async skipBotTurn(gameId: string, botColor: string): Promise<void> {
    const gameRef = ref(db, `games/${gameId}`);

    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 200; // 200ms base delay

    while (retryCount < maxRetries) {
      try {
        const result = await runTransaction(gameRef, (gameData) => {
          if (gameData === null) {
            // Game not found during skip turn
            return null;
          }

          // ✅ CRITICAL FIX: Check if gameState exists
          if (!gameData.gameState) {
            // Game has no gameState during skip turn
            return gameData;
          }

          // Initialize eliminatedPlayers if it doesn't exist
          if (!gameData.gameState.eliminatedPlayers) {
            gameData.gameState.eliminatedPlayers = [];
          }

          // Advance to next active player
          const turnOrder = ["r", "b", "y", "g"];
          const currentIndex = turnOrder.indexOf(gameData.gameState.currentPlayerTurn);
          const nextIndex = (currentIndex + 1) % turnOrder.length;
          const nextPlayerInSequence = turnOrder[nextIndex];

          let nextActivePlayer = nextPlayerInSequence;
          while (gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)) {
            const activeIndex = turnOrder.indexOf(nextActivePlayer);
            const nextActiveIndex = (activeIndex + 1) % turnOrder.length;
            nextActivePlayer = turnOrder[nextActiveIndex];
          }

          gameData.gameState.currentPlayerTurn = nextActivePlayer;
          gameData.currentPlayerTurn = nextActivePlayer;

          // Add a log entry for the skipped turn
          gameData.lastMove = {
            from: { row: -1, col: -1 },
            to: { row: -1, col: -1 },
            pieceCode: "SKIP",
            playerColor: botColor,
            playerId: `bot_${botColor}_overheated`,
            timestamp: Date.now(),
          };
          gameData.lastActivity = Date.now();

          return gameData;
        });

        if (result.committed) {
          return; // Success - exit retry loop
        } else {
          throw new Error("Transaction failed to commit");
        }
      } catch (error: any) {
        retryCount++;
        // Skip turn attempt failed

        if (retryCount >= maxRetries) {
          // Max retries exceeded for skipping bot turn
          return; // Give up after max retries
        }

        // Exponential backoff delay
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Cancel all scheduled bot moves
  public cancelAllBotMoves(): void {
    // Since we no longer use setTimeout delays, just clear processing flags
    this.botProcessingFlags.clear();
  }

  // Check if a player is a bot
  public isBotPlayer(playerId: string): boolean {
    return playerId.startsWith('bot_');
  }

  // Get bot color from player ID
  public getBotColor(playerId: string): string | null {
    if (!this.isBotPlayer(playerId)) return null;
    const parts = playerId.split('_');
    return parts[1] || null;
  }
}

export const onlineBotService = new OnlineBotService();
