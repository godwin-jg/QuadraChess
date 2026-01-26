import type { GameState } from "../../state/types";
import { turnOrder } from "../../state/types";
import type { MoveInfo } from "../../types";
import {
  Bitboard,
  RAY_MASKS,
  bitScanForward,
  bitScanReverse,
  NOT_FILE_A,
  NOT_FILE_AB,
  NOT_FILE_ABC,
  NOT_FILE_MN,
  NOT_FILE_LMN,
  NOT_FILE_N,
  PLAYABLE_MASK,
  PROMOTION_MASKS,
  squareBit,
  shift,
  ROOK_DIRS,
  BISHOP_DIRS,
  getSlidingAttacks,
} from "./bitboardUtils";
export const getKnightAttacks = (knights: bigint): bigint => {
  let l1 = (knights >> BigInt(15)) & NOT_FILE_N; // Up 1, Left 2
  let l2 = (knights >> BigInt(13)) & NOT_FILE_A; // Up 1, Right 2
  let l3 = (knights >> BigInt(30)) & NOT_FILE_MN; // Up 2, Left 1
  let l4 = (knights >> BigInt(26)) & NOT_FILE_AB; // Up 2, Right 1

  let r1 = (knights << BigInt(15)) & NOT_FILE_A; // Down 1, Right 2
  let r2 = (knights << BigInt(13)) & NOT_FILE_N; // Down 1, Left 2
  let r3 = (knights << BigInt(30)) & NOT_FILE_AB; // Down 2, Right 1
  let r4 = (knights << BigInt(26)) & NOT_FILE_MN; // Down 2, Left 1

  return (l1 | l2 | l3 | l4 | r1 | r2 | r3 | r4) & PLAYABLE_MASK;
};

export const getPawnAttacksBB = (color: string, pawns: bigint): bigint => {
  let attacks = BigInt(0);
  let temp = pawns;

  const addAttack = (row: number, col: number) => {
    if (row < 0 || row >= 14 || col < 0 || col >= 14) return;
    const bit = squareBit(row * 14 + col);
    if ((bit & PLAYABLE_MASK) !== BigInt(0)) {
      attacks |= bit;
    }
  };

  while (temp > BigInt(0)) {
    const sq = Number(bitScanForward(temp));
    const row = Math.floor(sq / 14);
    const col = sq % 14;

    switch (color) {
      case "r":
        addAttack(row - 1, col - 1);
        addAttack(row - 1, col + 1);
        break;
      case "y":
        addAttack(row + 1, col - 1);
        addAttack(row + 1, col + 1);
        break;
      case "b":
        addAttack(row - 1, col + 1);
        addAttack(row + 1, col + 1);
        break;
      case "g":
        addAttack(row - 1, col - 1);
        addAttack(row + 1, col - 1);
        break;
      default:
        break;
    }

    temp &= temp - BigInt(1);
  }

  return attacks & PLAYABLE_MASK;
};

const getEnemyEnPassantMask = (state: GameState, color: string): Bitboard => {
  if (!state.enPassantTargets || state.enPassantTargets.length === 0) {
    return 0n;
  }

  return state.enPassantTargets.reduce((mask, target) => {
    if (target.createdBy.charAt(0) !== color) {
      const { row, col } = target.position;
      return mask | squareBit(row * 14 + col);
    }
    return mask;
  }, 0n as Bitboard);
};

