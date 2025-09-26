import { Position } from "../types";
import { MoveInfo } from "./types";
import { isCornerSquare, isEmpty, isEnemy, isWithinBounds } from "./utils";

// Get valid moves for a pawn
export const getPawnMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  enPassantTargets?: {
    position: Position;
    createdBy: string;
    createdByTurn: string;
  }[]
): MoveInfo[] => {
  const { row, col } = position;
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // Define movement directions for each color
  const directions = {
    r: {
      forward: { row: -1, col: 0 },
      diagonal1: { row: -1, col: -1 },
      diagonal2: { row: -1, col: 1 },
    }, // Red moves up
    y: {
      forward: { row: 1, col: 0 },
      diagonal1: { row: 1, col: -1 },
      diagonal2: { row: 1, col: 1 },
    }, // Yellow moves down
    b: {
      forward: { row: 0, col: 1 },
      diagonal1: { row: -1, col: 1 },
      diagonal2: { row: 1, col: 1 },
    }, // Blue moves right
    g: {
      forward: { row: 0, col: -1 },
      diagonal1: { row: -1, col: -1 },
      diagonal2: { row: 1, col: -1 },
    }, // Green moves left
  };

  const dir = directions[pieceColor as keyof typeof directions];
  if (!dir) return validMoves;

  // Check forward move (one square)
  const forwardRow = row + dir.forward.row;
  const forwardCol = col + dir.forward.col;
  if (
    isWithinBounds(forwardRow, forwardCol) &&
    !isCornerSquare(forwardRow, forwardCol) &&
    isEmpty(boardState, forwardRow, forwardCol)
  ) {
    validMoves.push({
      row: forwardRow,
      col: forwardCol,
      isCapture: false,
      isPromotion: false,
    });
  }

  // Check diagonal moves (for capturing)
  const diagonal1Row = row + dir.diagonal1.row;
  const diagonal1Col = col + dir.diagonal1.col;
  if (
    isWithinBounds(diagonal1Row, diagonal1Col) &&
    !isCornerSquare(diagonal1Row, diagonal1Col) &&
    isEnemy(
      boardState,
      diagonal1Row,
      diagonal1Col,
      pieceColor,
      eliminatedPlayers
    )
  ) {
    validMoves.push({
      row: diagonal1Row,
      col: diagonal1Col,
      isCapture: true,
      isPromotion: false,
    });
  }

  const diagonal2Row = row + dir.diagonal2.row;
  const diagonal2Col = col + dir.diagonal2.col;
  if (
    isWithinBounds(diagonal2Row, diagonal2Col) &&
    !isCornerSquare(diagonal2Row, diagonal2Col) &&
    isEnemy(
      boardState,
      diagonal2Row,
      diagonal2Col,
      pieceColor,
      eliminatedPlayers
    )
  ) {
    validMoves.push({
      row: diagonal2Row,
      col: diagonal2Col,
      isCapture: true,
      isPromotion: false,
    });
  }

  // Check en passant capture
  if (enPassantTargets && enPassantTargets.length > 0) {
    for (const enPassantTarget of enPassantTargets) {
      if (pieceCode !== enPassantTarget.createdBy) {
        const { row: targetRow, col: targetCol } = enPassantTarget.position;

        // Check if this pawn can attack the en passant target diagonally
        const canCapture = (() => {
          switch (pieceColor) {
            case "r":
              return row === targetRow + 1 && Math.abs(col - targetCol) === 1;
            case "y":
              return row === targetRow - 1 && Math.abs(col - targetCol) === 1;
            case "b":
              return col === targetCol - 1 && Math.abs(row - targetRow) === 1;
            case "g":
              return col === targetCol + 1 && Math.abs(row - targetRow) === 1;
            default:
              return false;
          }
        })();

        if (canCapture) {
          validMoves.push({
            row: targetRow,
            col: targetCol,
            isCapture: true,
            isEnPassant: true,
          });
        }
      }
    }
  }

  // Check initial two-square move (only from starting position)
  const isStartingPosition =
    (pieceColor === "r" && row === 12) || // Red pawns start at row 12
    (pieceColor === "y" && row === 1) || // Yellow pawns start at row 1
    (pieceColor === "b" && col === 1) || // Blue pawns start at col 1
    (pieceColor === "g" && col === 12); // Green pawns start at col 12

  if (isStartingPosition) {
    const doubleForwardRow = row + dir.forward.row * 2;
    const doubleForwardCol = col + dir.forward.col * 2;
    if (
      isWithinBounds(doubleForwardRow, doubleForwardCol) &&
      !isCornerSquare(doubleForwardRow, doubleForwardCol) &&
      isEmpty(boardState, doubleForwardRow, doubleForwardCol) &&
      isEmpty(boardState, forwardRow, forwardCol)
    ) {
      validMoves.push({
        row: doubleForwardRow,
        col: doubleForwardCol,
        isCapture: false,
        isPromotion: false,
      });
    }
  }

  // Mark moves that would result in promotion
  // PROMOTION RULE: Pawns promote when reaching:
  // 1. OPPOSING player's first rank (new universal rule)
  // 2. Traditional promotion ranks (old rule)
  const movesWithPromotion = validMoves.map((move) => {
    let isPromotion = false;

    // NEW RULE: OPPOSING player's first rank promotion
    // Yellow's first rank (row 0, cols 3-10) - OPPOSING pawns promote here
    if (
      move.row === 0 &&
      move.col >= 3 &&
      move.col <= 10 &&
      pieceColor !== "y"
    ) {
      isPromotion = true;
    } else if (
      move.row === 13 &&
      move.col >= 3 &&
      move.col <= 10 &&
      pieceColor !== "r"
    ) {
      // Red's first rank (row 13, cols 3-10) - OPPOSING pawns promote here
      isPromotion = true;
    } else if (
      move.col === 0 &&
      move.row >= 3 &&
      move.row <= 10 &&
      pieceColor !== "b"
    ) {
      // Blue's first rank (col 0, rows 3-10) - OPPOSING pawns promote here
      isPromotion = true;
    } else if (
      move.col === 13 &&
      move.row >= 3 &&
      move.row <= 10 &&
      pieceColor !== "g"
    ) {
      // Green's first rank (col 13, rows 3-10) - OPPOSING pawns promote here
      isPromotion = true;
    }

    // OLD RULE: Traditional promotion ranks (if not already promoting)
    if (!isPromotion) {
      if (pieceColor === "r" && move.row === 6) {
        isPromotion = true; // Red promotes on row 6
      } else if (pieceColor === "y" && move.row === 7) {
        isPromotion = true; // Yellow promotes on row 7
      } else if (pieceColor === "b" && move.col === 7) {
        isPromotion = true; // Blue promotes on col 7
      } else if (pieceColor === "g" && move.col === 6) {
        isPromotion = true; // Green promotes on col 6
      }
    }

    return {
      ...move,
      isPromotion: isPromotion,
    };
  });

  return movesWithPromotion;
};

