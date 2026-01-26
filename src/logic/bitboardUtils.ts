/**
 * 14x14 Bitboard Utilities
 * Playable squares: 160 (196 total - 36 corner squares)
 */

export type Bitboard = bigint;

export const BOARD_SIZE = 14;
export const TOTAL_SQUARES = 196;

export const SQUARE_BITS: Bitboard[] = Array.from(
  { length: TOTAL_SQUARES },
  (_, idx) => 1n << BigInt(idx)
);

export const squareBit = (idx: number): Bitboard => SQUARE_BITS[idx] ?? 0n;

// Precompute the playable mask (0 for 3x3 corners, 1 elsewhere)
export const PLAYABLE_MASK: Bitboard = (() => {
  let mask = 0n;
  for (let r = 0; r < 14; r++) {
    for (let c = 0; c < 14; c++) {
      const isCorner = (r < 3 || r > 10) && (c < 3 || c > 10);
      if (!isCorner) mask |= squareBit(r * 14 + c);
    }
  }
  return mask;
})();

// Masks for columns (Files) to prevent illegal wraps
export const FILE_A = (() => {
  let mask = 0n;
  for (let r = 0; r < 14; r++) mask |= squareBit(r * 14 + 0);
  return mask;
})();

export const FILE_B = FILE_A << 1n;
export const FILE_C = FILE_B << 1n; // Column 2
export const FILE_M = FILE_A << 12n; // Column 12
export const FILE_N = FILE_A << 13n; // Column 13 (Far right)
export const FILE_L = FILE_M >> 1n; // Column 11

// Combined masks for multi-square shifts (like Knights)
export const NOT_FILE_A = ~FILE_A;
export const NOT_FILE_N = ~FILE_N;
export const NOT_FILE_AB = ~(FILE_A | FILE_B);
export const NOT_FILE_MN = ~(FILE_M | FILE_N);
export const NOT_FILE_ABC = ~(FILE_A | FILE_B | FILE_C); // Far left protection
export const NOT_FILE_LMN = ~(FILE_L | FILE_M | FILE_N); // Far right protection

// Helper to convert board coordinates to bit index
export const toIdx = (r: number, c: number) => BigInt(r * 14 + c);

// Bitwise shifts for directions (Sparse 14x14 mapping)
export const shift = (bb: Bitboard, count: number): Bitboard => {
  if (count > 0) return (bb << BigInt(count)) & PLAYABLE_MASK;
  return (bb >> BigInt(Math.abs(count))) & PLAYABLE_MASK;
};

// Count Trailing Zeros (Finds the index of the first '1' bit)
// Optimized: Use binary search instead of linear scan - O(log n) instead of O(n)
export const ctz = (n: bigint): bigint => {
  if (n === 0n) return 0n;
  
  // Isolate lowest set bit: n & -n
  // Then count position using binary search
  let count = 0n;
  let isolated = n & -n;
  
  // Binary search through bit positions (up to 256 bits covers 196 squares)
  if ((isolated & 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFn) === 0n) { count += 128n; isolated >>= 128n; }
  if ((isolated & 0xFFFFFFFFFFFFFFFFn) === 0n) { count += 64n; isolated >>= 64n; }
  if ((isolated & 0xFFFFFFFFn) === 0n) { count += 32n; isolated >>= 32n; }
  if ((isolated & 0xFFFFn) === 0n) { count += 16n; isolated >>= 16n; }
  if ((isolated & 0xFFn) === 0n) { count += 8n; isolated >>= 8n; }
  if ((isolated & 0xFn) === 0n) { count += 4n; isolated >>= 4n; }
  if ((isolated & 0x3n) === 0n) { count += 2n; isolated >>= 2n; }
  if ((isolated & 0x1n) === 0n) { count += 1n; }
  
  return count;
};

// Bit Scan Forward: Equivalent to ctz
export const bitScanForward = ctz;

// Bit Scan Reverse: Finds the highest set bit
export const bitScanReverse = (n: bigint): bigint => {
  if (n === 0n) return 0n;
  return BigInt(n.toString(2).length - 1);
};

const maskRows = (rows: number[], cols: number[]): Bitboard => {
  let m = 0n;
  rows.forEach((r) => {
    cols.forEach((c) => {
      m |= squareBit(r * 14 + c);
    });
  });
  return m;
};

const maskCols = (cols: number[], rows: number[]): Bitboard => {
  let m = 0n;
  cols.forEach((c) => {
    rows.forEach((r) => {
      m |= squareBit(r * 14 + c);
    });
  });
  return m;
};

const BASE_ROWS = [3, 4, 5, 6, 7, 8, 9, 10];
const BASE_COLS = [3, 4, 5, 6, 7, 8, 9, 10];