export const getPseudoLegalMovesBB = (
  pieceCode: string,
  position: { row: number; col: number },
  state: GameState
): Bitboard => {
  const color = pieceCode[0];
  const type = pieceCode[1];
  const sq = position.row * 14 + position.col;
  const sqBit = squareBit(sq);

  const friends = state.bitboardState[color as "r" | "b" | "y" | "g"];
  const occupancy = state.bitboardState.allPieces;
  const enemies = occupancy & ~friends;
  const enemyAttacks = ["r", "b", "y", "g"].reduce((acc, c) => {
    if (c !== color && !state.eliminatedPlayers.includes(c)) {
      return acc | state.bitboardState.attackMaps[c as "r" | "b" | "y" | "g"];
    }
    return acc;
  }, 0n);
  const enPassantTarget = getEnemyEnPassantMask(state, color);

  let moves = 0n;

  switch (type) {
    case "P": // Pawn Logic (Directional)
      if (color === "r") {
        // Red moves up (negative row)
        const forward = shift(sqBit, -14);
        if (forward && !(forward & occupancy)) {
          moves |= forward;
          // Initial double move
          if (position.row === 12 && !(shift(forward, -14) & occupancy)) {
            moves |= shift(forward, -14);
          }
        }
        // Captures
        const ne = shift(sqBit & NOT_FILE_N, -13);
        const nw = shift(sqBit & NOT_FILE_A, -15);
        moves |= (ne | nw) & enemies;
        moves |= (ne | nw) & enPassantTarget;
      } else if (color === "y") {
        // Yellow moves down (positive row)
        const forward = shift(sqBit, 14);
        if (forward && !(forward & occupancy)) {
          moves |= forward;
          if (position.row === 1 && !(shift(forward, 14) & occupancy)) {
            moves |= shift(forward, 14);
          }
        }
        const se = shift(sqBit & NOT_FILE_N, 15);
        const sw = shift(sqBit & NOT_FILE_A, 13);
        moves |= (se | sw) & enemies;
        moves |= (se | sw) & enPassantTarget;
      } else if (color === "b") {
        // Blue moves right (positive col)
        const blueMask = NOT_FILE_N;
        const forward = shift(sqBit & blueMask, 1);
        if (forward && !(forward & occupancy)) {
          moves |= forward;
          if (position.col === 1 && !(shift(forward & blueMask, 1) & occupancy)) {
            moves |= shift(forward & blueMask, 1);
          }
        }
        const ne = shift(sqBit & blueMask, -13);
        const se = shift(sqBit & blueMask, 15);
        moves |= (ne | se) & enemies;
        moves |= (ne | se) & enPassantTarget;
      } else if (color === "g") {
        // Green moves left (negative col)
        const greenMask = NOT_FILE_A;
        const forward = shift(sqBit & greenMask, -1);
        if (forward && !(forward & occupancy)) {
          moves |= forward;
          if (position.col === 12 && !(shift(forward & greenMask, -1) & occupancy)) {
            moves |= shift(forward & greenMask, -1);
          }
        }
        const nw = shift(sqBit & greenMask, -15);
        const sw = shift(sqBit & greenMask, 13);
        moves |= (nw | sw) & enemies;
        moves |= (nw | sw) & enPassantTarget;
      }
      break;

    case "N": {
      // Knight Logic (The fastest)
      const east2 = sqBit & NOT_FILE_MN;
      const west2 = sqBit & NOT_FILE_AB;
      const east1 = sqBit & NOT_FILE_N;
      const west1 = sqBit & NOT_FILE_A;

      moves |= shift(east2, -12);
      moves |= shift(east2, 16);
      moves |= shift(west2, -16);
      moves |= shift(west2, 12);
      moves |= shift(east1, -27);
      moves |= shift(east1, 29);
      moves |= shift(west1, -29);
      moves |= shift(west1, 27);

      moves &= ~friends; // Cannot land on friends
      break;
    }

    case "B": // Bishop (Sliding)
      BISHOP_DIRS.forEach((dir) => {
        moves |= getSlidingAttacks(sq, occupancy, [dir]) & ~friends;
      });
      break;

    case "R": // Rook (Sliding)
      ROOK_DIRS.forEach((dir) => {
        moves |= getSlidingAttacks(sq, occupancy, [dir]) & ~friends;
      });
      break;

    case "Q": // Queen (Combined)
      [...ROOK_DIRS, ...BISHOP_DIRS].forEach((dir) => {
        moves |= getSlidingAttacks(sq, occupancy, [dir]) & ~friends;
      });
      break;

    case "K": {
      // King
      const north = shift(sqBit, -14);
      const south = shift(sqBit, 14);
      const east = shift(sqBit & NOT_FILE_N, 1);
      const west = shift(sqBit & NOT_FILE_A, -1);
      const ne = shift(sqBit & NOT_FILE_N, -13);
      const nw = shift(sqBit & NOT_FILE_A, -15);
      const se = shift(sqBit & NOT_FILE_N, 15);
      const sw = shift(sqBit & NOT_FILE_A, 13);

      moves |= north | south | east | west | ne | nw | se | sw;
      moves &= ~friends;
      
      // ✅ FIX: Calculate enemy attacks with King REMOVED from occupancy
      // This handles "X-ray attacks" - squares that enemy sliders would attack
      // if the King wasn't blocking them
      const occupancyWithoutKing = occupancy ^ sqBit;
      let xrayEnemyAttacks = 0n;
      
      turnOrder
        .filter((p) => p !== color && !state.eliminatedPlayers.includes(p))
        .forEach((enemy) => {
          // Get slider pieces that might have X-ray attacks through the King
          const enemyRooks = state.bitboardState.pieces[`${enemy}R`] ?? 0n;
          const enemyBishops = state.bitboardState.pieces[`${enemy}B`] ?? 0n;
          const enemyQueens = state.bitboardState.pieces[`${enemy}Q`] ?? 0n;
          
          // Recalculate slider attacks with King removed
          let tempSlider = enemyRooks | enemyQueens;
          while (tempSlider > 0n) {
            const sliderSq = Number(bitScanForward(tempSlider));
            ROOK_DIRS.forEach((dir) => {
              xrayEnemyAttacks |= getSlidingAttacks(sliderSq, occupancyWithoutKing, [dir]);
            });
            tempSlider &= tempSlider - 1n;
          }
          
          tempSlider = enemyBishops | enemyQueens;
          while (tempSlider > 0n) {
            const sliderSq = Number(bitScanForward(tempSlider));
            BISHOP_DIRS.forEach((dir) => {
              xrayEnemyAttacks |= getSlidingAttacks(sliderSq, occupancyWithoutKing, [dir]);
            });
            tempSlider &= tempSlider - 1n;
          }
          
          // Also include non-slider attacks (pawns, knights, kings)
          xrayEnemyAttacks |= state.bitboardState.attackMaps[enemy as "r" | "b" | "y" | "g"];
        });
      
      moves &= ~xrayEnemyAttacks;

      // ✅ BITBOARD ONLY: Castling uses bitboards for emptiness + hasMoved flags
      const hasMoved = state.hasMoved;
      const inCheck = (sqBit & enemyAttacks) !== 0n;
      const pieces = state.bitboardState.pieces;
      
      // Helper: check if square is empty using occupancy
      const isEmpty = (row: number, col: number) => (occupancy & squareBit(row * 14 + col)) === 0n;
      // Helper: check if specific piece is at position
      const hasRook = (rookCode: string, row: number, col: number) => 
        ((pieces[rookCode] ?? 0n) & squareBit(row * 14 + col)) !== 0n;

      if (hasMoved && !hasMoved[`${color}K` as keyof typeof hasMoved] && !inCheck) {
        if (color === "r") {
          // Kingside
          if (
            !hasMoved.rR2 &&
            isEmpty(13, 8) &&
            isEmpty(13, 9) &&
            hasRook("rR", 13, 10)
          ) {
            const sq1 = squareBit(13 * 14 + 8) & enemyAttacks;
            const sq2 = squareBit(13 * 14 + 9) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(13 * 14 + 9);
            }
          }
          // Queenside
          if (
            !hasMoved.rR1 &&
            isEmpty(13, 4) &&
            isEmpty(13, 5) &&
            isEmpty(13, 6) &&
            hasRook("rR", 13, 3)
          ) {
            const sq1 = squareBit(13 * 14 + 5) & enemyAttacks;
            const sq2 = squareBit(13 * 14 + 6) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(13 * 14 + 5);
            }
          }
        } else if (color === "b") {
          // Kingside (down)
          if (
            !hasMoved.bR2 &&
            isEmpty(8, 0) &&
            isEmpty(9, 0) &&
            hasRook("bR", 10, 0)
          ) {
            const sq1 = squareBit(8 * 14 + 0) & enemyAttacks;
            const sq2 = squareBit(9 * 14 + 0) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(9 * 14 + 0);
            }
          }
          // Queenside (up)
          if (
            !hasMoved.bR1 &&
            isEmpty(4, 0) &&
            isEmpty(5, 0) &&
            isEmpty(6, 0) &&
            hasRook("bR", 3, 0)
          ) {
            const sq1 = squareBit(5 * 14 + 0) & enemyAttacks;
            const sq2 = squareBit(6 * 14 + 0) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(5 * 14 + 0);
            }
          }
        } else if (color === "y") {
          // Right (to col 8)
          if (
            !hasMoved.yR2 &&
            isEmpty(0, 7) &&
            isEmpty(0, 8) &&
            isEmpty(0, 9) &&
            hasRook("yR", 0, 10)
          ) {
            const sq1 = squareBit(0 * 14 + 7) & enemyAttacks;
            const sq2 = squareBit(0 * 14 + 8) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(0 * 14 + 8);
            }
          }
          // Left (to col 4)
          if (
            !hasMoved.yR1 &&
            isEmpty(0, 4) &&
            isEmpty(0, 5) &&
            hasRook("yR", 0, 3)
          ) {
            const sq1 = squareBit(0 * 14 + 4) & enemyAttacks;
            const sq2 = squareBit(0 * 14 + 5) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(0 * 14 + 4);
            }
          }
        } else if (color === "g") {
          // Down (to row 8)
          if (
            !hasMoved.gR2 &&
            isEmpty(8, 13) &&
            isEmpty(9, 13) &&
            hasRook("gR", 10, 13)
          ) {
            const sq1 = squareBit(7 * 14 + 13) & enemyAttacks;
            const sq2 = squareBit(8 * 14 + 13) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(8 * 14 + 13);
            }
          }
          // Up (to row 4)
          if (
            !hasMoved.gR1 &&
            isEmpty(4, 13) &&
            isEmpty(5, 13) &&
            hasRook("gR", 3, 13)
          ) {
            const sq1 = squareBit(4 * 14 + 13) & enemyAttacks;
            const sq2 = squareBit(5 * 14 + 13) & enemyAttacks;
            if (sq1 === 0n && sq2 === 0n) {
              moves |= squareBit(4 * 14 + 13);
            }
          }
        }
      }
      break;
    }
  }

  return moves & PLAYABLE_MASK;
};

