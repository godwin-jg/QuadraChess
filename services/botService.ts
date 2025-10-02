// services/botService.ts

import { store } from '../state/store';
import { makeMove, completePromotion } from '../state/gameSlice';
import { getValidMoves } from '../functions/src/logic/gameLogic';
import { GameState, Position } from '../state/types';
import p2pGameService from './p2pGameService';
import captureAnimationService from './captureAnimationService';

// Global lock to prevent multiple bots from moving simultaneously
let botMoveInProgress = false;

// Point values for each piece type
const pieceValues: { [key: string]: number } = {
  P: 1,  // Pawn
  N: 3,  // Knight
  B: 5,  // Bishop
  R: 5,  // Rook
  Q: 9,  // Queen
  // K: Kings cannot be captured in chess, so no value assigned
};

interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
  // Note: capturedPieceCode removed to avoid stale data in multiplayer
}

const getAllLegalMoves = (botColor: string, gameState: GameState, maxMoves: number = 50): MoveOption[] => {
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
};

const makeBotMove = (botColor: string) => {
  
  // ✅ CRITICAL: Prevent multiple bots from moving simultaneously
  if (botMoveInProgress) {
    return;
  }
  
  const gameState = store.getState().game;
  
  // Safety checks
  if (!gameState || !gameState.boardState || gameState.gameStatus !== 'active') {
    return;
  }

  // ✅ CRITICAL: Double-check that it's actually this bot's turn
  if (gameState.currentPlayerTurn !== botColor) {
    return;
  }

  // ✅ CRITICAL FIX: Check if bot is eliminated
  if (gameState.eliminatedPlayers.includes(botColor)) {
    console.log(`🤖 BotService: Bot ${botColor} is eliminated, skipping move`);
    return;
  }

  // Set the lock
  botMoveInProgress = true;
  
  const allLegalMoves = getAllLegalMoves(botColor, gameState);

  if (allLegalMoves.length === 0) {
    botMoveInProgress = false; // Release the lock
    return;
  }

  const captureMoves = allLegalMoves.filter(move => move.to.isCapture);

  let chosenMove: MoveOption;

  if (captureMoves.length > 0) {
    // --- GREEDY CAPTURE LOGIC ---
    // Find the capture that yields the most points
    chosenMove = captureMoves.reduce((bestMove, currentMove) => {
      // Get captured piece codes at execution time to avoid stale data
      const bestCapturedPiece = gameState.boardState[currentMove.to.row][currentMove.to.col];
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
      console.warn(`🤖 Bot ${botColor}: Logic error - no captures found but no non-capture moves either. Using first available move.`);
      chosenMove = allLegalMoves[0];
    }
  }

  // Re-validate move at execution time to ensure it's still legal
  const currentGameState = store.getState().game;
  const pieceCode = currentGameState.boardState[chosenMove.from.row][chosenMove.from.col];
  
  if (!pieceCode || pieceCode[0] !== botColor) {
    console.error(`🤖 Bot ${botColor}: Move validation failed - piece not found or wrong color`);
    botMoveInProgress = false;
    return;
  }
  
  // Check if it's still this bot's turn
  if (currentGameState.currentPlayerTurn !== botColor) {
    console.error(`🤖 Bot ${botColor}: Turn validation failed - not bot's turn anymore`);
    botMoveInProgress = false;
    return;
  }

  // Execute the chosen move - handle different game modes
  if (currentGameState.gameMode === 'p2p') {
    // 🔊 Play sound and vibration for P2P bot move (since P2P doesn't trigger sounds automatically)
    try {
      const soundService = require('./soundService').default;
      const capturedPiece = currentGameState.boardState[chosenMove.to.row][chosenMove.to.col];
      
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

  // 🎯 Trigger capture animation if this move captures a piece
  const capturedPiece = currentGameState.boardState[chosenMove.to.row][chosenMove.to.col];
  if (capturedPiece && captureAnimationService.isAvailable()) {
    captureAnimationService.triggerCaptureAnimation(capturedPiece, chosenMove.to.row, chosenMove.to.col, botColor);
  }

  // Release the lock
  botMoveInProgress = false;
};

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
};
