import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import { useSettings } from "../context/SettingsContext";
import modeSwitchService from "../services/modeSwitchService";
import onlineGameService from "../services/onlineGameService";
import p2pGameService from "../services/p2pGameService";
import networkService from "../app/services/networkService";
import type { OnlineGameSnapshot } from "../services/onlineDataClient";
import { onlineDataClient } from "../services/onlineDataClient";
import { store } from "../state";
import {
  applyNetworkMove,
  applyOnlineSnapshot,
  resetGame,
  setBotPlayers,
  setGameMode,
  setGameState,
} from "../state/gameSlice";
import type { GameState, SerializedGameState } from "../state/types";
import {
  createEmptyPieceBitboards,
  deserializeBitboardPieces,
  rebuildBitboardStateFromPieces,
} from "../src/logic/bitboardSerialization";
import { bitboardToArray } from "../src/logic/bitboardUtils";
import { getPinnedPiecesMask } from "../src/logic/bitboardLogic";
import { updateAllCheckStatus } from "../state/gameHelpers";
import { syncBitboardsFromArray } from "../state/gameSlice";
import { buildMoveKey, sendGameFlowEvent, consumeSkipNextMoveAnimation } from "../services/gameFlowService";

type GameMode = "solo" | "local" | "online" | "p2p" | "single";
type ConnectionMode = GameMode | "spectate";

const BOARD_SIZE = 14;

const isWithinBoard = (row: number, col: number) =>
  row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;

const isSnapshotLastMoveConsistent = (
  boardState: GameState["boardState"],
  move: GameState["lastMove"]
) => {
  if (!move) return true;
  if (
    !isWithinBoard(move.from.row, move.from.col) ||
    !isWithinBoard(move.to.row, move.to.col)
  ) {
    return false;
  }

  const pieceAtTo = boardState?.[move.to.row]?.[move.to.col] ?? null;
  if (!pieceAtTo) return false;

  const moverColor = move.playerColor || move.pieceCode[0];
  if (pieceAtTo[0] !== moverColor) return false;
  if (pieceAtTo === move.pieceCode) return true;
  // Promotion can legitimately change pawn type at destination.
  if (move.pieceCode[1] === "P" && pieceAtTo[1] !== "P") return true;
  return false;
};