const OPPOSITE_DIR = [1, 0, 3, 2, 7, 6, 5, 4];

const getRayConnecting = (sq1: number, sq2: number): Bitboard => {
  for (let d = 0; d < 8; d++) {
    const ray = RAY_MASKS[sq1][d];
    if ((ray & squareBit(sq2)) !== 0n) {
      const oppositeDir = OPPOSITE_DIR[d];
      return (
        ray |
        RAY_MASKS[sq1][oppositeDir] |
        squareBit(sq1) |
        squareBit(sq2)
      );
    }
  }
  return 0n;
};

const getCheckerMask = (state: GameState, color: string): Bitboard => {
  const kingBB = state.bitboardState.pieces[`${color}K`] ?? 0n;
  if (kingBB === 0n) return 0n;
  const kingSq = Number(bitScanForward(kingBB));
  let mask = 0n;
  let checkers = 0;

  const occupancy = state.bitboardState.occupancy ?? state.bitboardState.allPieces;
  const enemyColors = turnOrder.filter(
    (enemy) => enemy !== color && !state.eliminatedPlayers.includes(enemy)
  );

  const addChecker = (checkerBit: Bitboard, rayMask?: Bitboard) => {
    checkers += 1;
    if (checkers > 1) return;
    mask |= checkerBit;
    if (rayMask) {
      mask |= rayMask;
    }
  };

  // Knight checkers
  let enemyKnights = 0n;
  enemyColors.forEach((enemy) => {
    enemyKnights |= state.bitboardState.pieces[`${enemy}N`] ?? 0n;
  });
  const knightAttackers = getKnightAttacks(kingBB) & enemyKnights;
  let tempKnights = knightAttackers;
  while (tempKnights > 0n) {
    const sq = Number(bitScanForward(tempKnights));
    const bit = squareBit(sq);
    addChecker(bit);
    if (checkers > 1) return 0n;
    tempKnights &= tempKnights - 1n;
  }

  // Pawn checkers
  for (const enemy of enemyColors) {
    let pawns = state.bitboardState.pieces[`${enemy}P`] ?? 0n;
    while (pawns > 0n) {
      const sq = Number(bitScanForward(pawns));
      const pawnBit = squareBit(sq);
      if (getPawnAttacksBB(enemy, pawnBit) & kingBB) {
        addChecker(pawnBit);
        if (checkers > 1) return 0n;
      }
      pawns &= pawns - 1n;
    }
  }

  // Slider checkers
  let enemyRooksQueens = 0n;
  let enemyBishopsQueens = 0n;
  enemyColors.forEach((enemy) => {
    enemyRooksQueens |=
      (state.bitboardState.pieces[`${enemy}R`] ?? 0n) |
      (state.bitboardState.pieces[`${enemy}Q`] ?? 0n);
    enemyBishopsQueens |=
      (state.bitboardState.pieces[`${enemy}B`] ?? 0n) |
      (state.bitboardState.pieces[`${enemy}Q`] ?? 0n);
  });

  const directions = [
    { idx: 0, slider: enemyRooksQueens }, // N
    { idx: 1, slider: enemyRooksQueens }, // S
    { idx: 2, slider: enemyRooksQueens }, // E
    { idx: 3, slider: enemyRooksQueens }, // W
    { idx: 4, slider: enemyBishopsQueens }, // NE
    { idx: 5, slider: enemyBishopsQueens }, // NW
    { idx: 6, slider: enemyBishopsQueens }, // SE
    { idx: 7, slider: enemyBishopsQueens }, // SW
  ];

  for (const { idx, slider } of directions) {
    const ray = RAY_MASKS[kingSq][idx];
    const blockers = ray & occupancy;
    if (blockers === 0n) continue;

    const useForward = idx === 1 || idx === 2 || idx === 6 || idx === 7;
    const blockerIdx = useForward
      ? Number(bitScanForward(blockers))
      : Number(bitScanReverse(blockers));
    const blockerBit = squareBit(blockerIdx);

    if ((blockerBit & slider) !== 0n) {
      const rayToBlocker = ray ^ RAY_MASKS[blockerIdx][idx];
      addChecker(blockerBit, rayToBlocker);
      if (checkers > 1) return 0n;
    }
  }

  if (checkers === 0) return -1n;
  if (checkers > 1) return 0n;
  return mask;
};

