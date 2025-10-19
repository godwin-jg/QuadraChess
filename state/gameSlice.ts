import { createSlice, PayloadAction, createSelector } from "@reduxjs/toolkit";
import networkService, { Player } from "../app/services/networkService";
import {
  getValidMoves,
  hasAnyLegalMoves,
  isKingInCheck,
} from "../functions/src/logic/gameLogic";
import { MoveInfo } from "../types";
import { initialBoardState } from "./boardState";
import { PIECE_VALUES, GAME_BONUSES, TURN_ORDER } from "../config/gameConfig";
import { EnPassantTarget } from "./types";
import {
  getRookIdentifier,
  isCastlingMove,
  updateAllCheckStatus,
} from "./gameHelpers";
import { GameState, Position, turnOrder } from "./types";

// Define the new payload type for our improved makeMove action
interface MovePayload {
  from: Position;
  to: { row: number; col: number };
  isPromotion?: boolean; // Optional flag to indicate if this move results in promotion
}

// Helper function to create a deep copy of the game state
export const createStateSnapshot = (state: GameState): GameState => {
  return {
    ...state,
    boardState: state.boardState.map((row) => [...row]),
    capturedPieces: {
      r: [...(state.capturedPieces?.r || [])],
      b: [...(state.capturedPieces?.b || [])],
      y: [...(state.capturedPieces?.y || [])],
      g: [...(state.capturedPieces?.g || [])],
    },
    checkStatus: { ...state.checkStatus },
    scores: { ...state.scores },
    hasMoved: { ...state.hasMoved },
    enPassantTargets: state.enPassantTargets.map((target) => ({
      ...target,
      position: { ...target.position },
    })),
    promotionState: { ...state.promotionState },
    gameOverState: { ...state.gameOverState },
    eliminatedPlayers: [...state.eliminatedPlayers],
    // Don't copy history when creating snapshots - this prevents circular references
    history: [],
    historyIndex: 0, // Always set to 0 for snapshots
    viewingHistoryIndex: null, // Snapshots represent live state, not viewing history
  };
};

export const baseInitialState: GameState = {
  boardState: initialBoardState,
  currentPlayerTurn: "r", // Red starts first
  gameStatus: "active",
  selectedPiece: null,
  validMoves: [],
  capturedPieces: { r: [], b: [], y: [], g: [] },
  checkStatus: updateAllCheckStatus(initialBoardState, [], {}),
  winner: null,
  eliminatedPlayers: [],
  justEliminated: null, // Will be 'r', 'b', 'y', or 'g'
  scores: { r: 0, b: 0, y: 0, g: 0 },
  promotionState: { isAwaiting: false, position: null, color: null },
  hasMoved: {
    rK: false,
    rR1: false,
    rR2: false, // Red King, Rook on a-file, Rook on h-file
    bK: false,
    bR1: false,
    bR2: false, // Blue King, Rook on rank 1, Rook on rank 8
    yK: false,
    yR1: false,
    yR2: false, // Yellow
    gK: false,
    gR1: false,
    gR2: false, // Green
  },
  enPassantTargets: [], // Will store multiple {position: Position, createdBy: string, createdByTurn: string} of squares that were skipped
  gameOverState: {
    isGameOver: false,
    status: null,
    eliminatedPlayer: null,
  },
  history: [],
  historyIndex: 0,
  viewingHistoryIndex: null, // null = viewing live, number = viewing history
  lastMove: null, // No last move initially
  // Multiplayer state
  players: [],
  isHost: false,
  canStartGame: false,
  // Game mode
  gameMode: "single",
  // Bot players tracking
  botPlayers: [],
  // P2P Lobby state
  currentGame: null as any, // P2PGame | null
  discoveredGames: [],
  isDiscovering: false,
  isLoading: false,
  isConnected: false,
  connectionError: null as string | null,
  isEditingName: false,
  tempName: "",
};

// Create initial state with proper history initialization
const initialState: GameState = {
  ...baseInitialState,
  history: [], // Start with empty history - no initial snapshot
  historyIndex: 0, // This should be 0 for the initial state (not viewing history)
  viewingHistoryIndex: null, // Start viewing live state
  lastMove: null, // No last move initially
  moveCache: {}, // Initialize move cache for performance optimization
  // Ensure multiplayer state is included
  players: baseInitialState.players,
  isHost: baseInitialState.isHost,
  canStartGame: baseInitialState.canStartGame,
};

