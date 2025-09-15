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
  enPassantTarget: null, // Will store {position: Position, createdBy: string} of the square that was skipped
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
    selectPiece: (state, action: PayloadAction<Position>) => {
      const { row, col } = action.payload;
      const pieceCode = state.boardState[row][col];

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

      // Enforce player turn - TEMPORARILY DISABLED FOR TESTING
      // if (pieceColor !== state.currentPlayerTurn) {
      //   state.selectedPiece = null;
      //   state.validMoves = [];
      //   return;
      // }

      state.selectedPiece = { row, col };
      state.validMoves = getValidMoves(
        pieceCode,
        { row, col },
        state.boardState,
        state.eliminatedPlayers,
        state.hasMoved,
        state.enPassantTarget
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

        // A. Handle en passant capture FIRST (before clearing enPassantTarget)
        const enPassantTarget = state.enPassantTarget as {
          position: Position;
          createdBy: string;
        } | null;
        const isEnPassantCapture =
          enPassantTarget !== null &&
          enPassantTarget.position.row === targetRow &&
          enPassantTarget.position.col === targetCol &&
          pieceType === "P" &&
          pieceToMove !== enPassantTarget.createdBy; // Prevent the pawn that created the target from capturing it

        if (isEnPassantCapture) {
          // Find the captured pawn - it's at its final position (one square beyond the skipped square)
          const createdByColor = enPassantTarget.createdBy.charAt(0);
          const { row: skippedRow, col: skippedCol } = enPassantTarget.position;

          // Calculate the captured pawn's position based on its movement direction
          let capturedPawnRow: number;
          let capturedPawnCol: number;

          switch (createdByColor) {
            case "r": // Red moves up (decreasing row)
              capturedPawnRow = skippedRow - 1;
              capturedPawnCol = skippedCol;
              break;
            case "y": // Yellow moves down (increasing row)
              capturedPawnRow = skippedRow + 1;
              capturedPawnCol = skippedCol;
              break;
            case "b": // Blue moves right (increasing col)
              capturedPawnRow = skippedRow;
              capturedPawnCol = skippedCol + 1;
              break;
            case "g": // Green moves left (decreasing col)
              capturedPawnRow = skippedRow;
              capturedPawnCol = skippedCol - 1;
              break;
            default:
              throw new Error(`Invalid piece color: ${createdByColor}`);
          }

          // Remove the captured pawn
          const capturedPawn =
            state.boardState[capturedPawnRow][capturedPawnCol];
          if (capturedPawn) {
            state.boardState[capturedPawnRow][capturedPawnCol] = null;

            // Add to captured pieces and update score
            state.capturedPieces[
              pieceColor as keyof typeof state.capturedPieces
            ].push(capturedPawn);
            state.scores[pieceColor as keyof typeof state.scores] += 1;
          }
        }

        // B. Clear enPassantTarget after handling en passant capture
        // (This will be set again if current move creates a new en passant opportunity)
        state.enPassantTarget = null;

        // Handle the capture (only for non-castling moves and non-en passant captures)
        if (capturedPiece && !isCastling && !isEnPassantCapture) {
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
        }

        // C. Set new enPassantTarget for two-square pawn moves
        if (pieceType === "P") {
          const rowDiff = Math.abs(targetRow - startRow);
          const colDiff = Math.abs(targetCol - startCol);
          const isTwoSquarePawnMove =
            (rowDiff === 2 && colDiff === 0) ||
            (rowDiff === 0 && colDiff === 2);

          if (isTwoSquarePawnMove) {
            // Calculate the skipped square based on movement direction
            const skippedSquare: Position = (() => {
              switch (pieceColor) {
                case "r": // Red moves up (decreasing row)
                  return { row: targetRow + 1, col: targetCol };
                case "y": // Yellow moves down (increasing row)
                  return { row: targetRow - 1, col: targetCol };
                case "b": // Blue moves right (increasing col)
                  return { row: targetRow, col: targetCol - 1 };
                case "g": // Green moves left (decreasing col)
                  return { row: targetRow, col: targetCol + 1 };
                default:
                  throw new Error(`Invalid piece color: ${pieceColor}`);
              }
            })();

            state.enPassantTarget = {
              position: skippedSquare,
              createdBy: pieceToMove!,
            };
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
            state.enPassantTarget
          );
          return; // Don't advance the turn
        }

        // Advance to next player
        const currentIndex = turnOrder.indexOf(state.currentPlayerTurn as any);
        const nextIndex = (currentIndex + 1) % turnOrder.length;
        const nextPlayer = turnOrder[nextIndex];
        state.currentPlayerTurn = nextPlayer;

        // Check if the next player has any legal moves
        const nextPlayerHasMoves = hasAnyLegalMoves(
          nextPlayer,
          state.boardState,
          state.eliminatedPlayers,
          state.hasMoved
        );

        if (!nextPlayerHasMoves) {
          // The next player has no legal moves
          if (state.checkStatus[nextPlayer as keyof typeof state.checkStatus]) {
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
    },
    resetGame: (state) => {
      return {
        ...initialState,
        checkStatus: updateAllCheckStatus(initialBoardState, [], {}),
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
