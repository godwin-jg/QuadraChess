import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import notificationService from "../../../services/notificationService";
import onlineGameService from "../../../services/onlineGameService";
import p2pGameService from "../../../services/p2pGameService";
import networkService from "../../services/networkService";
import { makeMove, sendMoveToServer, setPremove, applyOnlineSnapshot } from "../../../state/gameSlice";
import type { MoveInfo, Position } from "../../../types";
import { onlineDataClient } from "../../../services/onlineDataClient";
import realtimeDatabaseService from "../../../services/realtimeDatabaseService";
import { RootState } from "../../../state/store";

// All player colors in turn order
const TURN_ORDER = ['r', 'b', 'y', 'g'] as const;

interface UseMoveExecutionOptions {
  effectiveMode: string | undefined;
  currentPlayerTurn: string;
  gameStatus: string;
  displayBoardState: (string | null)[][];
  enPassantTargets: any[];
  abortPendingDrop: () => void;
  botPlayers?: string[];
  premoveEnabled?: boolean;
  /** Called immediately when premove is set for optimistic UI updates */
  onPremoveSet?: (premove: { from: Position; to: Position; pieceCode: string }) => void;
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
  botPlayers = [],
  premoveEnabled = true,
  onPremoveSet,
}: UseMoveExecutionOptions): UseMoveExecutionReturn {
  const dispatch = useDispatch();
  const players = useSelector((state: RootState) => state.game.players);
  const currentUserId = onlineDataClient.getCurrentUser()?.uid ?? null;
  const lastKnownOnlineColorRef = useRef<string | null>(null);

  const resolvedOnlineColor = useMemo(() => {
    if (effectiveMode !== "online" && effectiveMode !== "p2p") return null;
    const serviceColor = onlineGameService.currentPlayer?.color ?? null;
    if (serviceColor) {
      return serviceColor;
    }
    if (currentUserId) {
      const matchedPlayer = players.find((player) => player.id === currentUserId);
      return matchedPlayer?.color ?? null;
    }
    return null;
  }, [currentUserId, effectiveMode, players, onlineGameService.currentPlayer?.color]);

  useEffect(() => {
    if (effectiveMode === "online" || effectiveMode === "p2p") {
      if (resolvedOnlineColor) {
        lastKnownOnlineColorRef.current = resolvedOnlineColor;
      }
      return;
    }
    lastKnownOnlineColorRef.current = null;
  }, [effectiveMode, resolvedOnlineColor]);

  // Memoize current player color to avoid repeated service lookups
  // For solo mode, derive human player as whoever is NOT a bot
  const currentPlayerColor = useMemo(() => {
    if (effectiveMode === "online") {
      return resolvedOnlineColor ?? lastKnownOnlineColorRef.current;
    }
    if (effectiveMode === "p2p") {
      return p2pGameService.currentPlayer?.color ?? resolvedOnlineColor ?? lastKnownOnlineColorRef.current;
    }
    // Solo mode: human is whoever is NOT in botPlayers
    if (effectiveMode === "single" && botPlayers.length > 0) {
      const humanPlayers = TURN_ORDER.filter(c => !botPlayers.includes(c));
      // Return the first human player (typically 'r' for Red)
      return humanPlayers[0] ?? null;
    }
    return null;
  }, [
    effectiveMode,
    botPlayers,
    resolvedOnlineColor,
    p2pGameService.currentPlayer?.color,
  ]);

  const executeMoveFrom = useCallback(
    (from: Position, to: Position, moveInfo?: MoveInfo) => {
      const pieceToMove = displayBoardState[from.row]?.[from.col];
      if (!pieceToMove) {
        abortPendingDrop();
        return;
      }
      const pieceColor = pieceToMove.charAt(0);

      // Game status check
      if (gameStatus !== "active") {
        if (effectiveMode === "online" || effectiveMode === "p2p") {
          notificationService.show("Game has not started", "warning", 1500);
        }
        abortPendingDrop();
        return;
      }

      // Read-only fallback: if we don't yet know the local player's color,
      // never allow move execution from this client.
      if ((effectiveMode === "online" || effectiveMode === "p2p") && !currentPlayerColor) {
        abortPendingDrop();
        return;
      }

      // Online/P2P mode - handle premove when not your turn
      if ((effectiveMode === "online" || effectiveMode === "p2p") && currentPlayerColor) {
        // Only allow moves/premoves with your own pieces
        if (pieceColor !== currentPlayerColor) {
          abortPendingDrop();
          return;
        }
        
        // If it's not your turn, set as premove instead of executing (if enabled)
        if (currentPlayerColor !== currentPlayerTurn) {
          if (premoveEnabled) {
            const premoveData = { from, to, pieceCode: pieceToMove };
            // Call optimistic callback first for instant UI update
            onPremoveSet?.(premoveData);
            // Then dispatch to Redux for state persistence
            dispatch(setPremove(premoveData));
          }
          abortPendingDrop();
          return;
        }
      } else if ((effectiveMode === "online" || effectiveMode === "p2p") && pieceColor !== currentPlayerTurn) {
        // Fallback for online/p2p without player color
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
          // Optimistic update: apply move locally for instant animation
          // Server snapshot will reconcile (same moveKey = no duplicate animation)
          dispatch(makeMove({ from, to, isPromotion: moveInfo?.isPromotion }));

          // Send to server - on failure, fetch fresh state to correct optimistic update
          onlineGameService.makeMove(moveData).catch(async (error: unknown) => {
            try { require("../../../services/soundService").default.playSound("illegal"); } catch {}
            notificationService.show(error instanceof Error && error.message === "Not your turn" ? "Not your turn" : "Move failed", "warning", 1500);
            const gameId = onlineGameService.currentGameId;
            if (gameId) {
              const fresh = await realtimeDatabaseService.fetchGameState(gameId);
              if (fresh) dispatch(applyOnlineSnapshot({ gameState: fresh as any, lastMove: fresh.lastMove || null, version: fresh.version ?? 0 }));
            }
            abortPendingDrop();
          });
        } else {
          dispatch(makeMove({ from, to, isPromotion: moveInfo?.isPromotion }));
        }
      } else if (effectiveMode === "p2p") {
        if (p2pGameService.isConnected && p2pGameService.currentGameId) {
          // Optimistic update: apply move locally for instant animation
          dispatch(makeMove({ from, to, isPromotion: moveInfo?.isPromotion }));

          // Send to peer - host will broadcast correct state on failure
          p2pGameService.makeMove(moveData).catch((error) => {
            try { require("../../../services/soundService").default.playSound("illegal"); } catch {}
            notificationService.show(error instanceof Error && error.message === "Not your turn" ? "Not your turn" : "Move failed", "warning", 1500);
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
      premoveEnabled,
      onPremoveSet,
    ]
  );

  return { executeMoveFrom, currentPlayerColor };
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