// ✅ Core game logic function - DRY principle implementation
// This function contains all the shared logic for processing moves
const _applyMoveLogic = (
  state: GameState, 
  move: { 
    from: Position; 
    to: Position; 
    pieceCode: string; 
    playerColor: string; 
    capturedPiece: string | null; 
    isCastling: boolean; 
    isEnPassant: boolean; 
    enPassantTarget?: EnPassantTarget | null; // ✅ Enhanced type safety
  }
) => {
  const { from, to, pieceCode, playerColor, capturedPiece, isCastling, isEnPassant, enPassantTarget } = move;
  const { row: startRow, col: startCol } = from;
  const { row: targetRow, col: targetCol } = to;
  const pieceType = pieceCode[1];

  // Track if King or Rook has moved
  if (pieceType === "K") {
    state.hasMoved[`${playerColor}K` as keyof typeof state.hasMoved] = true;
  } else if (pieceType === "R") {
    const rookId = getRookIdentifier(playerColor, startRow, startCol);
    if (rookId) {
      state.hasMoved[rookId as keyof typeof state.hasMoved] = true;
    }
  }

  // Handle castling - move both King and Rook
  if (isCastling) {
    const kingTargetRow = targetRow;
    const kingTargetCol = targetCol;

    // Determine rook positions based on castling direction
    let rookStartRow: number, rookStartCol: number, rookTargetRow: number, rookTargetCol: number;

    if (playerColor === "r") {
      // Red - bottom row
      if (targetCol > startCol) {
        // Kingside castling
        rookStartRow = 13;
        rookStartCol = 10; // Right rook
        rookTargetRow = 13;
        rookTargetCol = 8;
      } else {
        // Queenside castling
        rookStartRow = 13;
        rookStartCol = 3; // Left rook
        rookTargetRow = 13;
        rookTargetCol = 6;
      }
    } else if (playerColor === "b") {
      // Blue - left column
      if (targetRow > startRow) {
        // Kingside castling (down)
        rookStartRow = 10;
        rookStartCol = 0; // Bottom rook at (10, 0)
        rookTargetRow = 8; // Rook moves to (8, 0)
        rookTargetCol = 0;
      } else {
        // Queenside castling (up)
        rookStartRow = 3;
        rookStartCol = 0; // Top rook at (3, 0)
        rookTargetRow = 6; // Rook moves to (6, 0)
        rookTargetCol = 0;
      }
    } else if (playerColor === "y") {
      // Yellow - top row
      if (targetCol > startCol) {
        // Kingside castling (right) - King moves from (0,6) to (0,8)
        rookStartRow = 0;
        rookStartCol = 10; // Right rook at (0, 10)
        rookTargetRow = 0;
        rookTargetCol = 7; // Rook moves to (0, 7)
      } else {
        // Queenside castling (left) - King moves from (0,6) to (0,4)
        rookStartRow = 0;
        rookStartCol = 3; // Left rook at (0, 3)
        rookTargetRow = 0;
        rookTargetCol = 5; // Rook moves to (0, 5)
      }
    } else if (playerColor === "g") {
      // Green - right column
      if (targetRow > startRow) {
        // Kingside castling (down) - King moves from (6,13) to (8,13)
        rookStartRow = 10;
        rookStartCol = 13; // Bottom rook at (10, 13)
        rookTargetRow = 7; // Rook moves to (7, 13)
        rookTargetCol = 13;
      } else {
        // Queenside castling (up) - King moves from (6,13) to (4,13)
        rookStartRow = 3;
        rookStartCol = 13; // Top rook at (3, 13)
        rookTargetRow = 5; // Rook moves to (5, 13)
        rookTargetCol = 13;
      }
    } else {
      // Default fallback (should not happen)
      rookStartRow = 0;
      rookStartCol = 0;
      rookTargetRow = 0;
      rookTargetCol = 0;
    }

    // Move the rook
    const rookPiece = state.boardState[rookStartRow!][rookStartCol!];
    state.boardState[rookTargetRow!][rookTargetCol!] = rookPiece;
    state.boardState[rookStartRow!][rookStartCol!] = null;

    // Mark the rook as moved
    const rookId = getRookIdentifier(playerColor, rookStartRow!, rookStartCol!);
    if (rookId) {
      state.hasMoved[rookId as keyof typeof state.hasMoved] = true;
    }
  }

  // Handle en passant capture
  if (isEnPassant && enPassantTarget) {
    const createdByColor = enPassantTarget.createdBy.charAt(0);
    const { row: skippedRow, col: skippedCol } = enPassantTarget.position;

    // Calculate captured pawn position based on movement direction
    const capturedPos = (() => {
      switch (createdByColor) {
        case "r":
          return { row: skippedRow - 1, col: skippedCol };
        case "y":
          return { row: skippedRow + 1, col: skippedCol };
        case "b":
          return { row: skippedRow, col: skippedCol + 1 };
        case "g":
          return { row: skippedRow, col: skippedCol - 1 };
        default:
          throw new Error(`Invalid piece color: ${createdByColor}`);
      }
    })();

    // Remove captured pawn and update score
    const capturedPawn = state.boardState[capturedPos.row][capturedPos.col];
    if (capturedPawn) {
      state.boardState[capturedPos.row][capturedPos.col] = null;
      if (!state.capturedPieces[playerColor as keyof typeof state.capturedPieces]) {
        state.capturedPieces[playerColor as keyof typeof state.capturedPieces] = [];
      }
      state.capturedPieces[playerColor as keyof typeof state.capturedPieces].push(capturedPawn);
      state.scores[playerColor as keyof typeof state.scores] += 1;
    }
  }

  // Handle regular capture (only for non-castling moves and non-en passant captures)
  if (capturedPiece && !isCastling && !isEnPassant) {
    // Prevent king capture - kings cannot be captured
    if (capturedPiece[1] === "K") {
      return; // Don't make the move if trying to capture a king
    }

    const capturingPlayer = playerColor;
    if (!state.capturedPieces[capturingPlayer as keyof typeof state.capturedPieces]) {
      state.capturedPieces[capturingPlayer as keyof typeof state.capturedPieces] = [];
    }
    state.capturedPieces[capturingPlayer as keyof typeof state.capturedPieces].push(capturedPiece);

    // Add points for captured piece
    const capturedPieceType = capturedPiece[1];
    const points = PIECE_VALUES[capturedPieceType as keyof typeof PIECE_VALUES] || 0;
    state.scores[capturingPlayer as keyof typeof state.scores] += points;
  }

  // Move the piece (for all moves, including promotions)
  state.boardState[targetRow][targetCol] = pieceCode;
  state.boardState[startRow][startCol] = null;

  // Set enPassantTarget for two-square pawn moves
  if (pieceType === "P") {
    const isTwoSquareMove =
      (Math.abs(targetRow - startRow) === 2 && targetCol === startCol) ||
      (Math.abs(targetCol - startCol) === 2 && targetRow === startRow);

    if (isTwoSquareMove) {
      const skippedSquare = (() => {
        switch (playerColor) {
          case "r":
            return { row: targetRow + 1, col: targetCol };
          case "y":
            return { row: targetRow - 1, col: targetCol };
          case "b":
            return { row: targetRow, col: targetCol - 1 };
          case "g":
            return { row: targetRow, col: targetCol + 1 };
          default:
            throw new Error(`Invalid piece color: ${playerColor}`);
        }
      })();

      state.enPassantTargets.push({
        position: skippedSquare,
        createdBy: pieceCode,
        createdByTurn: state.currentPlayerTurn,
      });
    }
  }

  // Clear selection
  state.selectedPiece = null;
  state.validMoves = [];

  // Update check status for all players
  const newCheckStatus = updateAllCheckStatus(
    state.boardState,
    state.eliminatedPlayers || [],
    state.hasMoved
  );
  
  state.checkStatus = newCheckStatus;

  // Check if the current player is in check after their move
  const currentPlayerInCheck =
    state.checkStatus[state.currentPlayerTurn as keyof typeof state.checkStatus];

  if (currentPlayerInCheck) {
    // The current player is in check after their move - this is illegal
    // Revert the move
    state.boardState[startRow][startCol] = pieceCode;
    state.boardState[targetRow][targetCol] = capturedPiece;
    state.selectedPiece = { row: startRow, col: startCol };
    state.validMoves = getValidMoves(
      pieceCode,
      { row: startRow, col: startCol },
      state.boardState,
      state.eliminatedPlayers,
      state.hasMoved,
      state.enPassantTargets
    );
    return; // Don't advance the turn
  }

  // Check if any opponent is in checkmate/stalemate after this move
  // We need to check all other players, not just the next one
  const currentPlayer = state.currentPlayerTurn;
  const otherPlayers = TURN_ORDER.filter(
    (player) =>
      player !== currentPlayer &&
      !state.eliminatedPlayers.includes(player)
  );

  // Check each opponent for checkmate/stalemate
  for (const opponent of otherPlayers) {
    const opponentHasMoves = hasAnyLegalMoves(
      opponent,
      state.boardState,
      state.eliminatedPlayers,
      state.hasMoved,
      state.enPassantTargets
    );

    if (!opponentHasMoves) {
      // This opponent has no legal moves
      const isInCheck = isKingInCheck(
        opponent,
        state.boardState,
        state.eliminatedPlayers,
        state.hasMoved
      );

      if (isInCheck) {
        // Checkmate - eliminate the player
        state.gameStatus = "checkmate";
        state.eliminatedPlayers.push(opponent);
        state.justEliminated = opponent;
        state.scores[state.currentPlayerTurn as keyof typeof state.scores] += GAME_BONUSES.CHECKMATE;

        // Set game over state for checkmate
        state.gameOverState = {
          isGameOver: true,
          status: "checkmate",
          eliminatedPlayer: opponent,
        };
      } else {
        // Stalemate - eliminate the player
        state.gameStatus = "stalemate";
        state.eliminatedPlayers.push(opponent);
        state.justEliminated = opponent;

        // Award points for stalemating opponent: +10 for each player still in game
        const remainingPlayers = TURN_ORDER.filter(
          (player) => !state.eliminatedPlayers.includes(player)
        );
        const stalematePoints = remainingPlayers.length * GAME_BONUSES.STALEMATE_PER_PLAYER;
        state.scores[state.currentPlayerTurn as keyof typeof state.scores] += stalematePoints;

        // Set game over state for stalemate
        state.gameOverState = {
          isGameOver: true,
          status: "stalemate",
          eliminatedPlayer: opponent,
        };
      }
      break; // Exit the loop after eliminating one player
    }
  }

  // Always advance to next player after a move
  // ✅ CRITICAL FIX: Use the player who made the move (not the eliminated player) for turn advancement
  const playerWhoMoved = state.currentPlayerTurn;
  const currentIndex = TURN_ORDER.indexOf(playerWhoMoved as any);
  const nextIndex = (currentIndex + 1) % TURN_ORDER.length;
  const nextPlayerInSequence = TURN_ORDER[nextIndex];

  // Find the next active player (skip eliminated players)
  let nextActivePlayer = nextPlayerInSequence;
  while (state.eliminatedPlayers.includes(nextActivePlayer)) {
    const activeIndex = TURN_ORDER.indexOf(nextActivePlayer as any);
    const nextActiveIndex = (activeIndex + 1) % TURN_ORDER.length;
    nextActivePlayer = TURN_ORDER[nextActiveIndex];
  }

  state.currentPlayerTurn = nextActivePlayer;

  // Check if the entire game is over
  if (state.eliminatedPlayers.length === 3) {
    // Find the one player who is NOT in the eliminatedPlayers array
    const winner = TURN_ORDER.find(
      (player) => !state.eliminatedPlayers.includes(player)
    );

    if (winner) {
      state.winner = winner;
      state.gameStatus = "finished";
      state.gameOverState = {
        isGameOver: true,
        status: "finished",
        eliminatedPlayer: null,
      };
    }

    // Clear justEliminated flag after a delay to allow UI to react
    // We'll clear it in the next move instead
  } else {
    // ✅ CRITICAL FIX: Reset game status to active after elimination (unless game is finished)
    // This allows the game to continue with remaining players
    state.gameStatus = "active";
  }
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setSelectedPiece: (state, action: PayloadAction<Position | null>) => {
      state.selectedPiece = action.payload;
    },
    setBotPlayers: (state, action: PayloadAction<string[]>) => {
      state.botPlayers = action.payload;
    },
    setValidMoves: (state, action: PayloadAction<MoveInfo[]>) => {
      state.validMoves = action.payload;
    },
    deselectPiece: (state) => {
      // OPTIMIZATION: Removed console.log for better performance
      state.selectedPiece = null;
      state.validMoves = [];
    },
    selectPiece: (state, action: PayloadAction<Position>) => {
      // OPTIMIZATION: Removed console.log statements for better performance

      // Don't allow piece selection when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return; // OPTIMIZATION: Removed console.log
      }

      const { row, col } = action.payload;
      const pieceCode = state.boardState[row][col];
      // OPTIMIZATION: Removed console.log for better performance

      // Check if clicking the same piece that's already selected - deselect it
      if (
        state.selectedPiece &&
        state.selectedPiece.row === row &&
        state.selectedPiece.col === col
      ) {
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      if (!pieceCode) {
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      // Check if the piece belongs to an eliminated player
      const pieceColor = pieceCode.charAt(0);
      if (state.eliminatedPlayers.includes(pieceColor)) {
        return; // Do nothing if the piece belongs to an eliminated player
      }

      // Allow any player to select their pieces to see moves (including en passant)
      // But only the current player can actually make moves
      state.selectedPiece = { row, col };

      // OPTIMIZATION: Check if we can reuse cached moves
      const moveCacheKey = `${pieceCode}-${row}-${col}-${state.eliminatedPlayers.join(',')}-${JSON.stringify(state.hasMoved)}-${JSON.stringify(state.enPassantTargets)}`;
      
      if (state.moveCache && state.moveCache[moveCacheKey]) {
        state.validMoves = state.moveCache[moveCacheKey];
      } else {
        const validMoves = getValidMoves(
          pieceCode,
          { row, col },
          state.boardState,
          state.eliminatedPlayers,
          state.hasMoved,
          state.enPassantTargets
        );
        state.validMoves = validMoves;
        
        // Cache the moves for future use
        if (!state.moveCache) {
          state.moveCache = {};
        }
        state.moveCache[moveCacheKey] = validMoves;
        
        // Limit cache size to prevent memory issues
        const cacheKeys = Object.keys(state.moveCache);
        if (cacheKeys.length > 50) {
          // Remove oldest entries (simple FIFO)
          const keysToRemove = cacheKeys.slice(0, 10);
          keysToRemove.forEach(key => delete state.moveCache![key]);
        }
      }
      
    },
    makeMove: (state, action: PayloadAction<MovePayload>) => {
      // Don't allow moves when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      // Store the current justEliminated flag before processing the move
      const previousJustEliminated = state.justEliminated;

      // Clear move cache when board state changes
      state.moveCache = {};

      const { from, to, isPromotion } = action.payload;
      const { row: startRow, col: startCol } = from;
      const { row: targetRow, col: targetCol } = to;

      // Get the piece to move from the board state
      const pieceToMove = state.boardState[startRow][startCol];
      
      if (!pieceToMove) return;

      // Check if en passant opportunities should expire
      // Remove targets that were created by the current player (full round has passed)
      state.enPassantTargets = state.enPassantTargets.filter(
        (target) => target.createdByTurn !== state.currentPlayerTurn
      );

      const capturedPiece = state.boardState[targetRow][targetCol];
      const pieceColor = pieceToMove.charAt(0);
      const pieceType = pieceToMove[1];

      // Enforce player turn - only current player can make moves
      if (
        state.gameMode !== "solo" &&
        state.gameMode !== "p2p" &&
        state.gameMode !== "online" &&
        pieceColor !== state.currentPlayerTurn
      ) {
        return; // Don't make the move
      }

      // For P2P mode, validate turn and send move through P2P service
      if (state.gameMode === "p2p") {
        if (pieceColor !== state.currentPlayerTurn) {
          return; // Don't make the move
        }
        
        // Import the P2P service dynamically to avoid circular imports
        const p2pGameService = require("../services/p2pGameService").default;
        const moveData = {
          from: { row: startRow, col: startCol },
          to: { row: targetRow, col: targetCol },
          pieceCode: pieceToMove,
          playerColor: pieceColor,
        };
        
        // Send move through P2P service (this will handle validation and synchronization)
        p2pGameService.makeMove(moveData).catch((error: any) => {
          console.error("P2P move failed:", error);
        });
        
        // Don't apply the move locally - let the P2P service handle it
        return;
      }

      // ✅ Gather all information about the move
      const isCastling = isCastlingMove(pieceToMove, startRow, startCol, targetRow, targetCol);
      const enPassantTarget = state.enPassantTargets.find(
        (target) =>
          target.position.row === targetRow &&
          target.position.col === targetCol &&
          pieceType === "P" &&
          pieceToMove !== target.createdBy
      );

      // ✅ Call the core logic function
      _applyMoveLogic(state, {
        from,
        to,
        pieceCode: pieceToMove,
        playerColor: pieceColor,
        capturedPiece,
        isCastling,
        isEnPassant: !!enPassantTarget,
        enPassantTarget,
      });

      // ✅ CRITICAL FIX: Clear justEliminated flag only if no elimination occurred in this move
      // This prevents the flag from being cleared immediately when an elimination happens
      if (state.justEliminated === previousJustEliminated) {
        state.justEliminated = null;
      }

      // Cancel any pending bot thinking notifications since a move was made
      try {
        const notificationService = require('../services/notificationService').default;
        notificationService.clearByPattern('is thinking hard');
      } catch (error) {
        // Ignore notification service errors
      }

      // ✅ Update the lastMove and history (this is unique to making a new move)
      state.lastMove = {
        from: { row: startRow, col: startCol },
        to: { row: targetRow, col: targetCol },
        pieceCode: pieceToMove,
        playerColor: pieceColor,
        timestamp: Date.now(),
        capturedPiece: capturedPiece,
      };

      if (isPromotion) {
        // Pause the game for promotion selection
        state.promotionState = {
          isAwaiting: true,
          position: { row: targetRow, col: targetCol },
          color: pieceColor,
        };
        state.gameStatus = "promotion";
        // Don't advance the turn yet - wait for promotion completion
      }

      // Save current state to history (only if not in promotion mode)
      if (state.gameStatus !== "promotion") {
        // Remove any future history if we're not at the end
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }

        // Add current state to history
        state.history.push(createStateSnapshot(state));
        state.historyIndex = state.history.length - 1;
      }
    },
    resetGame: (state) => {
      // Preserve the current game mode and bot configuration before resetting
      const currentGameMode = state.gameMode;
      const currentBotPlayers = [...state.botPlayers]; // Create a copy to preserve
      
      // ✅ CRITICAL FIX: Completely clear all state properties first
      // Delete all existing properties to ensure no stale data persists
      Object.keys(state).forEach(key => {
        delete (state as any)[key];
      });
      
      // ✅ CRITICAL FIX: Assign the complete baseInitialState
      // This ensures ALL properties are properly reset
      Object.assign(state, {
        ...baseInitialState,
        checkStatus: updateAllCheckStatus(initialBoardState, [], {}),
        moveCache: {}, // Clear move cache
      });
      
      // Restore the game mode after reset
      state.gameMode = currentGameMode;
      
      // Set bots based on game mode and preserve user configuration
      if (currentGameMode === "single") {
        // For single player mode, always use the default bot configuration (Red is human, others are bots)
        // This ensures that "Play Again" always maintains the 1 vs 3 bots setup
        state.botPlayers = ['b', 'y', 'g'];
      } else if (currentGameMode === "p2p" || currentGameMode === "online") {
        // ✅ CRITICAL FIX: For P2P and Online modes, start with no bots - they will be set by the lobby/host
        // This prevents stale bot configurations from previous games
        state.botPlayers = [];
      } else {
        state.botPlayers = []; // Other modes have no bots
      }
      
      // Initialize history as empty - no initial snapshot
      state.history = [];
      state.historyIndex = 0; // This should be 0 for the current state, not viewing history
      state.viewingHistoryIndex = null; // Start viewing live state

      // Ensure the board state is properly set
      state.boardState = initialBoardState.map((row) => [...row]);
    },
    clearGameOver: (state) => {
      state.gameOverState = {
        isGameOver: false,
        status: null,
        eliminatedPlayer: null,
      };
      // ✅ CRITICAL FIX: Also reset gameStatus to allow modal dismissal
      state.gameStatus = "active";
    },
    completePromotion: (
      state,
      action: PayloadAction<{ pieceType: string }>
    ) => {
      if (state.promotionState.isAwaiting && state.promotionState.position) {
        const { pieceType } = action.payload;
        
        // ✅ Sound effects moved to UI layer (Board.tsx useEffect)
        
        const { row, col } = state.promotionState.position;
        const pieceColor = state.promotionState.color!;

        // Replace the pawn with the selected piece
        state.boardState[row][col] = `${pieceColor}${pieceType}`;

        // Clear promotion state
        state.promotionState = {
          isAwaiting: false,
          position: null,
          color: null,
        };
        state.gameStatus = "active";

        // Clear selection
        state.selectedPiece = null;
        state.validMoves = [];

        // Update check status for all players
        state.checkStatus = updateAllCheckStatus(
          state.boardState,
          state.eliminatedPlayers,
          state.hasMoved
        );

        // Advance to next player
        const currentIndex = turnOrder.indexOf(state.currentPlayerTurn as any);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        state.currentPlayerTurn = turnOrder[nextIndex];
      }
    },
    stepHistory: (state, action: PayloadAction<"back" | "previous" | "forward">) => {
      console.log('stepHistory called:', {
        action: action.payload,
        currentViewingHistoryIndex: state.viewingHistoryIndex,
        historyLength: state.history.length
      });
      
      if (action.payload === "back") {
        // Start button: Always go to the first move (index 0) or back to live if already at first move
        if (state.viewingHistoryIndex === null) {
          // From live state: go to first move
          state.viewingHistoryIndex = 0;
          console.log('Started viewing history at first move (index 0)');
        } else {
          // From any other move: go to first move
          state.viewingHistoryIndex = 0;
          console.log('Went to first move from move:', state.viewingHistoryIndex);
        }
      } else if (action.payload === "previous" && state.viewingHistoryIndex === null) {
        // Go two steps back from live state (to the previous move)
        if (state.history.length > 0) {
          state.viewingHistoryIndex = state.history.length - 2;
          console.log('Stepped previous from live state to move:', state.viewingHistoryIndex);
        }
      } else if (action.payload === "previous" && state.viewingHistoryIndex !== null && state.viewingHistoryIndex > 0) {
        // Go one step back in history
        state.viewingHistoryIndex--;
        console.log('Stepped previous to index:', state.viewingHistoryIndex);
      } else if (action.payload === "forward" && state.viewingHistoryIndex !== null && state.viewingHistoryIndex < state.history.length - 1) {
        // Go one step forward in history
        state.viewingHistoryIndex++;
        console.log('Stepped forward to index:', state.viewingHistoryIndex);
      } 
      
      console.log('Final viewingHistoryIndex:', state.viewingHistoryIndex);
    },
    returnToLive: (state) => {
      state.viewingHistoryIndex = null;
    },
    resignGame: (state, action: PayloadAction<string | undefined>) => {
      // Don't allow resigning when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      // Don't allow resigning if game is already over
      if (
        state.gameStatus === "finished" ||
        state.gameStatus === "checkmate" ||
        state.gameStatus === "stalemate"
      ) {
        return;
      }

      // Use provided player color or default to current player turn
      const currentPlayer = action.payload || state.currentPlayerTurn;
      console.log("resignGame reducer: action.payload:", action.payload, "currentPlayerTurn:", state.currentPlayerTurn, "final currentPlayer:", currentPlayer);

      // Add current player to eliminated players
      if (!state.eliminatedPlayers.includes(currentPlayer)) {
        state.eliminatedPlayers.push(currentPlayer);
        state.justEliminated = currentPlayer;
      }

      // Clear selection
      state.selectedPiece = null;
      state.validMoves = [];

      // Update check status for all players
      state.checkStatus = updateAllCheckStatus(
        state.boardState,
        state.eliminatedPlayers,
        state.hasMoved
      );

      // Check if the entire game is over
      if (state.eliminatedPlayers.length === 3) {
        // Find the one player who is NOT in the eliminatedPlayers array
        const winner = turnOrder.find(
          (player) => !state.eliminatedPlayers.includes(player)
        );

        if (winner) {
          state.winner = winner;
          state.gameStatus = "finished";
          state.gameOverState = {
            isGameOver: true,
            status: "finished",
            eliminatedPlayer: null,
          };
        }
      } else {
        // Advance to next active player
        // ✅ CRITICAL FIX: Use the resigning player's color to calculate next turn
        const currentIndex = turnOrder.indexOf(currentPlayer as any);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        const nextPlayerInSequence = turnOrder[nextIndex];

        // Find the next active player (skip eliminated players)
        let nextActivePlayer = nextPlayerInSequence;
        while (state.eliminatedPlayers.includes(nextActivePlayer)) {
          const activeIndex = turnOrder.indexOf(nextActivePlayer as any);
          const nextActiveIndex = (activeIndex + 1) % turnOrder.length;
          nextActivePlayer = turnOrder[nextActiveIndex];
        }

        state.currentPlayerTurn = nextActivePlayer;
      }

      // Save current state to history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(createStateSnapshot(state));
      state.historyIndex = state.history.length - 1;
    },
    endGame: (state) => {
      // Don't allow ending game when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      // Don't allow ending game if game is already over
      if (
        state.gameStatus === "finished" ||
        state.gameStatus === "checkmate" ||
        state.gameStatus === "stalemate"
      ) {
        return;
      }

      // Clear selection
      state.selectedPiece = null;
      state.validMoves = [];

      // Find the player with the highest score
      const scores = state.scores;
      const players = ['r', 'b', 'y', 'g'] as const;
      let winner: string = players[0];
      let highestScore = scores[winner as keyof typeof scores];

      for (const player of players) {
        if (!state.eliminatedPlayers.includes(player) && scores[player] > highestScore) {
          winner = player;
          highestScore = scores[player];
        }
      }

      // Set the winner and end the game
      state.winner = winner;
      state.gameStatus = "finished";
      state.gameOverState = {
        isGameOver: true,
        status: "finished",
        eliminatedPlayer: null,
      };

      // Save current state to history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(createStateSnapshot(state));
      state.historyIndex = state.history.length - 1;
    },
    applyNetworkMove: (
      state,
      action: PayloadAction<{
        from: { row: number; col: number };
        to: { row: number; col: number };
        pieceCode: string;
        playerColor: string;
        isEnPassant?: boolean;
        enPassantTarget?: EnPassantTarget | null; // ✅ Enhanced type safety
      }>
    ) => {
      // Store the current justEliminated flag before processing the move
      const previousJustEliminated = state.justEliminated;
      
      const { from, to, pieceCode, playerColor, isEnPassant = false, enPassantTarget } = action.payload;

      // ✅ Handle resignation messages
      if (pieceCode === "RESIGN") {
        // Add player to eliminated players
        if (!state.eliminatedPlayers.includes(playerColor)) {
          state.eliminatedPlayers.push(playerColor);
          state.justEliminated = playerColor;
        }

        // Clear selection
        state.selectedPiece = null;
        state.validMoves = [];

        // Update check status for all players
        state.checkStatus = updateAllCheckStatus(
          state.boardState,
          state.eliminatedPlayers,
          state.hasMoved
        );

        // Check if the entire game is over
        if (state.eliminatedPlayers.length === 3) {
          const turnOrder = ["r", "b", "y", "g"];
          const winner = turnOrder.find(
            (color) => !state.eliminatedPlayers.includes(color)
          );

          if (winner) {
            state.winner = winner;
            state.gameStatus = "finished";
            state.gameOverState = {
              isGameOver: true,
              status: "finished",
              eliminatedPlayer: null,
            };
          }
        } else {
          // Advance to next active player
          const turnOrder = ["r", "b", "y", "g"];
          const currentIndex = turnOrder.indexOf(playerColor);
          const nextIndex = (currentIndex + 1) % 4;
          const nextPlayerInSequence = turnOrder[nextIndex];

          // Find the next active player (skip eliminated players)
          let nextActivePlayer = nextPlayerInSequence;
          while (state.eliminatedPlayers.includes(nextActivePlayer)) {
            const activeIndex = turnOrder.indexOf(nextActivePlayer);
            const nextActiveIndex = (activeIndex + 1) % 4;
            nextActivePlayer = turnOrder[nextActiveIndex];
          }

          state.currentPlayerTurn = nextActivePlayer;
        }

        // Clear move cache when game state changes
        state.moveCache = {};

        // Save to history
        if (state.historyIndex < state.history.length - 1) {
          state.history = state.history.slice(0, state.historyIndex + 1);
        }
        state.history.push(createStateSnapshot(state));
        state.historyIndex = state.history.length - 1;

        return; // Exit early for resignation
      }

      // ✅ Gather all information about the move
      const { row: fromRow, col: fromCol } = from;
      const { row: toRow, col: toCol } = to;
      const capturedPiece = state.boardState[toRow][toCol];
      
      // Check if trying to capture a king - prevent king capture
      if (capturedPiece && capturedPiece[1] === "K") {
        return; // Don't apply the move if trying to capture a king
      }

      const isCastling = isCastlingMove(pieceCode, fromRow, fromCol, toRow, toCol);

      // ✅ Call the same core logic function
      _applyMoveLogic(state, {
        from,
        to,
        pieceCode,
        playerColor,
        capturedPiece,
        isCastling,
        isEnPassant,
        enPassantTarget,
      });

      // ✅ CRITICAL FIX: Clear justEliminated flag only if no elimination occurred in this move
      // This prevents the flag from being cleared immediately when an elimination happens
      if (state.justEliminated === previousJustEliminated) {
        state.justEliminated = null;
      }

      // Cancel any pending bot thinking notifications since a move was made
      try {
        const notificationService = require('../services/notificationService').default;
        notificationService.clearByPattern('is thinking hard');
      } catch (error) {
        // Ignore notification service errors
      }

      // ✅ Update lastMove and history
      state.lastMove = {
        from: { row: fromRow, col: fromCol },
        to: { row: toRow, col: toCol },
        pieceCode,
        playerColor,
        timestamp: Date.now(),
        capturedPiece,
      };

      // ✅ Set game status to active when first move is made (network-specific)
      if ((state.gameMode === "p2p" || state.gameMode === "online") && state.gameStatus === "waiting") {
        state.gameStatus = "active";
      }

      // Save to history
      if (state.historyIndex < state.history.length - 1) {
        state.history = state.history.slice(0, state.historyIndex + 1);
      }

      state.history.push(createStateSnapshot(state));
      state.historyIndex = state.history.length - 1;
    },
    syncGameState: (state, action: PayloadAction<GameState>) => {
      // Sync the entire game state from network (create new state object)
      const networkState = action.payload;
      return { ...state, ...networkState };
    },
    setGameState: (state, action: PayloadAction<GameState>) => {
      // Replace the entire game state (useful for syncing when game starts)
      const newState = action.payload;
      // Clear move cache when game state changes
      newState.moveCache = {};
      
      // ✅ CRITICAL FIX: Recalculate check status when syncing from server
      const recalculatedCheckStatus = updateAllCheckStatus(
        newState.boardState,
        newState.eliminatedPlayers || [],
        newState.hasMoved
      );
      newState.checkStatus = recalculatedCheckStatus;
      
      return { ...state, ...newState };
    },
    sendMoveToServer: (
      state,
      action: PayloadAction<{ row: number; col: number }>
    ) => {
      // Send move to server without applying locally (for multiplayer mode)
      if (!networkService.connected || !networkService.roomId) {
        return;
      }

      if (state.selectedPiece) {
        const { row: targetRow, col: targetCol } = action.payload;
        const { row: startRow, col: startCol } = state.selectedPiece;

        const pieceToMove = state.boardState[startRow][startCol];
        const pieceColor = pieceToMove?.charAt(0);

        // Enforce player turn - only current player can make moves
        if (pieceColor !== state.currentPlayerTurn) {
          return; // Don't send the move
        }

        const moveData = {
          from: { row: startRow, col: startCol },
          to: { row: targetRow, col: targetCol },
          pieceCode: pieceToMove!,
          playerColor: pieceColor!,
        };

        networkService.sendMove(moveData);
      }
    },
    // Multiplayer actions
    setPlayers: (state, action: PayloadAction<Player[]>) => {
      state.players = action.payload;
    },
    setIsHost: (state, action: PayloadAction<boolean>) => {
      state.isHost = action.payload;
    },
    setCanStartGame: (state, action: PayloadAction<boolean>) => {
      state.canStartGame = action.payload;
    },
    setGameMode: (
      state,
      action: PayloadAction<"solo" | "local" | "online" | "p2p" | "single">
    ) => {
      console.log(
        "setGameMode: Setting game mode from",
        state.gameMode,
        "to",
        action.payload,
        "call stack:",
        new Error().stack?.split('\n').slice(1, 4).join('\n')
      );
      state.gameMode = action.payload;
    },
    // P2P Lobby actions
    setCurrentGame: (state, action: PayloadAction<any>) => {
      state.currentGame = action.payload;
    },
    setDiscoveredGames: (state, action: PayloadAction<any[]>) => {
      state.discoveredGames = action.payload;
    },
    setIsDiscovering: (state, action: PayloadAction<boolean>) => {
      state.isDiscovering = action.payload;
    },
    setIsLoading: (state, action: PayloadAction<boolean>) => {
      state.isLoading = action.payload;
    },
    setIsConnected: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    setConnectionError: (state, action: PayloadAction<string | null>) => {
      state.connectionError = action.payload;
    },
    setIsEditingName: (state, action: PayloadAction<boolean>) => {
      state.isEditingName = action.payload;
    },
    setTempName: (state, action: PayloadAction<string>) => {
      state.tempName = action.payload;
    },
    // P2P Lobby state sync - only essential info
    syncP2PGameState: (state, action: PayloadAction<any>) => {
      const lobbyData = action.payload;
      
      if (lobbyData) {
        // Only update lobby-related state, not the entire game state
        if (lobbyData.currentGame) {
          state.currentGame = lobbyData.currentGame;
        }
        if (lobbyData.players) {
          state.players = lobbyData.players;
        }
        if (typeof lobbyData.isHost === 'boolean') {
          state.isHost = lobbyData.isHost;
        }
        if (typeof lobbyData.canStartGame === 'boolean') {
          state.canStartGame = lobbyData.canStartGame;
        }
      } else {
        // Clear lobby state
        state.currentGame = null;
        state.players = [];
        state.isHost = false;
        state.canStartGame = false;
      }
    },
    
    // Clear the justEliminated flag (used after notification is shown)
    clearJustEliminated: (state) => {
      state.justEliminated = null;
    },
  },
});

