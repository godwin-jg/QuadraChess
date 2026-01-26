import { useCallback } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState } from "../state/store";
import { selectPiece } from "../state/gameSlice";
import {
  bitboardToMoveInfo,
  getValidMovesBB,
  isValidMove as isValidMoveBB,
} from "../src/logic/moveGeneration";
import { getPieceAtFromBitboard } from "../src/logic/bitboardUtils";
import type { MoveInfo, Position } from "../types";

export const useChessEngine = () => {
  const dispatch = useDispatch();
  const game = useSelector((state: RootState) => state.game);

  const getMovesForSquare = useCallback(
    (pos: Position): MoveInfo[] => {
      // ✅ BITBOARD ONLY: Read piece from bitboards
      const pieceCode = getPieceAtFromBitboard(game.bitboardState?.pieces || {}, pos.row, pos.col);
      if (!pieceCode) return [];

      const movesBB = getValidMovesBB(pieceCode, pos, game);
      return bitboardToMoveInfo(movesBB, pieceCode[0], pieceCode[1], game);
    },
    [game]
  );

  const handleSquarePress = useCallback(
    (pos: Position) => {
      dispatch(selectPiece(pos));
    },
    [dispatch]
  );

  const isValidMove = useCallback(
    (from: Position, to: Position, pieceCode?: string): boolean => {
      const resolvedPiece =
        pieceCode ??
        getPieceAtFromBitboard(game.bitboardState?.pieces || {}, from.row, from.col);
      if (!resolvedPiece) return false;
      return isValidMoveBB(resolvedPiece, from, to, game);
    },
    [game]
  );

  const isKingInDanger = useCallback(
    (color: string): boolean => game.checkStatus[color as "r" | "b" | "y" | "g"],
    [game.checkStatus]
  );

  return {
    getMovesForSquare,
    handleSquarePress,
    isKingInDanger,
    isValidMove,
    validMoves: game.validMoves,
    selectedPiece: game.selectedPiece,
    currentPlayer: game.currentPlayerTurn,
  };
};
