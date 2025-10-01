// services/botService.ts

import { store } from '../state/store';
import { makeMove, completePromotion } from '../state/gameSlice';
import { getValidMoves } from '../functions/src/logic/gameLogic';
import { GameState, Position } from '../state/types';
import p2pGameService from './p2pGameService';

// Point values for each piece type
const pieceValues: { [key: string]: number } = {
  P: 1,  // Pawn
  N: 3,  // Knight
  B: 5,  // Bishop
  R: 5,  // Rook
  Q: 9,  // Queen
  K: 100, // King (highest priority)
};

interface MoveOption {
  from: Position;
  to: {
    row: number;
    col: number;
    isCapture: boolean;
  };
  capturedPieceCode?: string | null;
}

const getAllLegalMoves = (botColor: string, gameState: GameState, maxMoves: number = 50): MoveOption[] => {
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
};

const makeBotMove = (botColor: string) => {
  console.log(`🤖 BotService: makeBotMove called for ${botColor}`);
  const gameState = store.getState().game;
  
  // Safety checks
  if (!gameState || !gameState.boardState || gameState.gameStatus !== 'active') {
    console.log(`🤖 BotService: Safety check failed - gameState: ${!!gameState}, boardState: ${!!gameState?.boardState}, gameStatus: ${gameState?.gameStatus}`);
    return;
  }
  
  const allLegalMoves = getAllLegalMoves(botColor, gameState);
  console.log(`🤖 Bot ${botColor}: Found ${allLegalMoves.length} legal moves (limited for performance)`);

  if (allLegalMoves.length === 0) {
    return;
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
    console.log(`🤖 Bot ${botColor}: Found best capture! Taking ${chosenMove.capturedPieceCode}.`);

  } else {
    // --- RANDOM MOVE LOGIC ---
    // If no captures, make a random move
    const nonCaptureMoves = allLegalMoves.filter(move => !move.to.isCapture);
    if (nonCaptureMoves.length > 0) {
      chosenMove = nonCaptureMoves[Math.floor(Math.random() * nonCaptureMoves.length)];
      console.log(`🤖 Bot ${botColor}: No captures. Making a random move.`);
    } else {
      // Should only happen if the only legal moves are captures, but the capture list was empty. Fallback.
      chosenMove = allLegalMoves[0];
    }
  }

  // Execute the chosen move - handle different game modes
  if (gameState.gameMode === 'p2p') {
    // In P2P mode, send the move over the network
    const moveData = {
      from: chosenMove.from,
      to: { row: chosenMove.to.row, col: chosenMove.to.col },
      pieceCode: gameState.boardState[chosenMove.from.row][chosenMove.from.col]!,
      playerColor: botColor,
    };
    console.log(`🤖 Bot ${botColor}: Sending P2P move...`, moveData);
    p2pGameService.makeMove(moveData).catch(err => {
      console.error("Bot failed to send P2P move:", err);
    });
  } else {
    // In Single Player ('solo') mode, dispatch the move locally
    console.log(`🤖 Bot ${botColor}: Dispatching local move...`);
    store.dispatch(
      makeMove({
        from: chosenMove.from,
        to: { row: chosenMove.to.row, col: chosenMove.to.col },
      })
    );
  }
};

// Handle bot pawn promotion
const handleBotPromotion = (botColor: string) => {
  const gameState = store.getState().game;
  
  // Check if there's a pending promotion for this bot
  if (gameState.promotionState.isAwaiting && 
      gameState.promotionState.color === botColor) {
    
    // Bot always promotes to Queen (most valuable piece)
    console.log(`🤖 Bot ${botColor}: Auto-promoting pawn to Queen`);
    store.dispatch(completePromotion({ pieceType: 'Q' }));
    return true;
  }
  
  return false;
};

export const botService = {
  makeBotMove,
  handleBotPromotion,
};