export const {
  setSelectedPiece,
  setValidMoves,
  deselectPiece,
  selectPiece,
  makeMove,
  completePromotion,
  resetGame,
  clearGameOver,
  stepHistory,
  returnToLive,
  resignGame,
  endGame,
  applyNetworkMove,
  syncGameState,
  setGameState,
  sendMoveToServer,
  setPlayers,
  setIsHost,
  setCanStartGame,
  setGameMode,
  setBotPlayers,
  // P2P Lobby actions
  setCurrentGame,
  setDiscoveredGames,
  setIsDiscovering,
  setIsLoading,
  setIsConnected,
  setConnectionError,
  setIsEditingName,
  setTempName,
  syncP2PGameState,
  clearJustEliminated,
} = gameSlice.actions;

// ✅ Input selectors: simple functions to get parts of the state
const selectGame = (state: { game: GameState }) => state.game;
const selectViewingHistoryIndex = (state: { game: GameState }) => state.game.viewingHistoryIndex;
const selectHistory = (state: { game: GameState }) => state.game.history;

// ✅ Memoized selectors for UI components to choose between live and historical state
export const selectDisplayBoardState = createSelector(
  [selectGame, selectViewingHistoryIndex, selectHistory],
  (game, viewingHistoryIndex, history) => {
    if (viewingHistoryIndex !== null && history.length > 0) {
      const historicalState = history[viewingHistoryIndex];
      return historicalState ? historicalState.boardState : game.boardState;
    }
    return game.boardState;
  }
);

export const selectDisplayGameState = createSelector(
  [selectGame, selectViewingHistoryIndex, selectHistory],
  (game, viewingHistoryIndex, history) => {
    if (viewingHistoryIndex !== null && history.length > 0) {
      const historicalState = history[viewingHistoryIndex];
      if (historicalState) {
        // This object is now only created when its inputs change
        return {
          ...game,
          boardState: historicalState.boardState,
          currentPlayerTurn: historicalState.currentPlayerTurn,
          gameStatus: historicalState.gameStatus,
          capturedPieces: historicalState.capturedPieces,
          checkStatus: historicalState.checkStatus,
          winner: historicalState.winner,
          eliminatedPlayers: historicalState.eliminatedPlayers,
          justEliminated: historicalState.justEliminated,
          scores: historicalState.scores,
          promotionState: historicalState.promotionState,
          hasMoved: historicalState.hasMoved,
          enPassantTargets: historicalState.enPassantTargets,
          gameOverState: historicalState.gameOverState,
        };
      }
    }
    return game;
  }
);

export const selectIsViewingHistory = createSelector(
  [selectViewingHistoryIndex],
  (viewingHistoryIndex) => viewingHistoryIndex !== null
);

export default gameSlice.reducer;
