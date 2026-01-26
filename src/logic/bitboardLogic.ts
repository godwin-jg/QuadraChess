import type { GameState } from "../../state/types";
import { turnOrder } from "../../state/types";
import {
  Bitboard,
  PLAYABLE_MASK,
  RAY_MASKS,
  NOT_FILE_A,
  NOT_FILE_AB,
  NOT_FILE_MN,
  NOT_FILE_N,
  bitScanForward,
  bitScanReverse,
  shift,
  squareBit,
} from "./bitboardUtils";

export const isKingInCheck = (kingColor: string, state: GameState): boolean => {
  const kingBit = state.bitboardState.pieces[`${kingColor}K`] ?? 0n;

  let enemyAttacks = 0n;
  for (const player of turnOrder) {
    if (player !== kingColor && !state.eliminatedPlayers.includes(player)) {
      enemyAttacks |= state.bitboardState.attackMaps[player];
    }
  }

  return (kingBit & enemyAttacks) !== 0n;
};

const DIR_DELTAS = [-14, 14, 1, -1, -13, -15, 15, 13];

const getFirstBlockerIndex = (
  blockers: Bitboard,
  dirIdx: number
): number | null => {
  if (blockers === 0n) return null;
  const delta = DIR_DELTAS[dirIdx];
  return delta > 0
    ? Number(bitScanForward(blockers))
    : Number(bitScanReverse(blockers));
};

const getSlidingAttacks = (
  sq: number,
  occupancy: Bitboard,
  dirIdx: number
): Bitboard => {
  const ray = RAY_MASKS[sq][dirIdx];
  const blockers = ray & occupancy;
  if (blockers === 0n) return ray;

  // Choose the nearest blocker along the direction:
  // - Positive deltas (S, E, SE, SW) -> lowest index on the ray
  // - Negative deltas (N, W, NE, NW) -> highest index on the ray
  const delta = DIR_DELTAS[dirIdx];
  const firstBlocker =
    delta > 0
      ? Number(bitScanForward(blockers))
      : Number(bitScanReverse(blockers));

  return ray ^ RAY_MASKS[firstBlocker][dirIdx];
};

const getPawnAttacksWithTurns = (
  color: string,
  pawns: Bitboard
): Bitboard => {
  let attacks = 0n;
  let temp = pawns;

  const addAttack = (row: number, col: number) => {
    if (row < 0 || row >= 14 || col < 0 || col >= 14) return;
    const bit = squareBit(row * 14 + col);
    if ((bit & PLAYABLE_MASK) !== 0n) {
      attacks |= bit;
    }
  };

  while (temp > 0n) {
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

    temp &= temp - 1n;
  }

  return attacks;
};

export const generateAttackMap = (
  color: string,
  pieces: Record<string, Bitboard>,
  occupancy: Bitboard
): Bitboard => {
  let attacks = 0n;

  const pawns = pieces[`${color}P`] ?? 0n;
  attacks |= getPawnAttacksWithTurns(color, pawns);

  const knights = pieces[`${color}N`] ?? 0n;
  const east2 = knights & NOT_FILE_MN;
  const west2 = knights & NOT_FILE_AB;
  const east1 = knights & NOT_FILE_N;
  const west1 = knights & NOT_FILE_A;

  attacks |= shift(east2, -12);
  attacks |= shift(east2, 16);
  attacks |= shift(west2, -16);
  attacks |= shift(west2, 12);
  attacks |= shift(east1, -27);
  attacks |= shift(east1, 29);
  attacks |= shift(west1, -29);
  attacks |= shift(west1, 27);

  const king = pieces[`${color}K`] ?? 0n;
  const north = shift(king, -14);
  const south = shift(king, 14);
  const east = shift(king & NOT_FILE_N, 1);
  const west = shift(king & NOT_FILE_A, -1);
  const ne = shift(king & NOT_FILE_N, -13);
  const nw = shift(king & NOT_FILE_A, -15);
  const se = shift(king & NOT_FILE_N, 15);
  const sw = shift(king & NOT_FILE_A, 13);
  attacks |= north | south | east | west | ne | nw | se | sw;

  const sliders = [
    { type: "R", dirs: [0, 1, 2, 3] },
    { type: "B", dirs: [4, 5, 6, 7] },
    { type: "Q", dirs: [0, 1, 2, 3, 4, 5, 6, 7] },
  ];

  sliders.forEach(({ type, dirs }) => {
    let bb = pieces[`${color}${type}`] ?? 0n;
    while (bb > 0n) {
      const sq = Number(bitScanForward(bb));
      dirs.forEach((d) => {
        attacks |= getSlidingAttacks(sq, occupancy, d);
      });
      bb &= bb - 1n;
    }
  });

  return attacks & PLAYABLE_MASK;
};

export const getPinnedPiecesMask = (
  state: GameState,
  color: string
): Bitboard => {
  const kingBB = state.bitboardState.pieces[`${color}K`] ?? 0n;
  if (kingBB === 0n) return 0n;
  const kingSqIdx = Number(bitScanForward(kingBB));
  let pinnedMask = 0n;

  const occupancy =
    state.bitboardState.occupancy ?? state.bitboardState.allPieces;
  const friendly =
    state.bitboardState[color as "r" | "b" | "y" | "g"];
  const enemyColors = turnOrder.filter(
    (c) => c !== color && !state.eliminatedPlayers.includes(c)
  );

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

  for (let dirIdx = 0; dirIdx < 8; dirIdx += 1) {
    const ray = RAY_MASKS[kingSqIdx][dirIdx];
    const blockers = ray & occupancy;
    const firstBlockerIdx = getFirstBlockerIndex(blockers, dirIdx);
    if (firstBlockerIdx === null) continue;

    const firstBlockerBit = squareBit(firstBlockerIdx);
    if ((firstBlockerBit & friendly) === 0n) continue;

    const rayBeyond = RAY_MASKS[firstBlockerIdx][dirIdx];
    const blockersBeyond = rayBeyond & occupancy;
    const secondBlockerIdx = getFirstBlockerIndex(blockersBeyond, dirIdx);
    if (secondBlockerIdx === null) continue;

    const secondBlockerBit = squareBit(secondBlockerIdx);
    const enemySliderMask = dirIdx >= 4 ? enemyBishopsQueens : enemyRooksQueens;
    if ((secondBlockerBit & enemySliderMask) !== 0n) {
      pinnedMask |= firstBlockerBit;
    }
  }

  return pinnedMask;
};
