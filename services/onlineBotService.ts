// services/onlineBotService.ts
// Centralized bot service for online games - single source of truth

import database from '@react-native-firebase/database';
import { getValidMoves } from '../functions/src/logic/gameLogic';
import { GameState, Position } from '../state/types';
import { BOT_CONFIG } from '../config/gameConfig';

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

// Point values for each piece type
const pieceValues: { [key: string]: number } = {
  P: 1,  // Pawn
  N: 3,  // Knight
  B: 5,  // Bishop
  R: 5,  // Rook
  Q: 9,  // Queen
  // K: Kings cannot be captured in chess, so no value assigned
};

class OnlineBotService {
  private botMoveTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private botProcessingFlags: Map<string, boolean> = new Map(); // Per-bot processing flags

  // Get all legal moves for a bot with cancellation support
  private getAllLegalMoves(botColor: string, gameState: GameState, maxMoves: number = 20, cancellationToken?: { cancelled: boolean }): MoveOption[] {
    const allMoves: MoveOption[] = [];
    const { boardState, eliminatedPlayers, hasMoved, enPassantTargets } = gameState;

    // Collect all bot pieces first to avoid positional bias
    const botPieces: { pieceCode: string; position: { row: number; col: number } }[] = [];
    
    for (let r = 0; r < boardState.length; r++) {
      for (let c = 0; c < boardState[r].length; c++) {
        // Check for cancellation before each piece
        if (cancellationToken?.cancelled) {
          return [];
        }
        
        const pieceCode = boardState[r][c];
        if (pieceCode && pieceCode.startsWith(botColor)) {
          botPieces.push({ pieceCode, position: { row: r, col: c } });
        }
      }
    }
    
    // Prioritize pieces that are more likely to have good moves (captures first)
    const prioritizedPieces = botPieces.sort((a, b) => {
      // Prioritize by piece value and likelihood of captures
      const pieceValues = { 'Q': 9, 'R': 5, 'B': 5, 'N': 3, 'P': 1, 'K': 0 };
      const aValue = pieceValues[a.pieceCode[1] as keyof typeof pieceValues] || 0;
      const bValue = pieceValues[b.pieceCode[1] as keyof typeof pieceValues] || 0;
      return bValue - aValue; // Higher value pieces first
    });
    
    // Process pieces in prioritized order with early termination and cancellation checks
    for (const { pieceCode, position } of prioritizedPieces) {
      // Check for cancellation before processing each piece
      if (cancellationToken?.cancelled) {
        return [];
      }
      
      const movesForPiece = getValidMoves(
        pieceCode, position, boardState, eliminatedPlayers, hasMoved, enPassantTargets
      );
      
      // Use all legal moves for this piece (no arbitrary truncation)
      movesForPiece.forEach(move => {
        allMoves.push({ 
          from: position, 
          to: { 
            row: move.row, 
            col: move.col, 
            isCapture: move.isCapture || false 
          }
          // Note: capturedPieceCode removed to avoid stale data in multiplayer
        });
      });
      
      // Early termination: Stop if we have enough moves for decision making
      if (allMoves.length >= maxMoves) {
        break;
      }
    }
    
    return allMoves.slice(0, maxMoves); // Ensure we don't exceed the limit
  }

