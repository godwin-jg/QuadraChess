import type { MoveInfo } from "../../../types";

/**
 * Get the type of move for a square (move or capture)
 */
export function getMoveType(
  row: number,
  col: number,
  validMoves: MoveInfo[]
): "move" | "capture" | null {
  const move = validMoves.find((m) => m.row === row && m.col === col);
  if (!move) return null;
  return move.isCapture ? "capture" : "move";
}

/**
 * Get the color of the selected piece
 */
export function getSelectedPieceColor(
  selectedPiece: { row: number; col: number } | null,
  boardState: (string | null)[][]
): string | null {
  if (!selectedPiece) return null;
  const piece = boardState[selectedPiece.row]?.[selectedPiece.col];
  return piece ? piece[0] : null;
}

/**
 * Check if a piece belongs to an eliminated player
 */
export function isPieceEliminated(
  piece: string | null,
  eliminatedPlayers: string[]
): boolean {
  if (!piece) return false;
  const pieceColor = piece[0];
  return eliminatedPlayers.includes(pieceColor);
}

/**
 * Find the nearest valid snap target to a position
 * Returns the key, center position, and distance
 */
export function findNearestSnapTarget(
  x: number,
  y: number,
  targets: number[],
  squareSize: number
): { key: number; centerX: number; centerY: number; distance: number } | null {
  if (targets.length === 0) return null;

  let bestDist = Number.POSITIVE_INFINITY;
  let bestKey = -1;
  let bestX = 0;
  let bestY = 0;

  for (let i = 0; i < targets.length; i++) {
    const key = targets[i];
    const row = Math.floor(key / 14);
    const col = key - row * 14;
    const centerX = (col + 0.5) * squareSize;
    const centerY = (row + 0.5) * squareSize;
    const dist = Math.hypot(x - centerX, y - centerY);
    if (dist < bestDist) {
      bestDist = dist;
      bestKey = key;
      bestX = centerX;
      bestY = centerY;
    }
  }

  if (bestKey === -1) return null;

  return {
    key: bestKey,
    centerX: bestX,
    centerY: bestY,
    distance: bestDist,
  };
}

/**
 * Convert a board key (0-195) to row and column
 */
export function keyToRowCol(key: number): { row: number; col: number } {
  return {
    row: Math.floor(key / 14),
    col: key % 14,
  };
}

/**
 * Convert row and column to a board key (0-195)
 */
export function rowColToKey(row: number, col: number): number {
  return row * 14 + col;
}

/**
 * Check if a position is inside the board bounds
 */
export function isInsideBoard(
  x: number,
  y: number,
  boardSize: number
): boolean {
  return x >= 0 && y >= 0 && x <= boardSize && y <= boardSize;
}

/**
 * Clamp a value to board bounds
 */
export function clampToBoard(value: number, boardSize: number): number {
  return Math.max(0, Math.min(value, boardSize));
}

/**
 * Find the best move target near a tap position
 * Used for snap-to-move on tap
 */
export function findBestMoveNearTap(
  x: number,
  y: number,
  validMoves: MoveInfo[],
  squareSize: number,
  snapThreshold: number
): MoveInfo | null {
  if (validMoves.length === 0) return null;

  let bestDistSq = snapThreshold * snapThreshold;
  let bestMove: MoveInfo | null = null;

  for (const move of validMoves) {
    const centerX = (move.col + 0.5) * squareSize;
    const centerY = (move.row + 0.5) * squareSize;
    const dx = x - centerX;
    const dy = y - centerY;
    const distSq = dx * dx + dy * dy;
    if (distSq <= bestDistSq) {
      bestDistSq = distSq;
      bestMove = move;
    }
  }

  return bestMove;
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
