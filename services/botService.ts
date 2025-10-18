// services/botService.ts

import { store } from '../state/store';
import { makeMove, completePromotion, resignGame } from '../state/gameSlice';
import { getValidMoves } from '../functions/src/logic/gameLogic';
import { GameState, Position } from '../state/types';
import p2pGameService from './p2pGameService';
import { PIECE_VALUES, TURN_ORDER, BOT_CONFIG } from '../config/gameConfig';

// Global lock to prevent multiple bots from moving simultaneously
let botMoveInProgress = false;

// ✅ Using centralized piece values from gameConfig

interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
  // Note: capturedPieceCode removed to avoid stale data in multiplayer
}

const getAllLegalMoves = (botColor: string, gameState: GameState, maxMoves: number = BOT_CONFIG.MAX_MOVES_TO_CALCULATE, cancellationToken?: { cancelled: boolean }): MoveOption[] => {
  const allMoves: MoveOption[] = [];
  const { boardState, eliminatedPlayers, hasMoved, enPassantTargets } = gameState;

  // ✅ CRITICAL FIX: Collect all bot pieces and shuffle them for random selection
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
  
  // ✅ CRITICAL FIX: Shuffle pieces for random selection instead of predictable row-wise order
  const shuffledPieces = botPieces.sort(() => Math.random() - 0.5);
  
  // ✅ CRITICAL FIX: Only prioritize pieces that actually have legal moves
  const availablePieces: { pieceCode: string; position: { row: number; col: number }; hasMoves: boolean }[] = [];
  
  for (const { pieceCode, position } of shuffledPieces) {
    // Check for cancellation before processing each piece
    if (cancellationToken?.cancelled) {
      return [];
    }
    
    const movesForPiece = getValidMoves(
      pieceCode, position, boardState, eliminatedPlayers, hasMoved, enPassantTargets
    );
    
    // Only include pieces that have legal moves
    if (movesForPiece.length > 0) {
      availablePieces.push({ pieceCode, position, hasMoves: true });
    }
  }
  
  // ✅ CRITICAL FIX: Shuffle available pieces again for maximum randomness
  const randomizedPieces = availablePieces.sort(() => Math.random() - 0.5);
  
  // ✅ CRITICAL FIX: Process pieces in random order with early termination and cancellation checks
  for (const { pieceCode, position } of randomizedPieces) {
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

  // ✅ CRITICAL FIX: Don't make moves when promotion modal is open
  if (gameState.promotionState.isAwaiting) {
    return;
  }

  // ✅ CRITICAL: Double-check that it's actually this bot's turn
  if (gameState.currentPlayerTurn !== botColor) {
    return;
  }

  // ✅ CRITICAL FIX: Check if bot is eliminated
  if (gameState.eliminatedPlayers.includes(botColor)) {
    return;
  }

  // Set the lock
  botMoveInProgress = true;
  
  // ⚡ PERFORMANCE FIX: Set a timeout to prevent bot from taking too long
  const cancellationToken = { cancelled: false };
  const moveTimeout = setTimeout(() => {
    cancellationToken.cancelled = true;
    botMoveInProgress = false;
    
    // Notify user about bot thinking hard
    try {
      const notificationService = require('./notificationService').default;
      notificationService.show(`Bot ${botColor.toUpperCase()} is thinking hard...`, "info", 3000);
    } catch (notificationError) {
      console.warn("Failed to show bot thinking notification:", notificationError);
    }
    
    // Skip bot's turn and advance to next player
    skipBotTurn(botColor);
  }, BOT_CONFIG.BRAIN_TIMEOUT);
  
  const allLegalMoves = getAllLegalMoves(botColor, gameState, BOT_CONFIG.MAX_MOVES_TO_CALCULATE, cancellationToken);

  // Check if calculation was cancelled due to timeout (brain overheated)
  if (cancellationToken.cancelled) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
    return;
  }

  if (allLegalMoves.length === 0) {
    // Bot has no legal moves - check if it's checkmate or stalemate
    const { isKingInCheck } = require('../functions/src/logic/gameLogic');
    const isInCheck = isKingInCheck(botColor, gameState.boardState, gameState.eliminatedPlayers, gameState.hasMoved);
    
    if (isInCheck) {
      
      // Notify user about bot elimination
      try {
        const notificationService = require('./notificationService').default;
        notificationService.show(`Bot ${botColor.toUpperCase()} eliminated!`, "error", 4000);
      } catch (notificationError) {
        console.warn("Failed to show bot elimination notification:", notificationError);
      }
      
      // Auto-eliminate the bot by dispatching a resign action
      store.dispatch(resignGame(botColor));
    } else {
      
      // Notify user about bot stalemate
      try {
        const notificationService = require('./notificationService').default;
        notificationService.show(`Bot ${botColor.toUpperCase()} has no moves - skipping turn`, "info", 3000);
      } catch (notificationError) {
        console.warn("Failed to show bot stalemate notification:", notificationError);
      }
    }
    
    clearTimeout(moveTimeout);
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
        ? PIECE_VALUES[bestCapturedPiece[1] as keyof typeof PIECE_VALUES] || 0 
        : 0;
      const currentValue = (currentCapturedPiece && currentCapturedPiece.length >= 2) 
        ? PIECE_VALUES[currentCapturedPiece[1] as keyof typeof PIECE_VALUES] || 0 
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
      chosenMove = allLegalMoves[0];
    }
  }

  // Re-validate move at execution time to ensure it's still legal
  const currentGameState = store.getState().game;
  const pieceCode = currentGameState.boardState[chosenMove.from.row][chosenMove.from.col];
  
  if (!pieceCode || pieceCode[0] !== botColor) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
    return;
  }
  
  // Check if it's still this bot's turn
  if (currentGameState.currentPlayerTurn !== botColor) {
    clearTimeout(moveTimeout);
    botMoveInProgress = false;
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
};

// Skip bot's turn when brain overheats (timeout)
const skipBotTurn = (botColor: string) => {
  
  // Use the existing turn advancement logic by dispatching a dummy move that will be rejected
  // This will trigger the turn advancement logic in the makeMove reducer
  const gameState = store.getState().game;
  
  // Create a dummy move that will be rejected (invalid move)
  const dummyMove = {
    from: { row: -1, col: -1 },
    to: { row: -1, col: -1 }
  };
  
  // Dispatch the dummy move - it will be rejected but turn will advance
  store.dispatch(makeMove(dummyMove));
  
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
