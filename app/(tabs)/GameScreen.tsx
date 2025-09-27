import { Text, View } from "@/components/Themed";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useSettings } from "../../hooks/useSettings";
import modeSwitchService from "../../services/modeSwitchService";
import onlineGameService from "../../services/onlineGameService";
import p2pGameService from "../../services/p2pGameService";
import { RootState, completePromotion, resetGame } from "../../state";
import {
  applyNetworkMove,
  setGameMode,
  setGameState,
} from "../../state/gameSlice";
import Board from "../components/board/Board";
import GameMenu from "../components/ui/GameMenu";
import GameNotification from "../components/ui/GameNotification";
import GameOverModal from "../components/ui/GameOverModal";
import HistoryControls from "../components/ui/HistoryControls";
import PlayerInfoPod from "../components/ui/PlayerInfoPod";
import PromotionModal from "../components/ui/PromotionModal";
import networkService from "../services/networkService";

export default function GameScreen() {
  // Get dispatch function
  const dispatch = useDispatch();
  const { gameId, mode } = useLocalSearchParams<{
    gameId?: string;
    mode?: string;
  }>();
  const { settings } = useSettings();
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connecting...");

  // Determine if this is online or P2P multiplayer mode
  useEffect(() => {
    setIsOnlineMode(mode === "online" && !!gameId);
    setIsP2PMode(mode === "p2p");

    // Set the game mode in the Redux store
    // Use solo mode from settings if enabled, otherwise use the route mode
    const effectiveMode = settings.developer.soloMode
      ? "solo"
      : (mode as "solo" | "local" | "online" | "p2p" | "single");

    console.log(
      "GameScreen: Setting game mode:",
      effectiveMode,
      "from route mode:",
      mode,
      "solo mode enabled:",
      settings.developer.soloMode
    );
    dispatch(setGameMode(effectiveMode));
  }, [gameId, mode, settings.developer.soloMode, dispatch]);

  // Handle mode switching with proper disconnection
  useEffect(() => {
    const handleModeSwitch = async () => {
      // Check if we need to disconnect from current game
      const currentMode = onlineGameService.isConnected
        ? "online"
        : p2pGameService.isConnected
        ? "p2p"
        : networkService.connected
        ? "local"
        : "solo";

      // Only show warning if we're actually switching modes
      if (currentMode !== mode) {
        await modeSwitchService.handleModeSwitch(
          mode as "online" | "p2p" | "local" | "solo" | "single",
          () => {
            // Confirm: Reset game and continue
            dispatch(resetGame());
          },
          () => {
            // Cancel: Navigate back to previous mode
            // This would need to be handled by the parent component
            console.log("Mode switch cancelled by user");
          }
        );
      } else if (mode !== "online") {
        // Same mode but not online, safe to reset
        dispatch(resetGame());
      }
    };

    handleModeSwitch();
  }, [mode, dispatch]);

  // Set up online game connection
  useEffect(() => {
    // Only connect if we're actually in online mode AND have a gameId
    // This prevents reconnection when switching to solo mode
    if (isOnlineMode && gameId && mode === "online") {
      const connectToOnlineGame = async () => {
        try {
          setConnectionStatus("Connecting to game...");
          console.log(
            "GameScreen: Attempting to connect to online game:",
            gameId
          );
          await onlineGameService.connectToGame(gameId);
          console.log("GameScreen: Successfully connected to online game");
          console.log(
            "GameScreen: onlineGameService.isConnected:",
            onlineGameService.isConnected
          );
          setConnectionStatus("Connected");

          // Set up online game listeners
          const unsubscribeGame = onlineGameService.onGameUpdate((game) => {
            if (game) {
              // onlineGameService handles all state management including history
              // No need to dispatch setGameState here as it's handled internally
            } else {
              console.log("Game not found or ended");
              setConnectionStatus("Game not found");
            }
          });

          const unsubscribeMoves = onlineGameService.onMoveUpdate((move) => {
            // The service handles move application internally
          });

          return () => {
            unsubscribeGame();
            unsubscribeMoves();
          };
        } catch (error) {
          console.error("Failed to connect to online game:", error);
          setConnectionStatus("Connection failed");
        }
      };

      const cleanup = connectToOnlineGame();

      return () => {
        cleanup.then((cleanupFn) => cleanupFn?.());
        onlineGameService.disconnect();
      };
    }
  }, [isOnlineMode, gameId, mode, dispatch]);

  // Set up P2P game connection
  useEffect(() => {
    if (isP2PMode && mode === "p2p") {
      const connectToP2PGame = async () => {
        try {
          setConnectionStatus("Connecting to P2P game...");
          console.log("GameScreen: Attempting to connect to P2P game");
          await p2pGameService.connectToGame("p2p-game");
          console.log("GameScreen: Successfully connected to P2P game");
          setConnectionStatus("Connected");

          // Set up P2P game listeners
          const unsubscribeGame = p2pGameService.onGameUpdate((game) => {
            if (game) {
              // p2pGameService handles all state management
              console.log("P2P Game updated:", game);
            } else {
              console.log("P2P Game not found or ended");
              setConnectionStatus("Game not found");
            }
          });

          const unsubscribeMoves = p2pGameService.onMoveUpdate((move) => {
            // The service handles move application internally
            console.log("P2P Move received:", move);
          });

          return () => {
            unsubscribeGame();
            unsubscribeMoves();
          };
        } catch (error) {
          console.error("Failed to connect to P2P game:", error);
          setConnectionStatus("Connection failed");
        }
      };

      const cleanup = connectToP2PGame();

      return () => {
        cleanup.then((cleanupFn) => cleanupFn?.());
        p2pGameService.disconnect();
      };
    }
  }, [isP2PMode, mode, dispatch]);

  // Cleanup online game connection when switching to solo mode
  useEffect(() => {
    if (mode === "solo" && onlineGameService.isConnected) {
      console.log(
        "GameScreen: Disconnecting from online game due to solo mode switch"
      );
      onlineGameService.disconnect();
    }
  }, [mode]);

  // Cleanup P2P game connection when switching to solo mode
  useEffect(() => {
    if (mode === "solo" && p2pGameService.isConnected) {
      console.log(
        "GameScreen: Disconnecting from P2P game due to solo mode switch"
      );
      p2pGameService.disconnect();
    }
  }, [mode]);

  // Set up local network listeners for local multiplayer
  useEffect(() => {
    if (!isOnlineMode && !isP2PMode) {
      const handleMoveMade = (data: any) => {
        dispatch(applyNetworkMove(data.move));
        // Update game state with server's turn information
        if (data.gameState) {
          dispatch(setGameState(data.gameState));
        }
      };

      const handleGameStateUpdated = (data: any) => {
        dispatch(setGameState(data.gameState));
      };

      const handleMoveRejected = (data: any) => {
        // Move was rejected by server
      };

      const handleGameDestroyed = (data: { reason: string }) => {
        dispatch(resetGame());
      };

      networkService.on("move-made", handleMoveMade);
      networkService.on("game-state-updated", handleGameStateUpdated);
      networkService.on("move-rejected", handleMoveRejected);
      networkService.on("game-destroyed", handleGameDestroyed);

      return () => {
        networkService.off("move-made", handleMoveMade);
        networkService.off("game-state-updated", handleGameStateUpdated);
        networkService.off("move-rejected", handleMoveRejected);
        networkService.off("game-destroyed", handleGameDestroyed);
      };
    }
  }, [isOnlineMode, isP2PMode, dispatch]);

  // Get the entire live game state, including the history array and index
  const liveGame = useSelector((state: RootState) => state.game);
  const { history, viewingHistoryIndex } = liveGame;

  // This is the magic: create a memoized variable for the state to display
  const displayedGameState = useMemo(() => {
    // If we are in "review mode" and the index is valid...
    if (viewingHistoryIndex !== null && viewingHistoryIndex < history.length && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex]; // ...show the historical state.
    }
    return liveGame; // ...otherwise, show the live game state.
  }, [liveGame, history, viewingHistoryIndex]);

  // Extract individual properties from displayedGameState for easier use
  const currentPlayerTurn = displayedGameState.currentPlayerTurn;
  const gameStatus = displayedGameState.gameStatus;
  const winner = displayedGameState.winner;
  const capturedPieces = displayedGameState.capturedPieces;
  const scores = displayedGameState.scores;
  const promotionState = displayedGameState.promotionState;
  const justEliminated = displayedGameState.justEliminated;

  // Safety check for incomplete game state
  const isGameStateReady =
    displayedGameState.boardState &&
    Array.isArray(displayedGameState.boardState) &&
    displayedGameState.boardState.length > 0;

  // Helper function to get player name
  const getPlayerName = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Yellow";
      case "g":
        return "Green";
      default:
        return "Unknown";
    }
  };

  // Determine notification message
  const getNotificationMessage = () => {
    if (gameStatus === "checkmate" && justEliminated) {
      return `Checkmate! ${getPlayerName(justEliminated)} has been eliminated!`;
    }
    if (gameStatus === "stalemate" && justEliminated) {
      return `Stalemate! ${getPlayerName(justEliminated)} has been eliminated!`;
    }
    return "";
  };

  // Create player data for the pods
  const players = [
    {
      name: getPlayerName("r"),
      color: "r",
      score: scores.r,
      capturedPieces: capturedPieces.r,
      isCurrentTurn: currentPlayerTurn === "r",
    },
    {
      name: getPlayerName("b"),
      color: "b",
      score: scores.b,
      capturedPieces: capturedPieces.b,
      isCurrentTurn: currentPlayerTurn === "b",
    },
    {
      name: getPlayerName("y"),
      color: "y",
      score: scores.y,
      capturedPieces: capturedPieces.y,
      isCurrentTurn: currentPlayerTurn === "y",
    },
    {
      name: getPlayerName("g"),
      color: "g",
      score: scores.g,
      capturedPieces: capturedPieces.g,
      isCurrentTurn: currentPlayerTurn === "g",
    },
  ];

  // Show loading screen if game state isn't ready
  if (!isGameStateReady) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4">Loading game...</Text>
        {(isOnlineMode || isP2PMode) && (
          <Text className="text-gray-400 text-sm mt-2">{connectionStatus}</Text>
        )}
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black justify-center items-center">
      {/* History Controls - Top Center */}
      <View className="absolute top-4 z-10">
        <HistoryControls />
      </View>

      {/* Game Menu - Top Right */}
      <GameMenu />

      {/* Chess Board - Centered */}
      <Board />

      {/* Player Info Pods - Positioned in corners */}

      {/* Top Left - Yellow Player */}
      <View className="absolute top-4 left-4">
        <PlayerInfoPod
          player={players[2]}
          capturedPieces={players[2].capturedPieces}
          isCurrentTurn={players[2].isCurrentTurn}
        />
      </View>

      {/* Top Right - Green Player */}
      <View className="absolute top-4 right-4">
        <PlayerInfoPod
          player={players[3]}
          capturedPieces={players[3].capturedPieces}
          isCurrentTurn={players[3].isCurrentTurn}
        />
      </View>

      {/* Bottom Left - Blue Player */}
      <View className="absolute bottom-4 left-4">
        <PlayerInfoPod
          player={players[1]}
          capturedPieces={players[1].capturedPieces}
          isCurrentTurn={players[1].isCurrentTurn}
        />
      </View>

      {/* Bottom Right - Red Player */}
      <View className="absolute bottom-4 right-4">
        <PlayerInfoPod
          player={players[0]}
          capturedPieces={players[0].capturedPieces}
          isCurrentTurn={players[0].isCurrentTurn}
        />
      </View>

      {/* Game Notification (for eliminations during ongoing game) */}
      <GameNotification
        message={getNotificationMessage()}
        isVisible={
          (gameStatus === "checkmate" || gameStatus === "stalemate") && !winner
        }
        duration={3000}
      />

      {/* Game Over Modal (for final game end) */}
      {gameStatus === "finished" && (
        <GameOverModal
          status={gameStatus}
          winner={winner || undefined}
          eliminatedPlayer={justEliminated || undefined}
          justEliminated={justEliminated || undefined}
          onReset={() => dispatch(resetGame())}
        />
      )}

      {/* Promotion Modal */}
      <PromotionModal
        visible={promotionState.isAwaiting}
        playerColor={promotionState.color || ""}
        onSelectPiece={(pieceType) =>
          dispatch(completePromotion({ pieceType }))
        }
      />
    </View>
  );
}

// Styles removed - using NativeWind classes instead