export const PROMOTION_MASKS: Record<string, Bitboard> = {
  // Red: enemy bases (row 0, col 0, col 13) + mid board row 6
  r: maskRows([0, 6], BASE_COLS) | maskCols([0, 13], BASE_ROWS),
  // Yellow: enemy bases (row 13, col 0, col 13) + mid board row 7
  y: maskRows([13, 7], BASE_COLS) | maskCols([0, 13], BASE_ROWS),
  // Blue: enemy bases (row 0, row 13, col 13) + mid board col 7
  b: maskCols([13, 7], BASE_ROWS) | maskRows([0, 13], BASE_COLS),
  // Green: enemy bases (row 0, row 13, col 0) + mid board col 6
  g: maskCols([0, 6], BASE_ROWS) | maskRows([0, 13], BASE_COLS),
};

const DIR_INDEX: Record<number, number> = {
  [-14]: 0, // N
  [14]: 1, // S
  [1]: 2, // E
  [-1]: 3, // W
  [-13]: 4, // NE
  [-15]: 5, // NW
  [15]: 6, // SE
  [13]: 7, // SW
};

export const getSlidingAttacks = (
  square: number,
  occupancy: bigint,
  directions: number[]
): bigint => {
  let attacks = 0n;
  for (const dir of directions) {
    const dirIdx = DIR_INDEX[dir];
    if (dirIdx === undefined) continue;

    const ray = RAY_MASKS[square][dirIdx];
    const blockers = ray & occupancy;
    if (blockers === 0n) {
      attacks |= ray;
      continue;
    }

    const firstBlocker =
      dir > 0
        ? Number(bitScanForward(blockers))
        : Number(bitScanReverse(blockers));
    attacks |= ray ^ RAY_MASKS[firstBlocker][dirIdx];
  }
  return attacks;
};

// Directions for 14x14
export const ROOK_DIRS = [1, -1, 14, -14];
export const BISHOP_DIRS = [13, 15, -13, -15];

/**
 * Get piece code at a specific position from bitboards
 * Returns null if no piece at that position
 */
export const getPieceAtFromBitboard = (
  pieces: Record<string, Bitboard>,
  row: number,
  col: number
): string | null => {
  const sqBit = squareBit(row * 14 + col);
  for (const [pieceCode, bb] of Object.entries(pieces)) {
    if (bb && (bb & sqBit) !== 0n) {
      return pieceCode;
    }
  }
  return null;
};

/**
 * Convert bitboard state to 14x14 array for UI rendering
 * This derives the array board from bitboards (single source of truth)
 */
export const bitboardToArray = (
  pieces: Record<string, Bitboard>,
  overlayPieces?: Record<string, Bitboard>
): (string | null)[][] => {
  // Initialize 14x14 board with nulls
  const board: (string | null)[][] = Array.from({ length: 14 }, () =>
    Array(14).fill(null)
  );

  // Optional overlay (e.g. eliminated pieces) placed first
  if (overlayPieces) {
    for (const [pieceCode, bb] of Object.entries(overlayPieces)) {
      if (!bb || bb === 0n) continue;

      let temp = bb;
      while (temp > 0n) {
        const sqIdx = Number(bitScanForward(temp));
        const row = Math.floor(sqIdx / 14);
        const col = sqIdx % 14;
        board[row][col] = pieceCode;
        temp &= temp - 1n; // Clear lowest bit
      }
    }
  }

  // Iterate through all piece types and place them on the board
  // Live pieces override overlay visuals when occupying same square
  for (const [pieceCode, bb] of Object.entries(pieces)) {
    if (!bb || bb === 0n) continue;

    let temp = bb;
    while (temp > 0n) {
      const sqIdx = Number(bitScanForward(temp));
      const row = Math.floor(sqIdx / 14);
      const col = sqIdx % 14;
      board[row][col] = pieceCode;
      temp &= temp - 1n; // Clear lowest bit
    }
  }

  return board;
};

// Precomputed Ray Masks for 14x14 board
// Index 0-195 for squares, 0-7 for directions: [N, S, E, W, NE, NW, SE, SW]
export const RAY_MASKS: Bitboard[][] = (() => {
  const rays: Bitboard[][] = Array.from({ length: 196 }, () => []);
  const directions = [-14, 14, 1, -1, -13, -15, 15, 13];

  for (let sq = 0; sq < 196; sq++) {
    const r = Math.floor(sq / 14);
    const c = sq % 14;

    directions.forEach((dir, dirIdx) => {
      let currentRay = 0n;
      let currR = r;
      let currC = c;

      while (true) {
        if (dir === -14) currR--; // North
        else if (dir === 14) currR++; // South
        else if (dir === 1) currC++; // East
        else if (dir === -1) currC--; // West
        else if (dir === -13) {
          currR--;
          currC++;
        } // NE
        else if (dir === -15) {
          currR--;
          currC--;
        } // NW
        else if (dir === 15) {
          currR++;
          currC++;
        } // SE
        else if (dir === 13) {
          currR++;
          currC--;
        } // SW

        if (currR < 0 || currR >= 14 || currC < 0 || currC >= 14) break;

        const isCorner = (currR < 3 || currR > 10) && (currC < 3 || currC > 10);
        if (isCorner) break; // stop rays through unusable 3x3 corners

        currentRay |= squareBit(currR * 14 + currC);
      }
      rays[sq][dirIdx] = currentRay & PLAYABLE_MASK;
    });
  }
  return rays;
})();