// Get valid moves for a knight
export const getKnightMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = []
): MoveInfo[] => {
  const { row, col } = position;
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // Knight moves in L-shape: 2 squares in one direction, then 1 square perpendicular
  const knightMoves = [
    { row: row - 2, col: col - 1 }, // Up 2, Left 1
    { row: row - 2, col: col + 1 }, // Up 2, Right 1
    { row: row - 1, col: col - 2 }, // Up 1, Left 2
    { row: row - 1, col: col + 2 }, // Up 1, Right 2
    { row: row + 1, col: col - 2 }, // Down 1, Left 2
    { row: row + 1, col: col + 2 }, // Down 1, Right 2
    { row: row + 2, col: col - 1 }, // Down 2, Left 1
    { row: row + 2, col: col + 1 }, // Down 2, Right 1
  ];

  for (const move of knightMoves) {
    if (
      isWithinBounds(move.row, move.col) &&
      !isCornerSquare(move.row, move.col)
    ) {
      // Knight can move to empty squares or capture enemy pieces
      if (isEmpty(boardState, move.row, move.col)) {
        validMoves.push({
          row: move.row,
          col: move.col,
          isCapture: false,
          isPromotion: false,
        });
      } else if (
        isEnemy(boardState, move.row, move.col, pieceColor, eliminatedPlayers)
      ) {
        validMoves.push({
          row: move.row,
          col: move.col,
          isCapture: true,
          isPromotion: false,
        });
      }
    }
  }

  return validMoves;
};