export const useGameConnection = (mode?: string, gameId?: string) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings } = useSettings();
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [isSpectating, setIsSpectating] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");
  const initialModeRef = useRef<string | null>(null);
  const hasRedirectedRef = useRef<boolean>(false);
  const spectateLastVersionRef = useRef<number | null>(null);
  const spectateLastMoveKeyRef = useRef<string | null>(null);

  useEffect(() => {
    let cleanupFunction = () => {};

    if (initialModeRef.current === null && mode) {
      initialModeRef.current = mode;
    } else if (mode && initialModeRef.current && mode !== initialModeRef.current) {
      initialModeRef.current = mode;
    } else if (!mode && initialModeRef.current) {
      // Mode was cleared (e.g. navigating to GameScreen without params after
      // spectating). Reset the ref so stale "spectate" mode doesn't persist.
      initialModeRef.current = null;
    }

    const currentReduxGameMode = store.getState().game.gameMode;
    const stableMode = initialModeRef.current || mode || currentReduxGameMode || "solo";
    const currentSettings = settings;

    // Spectate mode: read-only game subscription
    if (stableMode === "spectate" && gameId) {
      setIsOnlineMode(false);
      setIsP2PMode(false);
      setIsSpectating(true);
      dispatch(setGameMode("online"));
      setConnectionStatus("Connecting to game...");

      spectateLastVersionRef.current = null;
      spectateLastMoveKeyRef.current = null;

      const unsubscribe = onlineDataClient.subscribeToGame(gameId, (game) => {
        if (!game || !game.gameState) {
          setConnectionStatus("Game not found");
          return;
        }

        setConnectionStatus("Spectating");

        const rawState = game.gameState as unknown as SerializedGameState;
        let pieces = deserializeBitboardPieces(rawState.bitboardState?.pieces);
        if (
          (!rawState.bitboardState || !rawState.bitboardState.pieces) &&
          Array.isArray(rawState.boardState)
        ) {
          const normalizedBoard = (rawState.boardState as any[]).map((row: any) =>
            Array.isArray(row)
              ? row.map((cell: any) => (cell === "" ? null : cell))
              : Array(14).fill(null)
          );
          const fallbackBitboards = syncBitboardsFromArray(
            normalizedBoard,
            rawState.eliminatedPlayers || []
          );
          pieces = fallbackBitboards.pieces;
        }
        const eliminatedPieceBitboards = rawState.eliminatedPieceBitboards
          ? deserializeBitboardPieces(rawState.eliminatedPieceBitboards as any)
          : createEmptyPieceBitboards();
        const bitboardState = rebuildBitboardStateFromPieces(
          pieces,
          rawState.eliminatedPlayers || [],
          rawState.enPassantTargets || []
        );
        const boardState = bitboardToArray(bitboardState.pieces, eliminatedPieceBitboards);

        const playersArray = game.players
          ? Object.entries(game.players).map(([playerId, player]: [string, any]) => ({
              id: player.id || playerId,
              name: player.name || `Player ${playerId.slice(0, 8)}`,
              color: player.color || "g",
              isHost: player.isHost || false,
              isOnline: player.isOnline || false,
              isBot: player.isBot || false,
              lastSeen: player.lastSeen || Date.now(),
            }))
          : [];

        const botPlayers = playersArray
          .filter((player) => player.isBot)
          .map((player) => player.color);

        store.dispatch(setBotPlayers(botPlayers));

        const baseMs = rawState.timeControl?.baseMs ?? 5 * 60 * 1000;
        const teamAssignments = rawState.teamAssignments ?? { r: "A", y: "A", b: "B", g: "B" };

        const snapshotState: GameState = {
          ...(game.gameState as unknown as GameState),
          boardState,
          bitboardState,
          eliminatedPieceBitboards,
          eliminatedPlayers: rawState.eliminatedPlayers || [],
          players: playersArray,
          isHost: false,
          canStartGame: false,
          gameMode: "online",
          botPlayers,
          timeControl: rawState.timeControl ?? { baseMs, incrementMs: 0 },
          clocks: rawState.clocks ?? { r: baseMs, b: baseMs, y: baseMs, g: baseMs },
          turnStartedAt: rawState.turnStartedAt ?? null,
          teamMode: !!rawState.teamMode,
          teamAssignments,
          winningTeam: rawState.winningTeam ?? null,
          premove: null,
        };
        snapshotState.checkStatus = updateAllCheckStatus(snapshotState);
        snapshotState.bitboardState.pinnedMask = getPinnedPiecesMask(
          snapshotState,
          snapshotState.currentPlayerTurn
        );

        const version = (game.gameState as any).version;
        if (version !== undefined && version !== null) {
          if (spectateLastVersionRef.current !== null && version <= spectateLastVersionRef.current) {
            return;
          }
          spectateLastVersionRef.current = version;
        }

        const resolvedVersion =
          typeof version === "number" ? version : store.getState().game.version ?? 0;

        const rawLastMove = game.lastMove || null;
        const sanitizedLastMove = isSnapshotLastMoveConsistent(
          snapshotState.boardState,
          rawLastMove
        )
          ? rawLastMove
          : null;

        const incomingMoveKey = buildMoveKey(sanitizedLastMove);
        const isNewMove = incomingMoveKey && incomingMoveKey !== spectateLastMoveKeyRef.current;

        store.dispatch(
          applyOnlineSnapshot({
            gameState: snapshotState,
            lastMove: sanitizedLastMove,
            version: resolvedVersion,
          })
        );

        if (isNewMove) {
          const shouldAnimate = !consumeSkipNextMoveAnimation();
          sendGameFlowEvent({
            type: "MOVE_APPLIED",
            moveKey: incomingMoveKey,
            shouldAnimate,
          });
        }
        if (incomingMoveKey) {
          spectateLastMoveKeyRef.current = incomingMoveKey;
        }
      });

      return () => {
        unsubscribe();
        setIsSpectating(false);
      };
    }

    const userWantsSinglePlayer =
      currentSettings.developer.soloMode ||
      (stableMode === "single" && !onlineGameService.isConnected) ||
      (stableMode === "online" && !onlineGameService.isConnected && !gameId);

    const effectiveMode = userWantsSinglePlayer
      ? "single"
      : ((stableMode as GameMode | undefined) || "solo");

    const setupConnectionForMode = async (currentMode: string) => {
      setIsOnlineMode(currentMode === "online" && !!gameId);
      setIsP2PMode(currentMode === "p2p");
      setIsSpectating(false);

      if (store.getState().game.gameMode === "p2p" && currentMode !== "p2p") {
        // Skip mode change
      } else {
        dispatch(setGameMode(currentMode as any));
      }

      const currentGameState = store.getState().game;
      const currentConnectedMode =
        currentMode ||
        currentGameState.gameMode ||
        (onlineGameService.isConnected
          ? "online"
          : p2pGameService.isConnected
          ? "p2p"
          : networkService.connected
          ? "local"
          : "solo");

      if (currentConnectedMode !== currentMode) {
        await modeSwitchService.handleModeSwitch(
          currentMode as GameMode,
          () => {},
          () => {}
        );
      } else if (currentMode !== "online" && currentMode !== "p2p") {
        const currentState = store.getState().game;
        if (currentState.gameMode !== currentMode) {
          dispatch(setGameMode(currentMode as any));
        }
      }

      if (currentMode === "online" && gameId) {
        try {
          setConnectionStatus("Connecting to game...");

          const currentState = store.getState().game;
          if (currentState.gameMode !== "online") {
            dispatch(setGameMode("online"));
            await new Promise((resolve) => setTimeout(resolve, 10));
          }

          await onlineGameService.connectToGame(gameId);
          setConnectionStatus("Connected");

          const unsubscribeGame = onlineGameService.onGameUpdate(
            (game: OnlineGameSnapshot | null) => {
              if (game) {
                return;
              }

              if (!hasRedirectedRef.current) {
                hasRedirectedRef.current = true;
                setConnectionStatus("Game not found");
                onlineGameService.disconnect();
                dispatch(resetGame());
                router.replace("/(tabs)/OnlineLobbyScreen");
              }
            }
          );

          const unsubscribeMoves = onlineGameService.onMoveUpdate(
            (_move: OnlineGameSnapshot["lastMove"]) => {}
          );

          cleanupFunction = () => {
            unsubscribeGame();
            unsubscribeMoves();
            if (mode !== "online") {
              onlineGameService.disconnect();
            }
          };
        } catch (error) {
          console.error("Failed to connect to online game:", error);
          setConnectionStatus("Connection failed");
        }
      } else if (currentMode === "p2p") {
        try {
          setConnectionStatus("Connecting to P2P game...");
          await p2pGameService.connectToGame("p2p-game");
          setConnectionStatus("Connected");

          const unsubscribeGame = p2pGameService.onGameUpdate((game) => {
            if (!game) {
              setConnectionStatus("Game not found");
            }
          });

          const unsubscribeMoves = p2pGameService.onMoveUpdate((_move) => {});

          cleanupFunction = () => {
            unsubscribeGame();
            unsubscribeMoves();
            if (mode !== "p2p") {
              p2pGameService.disconnect();
            }
          };
        } catch (error) {
          console.error("Failed to connect to P2P game:", error);
          setConnectionStatus("Connection failed");
        }
      } else {
        if (currentMode !== "solo") {
          const handleMoveMade = (data: any) => {
            dispatch(applyNetworkMove(data.move));
            if (data.gameState) {
              dispatch(setGameState(data.gameState));
            }
          };

          const handleGameStateUpdated = (data: any) => {
            dispatch(setGameState(data.gameState));
          };

          const handleMoveRejected = (_data: any) => {};

          const handleGameDestroyed = (_data: { reason: string }) => {
            dispatch(resetGame());
          };

          networkService.on("move-made", handleMoveMade);
          networkService.on("game-state-updated", handleGameStateUpdated);
          networkService.on("move-rejected", handleMoveRejected);
          networkService.on("game-destroyed", handleGameDestroyed);

          cleanupFunction = () => {
            networkService.off("move-made", handleMoveMade);
            networkService.off("game-state-updated", handleGameStateUpdated);
            networkService.off("move-rejected", handleMoveRejected);
            networkService.off("game-destroyed", handleGameDestroyed);
          };
        } else {
          cleanupFunction = () => {
            if (onlineGameService.isConnected) {
              onlineGameService.disconnect();
            }
            if (p2pGameService.isConnected) {
              p2pGameService.disconnect();
            }
          };
        }
      }
    };

    setupConnectionForMode(effectiveMode);

    return () => {
      cleanupFunction();
    };
  }, [mode, gameId]);

  return {
    connectionStatus,
    isOnline: isOnlineMode,
    isP2P: isP2PMode,
    isSpectating,
  };
};
