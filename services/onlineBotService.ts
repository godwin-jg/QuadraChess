// services/onlineBotService.ts
// Centralized bot service for online games - single source of truth

import database from '@react-native-firebase/database';
import { getValidMoves } from '../functions/src/logic/gameLogic';
import { GameState, Position } from '../state/types';

interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
  capturedPieceCode?: string | null;
}

// Point values for each piece type
const pieceValues: { [key: string]: number } = {
  P: 1,  // Pawn
  N: 3,  // Knight
  B: 5,  // Bishop
  R: 5,  // Rook
  Q: 9,  // Queen
  K: 100, // King (highest priority)
};

class OnlineBotService {
  private botMoveTimeouts: Map<string, NodeJS.Timeout> = new Map();
  private isProcessingMove = false;

  // Get all legal moves for a bot
  private getAllLegalMoves(botColor: string, gameState: GameState, maxMoves: number = 50): MoveOption[] {
    const allMoves: MoveOption[] = [];
    const { boardState, eliminatedPlayers, hasMoved, enPassantTargets } = gameState;

    for (let r = 0; r < boardState.length; r++) {
      for (let c = 0; c < boardState[r].length; c++) {
        const pieceCode = boardState[r][c];
        if (pieceCode && pieceCode.startsWith(botColor)) {
          const movesForPiece = getValidMoves(
            pieceCode, { row: r, col: c }, boardState, eliminatedPlayers, hasMoved, enPassantTargets
          );
          
          // Limit moves per piece to avoid excessive computation
          const limitedMoves = movesForPiece.slice(0, 8); // Max 8 moves per piece
          
          limitedMoves.forEach(move => {
            const capturedPieceCode = boardState[move.row][move.col];
            allMoves.push({ 
              from: { row: r, col: c }, 
              to: { 
                row: move.row, 
                col: move.col, 
                isCapture: move.isCapture || false 
              }, 
              capturedPieceCode 
            });
          });
          
          // Stop if we've reached the maximum number of moves
          if (allMoves.length >= maxMoves) {
            break;
          }
        }
      }
      
      // Break outer loop if we've reached the limit
      if (allMoves.length >= maxMoves) {
        break;
      }
    }
    
    return allMoves.slice(0, maxMoves); // Ensure we don't exceed the limit
  }

  // Choose the best move for a bot
  private chooseBestMove(botColor: string, gameState: GameState): MoveOption | null {
    const allLegalMoves = this.getAllLegalMoves(botColor, gameState);
    console.log(`🤖 OnlineBotService: Bot ${botColor} found ${allLegalMoves.length} legal moves`);

    if (allLegalMoves.length === 0) {
      console.log(`🤖 OnlineBotService: Bot ${botColor} has no legal moves`);
      return null;
    }

    const captureMoves = allLegalMoves.filter(move => move.to.isCapture && move.capturedPieceCode);

    let chosenMove: MoveOption;

    if (captureMoves.length > 0) {
      // --- GREEDY CAPTURE LOGIC ---
      // Find the capture that yields the most points
      chosenMove = captureMoves.reduce((bestMove, currentMove) => {
        const bestValue = pieceValues[bestMove.capturedPieceCode![1]] || 0;
        const currentValue = pieceValues[currentMove.capturedPieceCode![1]] || 0;
        return currentValue > bestValue ? currentMove : bestMove;
      });
      console.log(`🤖 OnlineBotService: Bot ${botColor} found best capture! Taking ${chosenMove.capturedPieceCode}.`);

    } else {
      // --- RANDOM MOVE LOGIC ---
      // If no captures, make a random move
      const nonCaptureMoves = allLegalMoves.filter(move => !move.to.isCapture);
      if (nonCaptureMoves.length > 0) {
        chosenMove = nonCaptureMoves[Math.floor(Math.random() * nonCaptureMoves.length)];
        console.log(`🤖 OnlineBotService: Bot ${botColor} making a random move.`);
      } else {
        // Should only happen if the only legal moves are captures, but the capture list was empty. Fallback.
        chosenMove = allLegalMoves[0];
      }
    }

    return chosenMove;
  }

