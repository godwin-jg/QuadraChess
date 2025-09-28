import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import networkService, { Player } from "../app/services/networkService";
import {
  getValidMoves,
  hasAnyLegalMoves,
  isKingInCheck,
} from "../functions/src/logic/gameLogic";
import { MoveInfo } from "../types";
import { initialBoardState } from "./boardState";
import {
  getRookIdentifier,
  isCastlingMove,
  updateAllCheckStatus,
} from "./gameHelpers";
import { GameState, Position, turnOrder } from "./types";

// Helper function to create a deep copy of the game state
export const createStateSnapshot = (state: GameState): GameState => {
  return {
    ...state,
    boardState: state.boardState.map((row) => [...row]),
    capturedPieces: {
      r: [...state.capturedPieces.r],
      b: [...state.capturedPieces.b],
      y: [...state.capturedPieces.y],
      g: [...state.capturedPieces.g],
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
  // Multiplayer state
  players: [],
  isHost: false,
  canStartGame: false,
  // Game mode
  gameMode: "single",
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
  // Ensure multiplayer state is included
  players: baseInitialState.players,
  isHost: baseInitialState.isHost,
  canStartGame: baseInitialState.canStartGame,
};

const gameSlice = createSlice({
  name: "game",
  initialState,
  reducers: {
    setSelectedPiece: (state, action: PayloadAction<Position | null>) => {
      state.selectedPiece = action.payload;
    },
    setValidMoves: (state, action: PayloadAction<MoveInfo[]>) => {
      state.validMoves = action.payload;
    },
    deselectPiece: (state) => {
      console.log("Redux: deselectPiece called");
      state.selectedPiece = null;
      state.validMoves = [];
    },
    selectPiece: (state, action: PayloadAction<Position>) => {
      console.log("Redux: selectPiece called with", action.payload);
      console.log("Redux: currentPlayerTurn:", state.currentPlayerTurn);
      console.log(
        "Redux: historyIndex:",
        state.historyIndex,
        "history.length:",
        state.history.length
      );

      // Don't allow piece selection when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        console.log("Redux: Blocking piece selection - viewing history");
        return;
      }

      const { row, col } = action.payload;
      const pieceCode = state.boardState[row][col];
      console.log("Redux: pieceCode at", row, col, ":", pieceCode);

      // Check if clicking the same piece that's already selected - deselect it
      if (
        state.selectedPiece &&
        state.selectedPiece.row === row &&
        state.selectedPiece.col === col
      ) {
        console.log("Redux: Deselecting same piece");
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      if (!pieceCode) {
        console.log("Redux: No piece at position, clearing selection");
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      // Check if the piece belongs to an eliminated player
      const pieceColor = pieceCode.charAt(0);
      console.log(
        "Redux: pieceColor:",
        pieceColor,
        "eliminatedPlayers:",
        state.eliminatedPlayers
      );
      if (state.eliminatedPlayers.includes(pieceColor)) {
        console.log(
          "Redux: Blocking piece selection - piece belongs to eliminated player"
        );
        return; // Do nothing if the piece belongs to an eliminated player
      }

      // Allow any player to select their pieces to see moves (including en passant)
      // But only the current player can actually make moves
      console.log("Redux: Setting selectedPiece and calculating validMoves");
      state.selectedPiece = { row, col };

      state.validMoves = getValidMoves(
        pieceCode,
        { row, col },
        state.boardState,
        state.eliminatedPlayers,
        state.hasMoved,
        state.enPassantTargets
      );
      console.log(
        "Redux: validMoves calculated:",
        state.validMoves.length,
        "moves"
      );
    },
    makeMove: (state, action: PayloadAction<{ row: number; col: number }>) => {
      // Don't allow moves when viewing historical moves
      if (state.viewingHistoryIndex !== null) {
        return;
      }

      if (state.selectedPiece) {
        // Check if en passant opportunities should expire
        // Remove targets that were created by the current player (full round has passed)
        state.enPassantTargets = state.enPassantTargets.filter(
          (target) => target.createdByTurn !== state.currentPlayerTurn
        );

        const { row: targetRow, col: targetCol } = action.payload;
        const { row: startRow, col: startCol } = state.selectedPiece;

        const pieceToMove = state.boardState[startRow][startCol];
        const capturedPiece = state.boardState[targetRow][targetCol];
        const pieceColor = pieceToMove?.charAt(0);
        const pieceType = pieceToMove?.[1];

        // Enforce player turn - only current player can make moves
        // Skip turn validation ONLY in solo mode for testing purposes
        // For P2P mode, let the P2P service handle move validation and sending
        console.log(
          "makeMove: gameMode:",
          state.gameMode,
          "pieceColor:",
          pieceColor,
          "currentPlayerTurn:",
          state.currentPlayerTurn
        );

        if (
          state.gameMode !== "solo" &&
          state.gameMode !== "p2p" &&
          pieceColor !== state.currentPlayerTurn
        ) {
          console.log("makeMove: Turn validation blocked - not player's turn");
          return; // Don't make the move
        }

        // For P2P mode, send move through P2P service instead of applying locally
        if (state.gameMode === "p2p") {
          console.log("makeMove: P2P mode - sending move through P2P service");
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

        // Track if King or Rook has moved
        if (pieceType === "K") {
          state.hasMoved[`${pieceColor}K` as keyof typeof state.hasMoved] =
            true;
        } else if (pieceType === "R") {
          const rookId = getRookIdentifier(pieceColor!, startRow, startCol);
          if (rookId) {
            state.hasMoved[rookId as keyof typeof state.hasMoved] = true;
          }
        }

        // Check if this is a castling move
        const isCastling = isCastlingMove(
          pieceToMove!,
          startRow,
          startCol,
          targetRow,
          targetCol
        );

        if (isCastling) {
          // Handle castling - move both King and Rook
          const kingTargetRow = targetRow;
          const kingTargetCol = targetCol;

          // Determine rook positions based on castling direction
          let rookStartRow, rookStartCol, rookTargetRow, rookTargetCol;

          if (pieceColor === "r") {
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
          } else if (pieceColor === "b") {
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
          } else if (pieceColor === "y") {
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
          } else if (pieceColor === "g") {
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
          }

          // Move the rook
          const rookPiece = state.boardState[rookStartRow!][rookStartCol!];
          state.boardState[rookTargetRow!][rookTargetCol!] = rookPiece;
          state.boardState[rookStartRow!][rookStartCol!] = null;

          // Mark the rook as moved
          const rookId = getRookIdentifier(
            pieceColor!,
            rookStartRow!,
            rookStartCol!
          );
          if (rookId) {
            state.hasMoved[rookId as keyof typeof state.hasMoved] = true;
          }
        }

        // A. Handle en passant capture FIRST (before clearing enPassantTargets)
        const enPassantTarget = state.enPassantTargets.find(
          (target) =>
            target.position.row === targetRow &&
            target.position.col === targetCol &&
            pieceType === "P" &&
            pieceToMove !== target.createdBy // Prevent the pawn that created the target from capturing it
        );

        if (enPassantTarget) {
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
          const capturedPawn =
            state.boardState[capturedPos.row][capturedPos.col];
          if (capturedPawn) {
            state.boardState[capturedPos.row][capturedPos.col] = null;
            state.capturedPieces[
              pieceColor as keyof typeof state.capturedPieces
            ].push(capturedPawn);
            state.scores[pieceColor as keyof typeof state.scores] += 1;
          }
        }

        // B. Handle regular capture (only for non-castling moves and non-en passant captures)
        if (capturedPiece && !isCastling && !enPassantTarget) {
          // Prevent king capture - kings cannot be captured
          if (capturedPiece[1] === "K") {
            return; // Don't make the move if trying to capture a king
          }

          const capturingPlayer = pieceToMove?.charAt(0);
          state.capturedPieces[
            capturingPlayer as keyof typeof state.capturedPieces
          ].push(capturedPiece);

          // Add points for captured piece
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
            case "K": // King
              points = 20; // Special bonus for king capture
              break;
            default:
              points = 0;
          }
          state.scores[capturingPlayer as keyof typeof state.scores] += points;
        }

        // Check if this is a pawn promotion using the move's isPromotion flag
        const isPawn = pieceToMove?.endsWith("P");
        let isPromotion = false;

        if (isPawn) {
          // Get valid moves for this pawn to check if the move is a promotion
          const validMoves = getValidMoves(
            pieceToMove!,
            { row: startRow, col: startCol },
            state.boardState,
            state.eliminatedPlayers,
            state.hasMoved,
            state.enPassantTargets
          );

          // Find the specific move to check its isPromotion flag
          const move = validMoves.find(
            (move) => move.row === targetRow && move.col === targetCol
          );
          isPromotion = move?.isPromotion || false;
        }

        // Move the piece (for all moves, including promotions)
        state.boardState[targetRow][targetCol] = pieceToMove;
        state.boardState[startRow][startCol] = null;

        if (isPromotion) {
          // Pause the game for promotion selection
          state.promotionState = {
            isAwaiting: true,
            position: { row: targetRow, col: targetCol },
            color: pieceColor!,
          };
          state.gameStatus = "promotion";
          // Don't advance the turn yet - wait for promotion completion
        }

        // C. Set enPassantTarget for two-square pawn moves
        if (pieceType === "P") {
          const isTwoSquareMove =
            (Math.abs(targetRow - startRow) === 2 && targetCol === startCol) ||
            (Math.abs(targetCol - startCol) === 2 && targetRow === startRow);

          if (isTwoSquareMove) {
            const skippedSquare = (() => {
              switch (pieceColor) {
                case "r":
                  return { row: targetRow + 1, col: targetCol };
                case "y":
                  return { row: targetRow - 1, col: targetCol };
                case "b":
                  return { row: targetRow, col: targetCol - 1 };
                case "g":
                  return { row: targetRow, col: targetCol + 1 };
                default:
                  throw new Error(`Invalid piece color: ${pieceColor}`);
              }
            })();

            state.enPassantTargets.push({
              position: skippedSquare,
              createdBy: pieceToMove!,
              createdByTurn: state.currentPlayerTurn,
            });
          }
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

        // Check if the current player is in check after their move
        const currentPlayerInCheck =
          state.checkStatus[
            state.currentPlayerTurn as keyof typeof state.checkStatus
          ];

        if (currentPlayerInCheck) {
          // The current player is in check after their move - this is illegal
          // Revert the move
          state.boardState[startRow][startCol] = pieceToMove;
          state.boardState[targetRow][targetCol] = capturedPiece;
          state.selectedPiece = { row: startRow, col: startCol };
          state.validMoves = getValidMoves(
            pieceToMove!,
            { row: startRow, col: startCol },
            state.boardState,
            state.eliminatedPlayers,
            state.hasMoved,
            state.enPassantTargets
          );
          return; // Don't advance the turn
        }

        // Clear justEliminated flag from previous move (if any)
        state.justEliminated = null;

        // Check if any opponent is in checkmate/stalemate after this move
        // We need to check all other players, not just the next one
        const currentPlayer = state.currentPlayerTurn;
        const otherPlayers = turnOrder.filter(
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
              state.scores[
                state.currentPlayerTurn as keyof typeof state.scores
              ] += 10;

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
        // Determine the next player in sequence
        const currentIndex = turnOrder.indexOf(state.currentPlayerTurn as any);
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

          // Clear justEliminated flag after a delay to allow UI to react
          // We'll clear it in the next move instead
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

        // Note: In multiplayer mode, moves are sent to server via sendMoveToServer action
        // and applied locally via applyNetworkMove when server confirms them
      }
    },
    resetGame: (state) => {
      // Reset the entire game state back to baseInitialState
      const resetState = {
        ...baseInitialState,
        checkStatus: updateAllCheckStatus(initialBoardState, [], {}),
      };
      Object.assign(state, resetState);
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
    },
    completePromotion: (
      state,
      action: PayloadAction<{ pieceType: string }>
    ) => {
      if (state.promotionState.isAwaiting && state.promotionState.position) {
        const { pieceType } = action.payload;
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
        const currentIndex = turnOrder.indexOf(state.currentPlayerTurn as any);
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
    applyNetworkMove: (
      state,
      action: PayloadAction<{
        from: { row: number; col: number };
        to: { row: number; col: number };
        pieceCode: string;
        playerColor: string;
      }>
    ) => {
      const { from, to, pieceCode, playerColor } = action.payload;

      // Apply the move to the board
      const { row: fromRow, col: fromCol } = from;
      const { row: toRow, col: toCol } = to;

      // Check if trying to capture a king - prevent king capture
      const capturedPiece = state.boardState[toRow][toCol];
      if (capturedPiece && capturedPiece[1] === "K") {
        return; // Don't apply the move if trying to capture a king
      }

      // Move the piece
      state.boardState[toRow][toCol] = pieceCode;
      state.boardState[fromRow][fromCol] = null;

      // Note: Turn management is now handled by the server
      // The server will send the updated gameState with the correct currentPlayerTurn

      // Clear selection
      state.selectedPiece = null;
      state.validMoves = [];

      // Update check status
      state.checkStatus = updateAllCheckStatus(
        state.boardState,
        state.eliminatedPlayers,
        state.hasMoved
      );

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
        action.payload
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
      console.log("🎮 Redux: syncP2PGameState called with:", lobbyData);
      
      if (lobbyData) {
        // Only update lobby-related state, not the entire game state
        if (lobbyData.currentGame) {
          console.log("🎮 Redux: Updating currentGame:", lobbyData.currentGame);
          state.currentGame = lobbyData.currentGame;
        }
        if (lobbyData.players) {
          console.log("🎮 Redux: Updating players:", lobbyData.players);
          state.players = lobbyData.players;
        }
        if (typeof lobbyData.isHost === 'boolean') {
          console.log("🎮 Redux: Updating isHost:", lobbyData.isHost);
          state.isHost = lobbyData.isHost;
        }
        if (typeof lobbyData.canStartGame === 'boolean') {
          console.log("🎮 Redux: Updating canStartGame:", lobbyData.canStartGame);
          state.canStartGame = lobbyData.canStartGame;
        }
      } else {
        // Clear lobby state
        console.log("🎮 Redux: Clearing lobby state");
        state.currentGame = null;
        state.players = [];
        state.isHost = false;
        state.canStartGame = false;
      }
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
  applyNetworkMove,
  syncGameState,
  setGameState,
  sendMoveToServer,
  setPlayers,
  setIsHost,
  setCanStartGame,
  setGameMode,
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
} = gameSlice.actions;

// Selectors for UI components to choose between live and historical state
export const selectDisplayBoardState = (state: { game: GameState }) => {
  const game = state.game;
  if (game.viewingHistoryIndex !== null && game.history.length > 0) {
    const historicalState = game.history[game.viewingHistoryIndex];
    return historicalState ? historicalState.boardState : game.boardState;
  }
  return game.boardState;
};

export const selectDisplayGameState = (state: { game: GameState }) => {
  const game = state.game;
  if (game.viewingHistoryIndex !== null && game.history.length > 0) {
    const historicalState = game.history[game.viewingHistoryIndex];
    if (historicalState) {
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
};

export const selectIsViewingHistory = (state: { game: GameState }) => {
  return state.game.viewingHistoryIndex !== null;
};

export default gameSlice.reducer;
