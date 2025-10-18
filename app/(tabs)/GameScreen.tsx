import { Text, View } from "@/components/Themed";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState, useRef } from "react";
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
import realtimeDatabaseService from "../../services/realtimeDatabaseService";
import { BOT_CONFIG } from "../../config/gameConfig";
import Board from "../components/board/Board";
import ResignButton from "../components/ui/ResignButton";
import GameNotification from "../components/ui/GameNotification";
import GameOverModal from "../components/ui/GameOverModal";
import HistoryControls from "../components/ui/HistoryControls";
import PlayerHUDPanel from "../components/ui/PlayerHUDPanel";
import GameUtilityPanel from "../components/ui/GameUtilityPanel";
import PromotionModal from "../components/ui/PromotionModal";
import notificationService from "../../services/notificationService";
import SimpleNotification from "../components/ui/SimpleNotification";
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
  

  // Bot turn tracking to prevent multiple rapid triggers
  const lastProcessedTurn = useRef<string | null>(null);
  
  // ✅ CRITICAL FIX: Store initial mode to prevent unwanted mode switching
  const initialModeRef = useRef<string | null>(null);

  // Simple notifications state
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  }>>([]);

  // Game utility mode state - toggles between player info and utilities
  const [isUtilityMode, setIsUtilityMode] = useState(false);
  
  // Board rotation state - rotates board for each player's perspective
  const [boardRotation, setBoardRotation] = useState(0);
  
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

    // ✅ CRITICAL FIX: Prevent mode switching during gameplay
    // Store the initial mode on first run to prevent unwanted changes
    // BUT allow mode changes when explicitly navigating to a different mode
    if (initialModeRef.current === null && mode) {
      initialModeRef.current = mode;
    } else if (mode && initialModeRef.current && mode !== initialModeRef.current) {
      // Allow mode change if explicitly navigating to a different mode
      initialModeRef.current = mode;
    }
    
    // Use the locked initial mode, fallback to current mode, then to current Redux gameMode, then to "solo"
    const currentReduxGameMode = store.getState().game.gameMode;
    const stableMode = initialModeRef.current || mode || currentReduxGameMode || "solo";
    
    // Determine the effective mode based on settings
    // Use current settings value to avoid dependency issues
    const currentSettings = settings;
    const effectiveMode = currentSettings.developer.soloMode
      ? "solo"
      : (stableMode as "solo" | "local" | "online" | "p2p" | "single" | undefined) || "solo";
    

    const setupConnectionForMode = async (currentMode: string) => {
      
      // Update mode flags
      setIsOnlineMode(currentMode === "online" && !!gameId);
      setIsP2PMode(currentMode === "p2p");

      
      // ✅ Don't override P2P mode if it's already set
      if (store.getState().game.gameMode === "p2p" && currentMode !== "p2p") {
        // Skip mode change
      } else {
        dispatch(setGameMode(currentMode as any));
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
            console.log("🔍 DEBUG GameScreen: Cleaning up online game connection - currentGameId:", gameId);
            console.trace("🔍 DEBUG GameScreen: cleanupFunction call stack");
            unsubscribeGame();
            unsubscribeMoves();
            
            // ✅ CRITICAL FIX: Only disconnect if we're actually changing modes or unmounting
            // Don't disconnect if we're just changing gameId within online mode
            const isStillOnlineMode = mode === "online";
            if (!isStillOnlineMode) {
              console.log("🔍 DEBUG GameScreen: Mode changed from online, disconnecting");
              onlineGameService.disconnect();
            } else {
              console.log("🔍 DEBUG GameScreen: Still in online mode, skipping disconnect");
            }
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
            
            // ✅ CRITICAL FIX: Only disconnect if we're actually changing modes or unmounting
            const isStillP2PMode = mode === "p2p";
            if (!isStillP2PMode) {
              console.log("🔍 DEBUG GameScreen: Mode changed from P2P, disconnecting");
              p2pGameService.disconnect();
            } else {
              console.log("🔍 DEBUG GameScreen: Still in P2P mode, skipping disconnect");
            }
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
      console.log("🔍 DEBUG GameScreen: Cleaning up connections for previous mode...");
      console.log("🔍 DEBUG GameScreen: Current mode:", mode, "gameId:", gameId);
      console.trace("🔍 DEBUG GameScreen: useEffect cleanup call stack");
      
      // ✅ CRITICAL FIX: Always run cleanup to ensure proper connection management
      // The cleanup function is designed to be safe to call multiple times
      cleanupFunction();
    };
  }, [mode, gameId]); // Removed settings.developer.soloMode and dispatch to prevent unnecessary re-runs

  // ✅ CRITICAL FIX: Removed conflicting useEffect that was overriding mode setup
  // The main useEffect already handles all mode setup correctly

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
    // ✅ CRITICAL FIX: Reset lastProcessedTurn when currentPlayerTurn changes
    // This ensures bots can make moves after eliminations and turn changes
    if (lastProcessedTurn.current !== currentPlayerTurn) {
      console.log(`🤖 GameScreen Bot Controller: Turn changed from ${lastProcessedTurn.current} to ${currentPlayerTurn}, resetting lastProcessedTurn`);
      lastProcessedTurn.current = null;
    }
    
    // ✅ CRITICAL FIX: Prevent multiple rapid bot triggers for the same turn
    if (lastProcessedTurn.current === currentPlayerTurn) {
      console.log(`🤖 GameScreen Bot Controller: Already processed turn for ${currentPlayerTurn}, skipping`);
      return;
    }
    
    // Get the effective mode for bot decisions
    const currentSettings = settings;
    const effectiveGameMode = currentSettings.developer.soloMode
      ? "solo"
      : (mode as "solo" | "local" | "online" | "p2p" | "single" | undefined) || "solo";
    
    console.log(`🤖 GameScreen Bot Controller:`, {
      currentPlayerTurn,
      lastProcessedTurn: lastProcessedTurn.current,
      isBot: botPlayers.includes(currentPlayerTurn),
      gameStatus,
      gameMode,
      effectiveGameMode,
      isGameStateReady,
      eliminatedPlayers: eliminatedPlayers,
      isEliminated: eliminatedPlayers.includes(currentPlayerTurn),
      promotionState: promotionState.isAwaiting,
      shouldTriggerBot: botPlayers.includes(currentPlayerTurn) && 
        (gameStatus === 'active' || gameStatus === 'promotion') && 
        isGameStateReady &&
        !eliminatedPlayers.includes(currentPlayerTurn) && 
        !promotionState.isAwaiting
    });
    
    if (botPlayers.includes(currentPlayerTurn) && 
        (gameStatus === 'active' || gameStatus === 'promotion') && // ✅ CRITICAL FIX: Allow bots in promotion mode too
        isGameStateReady &&
        !eliminatedPlayers.includes(currentPlayerTurn) && // ✅ CRITICAL FIX: Don't trigger bot moves for eliminated players
        !promotionState.isAwaiting) { // ✅ CRITICAL FIX: Don't trigger bot moves when promotion modal is open
      
      // Mark this turn as processed
      lastProcessedTurn.current = currentPlayerTurn;
      
      // ✅ UNIFIED BOT TIMING: Use consistent timing for all game modes
      // This ensures piece animations (250ms) have time to complete before the next bot move
      const botThinkTime = BOT_CONFIG.MOVE_DELAY;
      
      if (effectiveGameMode === 'online') {
        // For online games, use centralized bot service
        const currentGameState = store.getState().game;
        
        // ✅ CRITICAL FIX: Additional validation to prevent multiple bot triggers
        if (currentGameState.currentPlayerTurn !== currentPlayerTurn) {
          console.log(`🤖 GameScreen: Bot trigger cancelled - turn mismatch: expected ${currentPlayerTurn}, got ${currentGameState.currentPlayerTurn}`);
          return;
        }
        
        onlineBotService.scheduleBotMove(gameId || '', currentPlayerTurn, currentGameState);
      } else {
        // For local modes (solo, p2p, single), use local bot service with same timing
        const timer = setTimeout(() => {
          botService.makeBotMove(currentPlayerTurn);
        }, botThinkTime);

        return () => clearTimeout(timer);
      }
    }
  }, [currentPlayerTurn, botPlayers, gameStatus, isGameStateReady, gameMode, gameId, eliminatedPlayers, promotionState.isAwaiting]);

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

  // ✅ Helper function to get current player color
  const getCurrentPlayerColor = (): string | null => {
    if (isOnlineMode && onlineGameService.currentPlayer) {
      return onlineGameService.currentPlayer.color;
    }
    if (isP2PMode && p2pGameService.currentPlayer) {
      return p2pGameService.currentPlayer.color;
    }
    // For local games, return null (no specific player)
    return null;
  };

  // ✅ Board rotation logic - rotate board for each player's perspective
  useEffect(() => {
    const currentPlayerColor = getCurrentPlayerColor();
    
    if (currentPlayerColor) {
      // Rotate board so each player sees their pieces at the bottom (red position)
      let rotation = 0;
      switch (currentPlayerColor) {
        case 'r': // Red - default position (0 degrees)
          rotation = 0;
          break;
        case 'b': // Blue - rotate  - 90 degrees clockwise
          rotation = -90;
          break;
        case 'y': // Yellow - rotate - 180 degrees
          rotation = -180;
          break;
        case 'g': // Green - rotate -270 degrees clockwise (or 90 degrees)
          rotation = -270;
          break;
        default:
          rotation = 0;
      }
      
      console.log(`🎮 GameScreen: Rotating board for ${currentPlayerColor} player to ${rotation} degrees`);
      setBoardRotation(rotation);
    } else {
      // For local games, keep default rotation
      setBoardRotation(0);
    }
  }, [isOnlineMode, isP2PMode, onlineGameService.currentPlayer?.color, p2pGameService.currentPlayer?.color]);

  // ✅ Setup notification service callback
  useEffect(() => {
    // Set up notification service callback
    notificationService.setCallback(setNotifications);
    
    // Cleanup on unmount
    return () => {
      notificationService.clear();
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

  // Clear justEliminated after notification is shown
  useEffect(() => {
    if (justEliminated) {
      const timer = setTimeout(async () => {
        // Clear from local Redux state
        dispatch(clearJustEliminated());
        
        // ✅ CRITICAL FIX: Also clear from server for online games
        if (gameMode === 'online' && gameId) {
          try {
            await realtimeDatabaseService.clearJustEliminated(gameId);
            console.log(`🎯 GameScreen: Cleared justEliminated flag from server for game ${gameId}`);
          } catch (error) {
            console.error('Error clearing justEliminated from server:', error);
          }
        }
      }, 3000); // Clear after notification duration
      
      return () => clearTimeout(timer);
    }
  }, [justEliminated, dispatch, gameMode, gameId]);


  // Determine notification message
  const getNotificationMessage = () => {
    if (justEliminated) {
      if (gameStatus === "checkmate") {
        return `Checkmate! ${getPlayerName(justEliminated)} has been eliminated!`;
      }
      if (gameStatus === "stalemate") {
        return `Stalemate! ${getPlayerName(justEliminated)} has been eliminated!`;
      }
      // Show notification for any elimination (resignation, timeout, etc.)
      return `${getPlayerName(justEliminated)} has been eliminated!`;
    }
    return "";
  };

  // Create player data for the pods with safety checks
  const players = [
    {
      name: getPlayerName("r"),
      color: "r",
      score: scores?.r || 0,
      capturedPieces: capturedPieces?.r || [],
      isCurrentTurn: currentPlayerTurn === "r",
      isEliminated: eliminatedPlayers?.includes("r") || false,
    },
    {
      name: getPlayerName("b"),
      color: "b",
      score: scores?.b || 0,
      capturedPieces: capturedPieces?.b || [],
      isCurrentTurn: currentPlayerTurn === "b",
      isEliminated: eliminatedPlayers?.includes("b") || false,
    },
    {
      name: getPlayerName("y"),
      color: "y",
      score: scores?.y || 0,
      capturedPieces: capturedPieces?.y || [],
      isCurrentTurn: currentPlayerTurn === "y",
      isEliminated: eliminatedPlayers?.includes("y") || false,
    },
    {
      name: getPlayerName("g"),
      color: "g",
      score: scores?.g || 0,
      capturedPieces: capturedPieces?.g || [],
      isCurrentTurn: currentPlayerTurn === "g",
      isEliminated: eliminatedPlayers?.includes("g") || false,
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
          <Text className="text-white text-lg mt-4">Preparing the battlefield...</Text>
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
      <View style={{ paddingTop: 8, height: 160, overflow: 'visible' }}>
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
            entering={SlideInLeft.duration(300)} 
            exiting={SlideOutRight.duration(200)}
            style={{ position: 'absolute', width: '100%' }}
          >
            <PlayerHUDPanel 
              players={players.length >= 4 ? [players[2], players[3]] : []}
              panelType="top"
            />
          </Animated.View>
        )}
      </View>

      {/* Main Game Area with breathing space */}
      <View className="flex-1 justify-center items-center" style={{ paddingVertical: 16 }}>
        <Animated.View
          style={{
            transform: [{ rotate: `${boardRotation}deg` }],
            // Adjust padding to compensate for board rotation
            paddingTop: boardRotation === 90 ? 8 : boardRotation === 180 ? 16 : boardRotation === 270 ? 8 : 0,
            paddingBottom: boardRotation === 90 ? 8 : boardRotation === 180 ? 0 : boardRotation === 270 ? 8 : 16,
            paddingLeft: boardRotation === 90 ? 16 : boardRotation === 180 ? 8 : boardRotation === 270 ? 0 : 8,
            paddingRight: boardRotation === 90 ? 0 : boardRotation === 180 ? 8 : boardRotation === 270 ? 16 : 8,
          }}
        >
          <Board 
            playerData={players}
            boardRotation={boardRotation}
          />
        </Animated.View>
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
          onPress={async () => {
            // ✅ CRITICAL FIX: Use sound service to respect haptics settings
            try {
              const soundService = require('../../services/soundService').default;
              // Sound effect removed for menu clicks
            } catch (error) {
              console.log('🔊 Failed to play button sound:', error);
            }
            
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
          justEliminated !== null && !winner
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
          onReset={async () => {
            try {
              // ✅ CRITICAL FIX: For online games, create a rematch with same players and bots
              if (gameMode === 'online' && gameId) {
                console.log(`🎮 GameScreen: Creating rematch game for ${gameId}`);
                
                // Create rematch game with same players and bots
                const newGameId = await realtimeDatabaseService.createRematchGame(gameId);
                
                // Navigate to the new game
                router.push(`/(tabs)/GameScreen?gameId=${newGameId}&mode=online`);
                
                console.log(`🎮 GameScreen: Navigated to rematch game ${newGameId}`);
              } else {
                // For local games, just reset the game
                dispatch(resetGame());
              }
            } catch (error) {
              console.error('Error creating rematch:', error);
              // Fallback to regular reset
              dispatch(resetGame());
            }
          }}
          onDismiss={() => {
            // Clear the game over state to dismiss the modal
            dispatch(clearGameOver());
          }}
        />
      )}

      {/* Promotion Modal - Only show to the player who needs to promote in multiplayer games */}
      <PromotionModal
        visible={promotionState.isAwaiting && 
                (getCurrentPlayerColor() === null || // Local games - show to all players
                 promotionState.color === getCurrentPlayerColor())} // Multiplayer - show only to promoting player
        playerColor={promotionState.color || ""}
        onSelectPiece={async (pieceType) => {
          if (isOnlineMode && onlineGameService.isConnected) {
            try {
              await onlineGameService.makePromotion(pieceType);
            } catch (error) {
              console.error("Failed to make online promotion:", error);
              // Fallback to local promotion if online fails
              dispatch(completePromotion({ pieceType }));
            }
          } else if (isP2PMode && p2pGameService.isConnected) {
            try {
              await p2pGameService.makePromotion(pieceType);
            } catch (error) {
              console.error("Failed to make P2P promotion:", error);
              // Fallback to local promotion if P2P fails
              dispatch(completePromotion({ pieceType }));
            }
          } else {
            // Local mode - use Redux action
            dispatch(completePromotion({ pieceType }));
          }
        }}
      />

      {/* Simple Notifications Layer */}
      {notifications.map((notification) => (
        <SimpleNotification
          key={notification.id}
          message={notification.message}
          type={notification.type}
          onComplete={() => notificationService.remove(notification.id)}
        />
      ))}
    </SafeAreaView>
  );
}

// Styles removed - using NativeWind classes instead