// Get valid moves for a rook
export const getRookMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = []
): MoveInfo[] => {
  const { row, col } = position;
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // Rook moves: horizontal and vertical directions
  const directions = [
    { row: -1, col: 0 }, // Up
    { row: 1, col: 0 }, // Down
    { row: 0, col: -1 }, // Left
    { row: 0, col: 1 }, // Right
  ];

  for (const direction of directions) {
    let newRow = row + direction.row;
    let newCol = col + direction.col;

    while (isWithinBounds(newRow, newCol) && !isCornerSquare(newRow, newCol)) {
      const targetPiece = boardState[newRow]
        ? boardState[newRow][newCol]
        : null;

      if (!targetPiece) {
        // Empty square - valid move
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: false,
          isPromotion: false,
        });
      } else if (
        isEnemy(boardState, newRow, newCol, pieceColor, eliminatedPlayers)
      ) {
        // Enemy piece - valid capture
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: true,
          isPromotion: false,
        });
        break; // Stop sliding after capture
      } else {
        // Friendly piece - stop sliding
        break;
      }

      newRow += direction.row;
      newCol += direction.col;
    }
  }

  return validMoves;
};

// Get valid moves for a bishop
export const getBishopMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = []
): MoveInfo[] => {
  const { row, col } = position;
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // Bishop moves: diagonal directions
  const directions = [
    { row: -1, col: -1 }, // Up-left
    { row: -1, col: 1 }, // Up-right
    { row: 1, col: -1 }, // Down-left
    { row: 1, col: 1 }, // Down-right
  ];

  for (const direction of directions) {
    let newRow = row + direction.row;
    let newCol = col + direction.col;

    while (isWithinBounds(newRow, newCol) && !isCornerSquare(newRow, newCol)) {
      const targetPiece = boardState[newRow]
        ? boardState[newRow][newCol]
        : null;

      if (!targetPiece) {
        // Empty square - valid move
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: false,
          isPromotion: false,
        });
      } else if (
        isEnemy(boardState, newRow, newCol, pieceColor, eliminatedPlayers)
      ) {
        // Enemy piece - valid capture
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: true,
          isPromotion: false,
        });
        break; // Stop sliding after capture
      } else {
        // Friendly piece - stop sliding
        break;
      }

      newRow += direction.row;
      newCol += direction.col;
    }
  }

  return validMoves;
};

// Get valid moves for a queen
export const getQueenMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = []
): MoveInfo[] => {
  const { row, col } = position;
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // Queen moves: all 8 directions (rook + bishop)
  const directions = [
    { row: -1, col: 0 }, // Up
    { row: 1, col: 0 }, // Down
    { row: 0, col: -1 }, // Left
    { row: 0, col: 1 }, // Right
    { row: -1, col: -1 }, // Up-left
    { row: -1, col: 1 }, // Up-right
    { row: 1, col: -1 }, // Down-left
    { row: 1, col: 1 }, // Down-right
  ];

  for (const direction of directions) {
    let newRow = row + direction.row;
    let newCol = col + direction.col;

    while (isWithinBounds(newRow, newCol) && !isCornerSquare(newRow, newCol)) {
      const targetPiece = boardState[newRow]
        ? boardState[newRow][newCol]
        : null;

      if (!targetPiece) {
        // Empty square - valid move
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: false,
          isPromotion: false,
        });
      } else if (
        isEnemy(boardState, newRow, newCol, pieceColor, eliminatedPlayers)
      ) {
        // Enemy piece - valid capture
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: true,
          isPromotion: false,
        });
        break; // Stop sliding after capture
      } else {
        // Friendly piece - stop sliding
        break;
      }

      newRow += direction.row;
      newCol += direction.col;
    }
  }

  return validMoves;
};

