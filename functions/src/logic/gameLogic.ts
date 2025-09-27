import { MoveInfo, Position } from "../types";
import {
  getBishopMoves,
  getKingMoves,
  getKingMovesWithoutCastling,
  getKnightMoves,
  getPawnMoves,
  getQueenMoves,
  getRookMoves,
} from "./pieceMoves";
import { simulateMove } from "./utils";

// Re-export MoveInfo for client use
export { MoveInfo };

// Helper function to check if a square is under attack (without castling to prevent recursion)
export const isSquareUnderAttack = (
  boardState: (string | null)[][],
  row: number,
  col: number,
  defendingColor: string,
  eliminatedPlayers: string[] = [],
  hasMoved?: any
): boolean => {
  // Check if any opponent piece can attack this square
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 14; c++) {
      const piece = boardState[r] ? boardState[r][c] : null;

      // If square contains an opponent's piece
      if (piece && piece[0] !== defendingColor) {
        // Get pseudo-legal moves for this opponent piece (without castling to prevent recursion)
        const validMoves = getPseudoLegalMovesWithoutCastling(
          piece,
          { row: r, col: c },
          boardState,
          eliminatedPlayers,
          hasMoved
        );

        // Check if any of these moves target the square
        const isAttackingSquare = validMoves.some(
          (move) => move.row === row && move.col === col
        );

        if (isAttackingSquare) {
          return true; // Square is under attack
        }
      }
    }
  }

  return false; // Square is not under attack
};

// Helper function to get pseudo-legal moves without castling (to prevent recursion)
const getPseudoLegalMovesWithoutCastling = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  hasMoved?: any
): MoveInfo[] => {
  if (!pieceCode || pieceCode.length < 2) return [];

  const pieceType = pieceCode[1];
  const pieceColor = pieceCode[0];

  // If the piece belongs to an eliminated player, it cannot generate moves
  if (eliminatedPlayers.includes(pieceColor)) {
    return [];
  }

  switch (pieceType) {
  case "P": // Pawn
    return getPawnMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "N": // Knight
    return getKnightMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "R": // Rook
    return getRookMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "B": // Bishop
    return getBishopMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "Q": // Queen
    return getQueenMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "K": // King (without castling)
    return getKingMovesWithoutCastling(
      pieceCode,
      position,
      boardState,
      eliminatedPlayers
    );
  default:
    return [];
  }
};

// Function to get pseudo-legal moves (without self-check filtering)
const getPseudoLegalMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  hasMoved?: any,
  enPassantTargets?: {
    position: Position;
    createdBy: string;
    createdByTurn: string;
  }[]
): MoveInfo[] => {
  if (!pieceCode || pieceCode.length < 2) return [];

  const pieceType = pieceCode[1];
  const pieceColor = pieceCode[0];

  // If the piece belongs to an eliminated player, it cannot generate moves
  if (eliminatedPlayers.includes(pieceColor)) {
    return [];
  }

  switch (pieceType) {
  case "P": // Pawn
    return getPawnMoves(
      pieceCode,
      position,
      boardState,
      eliminatedPlayers,
      enPassantTargets
    );
  case "N": // Knight
    return getKnightMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "R": // Rook
    return getRookMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "B": // Bishop
    return getBishopMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "Q": // Queen
    return getQueenMoves(pieceCode, position, boardState, eliminatedPlayers);
  case "K": // King
    return getKingMoves(
      pieceCode,
      position,
      boardState,
      eliminatedPlayers,
      hasMoved,
      isKingInCheck,
      isSquareUnderAttack
    );
  default:
    return [];
  }
};

// Main function to get valid moves for any piece
export const getValidMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  hasMoved?: any,
  enPassantTargets?: {
    position: Position;
    createdBy: string;
    createdByTurn: string;
  }[]
): MoveInfo[] => {
  if (!pieceCode || pieceCode.length < 2) return [];

  const pieceColor = pieceCode[0];

  // If the piece belongs to an eliminated player, it cannot generate moves
  if (eliminatedPlayers.includes(pieceColor)) {
    return [];
  }

  // Get pseudo-legal moves (moves that follow piece movement rules)
  const pseudoLegalMoves = getPseudoLegalMoves(
    pieceCode,
    position,
    boardState,
    eliminatedPlayers,
    hasMoved,
    enPassantTargets
  );

  // Filter out moves that would result in self-check
  const legalMoves: MoveInfo[] = [];

  for (const move of pseudoLegalMoves) {
    // Simulate the move on a temporary board
    const simulatedBoard = simulateMove(boardState, position, move);

    // Check if this move would put the player's own king in check
    const wouldBeInCheck = isKingInCheck(
      pieceColor,
      simulatedBoard,
      eliminatedPlayers,
      hasMoved
    );

    // Only keep moves that don't result in self-check
    if (!wouldBeInCheck) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
};

// Check if a king is in check
export const isKingInCheck = (
  kingColor: string,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  hasMoved?: any
): boolean => {
  // Find the king's position
  let kingPosition: Position | null = null;

  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = boardState[row] ? boardState[row][col] : null;
      if (piece && piece[0] === kingColor && piece[1] === "K") {
        kingPosition = { row, col };
        break;
      }
    }
    if (kingPosition) break;
  }

  // If king not found, return false (shouldn't happen in normal gameplay)
  if (!kingPosition) {
    return false;
  }

  // Check if any opponent piece can attack the king
  for (let row = 0; row < 14; row++) {
    for (let col = 0; col < 14; col++) {
      const piece = boardState[row] ? boardState[row][col] : null;

      // If square contains an opponent's piece
      if (piece && piece[0] !== kingColor) {
        // Get pseudo-legal moves for this opponent piece (no self-check filtering needed)
        const validMoves = getPseudoLegalMovesWithoutCastling(
          piece,
          { row, col },
          boardState,
          eliminatedPlayers,
          hasMoved
        );

        // Check if any of these moves target the king's position
        const isAttackingKing = validMoves.some(
          (move) =>
            move.row === kingPosition!.row && move.col === kingPosition!.col
        );

        if (isAttackingKing) {
          return true; // King is in check
        }
      }
    }
  }

  return false; // King is not in check
};

// Check if a player has any legal moves available (optimized)
export const hasAnyLegalMoves = (
  playerColor: string,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  hasMoved?: any,
  enPassantTargets?: {
    position: Position;
    createdBy: string;
    createdByTurn: string;
  }[]
): boolean => {
  // Early exit if player is eliminated
  if (eliminatedPlayers.includes(playerColor)) {
    return false;
  }

  // Optimized: Check pieces in order of likelihood to have moves
  // Start with pieces that are more likely to have moves (pawns, knights, queens)
  const piecePriority = ["P", "N", "Q", "R", "B", "K"];

  for (const pieceType of piecePriority) {
    for (let row = 0; row < 14; row++) {
      for (let col = 0; col < 14; col++) {
        const piece = boardState[row] ? boardState[row][col] : null;

        // If this square contains a piece belonging to the player of the current type
        if (piece && piece[0] === playerColor && piece[1] === pieceType) {
          // Get valid moves for this piece (including en passant opportunities)
          const validMoves = getValidMoves(
            piece,
            { row, col },
            boardState,
            eliminatedPlayers,
            hasMoved,
            enPassantTargets
          );

          // If there are any legal moves, return true immediately
          if (validMoves.length > 0) {
            return true;
          }
        }
      }
    }
  }

  // No legal moves found for any of the player's pieces
  return false;
};
