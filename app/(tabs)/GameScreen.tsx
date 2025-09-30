import { Text, View } from "@/components/Themed";
import { useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useSettings } from "../../context/SettingsContext";
import modeSwitchService from "../../services/modeSwitchService";
import onlineGameService from "../../services/onlineGameService";
import p2pGameService from "../../services/p2pGameService";
import { RootState, completePromotion, resetGame, store } from "../../state";
import {
  applyNetworkMove,
  setGameMode,
  setGameState,
  clearJustEliminated,
} from "../../state/gameSlice";
import Board from "../components/board/Board";
import ResignButton from "../components/ui/ResignButton";
import GameNotification from "../components/ui/GameNotification";
import GameOverModal from "../components/ui/GameOverModal";
import HistoryControls from "../components/ui/HistoryControls";
import PlayerInfoPod from "../components/ui/PlayerInfoPod";
import PromotionModal from "../components/ui/PromotionModal";
import FloatingPointsText from "../components/ui/FloatingPointsText";
import networkService from "../services/networkService";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import GridBackground from "../components/ui/GridBackground";

export default function GameScreen() {
  // Get dispatch function
  const dispatch = useDispatch();
  const { gameId, mode } = useLocalSearchParams<{
    gameId?: string;
    mode?: string;
  }>();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const [isOnlineMode, setIsOnlineMode] = useState(false);
  const [isP2PMode, setIsP2PMode] = useState(false);
  const [connectionStatus, setConnectionStatus] =
    useState<string>("Connecting...");
  
  // Floating points animation state
  const [floatingPoints, setFloatingPoints] = useState<Array<{
    id: string;
    points: number;
    x: number;
    y: number;
    color: string;
  }>>([]);

  // Master connection management - single useEffect to prevent race conditions
  useEffect(() => {
    // This function will be returned by the effect to clean up everything
    let cleanupFunction = () => {};

    // Determine the effective mode based on settings
    const effectiveMode = settings.developer.soloMode
      ? "solo"
      : (mode as "solo" | "local" | "online" | "p2p" | "single" | undefined) || "solo";
    
    console.log("🔧 GameScreen Debug:", {
      "settings.developer.soloMode": settings.developer.soloMode,
      "route mode": mode,
      "effectiveMode": effectiveMode,
      "settings object": settings.developer,
      "full settings": settings
    });

    const setupConnectionForMode = async (currentMode: string) => {
      console.log("GameScreen: Setting up connection for mode:", currentMode);
      
      // Update mode flags
      setIsOnlineMode(currentMode === "online" && !!gameId);
      setIsP2PMode(currentMode === "p2p");

      console.log(
        "GameScreen: Setting game mode:",
        currentMode,
        "from route mode:",
        mode,
        "solo mode enabled:",
        settings.developer.soloMode
      );
      console.log("GameScreen: Current Redux gameMode before dispatch:", store.getState().game.gameMode);
      
      // ✅ Don't override P2P mode if it's already set
      if (store.getState().game.gameMode === "p2p" && currentMode !== "p2p") {
        console.log("GameScreen: Skipping gameMode change - already set to p2p");
      } else {
        dispatch(setGameMode(currentMode as any));
        console.log("GameScreen: Current Redux gameMode after dispatch:", store.getState().game.gameMode);
      }

      // Handle mode switching with proper disconnection
      const currentConnectedMode = onlineGameService.isConnected
        ? "online"
        : p2pGameService.isConnected
        ? "p2p"
        : networkService.connected
        ? "local"
        : "solo";

      // Only show warning if we're actually switching modes
      if (currentConnectedMode !== currentMode) {
        await modeSwitchService.handleModeSwitch(
          currentMode as "online" | "p2p" | "local" | "solo" | "single",
          () => {
            // Confirm: Reset game and continue
            dispatch(resetGame());
          },
          () => {
            // Cancel: Navigate back to previous mode
            console.log("Mode switch cancelled by user");
          }
        );
      } else if (currentMode !== "online" && currentMode !== "p2p") {
        // Same mode but not online or P2P, safe to reset
        dispatch(resetGame());
      }

      // Set up connection based on mode
      if (currentMode === "online" && gameId) {
        // Online game connection
        try {
          setConnectionStatus("Connecting to game...");
          console.log("GameScreen: Attempting to connect to online game:", gameId);
          await onlineGameService.connectToGame(gameId);
          console.log("GameScreen: Successfully connected to online game");
          setConnectionStatus("Connected");

          // Set up online game listeners
          const unsubscribeGame = onlineGameService.onGameUpdate((game) => {
            if (game) {
              // onlineGameService handles all state management including history
            } else {
              console.log("Game not found or ended");
              setConnectionStatus("Game not found");
            }
          });

          const unsubscribeMoves = onlineGameService.onMoveUpdate((move) => {
            // The service handles move application internally
          });

          cleanupFunction = () => {
            console.log("GameScreen: Cleaning up online game connection");
            unsubscribeGame();
            unsubscribeMoves();
            onlineGameService.disconnect();
          };
        } catch (error) {
          console.error("Failed to connect to online game:", error);
          setConnectionStatus("Connection failed");
        }
      } else if (currentMode === "p2p") {
        // P2P game connection
        try {
          setConnectionStatus("Connecting to P2P game...");
          console.log("GameScreen: Attempting to connect to P2P game");
          await p2pGameService.connectToGame("p2p-game");
          console.log("GameScreen: Successfully connected to P2P game");
          setConnectionStatus("Connected");

          // Set up P2P game listeners
          const unsubscribeGame = p2pGameService.onGameUpdate((game) => {
            if (game) {
              console.log("P2P Game updated:", game);
            } else {
              console.log("P2P Game not found or ended");
              setConnectionStatus("Game not found");
            }
          });

          const unsubscribeMoves = p2pGameService.onMoveUpdate((move) => {
            console.log("P2P Move received:", move);
          });

          cleanupFunction = () => {
            console.log("GameScreen: Cleaning up P2P game connection");
            unsubscribeGame();
            unsubscribeMoves();
            p2pGameService.disconnect();
          };
        } catch (error) {
          console.error("Failed to connect to P2P game:", error);
          setConnectionStatus("Connection failed");
        }
      } else {
        // Local multiplayer or solo mode
        if (currentMode !== "solo") {
          // Set up local network listeners for local multiplayer
          const handleMoveMade = (data: any) => {
            dispatch(applyNetworkMove(data.move));
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

          cleanupFunction = () => {
            console.log("GameScreen: Cleaning up local network listeners");
            networkService.off("move-made", handleMoveMade);
            networkService.off("game-state-updated", handleGameStateUpdated);
            networkService.off("move-rejected", handleMoveRejected);
            networkService.off("game-destroyed", handleGameDestroyed);
          };
        } else {
          // Solo mode - ensure all connections are cleaned up
          cleanupFunction = () => {
            console.log("GameScreen: Cleaning up for solo mode");
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

    // The single return function ensures the previous mode's
    // connections and listeners are ALWAYS torn down before the
    // next mode's effect runs.
    return () => {
      console.log("GameScreen: Cleaning up connections for previous mode...");
      cleanupFunction();
    };
  }, [mode, gameId, settings.developer.soloMode, dispatch]);

  // Get granular pieces of state - only re-render when specific data changes
  const history = useSelector((state: RootState) => state.game.history);
  const viewingHistoryIndex = useSelector((state: RootState) => state.game.viewingHistoryIndex);
  const boardState = useSelector((state: RootState) => state.game.boardState);
  const currentPlayerTurn = useSelector((state: RootState) => state.game.currentPlayerTurn);
  const gameStatus = useSelector((state: RootState) => state.game.gameStatus);
  const winner = useSelector((state: RootState) => state.game.winner);
  const capturedPieces = useSelector((state: RootState) => state.game.capturedPieces);
  const scores = useSelector((state: RootState) => state.game.scores);
  const promotionState = useSelector((state: RootState) => state.game.promotionState);
  const justEliminated = useSelector((state: RootState) => state.game.justEliminated);
  const eliminatedPlayers = useSelector((state: RootState) => state.game.eliminatedPlayers);
  const selectedPiece = useSelector((state: RootState) => state.game.selectedPiece);
  const validMoves = useSelector((state: RootState) => state.game.validMoves);

  // Clear justEliminated flag after notification duration
  useEffect(() => {
    if (justEliminated && (gameStatus === "checkmate" || gameStatus === "stalemate") && !winner) {
      console.log("🎮 GameScreen: Setting timer to clear justEliminated flag");
      const timer = setTimeout(() => {
        console.log("🎮 GameScreen: Clearing justEliminated flag");
        dispatch(clearJustEliminated());
      }, 3000); // Same duration as notification

      return () => clearTimeout(timer);
    }
  }, [justEliminated, gameStatus, winner, dispatch]);

  // This is the magic: create a memoized variable for the state to display
  const displayedGameState = useMemo(() => {
    // If we are in "review mode" and the index is valid...
    if (viewingHistoryIndex !== null && viewingHistoryIndex < history.length && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex]; // ...show the historical state.
    }
    // ...otherwise, show the live game state composed from individual selectors
    return {
      boardState,
      currentPlayerTurn,
      gameStatus,
      winner,
      capturedPieces,
      scores,
      promotionState,
      justEliminated,
      selectedPiece,
      validMoves,
      history,
      viewingHistoryIndex
    };
  }, [history, viewingHistoryIndex, boardState, currentPlayerTurn, gameStatus, winner, capturedPieces, scores, promotionState, justEliminated, selectedPiece, validMoves]);

  // Use the individual selectors directly - no need to extract from displayedGameState

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

  // Function to trigger floating points animation
  const triggerFloatingPoints = (points: number, boardX: number, boardY: number, playerColor: string) => {
    const id = `floating-${Date.now()}-${Math.random()}`;
    // Add slight random offset to prevent overlapping animations
    const offsetX = (Math.random() - 0.5) * 20;
    const offsetY = (Math.random() - 0.5) * 10;
    
    const newFloatingPoint = {
      id,
      points,
      x: boardX + offsetX,
      y: boardY + offsetY,
      color: playerColor,
    };
    
    setFloatingPoints(prev => [...prev, newFloatingPoint]);
  };

  // Function to remove floating point after animation
  const removeFloatingPoint = (id: string) => {
    setFloatingPoints(prev => prev.filter(point => point.id !== id));
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
      isEliminated: eliminatedPlayers.includes("r"),
    },
    {
      name: getPlayerName("b"),
      color: "b",
      score: scores.b,
      capturedPieces: capturedPieces.b,
      isCurrentTurn: currentPlayerTurn === "b",
      isEliminated: eliminatedPlayers.includes("b"),
    },
    {
      name: getPlayerName("y"),
      color: "y",
      score: scores.y,
      capturedPieces: capturedPieces.y,
      isCurrentTurn: currentPlayerTurn === "y",
      isEliminated: eliminatedPlayers.includes("y"),
    },
    {
      name: getPlayerName("g"),
      color: "g",
      score: scores.g,
      capturedPieces: capturedPieces.g,
      isCurrentTurn: currentPlayerTurn === "g",
      isEliminated: eliminatedPlayers.includes("g"),
    },
  ];

  // Show loading screen if game state isn't ready
  if (!isGameStateReady) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        {/* Subtle blueprint grid background */}
        <GridBackground />
        <View style={{ paddingTop: insets.top }}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-white text-lg mt-4">Loading game...</Text>
          {(isOnlineMode || isP2PMode) && (
            <Text className="text-gray-400 text-sm mt-2">{connectionStatus}</Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black justify-center items-center">
      {/* Subtle blueprint grid background */}
      <GridBackground />
      
      {/* History Controls - Top Center with safe area */}
      <View className="absolute z-10" style={{ top: insets.top + 100 }}>
        <HistoryControls />
      </View>

      {/* Resign Button - Bottom Center with safe area */}
      <View style={{ position: 'absolute', bottom: insets.bottom + 80 }}>
        <ResignButton />
      </View>

      {/* Chess Board - Centered */}
      <Board onCapture={triggerFloatingPoints} />

      {/* Player Info Pods - Positioned in corners with safe areas */}

      {/* Top Left - Yellow Player */}
      <View className="absolute left-4" style={{ top: insets.top + 60 }}>
        <PlayerInfoPod
          player={players[2]}
          capturedPieces={players[2].capturedPieces}
          isCurrentTurn={players[2].isCurrentTurn}
          isEliminated={players[2].isEliminated}
        />
      </View>

      {/* Top Right - Green Player */}
      <View className="absolute right-4" style={{ top: insets.top + 60 }}>
        <PlayerInfoPod
          player={players[3]}
          capturedPieces={players[3].capturedPieces}
          isCurrentTurn={players[3].isCurrentTurn}
          isEliminated={players[3].isEliminated}
        />
      </View>

      {/* Bottom Left - Blue Player */}
      <View className="absolute left-4" style={{ bottom: insets.bottom + 80 }}>
        <PlayerInfoPod
          player={players[1]}
          capturedPieces={players[1].capturedPieces}
          isCurrentTurn={players[1].isCurrentTurn}
          isEliminated={players[1].isEliminated}
        />
      </View>

      {/* Bottom Right - Red Player */}
      <View className="absolute right-4" style={{ bottom: insets.bottom + 80 }}>
        <PlayerInfoPod
          player={players[0]}
          capturedPieces={players[0].capturedPieces}
          isCurrentTurn={players[0].isCurrentTurn}
          isEliminated={players[0].isEliminated}
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
          scores={scores}
          eliminatedPlayers={eliminatedPlayers}
          players={players.map(p => ({
            color: p.color,
            name: p.name,
            isEliminated: p.isEliminated
          }))}
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

      {/* Floating Points Effects Layer */}
      {floatingPoints.map((point) => (
        <FloatingPointsText
          key={point.id}
          points={point.points}
          x={point.x}
          y={point.y}
          color={point.color}
          onComplete={() => removeFloatingPoint(point.id)}
        />
      ))}
    </View>
  );
}

// Styles removed - using NativeWind classes instead
