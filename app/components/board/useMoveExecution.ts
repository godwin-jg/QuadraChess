import { useCallback, useMemo } from "react";
import { useDispatch } from "react-redux";
import notificationService from "../../../services/notificationService";
import onlineGameService from "../../../services/onlineGameService";
import p2pGameService from "../../../services/p2pGameService";
import networkService from "../../services/networkService";
import { makeMove, sendMoveToServer } from "../../../state/gameSlice";
import type { MoveInfo, Position } from "../../../types";

interface UseMoveExecutionOptions {
  effectiveMode: string | undefined;
  currentPlayerTurn: string;
  gameStatus: string;
  displayBoardState: (string | null)[][];
  enPassantTargets: any[];
  abortPendingDrop: () => void;
}

interface UseMoveExecutionReturn {
  executeMoveFrom: (from: Position, to: Position, moveInfo?: MoveInfo) => void;
  currentPlayerColor: string | null;
}

/**
 * Hook that handles move execution across different game modes:
 * - Online multiplayer
 * - P2P multiplayer
 * - Local/solo mode
 */
export function useMoveExecution({
  effectiveMode,
  currentPlayerTurn,
  gameStatus,
  displayBoardState,
  enPassantTargets,
  abortPendingDrop,
}: UseMoveExecutionOptions): UseMoveExecutionReturn {
  const dispatch = useDispatch();

  // Memoize current player color to avoid repeated service lookups
  const currentPlayerColor = useMemo(() => {
    if (effectiveMode === "online") {
      return onlineGameService.currentPlayer?.color ?? null;
    }
    if (effectiveMode === "p2p") {
      return p2pGameService.currentPlayer?.color ?? null;
    }
    return null;
  }, [effectiveMode, onlineGameService.currentPlayer?.color, p2pGameService.currentPlayer?.color]);

  const executeMoveFrom = useCallback(
    (from: Position, to: Position, moveInfo?: MoveInfo) => {
      const pieceToMove = displayBoardState[from.row]?.[from.col];
      if (!pieceToMove) {
        abortPendingDrop();
        return;
      }
      const pieceColor = pieceToMove.charAt(0);

      // Online mode validation
      if (
        effectiveMode === "online" &&
        currentPlayerColor &&
        currentPlayerColor !== currentPlayerTurn
      ) {
        notificationService.show("Not your turn", "warning", 1500);
        abortPendingDrop();
        return;
      }
      if (effectiveMode === "online" && pieceColor !== currentPlayerTurn) {
        abortPendingDrop();
        return;
      }
      if (gameStatus !== "active") {
        if (effectiveMode === "online") {
          notificationService.show("Game has not started", "warning", 1500);
        }
        abortPendingDrop();
        return;
      }

      // Check for en passant
      const enPassantTarget = enPassantTargets.find(
        (target: any) =>
          target.position.row === to.row &&
          target.position.col === to.col &&
          pieceToMove[1] === "P" &&
          pieceToMove !== target.createdBy
      );

      const moveData = {
        from,
        to,
        pieceCode: pieceToMove,
        playerColor: pieceColor,
        isEnPassant: !!enPassantTarget,
        enPassantTarget,
      };

      // Handle move based on game mode
      if (effectiveMode === "online") {
        if (onlineGameService.isConnected && onlineGameService.currentGameId) {
          onlineGameService.makeMove(moveData).catch((error: unknown) => {
            console.error("Failed to make online move:", error);
            const playIllegalSound = () => {
              try {
                const soundService = require("../../../services/soundService").default;
                soundService.playSound("illegal");
              } catch {
                // Sound service not available
              }
            };

            if (error instanceof Error && error.message === "Not your turn") {
              playIllegalSound();
              notificationService.show("Not your turn", "warning", 1500);
            } else {
              playIllegalSound();
              notificationService.show("Move failed - check connection", "error", 2000);
            }
            abortPendingDrop();
          });
        } else {
          dispatch(makeMove({ from, to, isPromotion: moveInfo?.isPromotion }));
        }
      } else if (effectiveMode === "p2p") {
        if (p2pGameService.isConnected && p2pGameService.currentGameId) {
          p2pGameService.makeMove(moveData).catch((error) => {
            console.error("Failed to make P2P move:", error);
            if (error instanceof Error && error.message === "Not your turn") {
              notificationService.show("Not your turn", "warning", 1500);
            } else {
              notificationService.show("Move failed - check connection", "error", 2000);
            }
            abortPendingDrop();
          });
        } else {
          dispatch(makeMove({ from, to, isPromotion: moveInfo?.isPromotion }));
        }
      } else if (networkService.connected && networkService.roomId) {
        dispatch(sendMoveToServer({ row: to.row, col: to.col }));
      } else {
        dispatch(makeMove({ from, to, isPromotion: moveInfo?.isPromotion }));
      }
    },
    [
      abortPendingDrop,
      currentPlayerColor,
      currentPlayerTurn,
      dispatch,
      displayBoardState,
      effectiveMode,
      enPassantTargets,
      gameStatus,
    ]
  );

  return { executeMoveFrom, currentPlayerColor };
}
