import type { Bitboard } from "./bitboardUtils";
import { squareBit } from "./bitboardUtils";
import { generateAttackMap } from "./bitboardLogic";
import type { BitboardState, EnPassantTarget } from "../../state/types";

export type SerializedBitboardPieces = Record<string, string>;

const PIECE_CODES = [
  "rP", "rN", "rB", "rR", "rQ", "rK",
  "bP", "bN", "bB", "bR", "bQ", "bK",
  "yP", "yN", "yB", "yR", "yQ", "yK",
  "gP", "gN", "gB", "gR", "gQ", "gK",
] as const;

export const createEmptyPieceBitboards = (): Record<string, Bitboard> => {
  return PIECE_CODES.reduce((acc, code) => {
    acc[code] = 0n;
    return acc;
  }, {} as Record<string, Bitboard>);
};

const normalizePieces = (
  pieces: Record<string, Bitboard>,
  eliminatedPlayers: string[] = []
): Record<string, Bitboard> => {
  const normalized = createEmptyPieceBitboards();
  Object.entries(pieces || {}).forEach(([code, bb]) => {
    const color = code[0];
    normalized[code] = eliminatedPlayers.includes(color) ? 0n : bb;
  });
  return normalized;
};

export const serializeBitboardPieces = (
  pieces: Record<string, Bitboard>
): SerializedBitboardPieces => {
  const serialized: SerializedBitboardPieces = {};
  PIECE_CODES.forEach((code) => {
    const value = pieces?.[code] ?? 0n;
    serialized[code] = value.toString(16);
  });
  return serialized;
};

export const deserializeBitboardPieces = (
  serialized?: SerializedBitboardPieces | Record<string, Bitboard>
): Record<string, Bitboard> => {
  const pieces = createEmptyPieceBitboards();
  if (!serialized) return pieces;

  Object.entries(serialized).forEach(([code, value]) => {
    if (typeof value === "string") {
      pieces[code] = value ? BigInt(`0x${value}`) : 0n;
    } else {
      pieces[code] = value ?? 0n;
    }
  });

  return pieces;
};

export const rebuildBitboardStateFromPieces = (
  pieces: Record<string, Bitboard>,
  eliminatedPlayers: string[] = [],
  enPassantTargets: EnPassantTarget[] = []
): BitboardState => {
  const normalizedPieces = normalizePieces(pieces, eliminatedPlayers);
  let allPieces = 0n;
  let r = 0n;
  let b = 0n;
  let y = 0n;
  let g = 0n;

  Object.entries(normalizedPieces).forEach(([code, bb]) => {
    if (!bb || bb === 0n) return;
    allPieces |= bb;
    if (code[0] === "r") r |= bb;
    if (code[0] === "b") b |= bb;
    if (code[0] === "y") y |= bb;
    if (code[0] === "g") g |= bb;
  });

  const attackMaps = {
    r: eliminatedPlayers.includes("r") ? 0n : generateAttackMap("r", normalizedPieces, allPieces),
    b: eliminatedPlayers.includes("b") ? 0n : generateAttackMap("b", normalizedPieces, allPieces),
    y: eliminatedPlayers.includes("y") ? 0n : generateAttackMap("y", normalizedPieces, allPieces),
    g: eliminatedPlayers.includes("g") ? 0n : generateAttackMap("g", normalizedPieces, allPieces),
  };

  const enPassantTarget = enPassantTargets.reduce((mask, target) => {
    const bit = squareBit(target.position.row * 14 + target.position.col);
    return mask | bit;
  }, 0n as Bitboard);

  return {
    white: 0n,
    black: 0n,
    red: r,
    yellow: y,
    blue: b,
    green: g,
    r,
    b,
    y,
    g,
    allPieces,
    occupancy: allPieces,
    pieces: normalizedPieces,
    enPassantTarget,
    pinnedMask: 0n,
    attackMaps,
  };
};
