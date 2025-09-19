import { View, Text } from "@/components/Themed";
import { ActivityIndicator } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, resetGame, completePromotion } from "../../state";
import {
  applyNetworkMove,
  setGameState,
  makeMove,
} from "../../state/gameSlice";
import Board from "../components/board/Board";
import GameOverModal from "../components/ui/GameOverModal";
import GameNotification from "../components/ui/GameNotification";
import PlayerInfoPod from "../components/ui/PlayerInfoPod";
import PromotionModal from "../components/ui/PromotionModal";
import HistoryControls from "../components/ui/HistoryControls";
import GameMenu from "../components/ui/GameMenu";
import networkService from "../services/networkService";
import onlineGameService from "../../services/onlineGameService";
import { useEffect, useState } from "react";
import { useLocalSearchParams } from "expo-router";

export default function GameScreen() {
  // Get dispatch function
  const dispatch = useDispatch();
  const { gameId, mode } = useLocalSearchParams<{
    gameId?: string;
    mode?: string;
  }>();
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connecting...");

  // Determine if this is online multiplayer mode
  useEffect(() => {
    setIsOnlineMode(mode === "online" && !!gameId);
  }, [gameId, mode]);

  // Reset game state when component mounts (for single player mode)
  useEffect(() => {
    if (mode !== "online") {
      // Only reset if we're not already in a game
      dispatch(resetGame());
    }
  }, [mode, dispatch]);

  // Set up online game connection
  useEffect(() => {
    if (isOnlineMode && gameId) {
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
              console.log("Online game updated:", game);
              dispatch(setGameState(game.gameState));
            } else {
              console.log("Game not found or ended");
              setConnectionStatus("Game not found");
            }
          });

          const unsubscribeMoves = onlineGameService.onMoveUpdate((move) => {
            console.log("Online move received:", move);
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
  }, [isOnlineMode, gameId, dispatch]);

  // Set up local network listeners for local multiplayer
  useEffect(() => {
    if (!isOnlineMode) {
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
  }, [isOnlineMode, dispatch]);

  // Get game state from Redux store
  const gameState = useSelector((state: RootState) => state.game);
  const currentPlayerTurn = useSelector(
    (state: RootState) => state.game.currentPlayerTurn
  );
  const gameStatus = useSelector((state: RootState) => state.game.gameStatus);
  const winner = useSelector((state: RootState) => state.game.winner);
  const capturedPieces = useSelector(
    (state: RootState) => state.game.capturedPieces
  );
  const scores = useSelector((state: RootState) => state.game.scores);
  const promotionState = useSelector(
    (state: RootState) => state.game.promotionState
  );
  const justEliminated = useSelector(
    (state: RootState) => state.game.justEliminated
  );

  // Safety check for incomplete game state
  const isGameStateReady =
    gameState.boardState &&
    Array.isArray(gameState.boardState) &&
    gameState.boardState.length > 0;

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
        {isOnlineMode && (
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

      {/* Game Notification (for eliminations) */}
      <GameNotification
        message={getNotificationMessage()}
        isVisible={gameStatus === "checkmate" || gameStatus === "stalemate"}
        duration={3000}
      />

      {/* Game Over Modal (only for final winner) */}
      {gameStatus === "finished" && (
        <GameOverModal
          status={gameStatus}
          winner={winner || undefined}
          eliminatedPlayer={justEliminated || undefined}
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