export const getValidMovesBB = (
  pieceCode: string,
  position: { row: number; col: number },
  state: GameState
): Bitboard => {
  if (!pieceCode || pieceCode.length < 2) return 0n;
  const pieceColor = pieceCode[0];
  const pieceBit = squareBit(position.row * 14 + position.col);

  if (state.eliminatedPlayers.includes(pieceColor)) {
    return 0n;
  }

  let moves = getPseudoLegalMovesBB(pieceCode, position, state);
  const pinnedMask = state.bitboardState.pinnedMask ?? 0n;

  if ((pieceBit & pinnedMask) !== 0n) {
    const kingBB = state.bitboardState.pieces[`${pieceColor}K`] ?? 0n;
    if (kingBB !== 0n) {
      const kingSqIdx = Number(bitScanForward(kingBB));
      moves &= getRayConnecting(position.row * 14 + position.col, kingSqIdx);
    }
  }

  // ✅ FIX: Only apply checker mask to non-King pieces
  // The King can move to any safe square (already filtered in pseudo-legal)
  // Other pieces must block or capture the checker
  if (state.checkStatus[pieceColor as "r" | "b" | "y" | "g"] && pieceCode[1] !== "K") {
    const checkerMask = getCheckerMask(state, pieceColor);
    if (checkerMask !== -1n) {
      moves &= checkerMask;
    }
  }

  return moves;
};

