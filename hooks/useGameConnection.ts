import { useEffect, useRef, useState } from "react";
import { useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import { useSettings } from "../context/SettingsContext";
import modeSwitchService from "../services/modeSwitchService";
import onlineGameService from "../services/onlineGameService";
import p2pGameService from "../services/p2pGameService";
import networkService from "../app/services/networkService";
import type { OnlineGameSnapshot } from "../services/onlineDataClient";
import { store } from "../state";
import {
  applyNetworkMove,
  resetGame,
  setGameMode,
  setGameState,
} from "../state/gameSlice";

type GameMode = "solo" | "local" | "online" | "p2p" | "single";

export const useGameConnection = (mode?: string, gameId?: string) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings } = useSettings();
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<string>("Connecting...");
  const initialModeRef = useRef<string | null>(null);
  const hasRedirectedRef = useRef<boolean>(false);

  useEffect(() => {
    let cleanupFunction = () => {};

    if (initialModeRef.current === null && mode) {
      initialModeRef.current = mode;
    } else if (mode && initialModeRef.current && mode !== initialModeRef.current) {
      initialModeRef.current = mode;
    }

    const currentReduxGameMode = store.getState().game.gameMode;
    const stableMode = initialModeRef.current || mode || currentReduxGameMode || "solo";
    const currentSettings = settings;

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
  };
};