  // Choose the best move for a bot
  private chooseBestMove(botColor: string, gameState: GameState, cancellationToken?: { cancelled: boolean }): MoveOption | null {
    const allLegalMoves = this.getAllLegalMoves(botColor, gameState, 20, cancellationToken);

    // Check if calculation was cancelled due to timeout (brain overheated)
    if (cancellationToken?.cancelled) {
      return null; // Return null to indicate skip turn (not elimination)
    }

    if (allLegalMoves.length === 0) {
      // Bot has no legal moves - check if it's checkmate or stalemate
      const { isKingInCheck } = require('../functions/src/logic/gameLogic');
      const isInCheck = isKingInCheck(botColor, gameState.boardState, gameState.eliminatedPlayers, gameState.hasMoved);
      
      if (isInCheck) {
        // Return a special "eliminate" move
        return { from: { row: -1, col: -1 }, to: { row: -1, col: -1, isCapture: false }, isEliminate: true };
      } else {
        return null;
      }
    }

    const captureMoves = allLegalMoves.filter(move => move.to.isCapture);

    let chosenMove: MoveOption;

    if (captureMoves.length > 0) {
      // --- GREEDY CAPTURE LOGIC ---
      // Find the capture that yields the most points
      chosenMove = captureMoves.reduce((bestMove, currentMove) => {
        // Get captured piece codes at execution time to avoid stale data
        const bestCapturedPiece = gameState.boardState[bestMove.to.row][bestMove.to.col];
        const currentCapturedPiece = gameState.boardState[currentMove.to.row][currentMove.to.col];
        
        const bestValue = (bestCapturedPiece && bestCapturedPiece.length >= 2) 
          ? pieceValues[bestCapturedPiece[1]] || 0 
          : 0;
        const currentValue = (currentCapturedPiece && currentCapturedPiece.length >= 2) 
          ? pieceValues[currentCapturedPiece[1]] || 0 
          : 0;
        
        return currentValue > bestValue ? currentMove : bestMove;
      });
      const capturedPiece = gameState.boardState[chosenMove.to.row][chosenMove.to.col];

    } else {
      // --- RANDOM MOVE LOGIC ---
      // If no captures, make a random move
      const nonCaptureMoves = allLegalMoves.filter(move => !move.to.isCapture);
      if (nonCaptureMoves.length > 0) {
        chosenMove = nonCaptureMoves[Math.floor(Math.random() * nonCaptureMoves.length)];
      } else {
        // This should never happen since we already filtered captureMoves above
        // If it does happen, it indicates a logic error - log and use first available move
        console.warn(`🤖 OnlineBotService: Bot ${botColor} logic error - no captures found but no non-capture moves either. Using first available move.`);
        chosenMove = allLegalMoves[0];
      }
    }

    return chosenMove;
  }