export const isValidMove = (
  pieceCode: string,
  from: { row: number; col: number },
  target: { row: number; col: number },
  state: GameState
): boolean => {
  if (!pieceCode || pieceCode.length < 2) return false;
  const movesBB = getValidMovesBB(pieceCode, from, state);
  const targetBit = squareBit(target.row * 14 + target.col);
  return (movesBB & targetBit) !== 0n;
};

export const bitboardToMoveInfo = (
  movesBB: bigint,
  color: string,
  pieceType: string,
  state: GameState
): MoveInfo[] => {
  const moves: MoveInfo[] = [];
  // Use a temporary bitboard so we don't mutate the original
  let tempBB = movesBB & PLAYABLE_MASK;
  const occupancy = state.bitboardState.occupancy ?? state.bitboardState.allPieces;
  const enemyBits =
    occupancy & ~state.bitboardState[color as "r" | "b" | "y" | "g"];
  const enPassantTarget = getEnemyEnPassantMask(state, color);

  while (tempBB !== 0n) {
    // Find the index of the lowest set bit using fast bitScanForward
    const bitIdx = Number(bitScanForward(tempBB));
    const row = Math.floor(bitIdx / 14);
    const col = bitIdx % 14;

    const targetBit = squareBit(Number(bitIdx));
    const isEnPassant =
      pieceType === "P" &&
      (targetBit & enPassantTarget) !== 0n;
    const isCapture = (targetBit & enemyBits) !== 0n || isEnPassant;
    const isPromotion =
      pieceType === "P" &&
      (targetBit & PROMOTION_MASKS[color]) !== 0n;

    moves.push({
      row,
      col,
      isCapture,
      isPromotion,
      isEnPassant,
    });

    // Clear the bit we just processed
    tempBB &= tempBB - 1n;
  }
  return moves;
};
