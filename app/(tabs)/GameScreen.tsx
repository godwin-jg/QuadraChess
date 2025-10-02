import { Text, View } from "@/components/Themed";
import { useLocalSearchParams, useRouter } from "expo-router";
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
  clearGameOver,
} from "../../state/gameSlice";
import { botService } from "../../services/botService";
import { onlineBotService } from "../../services/onlineBotService";
import p2pService from "../../services/p2pService";
import Board from "../components/board/Board";
import ResignButton from "../components/ui/ResignButton";
import GameNotification from "../components/ui/GameNotification";
import GameOverModal from "../components/ui/GameOverModal";
import HistoryControls from "../components/ui/HistoryControls";
import PlayerHUDPanel from "../components/ui/PlayerHUDPanel";
import GameUtilityPanel from "../components/ui/GameUtilityPanel";
import PromotionModal from "../components/ui/PromotionModal";
import FloatingPointsText from "../components/ui/FloatingPointsText";
import captureAnimationService from "../../services/captureAnimationService";
import networkService from "../services/networkService";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import GridBackground from "../components/ui/GridBackground";
import { TouchableOpacity, StyleSheet } from "react-native";
import { FontAwesome } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  SlideInLeft,
  SlideOutLeft,
  SlideInRight,
  SlideOutRight
} from "react-native-reanimated";