  // Process bot move directly in database
  private async processBotMove(gameId: string, botColor: string, gameState: GameState): Promise<void> {
    const startTime = Date.now();
    
    if (this.botProcessingFlags.get(botColor)) {
      return;
    }

    // ✅ CRITICAL FIX: Don't make moves when promotion modal is open
    if (gameState.promotionState.isAwaiting) {
      console.log(`🤖 OnlineBotService: Promotion modal is open, skipping bot ${botColor} move`);
      console.log(`🤖 DEBUG: promotionState =`, gameState.promotionState);
      console.log(`🤖 DEBUG: gameStatus =`, gameState.gameStatus);
      console.log(`🤖 DEBUG: currentPlayerTurn =`, gameState.currentPlayerTurn);
      return;
    }

    this.botProcessingFlags.set(botColor, true);

    // ⚡ PERFORMANCE FIX: Set a timeout to prevent bot from taking too long
    const cancellationToken = { cancelled: false };
    const moveTimeout = setTimeout(() => {
      console.warn(`🤖 OnlineBotService: Bot ${botColor} brain overheated after 5 seconds, skipping move`);
      cancellationToken.cancelled = true;
      this.botProcessingFlags.set(botColor, false);
      
      // Skip bot's turn and advance to next player
      this.skipBotTurn(gameId, botColor);
    }, 5000); // 5 second timeout

    try {
      const chosenMove = this.chooseBestMove(botColor, gameState, cancellationToken);
      
      // Check if calculation was cancelled due to timeout (brain overheated)
      if (cancellationToken.cancelled) {
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
      }
      
      if (!chosenMove) {
        // No legal moves found (stalemate) - just skip turn
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
      }

      // Handle bot elimination (checkmate)
      if (chosenMove.isEliminate) {
        await this.eliminateBot(gameId, botColor);
        clearTimeout(moveTimeout);
        this.botProcessingFlags.set(botColor, false);
        return;
      }

      // Re-validate move at execution time to ensure it's still legal
      const pieceCode = gameState.boardState[chosenMove.from.row][chosenMove.from.col];
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


      // 🔊 Play sound and vibration for bot move
      try {
        const soundService = require('./soundService').default;
        const capturedPiece = gameState.boardState[chosenMove.to.row][chosenMove.to.col];
        
        // Check if this is a castling move
        const isCastling = require('../state/gameHelpers').isCastlingMove(
          pieceCode,
          chosenMove.from.row,
          chosenMove.from.col,
          chosenMove.to.row,
          chosenMove.to.col
        );
        
        if (isCastling) {
          soundService.playCastleSound();
        } else if (capturedPiece) {
          soundService.playCaptureSound();
        } else {
          soundService.playMoveSound();
        }
      } catch (error) {
      }

      // Apply move directly to database with retry logic
      const gameRef = database().ref(`games/${gameId}`);
      
      // Add retry logic for transaction conflicts
      let retryCount = 0;
      const maxRetries = 3;
      let result: any = null;
      
      while (retryCount < maxRetries) {
        try {
          result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`🤖 OnlineBotService: Game ${gameId} not found`);
          return null;
        }

        // ✅ CRITICAL FIX: Check if gameState exists
        if (!gameData.gameState) {
          console.warn(`🤖 OnlineBotService: Game ${gameId} has no gameState`);
          return gameData;
        }

        // Validate bot turn
        if (gameData.gameState.currentPlayerTurn !== botColor) {
          return gameData;
        }

        // Apply move to board state
        const boardState = gameData.gameState.boardState;
        
        // ✅ CRITICAL FIX: Check if boardState exists
        if (!boardState) {
          console.warn(`🤖 OnlineBotService: Game ${gameId} has no boardState`);
          return gameData;
        }
        
        // ✅ CRITICAL FIX: Check if this is a capture move and update scores
        const capturedPiece = boardState[moveData.to.row][moveData.to.col];
        if (capturedPiece && capturedPiece[0] !== botColor) {
          const capturedPieceType = capturedPiece[1];
          let points = 0;
          switch (capturedPieceType) {
            case "P": // Pawn
              points = 1;
              break;
            case "N": // Knight
              points = 3;
              break;
            case "B": // Bishop
            case "R": // Rook
              points = 5;
              break;
            case "Q": // Queen
              points = 9;
              break;
            default:
              points = 0;
          }
          
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
          
          console.log(`🤖 OnlineBotService: Bot ${botColor} captured ${capturedPiece} for ${points} points`);
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
        gameData.lastMove = {
          from: moveData.from,
          to: moveData.to,
          pieceCode: moveData.pieceCode,
          playerColor: botColor,
          playerId: `bot_${botColor}`,
          timestamp: Date.now(),
        };
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

          if (result.committed) {
            // Success! Break out of retry loop
            break;
          } else {
            throw new Error("Transaction failed to commit");
          }
        } catch (error: any) {
          retryCount++;
          console.warn(`🤖 OnlineBotService: Bot ${botColor} move attempt ${retryCount} failed:`, error.message);
          
          // Check for specific Firebase errors that should not be retried
          if (error.code === 'database/max-retries' || 
              error.message?.includes('max-retries') ||
              error.message?.includes('too many retries')) {
            console.error(`🤖 OnlineBotService: Max retries exceeded for bot ${botColor} move. Giving up.`);
            throw error;
          }
          
          if (retryCount >= maxRetries) {
            console.error(`🤖 OnlineBotService: Bot ${botColor} move failed after ${maxRetries} attempts`);
            throw error;
          }
          
          // Wait before retrying with exponential backoff
          const delay = 200 * Math.pow(2, retryCount - 1); // 200ms, 400ms, 800ms
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (result && result.committed) {
        const totalTime = Date.now() - startTime;
        console.log(`🤖 Bot ${botColor} move completed in ${totalTime}ms`);
        
        // ✅ Animation is now handled automatically by the Board component
        // when it detects the lastMove state change from the dispatched makeMove action
      }

    } catch (error) {
      console.error(`🤖 OnlineBotService: Error processing bot ${botColor} move:`, error);
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
    // Clear any existing timeout for this bot
    const existingTimeout = this.botMoveTimeouts.get(botColor);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // ✅ UNIFIED TIMING: Use centralized bot timing for consistency
    // This allows piece animation (250ms) + thinking time (1250ms) = 1500ms total
    const delay = BOT_CONFIG.MOVE_DELAY;

    const timeout = setTimeout(() => {
      this.processBotMove(gameId, botColor, gameState);
      this.botMoveTimeouts.delete(botColor);
    }, delay);

    this.botMoveTimeouts.set(botColor, timeout);
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
          console.warn(`🤖 OnlineBotService: Game ${gameId} not found during elimination`);
          return null;
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
        console.warn(`🤖 OnlineBotService: Elimination attempt ${retryCount} failed:`, error.message);
        
        if (retryCount >= maxRetries) {
          console.error(`🤖 OnlineBotService: Max retries exceeded for eliminating bot ${botColor}`);
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
          console.warn(`🤖 OnlineBotService: Game ${gameId} not found during skip turn`);
          return null;
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
        console.warn(`🤖 OnlineBotService: Skip turn attempt ${retryCount} failed:`, error.message);
        
        if (retryCount >= maxRetries) {
          console.error(`🤖 OnlineBotService: Max retries exceeded for skipping bot ${botColor} turn`);
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
    this.botMoveTimeouts.forEach((timeout, botColor) => {
      clearTimeout(timeout);
    });
    this.botMoveTimeouts.clear();
    this.botProcessingFlags.clear(); // Clear all processing flags
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
