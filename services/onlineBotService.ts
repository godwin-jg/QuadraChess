// services/onlineBotService.ts
// Centralized bot service for online games - single source of truth

import database from '@react-native-firebase/database';
import { getValidMoves } from "../src/logic/gameLogic";
import { GameState, Position } from '../state/types';
import { BOT_CONFIG, getBotConfig, PIECE_VALUES } from '../config/gameConfig';
import { getPieceAtFromBitboard, bitScanForward } from '../src/logic/bitboardUtils';
import { computeBestMove } from "./botService";

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

  // Get all legal moves for a bot with smart timeout and early termination
  private getAllLegalMoves(botColor: string, gameState: GameState, maxMoves?: number, cancellationToken?: { cancelled: boolean }): MoveOption[] {
    // Get the appropriate bot configuration based on game mode
    const botConfig = getBotConfig(gameState.gameMode, gameState.botDifficulty);
    const maxMovesToCalculate = maxMoves || botConfig.MAX_MOVES_TO_CALCULATE;
    
    const allMoves: MoveOption[] = [];
    const { boardState, eliminatedPlayers, hasMoved, enPassantTargets } = gameState;
    const startTime = Date.now();
    const maxCalculationTime = 1500; // Reduced from 3000 to 1500ms for much faster calculation

    // ✅ BITBOARD ONLY: Collect all bot pieces from bitboards
    const botPieces: { pieceCode: string; position: { row: number; col: number } }[] = [];
    const pieces = gameState.bitboardState?.pieces || {};
    
    for (const [pieceCode, bb] of Object.entries(pieces)) {
      if (!pieceCode.startsWith(botColor) || !bb || bb === 0n) continue;
      
      let temp = bb as bigint;
      while (temp > 0n) {
        if (cancellationToken?.cancelled || (Date.now() - startTime) > maxCalculationTime) {
          return allMoves; // Return what we have so far
        }
        
        const sqIdx = Number(bitScanForward(temp));
        const row = Math.floor(sqIdx / 14);
        const col = sqIdx % 14;
        botPieces.push({ pieceCode, position: { row, col } });
        temp &= temp - 1n; // Clear lowest bit
      }
    }
    
    // ✅ SMART OPTIMIZATION: Prioritize pieces that are more likely to have good moves
    const prioritizedPieces = botPieces.sort((a, b) => {
      const aValue = PIECE_VALUES[a.pieceCode[1] as keyof typeof PIECE_VALUES] || 0;
      const bValue = PIECE_VALUES[b.pieceCode[1] as keyof typeof PIECE_VALUES] || 0;
      return bValue - aValue; // Higher value pieces first
    });
    
    // ✅ SMART OPTIMIZATION: Process pieces with time-based early termination
    for (const { pieceCode, position } of prioritizedPieces) {
      // Check for cancellation and time limit before processing each piece
      if (cancellationToken?.cancelled || (Date.now() - startTime) > maxCalculationTime) {
        break; // Stop processing but return what we have
      }
      
      try {
        const movesForPiece = getValidMoves(
          pieceCode, position, gameState, eliminatedPlayers, hasMoved, enPassantTargets
        );
        
        // Add moves for this piece
        movesForPiece.forEach(move => {
          allMoves.push({ 
            from: position, 
            to: { 
              row: move.row, 
              col: move.col, 
              isCapture: move.isCapture || false 
            }
          });
        });
        
        // ✅ SMART OPTIMIZATION: Early termination if we have enough good moves
        if (allMoves.length >= maxMovesToCalculate) {
          break;
        }
      } catch (error) {
        // If getValidMoves fails for a piece, skip it and continue
        // Skip problematic pieces silently
        continue;
      }
    }
    
    return allMoves.slice(0, maxMovesToCalculate); // Ensure we don't exceed the limit
  }

  // Process bot move directly in database
  private async processBotMove(gameId: string, botColor: string, gameState: GameState): Promise<void> {
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
    
    // Calculate adaptive timeout based on game state complexity
    const pieceCount = gameState.boardState.flat().filter(cell => cell && cell.startsWith(botColor)).length;
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
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
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

        await this.eliminateBot(gameId, botColor);
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
      const gameRef = database().ref(`games/${gameId}`);
      
      // Simplified transaction for faster bot moves
      const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          // Game not found
          return null;
        }

        // ✅ CRITICAL FIX: Check if gameState exists
        if (!gameData.gameState) {
          // Game has no gameState
          return gameData;
        }

        // ✅ CRITICAL FIX: Validate bot turn and prevent multiple moves
        if (gameData.gameState.currentPlayerTurn !== botColor) {
          // Bot turn validation failed
          return gameData;
        }

        // ✅ CRITICAL FIX: Double-check that this bot hasn't already moved
        if (gameData.lastMove && gameData.lastMove.playerColor === botColor) {
          // Bot has already moved this turn
          return gameData;
        }

        // Apply move to board state
        const boardState = gameData.gameState.boardState;
        
        // ✅ CRITICAL FIX: Check if boardState exists
        if (!boardState) {
          // Game has no boardState
          return gameData;
        }
        
        // ✅ CRITICAL FIX: Check if this is a capture move and update scores
        const capturedPiece = boardState[moveData.to.row][moveData.to.col];
        if (capturedPiece && capturedPiece[0] !== botColor) {
          const capturedPieceType = capturedPiece[1] as keyof typeof PIECE_VALUES;
          const points = PIECE_VALUES[capturedPieceType] || 0;
          
          // Update scores in game state
          if (!gameData.gameState.scores) {
            gameData.gameState.scores = { r: 0, b: 0, y: 0, g: 0 };
          }
          gameData.gameState.scores[botColor as keyof typeof gameData.gameState.scores] += points;
          
          // Update captured pieces
          if (!gameData.gameState.capturedPieces) {
            gameData.gameState.capturedPieces = { r: [], b: [], y: [], g: [] };
          }
          const capturedColor = capturedPiece[0] as keyof typeof gameData.gameState.capturedPieces;
          if (!gameData.gameState.capturedPieces[capturedColor]) {
            gameData.gameState.capturedPieces[capturedColor] = [];
          }
          gameData.gameState.capturedPieces[capturedColor].push(capturedPiece);
          
          // Bot captured piece
        }
        
        const piece = boardState[moveData.from.row][moveData.from.col];
        boardState[moveData.from.row][moveData.from.col] = "";
        boardState[moveData.to.row][moveData.to.col] = piece;

        // Update turn
        const currentTurn = gameData.gameState.currentPlayerTurn;
        const nextPlayer = this.getNextPlayer(currentTurn, gameData.gameState.eliminatedPlayers || []);
        gameData.gameState.currentPlayerTurn = nextPlayer;
        gameData.currentPlayerTurn = nextPlayer;

        // Update move history
        const moveTimestamp = Date.now();
        gameData.lastMove = {
          from: moveData.from,
          to: moveData.to,
          pieceCode: moveData.pieceCode,
          playerColor: botColor,
          playerId: `bot_${botColor}`,
          timestamp: moveTimestamp,
          capturedPiece: capturedPiece, // ✅ CRITICAL FIX: Include captured piece for proper sound effects
        };
        
        // Setting lastMove for bot
        gameData.lastActivity = Date.now();
        
        // ✅ CRITICAL FIX: Update move history for bots
        if (!gameData.gameState.history) {
          gameData.gameState.history = [];
        }
        if (!gameData.gameState.historyIndex) {
          gameData.gameState.historyIndex = 0;
        }
        
        // Create a snapshot of the current game state for history
        const historySnapshot = {
          boardState: gameData.gameState.boardState,
          currentPlayerTurn: gameData.gameState.currentPlayerTurn,
          gameStatus: gameData.gameState.gameStatus,
          scores: gameData.gameState.scores,
          capturedPieces: gameData.gameState.capturedPieces,
          eliminatedPlayers: gameData.gameState.eliminatedPlayers,
          winner: gameData.gameState.winner,
          justEliminated: gameData.gameState.justEliminated,
          checkStatus: gameData.gameState.checkStatus,
          promotionState: gameData.gameState.promotionState,
          hasMoved: gameData.gameState.hasMoved,
          enPassantTargets: gameData.gameState.enPassantTargets,
          gameOverState: gameData.gameState.gameOverState,
          lastMove: gameData.lastMove,
        };
        
        // Add to history
        gameData.gameState.history.push(historySnapshot);
        gameData.gameState.historyIndex = gameData.gameState.history.length - 1;

        return gameData;
      });

      if (result && result.committed) {
        const totalTime = Date.now() - startTime;
        // Bot move completed successfully
        
        // Cancel any thinking notifications immediately since move is complete
        try {
          const notificationService = require('./notificationService').default;
          notificationService.clearByPattern('is thinking hard');
        } catch (notificationError) {
          // Ignore notification service errors
        }
      }

    } catch (error: any) {
      // Handle Firebase transaction errors gracefully
      if (error.code === 'database/overridden-by-set' || 
          error.message?.includes('overridden-by-set') ||
          error.message?.includes('transaction was overridden')) {
        // Game state changed during bot calculation - this is normal, just skip this move
        return;
      }
      
      if (error.code === 'database/max-retries' || 
          error.message?.includes('max-retries') ||
          error.message?.includes('too many retries')) {
        // Max retries exceeded for bot move - just skip this move instead of crashing
        return; // Skip this bot move instead of throwing error
      }
      
    } finally {
      clearTimeout(moveTimeout);
      this.botProcessingFlags.set(botColor, false);
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
    if (!gameState || !gameState.boardState || gameState.currentPlayerTurn !== botColor) {
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
    this.processBotMove(gameId, botColor, currentGameState);
  }


  // Auto-eliminate a checkmated bot
  private async eliminateBot(gameId: string, botColor: string): Promise<void> {
    const gameRef = database().ref(`games/${gameId}`);
    
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 200; // 200ms base delay
    
    while (retryCount < maxRetries) {
      try {
        const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          // Game not found during elimination
          return null;
        }

        // ✅ CRITICAL FIX: Check if gameState exists
        if (!gameData.gameState) {
          // Game has no gameState during elimination
          return gameData;
        }

        // Initialize eliminatedPlayers if it doesn't exist
        if (!gameData.gameState.eliminatedPlayers) {
          gameData.gameState.eliminatedPlayers = [];
        }

        // Check if bot is already eliminated
        if (gameData.gameState.eliminatedPlayers.includes(botColor)) {
          return gameData;
        }

        // Add bot to eliminated players
        gameData.gameState.eliminatedPlayers.push(botColor);
        gameData.gameState.justEliminated = botColor;

        // Check if game is over (3 players eliminated)
        if (gameData.gameState.eliminatedPlayers.length >= 3) {
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
          const nextIndex = (currentIndex + 1) % turnOrder.length;
          const nextPlayerInSequence = turnOrder[nextIndex];

          let nextActivePlayer = nextPlayerInSequence;
          while (gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)) {
            const activeIndex = turnOrder.indexOf(nextActivePlayer);
            const nextActiveIndex = (activeIndex + 1) % turnOrder.length;
            nextActivePlayer = turnOrder[nextActiveIndex];
          }

          gameData.gameState.currentPlayerTurn = nextActivePlayer;
        }

        return gameData;
        });

        if (result.committed) {
          return; // Success - exit retry loop
        } else {
          throw new Error("Transaction failed to commit");
        }
      } catch (error: any) {
        retryCount++;
        // Elimination attempt failed
        
        if (retryCount >= maxRetries) {
          // Max retries exceeded for eliminating bot
          return; // Give up after max retries
        }
        
        // Exponential backoff delay
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // Skip bot's turn when brain overheats (timeout)
  private async skipBotTurn(gameId: string, botColor: string): Promise<void> {
    const gameRef = database().ref(`games/${gameId}`);
    
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 200; // 200ms base delay
    
    while (retryCount < maxRetries) {
      try {
        const result = await gameRef.transaction((gameData) => {
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