export default function GameScreen() {
  // Get dispatch function
  const dispatch = useDispatch();
  const router = useRouter();
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

  // Game utility mode state - toggles between player info and utilities
  const [isUtilityMode, setIsUtilityMode] = useState(false);
  
  // Animation values for the toggle button
  const toggleScale = useSharedValue(1);
  const toggleRotation = useSharedValue(0);
  const toggleOpacity = useSharedValue(0.7);

  // Animated styles for the toggle button
  const toggleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [
      { scale: withSpring(toggleScale.value, { damping: 15, stiffness: 200 }) },
      { rotate: withTiming(`${toggleRotation.value}deg`, { duration: 300 }) }
    ],
    opacity: withSpring(toggleOpacity.value, { damping: 15, stiffness: 200 }),
  }));

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
      
      console.log(`GameScreen: Mode check - currentMode: ${currentMode}, currentConnectedMode: ${currentConnectedMode}`);

      // Only show warning if we're actually switching modes
      if (currentConnectedMode !== currentMode) {
        console.log(`GameScreen: Mode switch needed - from ${currentConnectedMode} to ${currentMode}`);
        await modeSwitchService.handleModeSwitch(
          currentMode as "online" | "p2p" | "local" | "solo" | "single",
          () => {
            // Confirm: Reset game and continue - bots are set automatically by game mode
            console.log(`GameScreen: Mode switch confirmed - resetting game for ${currentMode}`);
            dispatch(resetGame());
          },
          () => {
            // Cancel: Navigate back to previous mode
            console.log("Mode switch cancelled by user");
          }
        );
      } else if (currentMode !== "online" && currentMode !== "p2p") {
        // Same mode but not online or P2P - don't reset, just ensure game mode is correct
        const currentState = store.getState().game;
        if (currentState.gameMode !== currentMode) {
          console.log(`GameScreen: Updating game mode from ${currentState.gameMode} to ${currentMode}`);
          dispatch(setGameMode(currentMode as any));
        } else {
          console.log(`GameScreen: Game mode already correct (${currentMode}), no reset needed`);
        }
      }

      // Set up connection based on mode
      if (currentMode === "online" && gameId) {
        // Online game connection
        try {
          setConnectionStatus("Connecting to game...");
          console.log("GameScreen: Attempting to connect to online game:", gameId);
          
          // ✅ CRITICAL FIX: Ensure game mode is set to "online" BEFORE connecting to the service
          // This prevents the race condition where game updates are skipped because mode is still "single"
          const currentState = store.getState().game;
          if (currentState.gameMode !== "online") {
            console.log("GameScreen: Setting game mode to 'online' before connecting to service");
            dispatch(setGameMode("online"));
            // Give Redux a moment to update the state
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          
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
  const botPlayers = useSelector((state: RootState) => state.game.botPlayers);
  const gameMode = useSelector((state: RootState) => state.game.gameMode);
  

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

  // ✅ Bot Controller - triggers bot moves when it's a bot's turn
  useEffect(() => {
    // Debug logging for bot controller
    console.log(`🤖 Bot Controller Debug:`, {
      currentPlayerTurn,
      botPlayers,
      gameStatus,
      isGameStateReady,
      gameMode,
      isBotTurn: botPlayers.includes(currentPlayerTurn)
    });
    
    // Check if the current player is a bot and the game is active
    console.log(`🤖 GameScreen: Bot check - botPlayers:`, botPlayers, `currentPlayerTurn:`, currentPlayerTurn, `gameStatus:`, gameStatus, `isGameStateReady:`, isGameStateReady);
    
    if (botPlayers.includes(currentPlayerTurn) && 
        (gameStatus === 'active' || gameStatus === 'promotion') && // ✅ CRITICAL FIX: Allow bots in promotion mode too
        isGameStateReady &&
        !eliminatedPlayers.includes(currentPlayerTurn)) { // ✅ CRITICAL FIX: Don't trigger bot moves for eliminated players
      console.log(`🤖 GameScreen: Bot ${currentPlayerTurn} turn detected - scheduling bot move`);
      
      if (gameMode === 'online') {
        // For online games, use centralized bot service (single source of truth)
        console.log(`🤖 GameScreen: Using centralized bot service for online game`);
        // Get current game state from Redux store
        const currentGameState = store.getState().game;
        onlineBotService.scheduleBotMove(gameId || '', currentPlayerTurn, currentGameState);
      } else {
        // For other modes (solo, p2p), use local bot service
        const botThinkTime = 400 + Math.random() * 400; // 0.4 - 0.8 seconds

        const timer = setTimeout(() => {
          console.log(`🤖 GameScreen: Making bot move for ${currentPlayerTurn} (mode: ${gameMode})`);
          botService.makeBotMove(currentPlayerTurn);
        }, botThinkTime);

        return () => clearTimeout(timer);
      }
    }
  }, [currentPlayerTurn, botPlayers, gameStatus, isGameStateReady, gameMode, gameId, eliminatedPlayers]);

  // Cleanup bot moves when game ends or changes
  useEffect(() => {
    if (gameMode === 'online' && (gameStatus === 'finished' || gameStatus === 'checkmate')) {
      console.log(`🤖 GameScreen: Game ended, cancelling all bot moves`);
      onlineBotService.cancelAllBotMoves();
    }
  }, [gameStatus, gameMode]);

  // ✅ Bot Promotion Controller - handles bot pawn promotions
  useEffect(() => {
    // Check if there's a pending promotion for a bot player
    if (promotionState.isAwaiting && botPlayers.includes(promotionState.color || '')) {
      // Add a short delay for promotion decision
      const promotionDelay = 300 + Math.random() * 300; // 0.3 - 0.6 seconds

      const timer = setTimeout(() => {
        console.log(`🤖 GameScreen: Handling bot promotion for ${promotionState.color} (mode: ${gameMode})`);
        botService.handleBotPromotion(promotionState.color!);
      }, promotionDelay);

      return () => clearTimeout(timer);
    }
  }, [promotionState, botPlayers, gameMode]);

  // ✅ Setup capture animation service callback for bot captures
  useEffect(() => {
    // Set up the capture animation callback
    captureAnimationService.setCaptureCallback(triggerFloatingPoints);
    
    // Cleanup on unmount
    return () => {
      captureAnimationService.clearCallback();
    };
  }, []);

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
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar style="light" hidden={true} />
      <GridBackground />

      {/* Top HUD Panel - Toggle between Player Info and Utilities */}
      <View style={{ paddingTop: 8, height: 120, overflow: 'visible' }}>
        {isUtilityMode ? (
          <Animated.View 
            entering={SlideInRight.duration(300).springify()} 
            exiting={SlideOutLeft.duration(200)}
            style={{ position: 'absolute', width: '100%' }}
          >
            <GameUtilityPanel />
          </Animated.View>
        ) : (
          <Animated.View 
            entering={SlideInLeft.duration(300).springify()} 
            exiting={SlideOutRight.duration(200)}
            style={{ position: 'absolute', width: '100%' }}
          >
            <PlayerHUDPanel 
              players={[players[2], players[3]]}
              panelType="top"
            />
          </Animated.View>
        )}
      </View>

      {/* Main Game Area with breathing space */}
      <View className="flex-1 justify-center items-center" style={{ paddingVertical: 16 }}>
        <Board onCapture={triggerFloatingPoints} playerData={players} />
      </View>

      {/* Bottom HUD Panel - Home Players (Red & Blue) */}
      <View style={{ paddingBottom: 100, paddingTop: 8 }}>
        <PlayerHUDPanel 
          players={[players[0], players[1]]}
          panelType="bottom"
        />
      </View>

      {/* --- Absolutely Positioned Overlays --- */}
      
      {/* Integrated Toggle Button - Top Right Corner */}
      <Animated.View style={[toggleAnimatedStyle, { 
        position: 'absolute', 
        top: insets.top + 12, 
        right: 12, 
        zIndex: 20 
      }]}>
        <TouchableOpacity
          onPress={() => {
            // 🔊 Add haptic feedback for tactile response
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            
            // Animate the toggle
            toggleScale.value = withSpring(0.9, { damping: 15, stiffness: 200 }, () => {
              toggleScale.value = withSpring(1, { damping: 15, stiffness: 200 });
            });
            toggleRotation.value = withTiming(toggleRotation.value + 180, { duration: 300 });
            toggleOpacity.value = withSpring(isUtilityMode ? 0.7 : 1, { damping: 15, stiffness: 200 });
            
            // Toggle the mode
            setIsUtilityMode(!isUtilityMode);
          }}
          style={{
            backgroundColor: isUtilityMode ? 'rgba(59, 130, 246, 0.9)' : 'rgba(255, 255, 255, 0.15)',
            width: 48,
            height: 48,
            borderRadius: 24,
            justifyContent: 'center',
            alignItems: 'center',
            borderWidth: 2,
            borderColor: isUtilityMode ? 'rgba(59, 130, 246, 0.5)' : 'rgba(255, 255, 255, 0.3)',
            shadowColor: isUtilityMode ? '#3B82F6' : '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: isUtilityMode ? 0.4 : 0.3,
            shadowRadius: isUtilityMode ? 12 : 8,
            elevation: isUtilityMode ? 12 : 8,
          }}
          activeOpacity={0.8}
        >
          <FontAwesome 
            name="cog" 
            size={18} 
            color="#FFFFFF" 
          />
        </TouchableOpacity>
      </Animated.View>


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
          onDismiss={() => {
            // Clear the game over state to dismiss the modal
            dispatch(clearGameOver());
          }}
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
    </SafeAreaView>
  );
}

// Styles removed - using NativeWind classes instead
