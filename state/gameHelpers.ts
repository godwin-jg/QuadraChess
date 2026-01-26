import { isKingInCheck } from "../src/logic/bitboardLogic";
import { GameState, Position, turnOrder } from "./types";

// Helper function to update check status for all players
export const updateAllCheckStatus = (state: GameState) => {
  const checkStatus = { r: false, b: false, y: false, g: false };
  const eliminated = state.eliminatedPlayers ?? [];

  turnOrder.forEach((playerColor) => {
    if (!eliminated.includes(playerColor)) {
      checkStatus[playerColor as keyof typeof checkStatus] = isKingInCheck(
        playerColor,
        state
      );
    }
  });

  return checkStatus;
};

// Helper function to get rook identifier based on position
export const getRookIdentifier = (
  playerColor: string,
  row: number,
  col: number
): string | null => {
  switch (playerColor) {
    case "r": // Red - bottom row
      if (row === 13) {
        if (col === 3) return "rR1"; // Left rook
        if (col === 10) return "rR2"; // Right rook
      }
      break;
    case "b": // Blue - left column
      if (col === 0) {
        if (row === 3) return "bR1"; // Top rook
        if (row === 10) return "bR2"; // Bottom rook
      }
      break;
    case "y": // Yellow - top row
      if (row === 0) {
        if (col === 3) return "yR1"; // Left rook
        if (col === 10) return "yR2"; // Right rook
      }
      break;
    case "g": // Green - right column
      if (col === 13) {
        if (row === 3) return "gR1"; // Top rook
        if (row === 10) return "gR2"; // Bottom rook
      }
      break;
  }
  return null;
};

export const getRookCastlingCoords = (
  playerColor: string,
  kingTarget: Position
): { rookFrom: Position; rookTo: Position } | null => {
  const { row: targetRow, col: targetCol } = kingTarget;

  if (playerColor === "r") {
    if (targetCol === 9)
      return {
        rookFrom: { row: 13, col: 10 },
        rookTo: { row: 13, col: 8 },
      };
    if (targetCol === 5)
      return {
        rookFrom: { row: 13, col: 3 },
        rookTo: { row: 13, col: 6 },
      };
  } else if (playerColor === "b") {
    if (targetRow === 9)
      return {
        rookFrom: { row: 10, col: 0 },
        rookTo: { row: 8, col: 0 },
      };
    if (targetRow === 5)
      return {
        rookFrom: { row: 3, col: 0 },
        rookTo: { row: 6, col: 0 },
      };
  } else if (playerColor === "y") {
    if (targetCol === 4)
      return {
        rookFrom: { row: 0, col: 3 },
        rookTo: { row: 0, col: 5 },
      };
    if (targetCol === 8)
      return {
        rookFrom: { row: 0, col: 10 },
        rookTo: { row: 0, col: 7 },
      };
  } else if (playerColor === "g") {
    if (targetRow === 4)
      return {
        rookFrom: { row: 3, col: 13 },
        rookTo: { row: 5, col: 13 },
      };
    if (targetRow === 8)
      return {
        rookFrom: { row: 10, col: 13 },
        rookTo: { row: 7, col: 13 },
      };
  }

  return null;
};

// Helper function to check if a move is castling
export const isCastlingMove = (
  pieceCode: string,
  startRow: number,
  startCol: number,
  targetRow: number,
  targetCol: number
): boolean => {
  const pieceType = pieceCode[1];
  const pieceColor = pieceCode[0];

  if (pieceType !== "K") return false;

  // Check if king is moving 2 squares (castling distance)
  const rowDiff = Math.abs(targetRow - startRow);
  const colDiff = Math.abs(targetCol - startCol);

  return (rowDiff === 2 && colDiff === 0) || (rowDiff === 0 && colDiff === 2);
};
