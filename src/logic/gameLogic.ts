import type { GameState, MoveInfo, Position } from "../../state/types";
import { getPinnedPiecesMask } from "./bitboardLogic";
import { bitboardToMoveInfo, getValidMovesBB } from "./moveGeneration";
import { ctz } from "./bitboardUtils";

export const getValidMoves = (
  pieceCode: string,
  position: Position,
  state: GameState,
  eliminatedPlayers: string[] = [],
  hasMoved?: any,
  enPassantTargets?: {
    position: Position;
    createdBy: string;
    createdByTurn: string;
  }[]
): MoveInfo[] => {
  if (!pieceCode || pieceCode.length < 2) return [];

  const pieceColor = pieceCode[0];
  const pieceType = pieceCode[1];

  if (eliminatedPlayers.includes(pieceColor)) {
    return [];
  }

  const movesBB = getValidMovesBB(pieceCode, position, state);
  return bitboardToMoveInfo(movesBB, pieceColor, pieceType, state);
};

export const hasAnyLegalMoves = (
  playerColor: string,
  state: GameState
): boolean => {
  const pieceTypes = ["P", "N", "B", "R", "Q", "K"];
  const tempPinnedMask = getPinnedPiecesMask(state, playerColor);
  const localState: GameState = {
    ...state,
    bitboardState: {
      ...state.bitboardState,
      pinnedMask: tempPinnedMask,
    },
  };

  for (const type of pieceTypes) {
    const pieceCode = `${playerColor}${type}`;
    let bb = state.bitboardState.pieces[pieceCode] ?? 0n;

    while (bb > 0n) {
      const sqIdx = Number(ctz(bb));
      const row = Math.floor(sqIdx / 14);
      const col = sqIdx % 14;
      const validMoves = getValidMovesBB(pieceCode, { row, col }, localState);
      if (validMoves !== 0n) return true;
      bb &= bb - 1n;
    }
  }

  return false;
};