// Get valid moves for a king (without castling)
export const getKingMovesWithoutCastling = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = []
): MoveInfo[] => {
  const { row, col } = position;
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // King moves: one square in any direction
  const directions = [
    { row: -1, col: 0 }, // Up
    { row: 1, col: 0 }, // Down
    { row: 0, col: -1 }, // Left
    { row: 0, col: 1 }, // Right
    { row: -1, col: -1 }, // Up-left
    { row: -1, col: 1 }, // Up-right
    { row: 1, col: -1 }, // Down-left
    { row: 1, col: 1 }, // Down-right
  ];

  for (const direction of directions) {
    const newRow = row + direction.row;
    const newCol = col + direction.col;

    if (isWithinBounds(newRow, newCol) && !isCornerSquare(newRow, newCol)) {
      const targetPiece = boardState[newRow]
        ? boardState[newRow][newCol]
        : null;

      if (!targetPiece) {
        // Empty square - valid move
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: false,
          isPromotion: false,
        });
      } else if (
        isEnemy(boardState, newRow, newCol, pieceColor, eliminatedPlayers)
      ) {
        // Enemy piece - valid capture
        validMoves.push({
          row: newRow,
          col: newCol,
          isCapture: true,
          isPromotion: false,
        });
      }
      // Friendly piece - invalid move (not added to validMoves)
    }
  }

  return validMoves;
};