  // Process bot move directly in database
  private async processBotMove(gameId: string, botColor: string, gameState: GameState): Promise<void> {
    if (this.isProcessingMove) {
      console.log(`🤖 OnlineBotService: Another bot move is being processed, skipping ${botColor}`);
      return;
    }

    this.isProcessingMove = true;

    try {
      const chosenMove = this.chooseBestMove(botColor, gameState);
      
      if (!chosenMove) {
        console.log(`🤖 OnlineBotService: Bot ${botColor} has no valid moves`);
        return;
      }

      // Get the piece code
      const pieceCode = gameState.boardState[chosenMove.from.row][chosenMove.from.col];
      if (!pieceCode) {
        console.error(`🤖 OnlineBotService: No piece found at ${chosenMove.from.row},${chosenMove.from.col}`);
        return;
      }

      const moveData = {
        from: chosenMove.from,
        to: { row: chosenMove.to.row, col: chosenMove.to.col },
        pieceCode: pieceCode,
        playerColor: botColor,
      };

      console.log(`🤖 OnlineBotService: Bot ${botColor} making move:`, moveData);

      // Apply move directly to database
      const gameRef = database().ref(`games/${gameId}`);
      const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`🤖 OnlineBotService: Game ${gameId} not found`);
          return null;
        }

        // Validate bot turn
        if (gameData.gameState.currentPlayerTurn !== botColor) {
          console.log(`🤖 OnlineBotService: Bot ${botColor} turn mismatch, current turn: ${gameData.gameState.currentPlayerTurn}`);
          return gameData;
        }

        // Apply move to board state
        const boardState = gameData.gameState.boardState;
        const piece = boardState[moveData.from.row][moveData.from.col];
        boardState[moveData.from.row][moveData.from.col] = "";
        boardState[moveData.to.row][moveData.to.col] = piece;

        // Update turn
        const currentTurn = gameData.gameState.currentPlayerTurn;
        const nextPlayer = this.getNextPlayer(currentTurn);
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

        console.log(`🤖 OnlineBotService: Bot ${botColor} move processed, turn advanced to ${nextPlayer}`);
        return gameData;
      });

      if (!result.committed) {
        console.error(`🤖 OnlineBotService: Bot ${botColor} move transaction failed`);
      }

    } catch (error) {
      console.error(`🤖 OnlineBotService: Error processing bot ${botColor} move:`, error);
    } finally {
      this.isProcessingMove = false;
    }
  }

  // Get next player in turn order
  private getNextPlayer(currentPlayer: string): string {
    const turnOrder = ["r", "b", "y", "g"];
    const currentIndex = turnOrder.indexOf(currentPlayer);
    return turnOrder[(currentIndex + 1) % turnOrder.length];
  }

  // Schedule bot move with delay
  public scheduleBotMove(gameId: string, botColor: string, gameState: GameState): void {
    // Clear any existing timeout for this bot
    const existingTimeout = this.botMoveTimeouts.get(botColor);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Schedule bot move with random delay (1-3 seconds)
    const delay = 1000 + Math.random() * 2000;
    console.log(`🤖 OnlineBotService: Scheduling bot ${botColor} move in ${delay}ms`);

    const timeout = setTimeout(() => {
      this.processBotMove(gameId, botColor, gameState);
      this.botMoveTimeouts.delete(botColor);
    }, delay);

    this.botMoveTimeouts.set(botColor, timeout);
  }

  // Cancel all scheduled bot moves
  public cancelAllBotMoves(): void {
    console.log(`🤖 OnlineBotService: Cancelling all scheduled bot moves`);
    this.botMoveTimeouts.forEach((timeout, botColor) => {
      clearTimeout(timeout);
      console.log(`🤖 OnlineBotService: Cancelled bot ${botColor} move`);
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
