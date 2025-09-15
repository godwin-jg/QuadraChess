import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  getValidMoves,
  isKingInCheck,
  hasAnyLegalMoves,
  MoveInfo,
} from "../logic";
import { GameState, Position, turnOrder } from "./types";
import { initialBoardState } from "./boardState";
import {
  updateAllCheckStatus,
  getRookIdentifier,
  isCastlingMove,
} from "./gameHelpers";

const initialState: GameState = {
  boardState: initialBoardState,
  currentPlayerTurn: "r", // Red starts first
  gameStatus: "active",
  selectedPiece: null,
  validMoves: [],
  capturedPieces: { r: [], b: [], y: [], g: [] },
  checkStatus: updateAllCheckStatus(initialBoardState, [], {}),
  winner: null,
  eliminatedPlayers: [],
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
    selectPiece: (
      state,
      action: PayloadAction<{ row: number; col: number }>
    ) => {
      const { row, col } = action.payload;
      const pieceCode = state.boardState[row][col];

      // If selecting an empty square, clear selection
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

      // Enforce player turn
      if (pieceColor !== state.currentPlayerTurn) {
        return; // Do nothing if it's not the player's turn
      }

      // Check if the same piece is already selected - if so, deselect it
      if (
        state.selectedPiece &&
        state.selectedPiece.row === row &&
        state.selectedPiece.col === col
      ) {
        state.selectedPiece = null;
        state.validMoves = [];
        return;
      }

      state.selectedPiece = { row, col };
      state.validMoves = getValidMoves(
        pieceCode,
        { row, col },
        state.boardState,
        state.eliminatedPlayers,
        state.hasMoved
      );
    },
    makeMove: (state, action: PayloadAction<{ row: number; col: number }>) => {
      if (state.selectedPiece) {
        const { row: targetRow, col: targetCol } = action.payload;
        const { row: startRow, col: startCol } = state.selectedPiece;

        const pieceToMove = state.boardState[startRow][startCol];
        const capturedPiece = state.boardState[targetRow][targetCol];
        const pieceColor = pieceToMove?.charAt(0);
        const pieceType = pieceToMove?.[1];

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
              // Kingside castling (right)
              rookStartRow = 0;
              rookStartCol = 10; // Right rook at (0, 10)
              rookTargetRow = 0;
              rookTargetCol = 8; // Rook moves to (0, 8)
            } else {
              // Queenside castling (left)
              rookStartRow = 0;
              rookStartCol = 3; // Left rook at (0, 3)
              rookTargetRow = 0;
              rookTargetCol = 6; // Rook moves to (0, 6)
            }
          } else if (pieceColor === "g") {
            // Green - right column
            if (targetRow > startRow) {
              // Kingside castling (down)
              rookStartRow = 10;
              rookStartCol = 13; // Bottom rook at (10, 13)
              rookTargetRow = 8; // Rook moves to (8, 13)
              rookTargetCol = 13;
            } else {
              // Queenside castling (up)
              rookStartRow = 3;
              rookStartCol = 13; // Top rook at (3, 13)
              rookTargetRow = 6; // Rook moves to (6, 13)
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

        // Handle the capture (only for non-castling moves)
        if (capturedPiece && !isCastling) {
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

        // Check if this is a pawn promotion
        const isPawn = pieceToMove?.endsWith("P");
        let isPromotion = false;

        if (isPawn) {
          const pieceColor = pieceToMove?.charAt(0);
          if (pieceColor === "r" && targetRow === 6) {
            isPromotion = true; // Red promotes on row 6
          } else if (pieceColor === "y" && targetRow === 7) {
            isPromotion = true; // Yellow promotes on row 7
          } else if (pieceColor === "b" && targetCol === 7) {
            isPromotion = true; // Blue promotes on col 7
          } else if (pieceColor === "g" && targetCol === 6) {
            isPromotion = true; // Green promotes on col 6
          }
        }

        if (isPromotion) {
          // Pause the game for promotion selection
          state.promotionState = {
            isAwaiting: true,
            position: { row: targetRow, col: targetCol },
            color: pieceColor!,
          };
          state.gameStatus = "promotion";
          // Don't advance the turn yet - wait for promotion completion
        } else {
          // Move the piece
          state.boardState[targetRow][targetCol] = pieceToMove;
          state.boardState[startRow][startCol] = null;

          // Clear selection
          state.selectedPiece = null;
          state.validMoves = [];

          // Update check status for all players
          state.checkStatus = updateAllCheckStatus(
            state.boardState,
            state.eliminatedPlayers,
            state.hasMoved
          );

          // Check for checkmate or stalemate
          const currentPlayerInCheck =
            state.checkStatus[
              state.currentPlayerTurn as keyof typeof state.checkStatus
            ];

          // Get the next player
          const currentIndex = turnOrder.indexOf(
            state.currentPlayerTurn as any
          );
          const nextIndex = (currentIndex + 1) % turnOrder.length;
          const nextPlayer = turnOrder[nextIndex];

          // Check if the next player has any legal moves
          const nextPlayerHasMoves = hasAnyLegalMoves(
            nextPlayer,
            state.boardState,
            state.eliminatedPlayers,
            state.hasMoved
          );

          if (!nextPlayerHasMoves) {
            if (currentPlayerInCheck) {
              // Checkmate - current player wins
              state.winner = state.currentPlayerTurn;
              state.gameStatus = "finished";
            } else {
              // Stalemate - it's a draw
              state.gameStatus = "finished";
            }
          } else {
            // Advance to next player
            state.currentPlayerTurn = nextPlayer;
          }

          // Check if any player is eliminated (checkmated)
          turnOrder.forEach((player) => {
            if (
              !state.eliminatedPlayers.includes(player) &&
              state.checkStatus[player as keyof typeof state.checkStatus]
            ) {
              const playerHasMoves = hasAnyLegalMoves(
                player,
                state.boardState,
                state.eliminatedPlayers,
                state.hasMoved
              );

              if (!playerHasMoves) {
                // Player is checkmated - eliminate them
                state.eliminatedPlayers.push(player);
                state.scores[
                  state.currentPlayerTurn as keyof typeof state.scores
                ] += 10; // Checkmate bonus
              }
            }
          });
        }
      }
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
    resetGame: (state) => {
      return {
        ...initialState,
        checkStatus: updateAllCheckStatus(initialBoardState, [], {}),
      };
    },
  },
});

export const {
  setSelectedPiece,
  setValidMoves,
  selectPiece,
  makeMove,
  completePromotion,
  resetGame,
} = gameSlice.actions;

export default gameSlice.reducer;