// Get valid moves for a king (with castling)
export const getKingMoves = (
  pieceCode: string,
  position: Position,
  boardState: (string | null)[][],
  eliminatedPlayers: string[] = [],
  hasMoved?: any,
  isKingInCheck?: (
    kingColor: string,
    boardState: (string | null)[][],
    eliminatedPlayers?: string[],
    hasMoved?: any
  ) => boolean,
  isSquareUnderAttack?: (
    boardState: (string | null)[][],
    row: number,
    col: number,
    defendingColor: string,
    eliminatedPlayers?: string[],
    hasMoved?: any
  ) => boolean
): MoveInfo[] => {
  const pieceColor = pieceCode[0];
  const validMoves: MoveInfo[] = [];

  // Get basic king moves first
  const basicMoves = getKingMovesWithoutCastling(
    pieceCode,
    position,
    boardState,
    eliminatedPlayers
  );
  validMoves.push(...basicMoves);

  // Add castling moves if king hasn't moved and not in check
  if (
    hasMoved &&
    !hasMoved[`${pieceColor}K` as keyof typeof hasMoved] &&
    isKingInCheck &&
    isSquareUnderAttack
  ) {
    // Check if king is in check (can't castle while in check)
    const inCheck = isKingInCheck(pieceColor, boardState, eliminatedPlayers);
    if (!inCheck) {
      // Check for castling opportunities
      if (pieceColor === "r") {
        // Red - bottom row
        // Kingside castling (right)
        if (
          !hasMoved.rR2 &&
          isEmpty(boardState, 13, 8) && // Intermediate square 1
          isEmpty(boardState, 13, 9) && // Intermediate square 2 (knight position)
          boardState[13] &&
          boardState[13][10] === "rR"
        ) {
          // Check if squares are not under attack
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            13,
            7,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            13,
            8,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 13,
              col: 9,
              isCapture: false,
              isPromotion: false,
            });
          }
        }
        // Queenside castling (left)
        if (
          !hasMoved.rR1 &&
          isEmpty(boardState, 13, 4) &&
          isEmpty(boardState, 13, 5) &&
          isEmpty(boardState, 13, 6) &&
          boardState[13] &&
          boardState[13][3] === "rR"
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            13,
            5,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            13,
            6,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 13,
              col: 5,
              isCapture: false,
              isPromotion: false,
            });
          }
        }
      } else if (pieceColor === "b") {
        // Blue - left column
        // Kingside castling (down) - King moves 2 squares down
        if (
          !hasMoved.bR2 &&
          isEmpty(boardState, 8, 0) && // Intermediate square 1
          isEmpty(boardState, 9, 0) && // Intermediate square 2 (knight position)
          boardState[10] &&
          boardState[10][0] === "bR" // Right rook at (10, 0)
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            7, // King's current position
            0,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            8, // King's intermediate square
            0,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 9, // King's destination (7 + 2)
              col: 0,
              isCapture: false,
              isPromotion: false,
            });
          }
        }
        // Queenside castling (up) - King moves 2 squares up
        if (
          !hasMoved.bR1 &&
          isEmpty(boardState, 4, 0) && // Intermediate square 1 (knight position)
          isEmpty(boardState, 5, 0) && // Intermediate square 2
          isEmpty(boardState, 6, 0) && // Intermediate square 3
          boardState[3] &&
          boardState[3][0] === "bR" // Left rook at (3, 0)
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            5, // King's destination (7 - 2)
            0,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            6, // King's intermediate square
            0,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 5, // King's destination (7 - 2)
              col: 0,
              isCapture: false,
              isPromotion: false,
            });
          }
        }
      } else if (pieceColor === "y") {
        // Yellow - top row
        // Queenside castling (right) - King moves 2 squares right
        if (
          !hasMoved.yR2 &&
          isEmpty(boardState, 0, 7) && // Intermediate square 1
          isEmpty(boardState, 0, 8) && // Intermediate square 2
          isEmpty(boardState, 0, 9) && // Intermediate square 3
          boardState[0] &&
          boardState[0][10] === "yR" // Right rook at (0, 10)
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            0,
            6, // King's current position (0, 6)
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            0,
            8, // King's intermediate square
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 0,
              col: 8, // King's destination (6 + 2)
              isCapture: false,
              isPromotion: false,
            });
          }
        }
        // Kingside castling (left) - King moves 2 squares left
        if (
          !hasMoved.yR1 &&
          isEmpty(boardState, 0, 4) && // Intermediate square 1
          isEmpty(boardState, 0, 5) && // Intermediate square 2
          boardState[0] &&
          boardState[0][3] === "yR" // Left rook at (0, 3)
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            0,
            4, // King's destination (6 - 2)
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            0,
            5, // King's intermediate square
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 0,
              col: 4, // King's destination (6 - 2)
              isCapture: false,
              isPromotion: false,
            });
          }
        }
      } else if (pieceColor === "g") {
        // Green - right column
        // Queenside castling (down) - King moves 2 squares down
        if (
          !hasMoved.gR2 &&
          isEmpty(boardState, 8, 13) && // Intermediate square 1
          isEmpty(boardState, 9, 13) && // Intermediate square 2
          boardState[10] &&
          boardState[10][13] === "gR" // Right rook at (10, 13)
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            6, // King's current position (6, 13)
            13,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            8, // King's intermediate square
            13,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 8, // King's destination (6 + 2)
              col: 13,
              isCapture: false,
              isPromotion: false,
            });
          }
        }
        // Kingside castling (up) - King moves 2 squares up
        if (
          !hasMoved.gR1 &&
          isEmpty(boardState, 4, 13) && // Intermediate square 1
          isEmpty(boardState, 5, 13) && // Intermediate square 2
          boardState[3] &&
          boardState[3][13] === "gR" // Left rook at (3, 13)
        ) {
          const square1UnderAttack = isSquareUnderAttack(
            boardState,
            4, // King's destination (6 - 2)
            13,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          const square2UnderAttack = isSquareUnderAttack(
            boardState,
            5, // King's intermediate square
            13,
            pieceColor,
            eliminatedPlayers,
            hasMoved
          );
          if (!square1UnderAttack && !square2UnderAttack) {
            validMoves.push({
              row: 4, // King's destination (6 - 2)
              col: 13,
              isCapture: false,
              isPromotion: false,
            });
          }
        }
      }
    }
  }

  return validMoves;
};
