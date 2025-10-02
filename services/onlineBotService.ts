// services/onlineBotService.ts
// Centralized bot service for online games - single source of truth

import database from '@react-native-firebase/database';
import { getValidMoves } from '../functions/src/logic/gameLogic';
import { GameState, Position } from '../state/types';
import captureAnimationService from './captureAnimationService';

interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
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
  private isProcessingMove = false;

  // Get all legal moves for a bot
  private getAllLegalMoves(botColor: string, gameState: GameState, maxMoves: number = 50): MoveOption[] {
    const allMoves: MoveOption[] = [];
    const { boardState, eliminatedPlayers, hasMoved, enPassantTargets } = gameState;

    // Collect all bot pieces first to avoid positional bias
    const botPieces: { pieceCode: string; position: { row: number; col: number } }[] = [];
    
    for (let r = 0; r < boardState.length; r++) {
      for (let c = 0; c < boardState[r].length; c++) {
        const pieceCode = boardState[r][c];
        if (pieceCode && pieceCode.startsWith(botColor)) {
          botPieces.push({ pieceCode, position: { row: r, col: c } });
        }
      }
    }
    
    // Randomize piece order to remove positional bias
    const shuffledPieces = botPieces.sort(() => Math.random() - 0.5);
    
    // Process pieces in randomized order
    for (const { pieceCode, position } of shuffledPieces) {
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
      
      // Stop if we've reached the maximum number of moves
      if (allMoves.length >= maxMoves) {
        break;
      }
    }
    
    return allMoves.slice(0, maxMoves); // Ensure we don't exceed the limit
  }

  // Choose the best move for a bot
  private chooseBestMove(botColor: string, gameState: GameState): MoveOption | null {
    const allLegalMoves = this.getAllLegalMoves(botColor, gameState);

    if (allLegalMoves.length === 0) {
      return null;
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
    if (this.isProcessingMove) {
      return;
    }

    this.isProcessingMove = true;

    try {
      const chosenMove = this.chooseBestMove(botColor, gameState);
      
      if (!chosenMove) {
        return;
      }

      // Re-validate move at execution time to ensure it's still legal
      const pieceCode = gameState.boardState[chosenMove.from.row][chosenMove.from.col];
      if (!pieceCode || pieceCode[0] !== botColor) {
        console.error(`🤖 OnlineBotService: Move validation failed - piece not found or wrong color`);
        return;
      }
      
      // Check if it's still this bot's turn
      if (gameState.currentPlayerTurn !== botColor) {
        console.error(`🤖 OnlineBotService: Turn validation failed - not bot's turn anymore`);
        return;
      }

      // ✅ CRITICAL FIX: Check if bot is eliminated
      if (gameState.eliminatedPlayers.includes(botColor)) {
        console.log(`🤖 OnlineBotService: Bot ${botColor} is eliminated, skipping move`);
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

      // Apply move directly to database
      const gameRef = database().ref(`games/${gameId}`);
      const result = await gameRef.transaction((gameData) => {
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
          piece: moveData.pieceCode,
          player: `bot_${botColor}`,
          timestamp: Date.now(),
        };
        gameData.lastActivity = Date.now();

        return gameData;
      });

      if (!result.committed) {
        console.error(`🤖 OnlineBotService: Bot ${botColor} move transaction failed`);
      } else {
        // 🎯 Trigger capture animation if this move captures a piece
        const capturedPiece = gameState.boardState[chosenMove.to.row][chosenMove.to.col];
        if (capturedPiece && captureAnimationService.isAvailable()) {
          captureAnimationService.triggerCaptureAnimation(capturedPiece, chosenMove.to.row, chosenMove.to.col, botColor);
        }
      }

    } catch (error) {
      console.error(`🤖 OnlineBotService: Error processing bot ${botColor} move:`, error);
    } finally {
      this.isProcessingMove = false;
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

    // Schedule bot move with faster delay (0.3-0.8 seconds)
    const delay = 300 + Math.random() * 500;

    const timeout = setTimeout(() => {
      this.processBotMove(gameId, botColor, gameState);
      this.botMoveTimeouts.delete(botColor);
    }, delay);

    this.botMoveTimeouts.set(botColor, timeout);
  }

  // Cancel all scheduled bot moves
  public cancelAllBotMoves(): void {
    this.botMoveTimeouts.forEach((timeout, botColor) => {
      clearTimeout(timeout);
    });
    this.botMoveTimeouts.clear();
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
