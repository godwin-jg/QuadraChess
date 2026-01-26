import { BOARD_CONFIG } from "../../../config/gameConfig";

export type PieceCode = string;
export type Key = number;
export type Pos = [number, number];
export type NumberPair = [number, number];
export type AnimVector = [number, number, number, number];
export type AnimVectors = Map<Key, AnimVector>;
export type AnimFadings = Map<Key, PieceCode>;

export interface AnimPlan {
  anims: AnimVectors;
  fadings: AnimFadings;
}

interface AnimPiece {
  key: Key;
  pos: Pos;
  piece: PieceCode;
}

const BOARD_SIZE = BOARD_CONFIG.ROWS;
const allKeys: Key[] = Array.from(
  { length: BOARD_SIZE * BOARD_SIZE },
  (_, index) => index
);

const keyToPos = (key: Key): Pos => [key % BOARD_SIZE, Math.floor(key / BOARD_SIZE)];

const distanceSq = (a: Pos, b: Pos): number => {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return dx * dx + dy * dy;
};

const samePiece = (a: PieceCode, b: PieceCode): boolean => a === b;

const makePiece = (key: Key, piece: PieceCode): AnimPiece => ({
  key,
  pos: keyToPos(key),
  piece,
});

const closer = (piece: AnimPiece, pieces: AnimPiece[]): AnimPiece | undefined => {
  if (pieces.length === 0) return undefined;
  let closest = pieces[0];
  let minDist = distanceSq(piece.pos, closest.pos);
  for (let i = 1; i < pieces.length; i++) {
    const dist = distanceSq(piece.pos, pieces[i].pos);
    if (dist < minDist) {
      minDist = dist;
      closest = pieces[i];
    }
  }
  return closest;
};

export const buildPiecesMap = (boardState: (string | null)[][]): Map<Key, PieceCode> => {
  const pieces = new Map<Key, PieceCode>();
  for (let row = 0; row < boardState.length; row++) {
    const rowData = boardState[row];
    if (!Array.isArray(rowData)) continue;
    for (let col = 0; col < rowData.length; col++) {
      const piece = rowData[col];
      if (!piece) continue;
      pieces.set(row * BOARD_SIZE + col, piece);
    }
  }
  return pieces;
};

export const computeAnimPlan = (
  prevPieces: Map<Key, PieceCode>,
  currentPieces: Map<Key, PieceCode>
): AnimPlan => {
  const anims: AnimVectors = new Map();
  const animedOrigs: Key[] = [];
  const fadings: AnimFadings = new Map();
  const missings: AnimPiece[] = [];
  const news: AnimPiece[] = [];
  const prePieces: Map<Key, AnimPiece> = new Map();

  for (const [k, p] of prevPieces) {
    prePieces.set(k, makePiece(k, p));
  }

  let curP: PieceCode | undefined;
  let preP: AnimPiece | undefined;
  let vector: NumberPair;

  for (const key of allKeys) {
    curP = currentPieces.get(key);
    preP = prePieces.get(key);
    if (curP) {
      if (preP) {
        if (!samePiece(curP, preP.piece)) {
          missings.push(preP);
          news.push(makePiece(key, curP));
        }
      } else {
        news.push(makePiece(key, curP));
      }
    } else if (preP) {
      missings.push(preP);
    }
  }

  for (const newP of news) {
    preP = closer(
      newP,
      missings.filter((p) => samePiece(newP.piece, p.piece))
    );
    if (preP) {
      vector = [preP.pos[0] - newP.pos[0], preP.pos[1] - newP.pos[1]];
      anims.set(newP.key, [vector[0], vector[1], vector[0], vector[1]]);
      animedOrigs.push(preP.key);
    }
  }

  for (const p of missings) {
    if (!animedOrigs.includes(p.key)) fadings.set(p.key, p.piece);
  }

  return { anims, fadings };
};

// https://gist.github.com/gre/1650294
export const chessgroundEase = (t: number): number => {
  "worklet";
  return t < 0.5
    ? 4 * t * t * t
    : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1;
};

export const keyToRowCol = (key: Key): { row: number; col: number } => ({
  row: Math.floor(key / BOARD_SIZE),
  col: key % BOARD_SIZE,
});
