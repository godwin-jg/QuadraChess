import { Position } from "../types";

// Helper function to check if a position is within board bounds
export const isWithinBounds = (row: number, col: number): boolean => {
  return row >= 0 && row < 14 && col >= 0 && col < 14;
};

// Helper function to check if a position is a corner square (not playable)
export const isCornerSquare = (row: number, col: number): boolean => {
  return (
    (row < 3 && col < 3) ||
    (row < 3 && col > 10) ||
    (row > 10 && col < 3) ||
    (row > 10 && col > 10)
  );
};

// Helper function to check if a square is empty
export const isEmpty = (
  boardState: (string | null)[][],
  row: number,
  col: number
): boolean => {
  return (
    isWithinBounds(row, col) &&
    boardState[row] &&
    (boardState[row][col] === null || boardState[row][col] === "")
  );
};

// Helper function to check if a square contains an enemy piece
export const isEnemy = (
  boardState: (string | null)[][],
  row: number,
  col: number,
  pieceColor: string,
  eliminatedPlayers: string[] = []
): boolean => {
  if (
    !isWithinBounds(row, col) ||
    !boardState[row] ||
    !boardState[row][col] ||
    boardState[row][col] === ""
  ) {
    return false;
  }
  const piece = boardState[row][col]!;
  const targetPieceColor = piece[0];

  // If the target piece belongs to an eliminated player, it's always capturable
  if (eliminatedPlayers.includes(targetPieceColor)) {
    return true;
  }

  return targetPieceColor !== pieceColor;
};

// Helper function to check if a square contains a friendly piece
export const isFriendly = (
  boardState: (string | null)[][],
  row: number,
  col: number,
  pieceColor: string,
  eliminatedPlayers: string[] = []
): boolean => {
  if (
    !isWithinBounds(row, col) ||
    !boardState[row] ||
    !boardState[row][col] ||
    boardState[row][col] === ""
  ) {
    return false;
  }
  const piece = boardState[row][col]!;
  const targetPieceColor = piece[0];

  // If the target piece belongs to an eliminated player, it's not friendly
  if (eliminatedPlayers.includes(targetPieceColor)) {
    return false;
  }

  return targetPieceColor === pieceColor;
};

// Helper function to clone the board state
export const cloneBoardState = (
  boardState: (string | null)[][]
): (string | null)[][] => {
  return boardState.map((row) => [...row]);
};

// Helper function to simulate a move on the board
export const simulateMove = (
  boardState: (string | null)[][],
  from: Position,
  to: Position
): (string | null)[][] => {
  const newBoard = cloneBoardState(boardState);
  newBoard[to.row][to.col] = newBoard[from.row][from.col];
  newBoard[from.row][from.col] = null;
  return newBoard;
};
