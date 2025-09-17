import { isKingInCheck } from "../logic";
import { turnOrder } from "./types";

// Helper function to update check status for all players
export const updateAllCheckStatus = (
  boardState: (string | null)[][],
  eliminatedPlayers: string[],
  hasMoved?: any
) => {
  const checkStatus = { r: false, b: false, y: false, g: false };

  turnOrder.forEach((playerColor) => {
    if (!eliminatedPlayers.includes(playerColor)) {
      checkStatus[playerColor as keyof typeof checkStatus] = isKingInCheck(
        playerColor,
        boardState,
        eliminatedPlayers,
        hasMoved
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
