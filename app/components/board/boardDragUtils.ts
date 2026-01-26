export type BoardPoint = {
  x: number;
  y: number;
  rawX: number;
  rawY: number;
  row: number;
  col: number;
  inside: boolean;
};

export const getBoardPointFromLocal = (
  localX: number,
  localY: number,
  boardSize: number
): BoardPoint | null => {
  if (boardSize <= 0) return null;
  const squareSize = boardSize / 14;
  const col = Math.floor(localX / squareSize);
  const row = Math.floor(localY / squareSize);
  const inside =
    localX >= 0 &&
    localY >= 0 &&
    localX <= boardSize &&
    localY <= boardSize &&
    row >= 0 &&
    row < 14 &&
    col >= 0 &&
    col < 14;
  return { x: localX, y: localY, rawX: localX, rawY: localY, row, col, inside };
};
