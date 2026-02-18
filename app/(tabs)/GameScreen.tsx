import { Text } from "@/components/Themed";
import { useLocalSearchParams, useRouter, useNavigation } from "expo-router";
import { useEffect, useMemo, useState, useRef, useCallback } from "react";
import { ActivityIndicator, useWindowDimensions, View, TouchableOpacity, StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useGameConnection } from "../../hooks/useGameConnection";
import onlineGameService from "../../services/onlineGameService";
import p2pGameService from "../../services/p2pGameService";
import { botService } from "../../services/botService";
import { RootState, completePromotion, resetGame } from "../../state";
import {
  clearJustEliminated,
  clearGameOver,
  stepHistory,
  selectDerivedBoardState,
  timeoutPlayer,
} from "../../state/gameSlice";
import realtimeDatabaseService from "../../services/realtimeDatabaseService";
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
import { useGameFlowMachine } from "../../hooks/useGameFlowMachine";
import { useGameFlowReady } from "../components/board/useGameFlowReady";
import { useTurnClock } from "../../hooks/useTurnClock";
import { buildMoveKey, consumeSkipNextMoveAnimation, sendGameFlowEvent } from "../../services/gameFlowService";
import { resetOrchestrationState } from "../components/board/useBoardAnimationOrchestration";
import { resetAnimatorState } from "../components/board/SkiaMoveAnimator";
import {
  getBotStateMachineSnapshot,
  subscribeBotStateMachine,
  type BotMachineSnapshot,
} from "../../services/botStateMachine";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import GridBackground from "../components/ui/GridBackground";
import { FontAwesome } from "@expo/vector-icons";
import { getHudHeight, sw, sh, TAB_BAR_HEIGHT, TAB_BAR_OFFSET } from "../utils/responsive";
import * as Haptics from "expo-haptics";
import { StatusBar } from "expo-status-bar";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  Easing,
  FadeInLeft,
  FadeOutLeft,
} from "react-native-reanimated";

const PLAYER_COLOR_LABELS: Record<string, string> = {
  r: "Red",
  b: "Blue",
  y: "Purple",
  g: "Green",
};

export default function GameScreen() {
  // Get dispatch function
  const dispatch = useDispatch();
  const router = useRouter();
  const navigation = useNavigation();
  const { gameId, mode, spectate } = useLocalSearchParams<{
    gameId?: string;
    mode?: string;
    spectate?: string;
  }>();
  const isSpectatorMode = spectate === "true";
  const insets = useSafeAreaInsets();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  // Responsive layout values
  const baseHudHeight = getHudHeight(windowHeight);
  const minHudHeight = Math.max(70, baseHudHeight * 0.7); // Minimum HUD can shrink to
  const tabBarSpace = TAB_BAR_HEIGHT + TAB_BAR_OFFSET + 8; // extra 8 for breathing room above tab bar
  // Total available height for content (top HUD + board + bottom HUD)
  const totalAvailable = Math.max(0, windowHeight - insets.top - insets.bottom - tabBarSpace);
  
  // Board size calculation: prioritize filling width, constrain by height
  const isTablet = windowWidth >= 600;
  const widthLimit = isTablet ? windowWidth * 0.85 : windowWidth * 0.98; // Use nearly full width
  const boardHardCap = isTablet ? 800 : 600;
  // Gap between HUD panels and board (prevents panels from touching board/timer edges)
  const hudBoardGap = clamp(sh(20), 14, 32);
  // Max board size that fits after minimum HUDs and gaps
  const maxBoardForHeight = Math.max(0, totalAvailable - (minHudHeight * 2) - (hudBoardGap * 2));
  const idealBoardSize = Math.min(widthLimit, maxBoardForHeight, boardHardCap);
  
  // HUDs use fixed base height
  const topHudHeight = baseHudHeight;
  const bottomHudHeight = baseHudHeight;
  const hudTextScale = 1;
  
  const effectiveMode = isSpectatorMode ? "spectate" : mode;
  const { connectionStatus, isOnline: isOnlineMode, isP2P: isP2PMode, isSpectating } =
    useGameConnection(effectiveMode, gameId);
  

  // Simple notifications state
  const [notifications, setNotifications] = useState<Array<{
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error' | 'success' | 'betrayal';
  }>>([]);
  const [botMachineDebug, setBotMachineDebug] = useState<BotMachineSnapshot | null>(
    __DEV__ ? getBotStateMachineSnapshot() : null
  );
  const lastEliminatedRef = useRef<string | null>(null);
  const lastMoveKeyRef = useRef<string | null>(null);
  const promotionAwaitingRef = useRef<boolean>(false);
  const viewingHistoryRef = useRef<boolean>(false);
  const gameReadyRef = useRef<boolean>(false);
  useEffect(() => {
    if (!__DEV__) return;
    const update = () => setBotMachineDebug(getBotStateMachineSnapshot());
    update();
    const unsubscribe = subscribeBotStateMachine(update);
    return () => unsubscribe();
  }, []);

  // Game utility mode state - toggles between player info and utilities
  const [isUtilityMode, setIsUtilityMode] = useState(false);
  
  // Board rotation state - rotates board for each player's perspective
  const [boardRotation, setBoardRotation] = useState(0);
  // Visual perspective passed to children - only updates after fade-out completes
  const [visualPerspective, setVisualPerspective] = useState<{
    rotation: number;
    viewerColor: string | null;
  }>({ rotation: 0, viewerColor: null });
  const [introCountdown, setIntroCountdown] = useState<number | null>(null);
  const introCountdownValueRef = useRef<number | null>(null);
  const introCountdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const introCountdownCompletedAtRef = useRef<number | null>(null);
  const pendingPerspectiveRef = useRef<{ rotation: number; viewerColor: string | null } | null>(
    null
  );
  const hasShownInitialPerspectiveRef = useRef(false);
  
  // Opacity and scale for smooth perspective transition
  const boardOpacity = useSharedValue(0);
  const boardScale = useSharedValue(0.95);
  
  // Animation values for the toggle button
  const toggleScale = useSharedValue(1);
  const toggleOpacity = useSharedValue(0.7);

  // Animated styles for the toggle button
  const toggleAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(toggleScale.value, { damping: 15, stiffness: 200 }) }],
    opacity: withSpring(toggleOpacity.value, { damping: 15, stiffness: 200 }),
  }));

  // Get granular pieces of state - only re-render when specific data changes
  const history = useSelector((state: RootState) => state.game.history);
  const viewingHistoryIndex = useSelector((state: RootState) => state.game.viewingHistoryIndex);
  // ✅ BITBOARD ONLY: Use selector that derives board from bitboards
  const boardState = useSelector(selectDerivedBoardState);
  const lastMove = useSelector((state: RootState) => state.game.lastMove);
  const currentPlayerTurn = useSelector((state: RootState) => state.game.currentPlayerTurn);
  
  const gameStatus = useSelector((state: RootState) => state.game.gameStatus);
  const winner = useSelector((state: RootState) => state.game.winner);
  const capturedPieces = useSelector((state: RootState) => state.game.capturedPieces);
  const scores = useSelector((state: RootState) => state.game.scores);
  const clocks = useSelector((state: RootState) => state.game.clocks);
  const turnStartedAt = useSelector((state: RootState) => state.game.turnStartedAt);
  const teamMode = useSelector((state: RootState) => state.game.teamMode);
  const teamAssignments = useSelector((state: RootState) => state.game.teamAssignments);
  const winningTeam = useSelector((state: RootState) => state.game.winningTeam);
  const gamePlayers = useSelector((state: RootState) => state.game.players);
  const promotionState = useSelector((state: RootState) => state.game.promotionState);
  const justEliminated = useSelector((state: RootState) => state.game.justEliminated);
  const eliminatedPlayers = useSelector((state: RootState) => state.game.eliminatedPlayers);
  const selectedPiece = useSelector((state: RootState) => state.game.selectedPiece);
  const validMoves = useSelector((state: RootState) => state.game.validMoves);
  const gameMode = useSelector((state: RootState) => state.game.gameMode);
  const bitboardState = useSelector((state: RootState) => state.game.bitboardState);
  const isSoloMode = gameMode === "solo" || gameMode === "single";

  const [gameFlowState, gameFlowSend] = useGameFlowMachine();
  const { isFlowAnimating } = useGameFlowReady(gameFlowState);

  const isViewingHistory = viewingHistoryIndex !== null && viewingHistoryIndex < history.length;

  const historyTurn = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].currentPlayerTurn;
    }
    return currentPlayerTurn;
  }, [viewingHistoryIndex, history, currentPlayerTurn]);
  const [displayTurn, setDisplayTurn] = useState(currentPlayerTurn);
  const wasAnimatingRef = useRef(false);
  const lastProcessedMoveKeyRef = useRef<string | null>(null);

  // Get the current move key from game flow context to know if animation completed
  const processedMoveKey = gameFlowState?.context?.lastMoveKey ?? null;
  const currentMoveKey = buildMoveKey(lastMove);

  useEffect(() => {
    if (isViewingHistory) {
      setDisplayTurn(historyTurn);
      wasAnimatingRef.current = false;
      return;
    }
    
    // ✅ FIX: Only update displayTurn when animation COMPLETES
    if (isFlowAnimating) {
      // Animation is in progress - mark that we're waiting for it to complete
      wasAnimatingRef.current = true;
    } else if (wasAnimatingRef.current) {
      // Animation just completed - now update the display turn
      wasAnimatingRef.current = false;
      setDisplayTurn(currentPlayerTurn);
      lastProcessedMoveKeyRef.current = currentMoveKey;
    } else if (!lastMove) {
      // Game just started or reset - no animation needed, update immediately
      setDisplayTurn(currentPlayerTurn);
      lastProcessedMoveKeyRef.current = null;
    } else if (currentMoveKey === processedMoveKey && lastProcessedMoveKeyRef.current !== currentMoveKey) {
      // Move was processed by game flow (either animation completed or was skipped)
      // Update the display turn now
      setDisplayTurn(currentPlayerTurn);
      lastProcessedMoveKeyRef.current = currentMoveKey;
    }
    // If the current move hasn't been processed by game flow yet, don't update displayTurn
  }, [isViewingHistory, historyTurn, currentPlayerTurn, isFlowAnimating, lastMove, currentMoveKey, processedMoveKey]);
  
  const handleTimeout = useCallback(
    (playerColor: string) => {
      if (isViewingHistory) return;
      if (gameStatus !== "active" && gameStatus !== "promotion") return;
      if (eliminatedPlayers.includes(playerColor)) return;

      if (isOnlineMode) {
        onlineGameService.timeoutPlayer(playerColor).catch((error) => {
          console.error("Failed to process online timeout:", error);
        });
        return;
      }
      if (isP2PMode) {
        p2pGameService.timeoutPlayer(playerColor).catch((error) => {
          console.error("Failed to process P2P timeout:", error);
        });
        return;
      }

      dispatch(timeoutPlayer({ playerColor }));
    },
    [dispatch, eliminatedPlayers, gameStatus, isOnlineMode, isP2PMode, isViewingHistory]
  );

  const effectiveTurnStartedAt =
    turnStartedAt && introCountdownCompletedAtRef.current
      ? Math.max(turnStartedAt, introCountdownCompletedAtRef.current)
      : turnStartedAt;

  const { displayClocks } = useTurnClock({
    clocks,
    currentPlayerTurn,
    turnStartedAt: effectiveTurnStartedAt,
    gameStatus,
    eliminatedPlayers,
    teamMode,
    teamAssignments,
    isPaused: isViewingHistory || introCountdown !== null || isSoloMode,
    onTimeout: isSoloMode ? undefined : handleTimeout,
  });


  // Clear justEliminated flag after notification duration
  useEffect(() => {
    if (justEliminated && (gameStatus === "checkmate" || gameStatus === "stalemate") && !winner) {
      // Setting timer to clear justEliminated flag
      const timer = setTimeout(() => {
        // Clearing justEliminated flag
        dispatch(clearJustEliminated());
      }, 3000); // Same duration as notification

      return () => clearTimeout(timer);
    }
  }, [justEliminated, gameStatus, winner, dispatch]);

  // ✅ Game flow machine synchronization
  useEffect(() => {
    const ready =
      !!bitboardState?.pieces && bitboardState.occupancy !== undefined;
    if (ready && !gameReadyRef.current) {
      gameReadyRef.current = true;
      gameFlowSend({ type: "GAME_READY" });
    }
  }, [bitboardState, gameFlowSend]);

  useEffect(() => {
    if (viewingHistoryRef.current !== isViewingHistory) {
      viewingHistoryRef.current = isViewingHistory;
      gameFlowSend({ type: "VIEW_HISTORY", enabled: isViewingHistory });
    }
  }, [isViewingHistory, gameFlowSend]);

  useEffect(() => {
    const moveKey = buildMoveKey(lastMove);
    if (!moveKey) {
      lastMoveKeyRef.current = null;
      return;
    }
    if (moveKey === lastMoveKeyRef.current) return;
    lastMoveKeyRef.current = moveKey;
    const shouldAnimate = !isViewingHistory && !consumeSkipNextMoveAnimation();
    gameFlowSend({ type: "MOVE_APPLIED", moveKey, shouldAnimate });
  }, [lastMove, isViewingHistory, gameFlowSend]);

  useEffect(() => {
    if (promotionState.isAwaiting && !promotionAwaitingRef.current) {
      promotionAwaitingRef.current = true;
      gameFlowSend({ type: "PROMOTION_REQUIRED" });
      return;
    }
    if (!promotionState.isAwaiting && promotionAwaitingRef.current) {
      promotionAwaitingRef.current = false;
      gameFlowSend({ type: "PROMOTION_COMPLETE" });
    }
  }, [promotionState.isAwaiting, gameFlowSend]);

  useEffect(() => {
    if (gameStatus === "finished" || gameStatus === "checkmate" || gameStatus === "stalemate") {
      gameFlowSend({ type: "GAME_ENDED" });
    }
  }, [gameStatus, gameFlowSend]);

  useEffect(() => {
    if (!lastMove && history.length === 0) {
      gameReadyRef.current = false;
      gameFlowSend({ type: "RESET" });
      // Reset menu toggle to default (player info view) on new game
      setIsUtilityMode(false);
    }
  }, [lastMove, history.length, gameFlowSend]);

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

  // ✅ Reactive state for local player color - polls service until connected
  const [localPlayerColor, setLocalPlayerColor] = useState<string | null>(null);
  const lastStablePlayerColorRef = useRef<string | null>(null);
  const clearLocalPlayerColorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // ✅ Helper function to get current player color
  const getCurrentPlayerColor = (): string | null => {
    if (isOnlineMode && onlineGameService.currentPlayer) {
      return onlineGameService.currentPlayer.color;
    }
    if (isOnlineMode) {
      const currentUserId = realtimeDatabaseService.getCurrentUser()?.uid ?? null;
      if (currentUserId && Array.isArray(gamePlayers)) {
        const matchingPlayer = gamePlayers.find((player) => player.id === currentUserId);
        if (matchingPlayer?.color) {
          return matchingPlayer.color;
        }
      }
    }
    if (isP2PMode && p2pGameService.currentPlayer) {
      return p2pGameService.currentPlayer.color;
    }
    // For local games, return null (no specific player)
    return null;
  };

  // ✅ Watch for player color changes (including when host is reassigned to different color)
  useEffect(() => {
    if (!isOnlineMode && !isP2PMode) {
      if (clearLocalPlayerColorTimeoutRef.current) {
        clearTimeout(clearLocalPlayerColorTimeoutRef.current);
        clearLocalPlayerColorTimeoutRef.current = null;
      }
      lastStablePlayerColorRef.current = null;
      setLocalPlayerColor(null);
      return;
    }
    
    const commitPlayerColor = (color: string | null) => {
      if (color) {
        if (clearLocalPlayerColorTimeoutRef.current) {
          clearTimeout(clearLocalPlayerColorTimeoutRef.current);
          clearLocalPlayerColorTimeoutRef.current = null;
        }
        lastStablePlayerColorRef.current = color;
        setLocalPlayerColor(color);
        return;
      }

      if (clearLocalPlayerColorTimeoutRef.current) return;
      clearLocalPlayerColorTimeoutRef.current = setTimeout(() => {
        const currentColor = getCurrentPlayerColor();
        if (!currentColor) {
          lastStablePlayerColorRef.current = null;
          setLocalPlayerColor(null);
        }
        clearLocalPlayerColorTimeoutRef.current = null;
      }, 400);
    };

    // Check immediately
    const color = getCurrentPlayerColor();
    commitPlayerColor(color ?? null);
    
    // Keep polling to detect color changes (e.g., when host is reassigned due to bot config)
    let lastColor = color ?? null;
    const interval = setInterval(() => {
      const currentColor = getCurrentPlayerColor();
      if (currentColor !== lastColor) {
        lastColor = currentColor;
        commitPlayerColor(currentColor ?? null);
      }
    }, 200);
    
    return () => {
      clearInterval(interval);
      if (clearLocalPlayerColorTimeoutRef.current) {
        clearTimeout(clearLocalPlayerColorTimeoutRef.current);
        clearLocalPlayerColorTimeoutRef.current = null;
      }
    };
  }, [isOnlineMode, isP2PMode, gameId, gamePlayers]);

  // ✅ Board rotation logic - rotate board for each player's perspective
  useEffect(() => {
    if (localPlayerColor) {
      // Rotate board so each player sees their pieces at the bottom (red position)
      let rotation = 0;
      switch (localPlayerColor) {
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

      setBoardRotation(rotation);
    } else {
      // For local games, keep default rotation
      setBoardRotation(0);
    }
  }, [localPlayerColor]);

  // Track if this is the initial mount for rotation animation
  const isFirstRender = useRef(true);
  const previousRotation = useRef(0);
  
  // ✅ Reset rotation refs when game changes (to handle navigation between games)
  useEffect(() => {
    isFirstRender.current = true;
    previousRotation.current = 0;
    hasShownInitialPerspectiveRef.current = false;
    pendingPerspectiveRef.current = null;
    introCountdownCompletedAtRef.current = null;
    if (introCountdownIntervalRef.current) {
      clearInterval(introCountdownIntervalRef.current);
      introCountdownIntervalRef.current = null;
    }
    introCountdownValueRef.current = null;
    setIntroCountdown(null);
    // ✅ Also clear localPlayerColor to prevent countdown from triggering on stale data
    lastStablePlayerColorRef.current = null;
    setLocalPlayerColor(null);
    // Hide board until the correct perspective is ready
    boardOpacity.value = 0;
    boardScale.value = 0.95;
  }, [gameId]);

  useEffect(() => {
    return () => {
      if (introCountdownIntervalRef.current) {
        clearInterval(introCountdownIntervalRef.current);
      }
      introCountdownValueRef.current = null;
    };
  }, []);
  
  // ✅ Animate board perspective change with smooth ease-in-out transition
  useEffect(() => {
    const targetPlayerColor = localPlayerColor ?? null;
    
    const targetPerspective = { rotation: boardRotation, viewerColor: targetPlayerColor };

    const shouldWaitForLocalPlayer =
      (isOnlineMode || isP2PMode) &&
      !isSpectatorMode &&
      !targetPlayerColor &&
      !hasShownInitialPerspectiveRef.current;

    if (shouldWaitForLocalPlayer) {
      boardOpacity.value = 0;
      boardScale.value = 0.95;
      return;
    }

    // ✅ Only show countdown for online/P2P modes - not for solo/single player or spectators
    if (!hasShownInitialPerspectiveRef.current && targetPlayerColor && (isOnlineMode || isP2PMode) && !isSpectatorMode) {
      hasShownInitialPerspectiveRef.current = true;
      pendingPerspectiveRef.current = targetPerspective;
      // Keep the previous board visible during the countdown
      boardOpacity.value = 1;
      boardScale.value = 1;
      introCountdownCompletedAtRef.current = null;
      introCountdownValueRef.current = 3;
      setIntroCountdown(3);

      if (introCountdownIntervalRef.current) {
        clearInterval(introCountdownIntervalRef.current);
      }

      introCountdownIntervalRef.current = setInterval(() => {
        const current = introCountdownValueRef.current;
        if (current === null) return;

        if (current <= 1) {
          if (introCountdownIntervalRef.current) {
            clearInterval(introCountdownIntervalRef.current);
            introCountdownIntervalRef.current = null;
          }
          introCountdownCompletedAtRef.current = Date.now();
          const pending = pendingPerspectiveRef.current ?? targetPerspective;
          setVisualPerspective(pending);
          previousRotation.current = pending.rotation;
          isFirstRender.current = false;
          introCountdownValueRef.current = null;
          setIntroCountdown(null);
          boardOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
          boardScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
          return;
        }

        const next = current - 1;
        introCountdownValueRef.current = next;
        setIntroCountdown(next);
      }, 1000);
      return;
    }

    if (introCountdown !== null) {
      pendingPerspectiveRef.current = targetPerspective;
      return;
    }

    // On first render or if rotation didn't actually change, just set values directly
    if (isFirstRender.current || boardRotation === previousRotation.current) {
      isFirstRender.current = false;
      previousRotation.current = boardRotation;
      setVisualPerspective(targetPerspective);
      boardOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
      boardScale.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
      return;
    }
    
    previousRotation.current = boardRotation;
    
    const easeOut = Easing.out(Easing.cubic);
    const easeIn = Easing.in(Easing.cubic);
    
    // Capture the target rotation for setTimeout closures
    const targetRotation = boardRotation;
    const targetViewerColor = targetPlayerColor;

    // Step 1: Fade out and scale down
    boardOpacity.value = withTiming(0, { duration: 200, easing: easeOut });
    boardScale.value = withTiming(0.95, { duration: 200, easing: easeOut });
    
    // Step 2: After fade out, change rotation
    const rotationTimeout = setTimeout(() => {
      setVisualPerspective({ rotation: targetRotation, viewerColor: targetViewerColor });
    }, 210);
    
    // Step 3: Fade back in
    const fadeInTimeout = setTimeout(() => {
      boardOpacity.value = withTiming(1, { duration: 250, easing: easeIn });
      boardScale.value = withTiming(1, { duration: 250, easing: easeIn });
    }, 220);
    
    // Cleanup: cancel pending timeouts if effect re-runs
    return () => {
      clearTimeout(rotationTimeout);
      clearTimeout(fadeInTimeout);
    };
  }, [boardRotation, localPlayerColor, introCountdown, isOnlineMode, isP2PMode]);

  // ✅ Animated style for board rotation container
  const boardRotationStyle = useAnimatedStyle(() => ({
    opacity: boardOpacity.value,
    transform: [{ scale: boardScale.value }],
  }));

  // ✅ Setup notification service callback
  useEffect(() => {
    // Set up notification service callback
    notificationService.setCallback(setNotifications);
    
    // Cleanup on unmount
    return () => {
      notificationService.clear();
    };
  }, []);

  // ✅ Spectator: clean up fully when navigating away (back gesture, hardware back, etc.)
  useEffect(() => {
    if (!isSpectatorMode) return;
    const unsubscribe = navigation.addListener("beforeRemove", () => {
      botService.cancelAllBotMoves();
      botService.cleanupBotMemory();
      sendGameFlowEvent({ type: "RESET" });
      resetOrchestrationState();
      resetAnimatorState();
      dispatch(resetGame());
    });
    return unsubscribe;
  }, [isSpectatorMode, navigation, dispatch]);

  // Clear justEliminated after notification is shown
  useEffect(() => {
    if (justEliminated && justEliminated !== lastEliminatedRef.current) {
      // ✅ CRITICAL FIX: Track this elimination to prevent duplicates
      lastEliminatedRef.current = justEliminated;
      
      // Clear after notification duration (not immediately)
      const timer = setTimeout(() => {
        dispatch(clearJustEliminated());
        
        // Also clear from server for online games
        if (gameMode === 'online' && gameId) {
          realtimeDatabaseService.clearJustEliminated(gameId).catch(error => {
            console.error('Error clearing justEliminated from server:', error);
          });
        }
        // For P2P games, sync elimination state to clients
        if (gameMode === 'p2p') {
          const p2pService = require('../../services/p2pService').default;
          if (p2pService.isGameHost()) {
            p2pService.syncGameStateToClients();
          }
        }
      }, 3000); // Clear after notification duration
      
      return () => clearTimeout(timer);
    }
  }, [justEliminated, dispatch, gameMode, gameId]);


  // Get player name from gamePlayers, fallback to color label
  const getPlayerName = useCallback((playerColor: string) => {
    const player = gamePlayers.find(p => p.color === playerColor);
    return player?.name || PLAYER_COLOR_LABELS[playerColor] || "Unknown";
  }, [gamePlayers]);

  // Check if a player is disconnected (online mode only)
  const isPlayerDisconnected = useCallback((playerColor: string) => {
    if (!isOnlineMode) return false;
    const player = gamePlayers.find(p => p.color === playerColor);
    if (!player) return false;
    if (player.isBot) return false;
    return player.isOnline === false;
  }, [gamePlayers, isOnlineMode]);

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
  const players = useMemo(
    () => [
      {
        name: getPlayerName("r"),
        colorLabel: PLAYER_COLOR_LABELS["r"],
        color: "r",
        score: scores?.r || 0,
        capturedPieces: capturedPieces?.r || [],
        isCurrentTurn: displayTurn === "r",
        isEliminated: eliminatedPlayers?.includes("r") || false,
        isDisconnected: isPlayerDisconnected("r"),
        timeMs: displayClocks?.r ?? clocks?.r ?? 0,
        isTimerDisabled: isSoloMode,
        teamLabel: teamMode ? `Team ${teamAssignments?.r ?? "A"}` : undefined,
      },
      {
        name: getPlayerName("b"),
        colorLabel: PLAYER_COLOR_LABELS["b"],
        color: "b",
        score: scores?.b || 0,
        capturedPieces: capturedPieces?.b || [],
        isCurrentTurn: displayTurn === "b",
        isEliminated: eliminatedPlayers?.includes("b") || false,
        isDisconnected: isPlayerDisconnected("b"),
        timeMs: displayClocks?.b ?? clocks?.b ?? 0,
        isTimerDisabled: isSoloMode,
        teamLabel: teamMode ? `Team ${teamAssignments?.b ?? "B"}` : undefined,
      },
      {
        name: getPlayerName("y"),
        colorLabel: PLAYER_COLOR_LABELS["y"],
        color: "y",
        score: scores?.y || 0,
        capturedPieces: capturedPieces?.y || [],
        isCurrentTurn: displayTurn === "y",
        isEliminated: eliminatedPlayers?.includes("y") || false,
        isDisconnected: isPlayerDisconnected("y"),
        timeMs: displayClocks?.y ?? clocks?.y ?? 0,
        isTimerDisabled: isSoloMode,
        teamLabel: teamMode ? `Team ${teamAssignments?.y ?? "A"}` : undefined,
      },
      {
        name: getPlayerName("g"),
        colorLabel: PLAYER_COLOR_LABELS["g"],
        color: "g",
        score: scores?.g || 0,
        capturedPieces: capturedPieces?.g || [],
        isCurrentTurn: displayTurn === "g",
        isEliminated: eliminatedPlayers?.includes("g") || false,
        isDisconnected: isPlayerDisconnected("g"),
        timeMs: displayClocks?.g ?? clocks?.g ?? 0,
        isTimerDisabled: isSoloMode,
        teamLabel: teamMode ? `Team ${teamAssignments?.g ?? "B"}` : undefined,
      },
    ],
    [
      getPlayerName,
      isPlayerDisconnected,
      scores,
      capturedPieces,
      displayTurn,
      eliminatedPlayers,
      displayClocks,
      clocks,
      teamMode,
      teamAssignments,
      isSoloMode,
    ]
  );

  const boardIsReadOnly =
    isSpectatorMode ||
    isSpectating ||
    ((isOnlineMode || isP2PMode) && !localPlayerColor);

  // Show loading screen if game state isn't ready
  if (!isGameStateReady) {
    return (
      <SafeAreaView className="flex-1 bg-black justify-center items-center">
        {/* Subtle blueprint grid background */}
        <GridBackground />
        <View>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text className="text-white text-lg mt-4">Preparing the battlefield...</Text>
          {(isOnlineMode || isP2PMode) && (
            <Text className="text-gray-400 text-sm mt-2">{connectionStatus}</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-black">
      <StatusBar style="light" hidden={true} />
      <GridBackground />
      {__DEV__ ? (
        <View pointerEvents="none" style={styles.botMachineDebug}>
          {botMachineDebug && (
            <Text style={styles.botMachineText}>
              {`Bot: ${botMachineDebug.state}${
                botMachineDebug.scheduledTurn ? ` (${botMachineDebug.scheduledTurn})` : ""
              }${
                botMachineDebug.state === "idle" && botMachineDebug.idleReason
                  ? ` · ${botMachineDebug.idleReason}`
                  : ""
              } · turn:${botMachineDebug.currentTurn} · status:${botMachineDebug.gameStatus} · bots:${botMachineDebug.botPlayers.join("")}`}
            </Text>
          )}
          {gameFlowState?.context && (
            <Text style={styles.botMachineText}>
              {`Flow: ${
                typeof gameFlowState.value === "string"
                  ? gameFlowState.value
                  : JSON.stringify(gameFlowState.value)
              } · active:${gameFlowState.context.activeMoveKey ? "yes" : "no"} · promo:${
                gameFlowState.context.promotionPending ? "yes" : "no"
              } · sync:${gameFlowState.context.syncCounter}`}
            </Text>
          )}
        </View>
      ) : null}

      {/* Top HUD Panel - Toggle between Player Info and Utilities */}
      <View
        style={{
          height: topHudHeight,
          overflow: "hidden",
          justifyContent: "flex-end",
          marginBottom: hudBoardGap,
          zIndex: 1,
        }}
      >
        {isUtilityMode ? (
          <GameUtilityPanel textScale={hudTextScale} />
        ) : (
          <PlayerHUDPanel 
            players={players.length >= 4 ? [players[2], players[3]] : []}
            panelType="top"
            textScale={hudTextScale}
          />
        )}
      </View>

      {/* Main Game Area - with gap from HUDs */}
      <View
        className="justify-center items-center"
        style={{ height: idealBoardSize, zIndex: 2 }}
      >
        <View style={{ width: idealBoardSize, height: idealBoardSize }}>
          <Animated.View
            style={boardRotationStyle}
            pointerEvents={introCountdown !== null || boardIsReadOnly ? "none" : "auto"}
          >
            <Board 
              playerData={players}
              boardRotation={visualPerspective.rotation}
              viewerColor={visualPerspective.viewerColor}
              displayTurn={displayTurn}
              maxBoardSize={idealBoardSize}
              isSpectatorMode={boardIsReadOnly}
            />
          </Animated.View>
          {introCountdown !== null && (
            <View 
              pointerEvents="none" 
              style={[
                styles.countdownOverlay,
                { 
                  top: -8, 
                  left: -8, 
                  right: -8, 
                  bottom: -12,
                }
              ]}
            >
              <Text style={styles.countdownText}>{introCountdown}</Text>
            </View>
          )}
        </View>
      </View>

      {/* Bottom HUD Panel - Home Players (Red & Blue) */}
      <View
        style={{
          height: bottomHudHeight,
          overflow: "hidden",
          justifyContent: "flex-start",
          marginTop: hudBoardGap,
          zIndex: 1,
        }}
      >
        <PlayerHUDPanel 
          players={[players[0], players[1]]}
          panelType="bottom"
          textScale={hudTextScale}
        />
      </View>
      
      {/* Spacer for bottom tab bar */}
      <View style={{ height: tabBarSpace }} />

      {/* --- Absolutely Positioned Overlays --- */}
      
      {/* Toggle Button - Top Right Corner (hidden for spectators) */}
      {!boardIsReadOnly && (
        <Animated.View style={[toggleAnimatedStyle, styles.toggleButtonContainer]}>
          <TouchableOpacity
            onPress={() => {
              toggleScale.value = withSpring(0.9, { damping: 15, stiffness: 200 }, () => {
                toggleScale.value = withSpring(1, { damping: 15, stiffness: 200 });
              });
              toggleOpacity.value = withSpring(isUtilityMode ? 0.7 : 1, { damping: 15, stiffness: 200 });
              setIsUtilityMode(!isUtilityMode);
            }}
            style={[
              styles.toggleButton,
              isUtilityMode ? styles.toggleButtonActive : styles.toggleButtonInactive
            ]}
            activeOpacity={0.8}
          >
            <FontAwesome
              name={isUtilityMode ? "users" : "sliders"}
              size={TOGGLE_ICON_SIZE}
              color="#FFFFFF"
            />
          </TouchableOpacity>
        </Animated.View>
      )}


      {/* Spectator Indicator */}
      {isSpectatorMode && (
        <Animated.View
          entering={FadeInLeft.duration(300).springify().damping(18)}
          exiting={FadeOutLeft.duration(200)}
          style={styles.spectatorBanner}
        >
          <View style={styles.spectatorBadge}>
            <FontAwesome name="eye" size={15} color="#4ade80" />
          </View>
        </Animated.View>
      )}

      {/* Game Notification (for eliminations during ongoing game) */}
      <GameNotification
        message={getNotificationMessage()}
        isVisible={
          justEliminated !== null && !winner
        }
        duration={3000}
      />

      {/* Game Over Modal (for final game end) - includes confetti celebration */}
      {gameStatus === "finished" && (
        <GameOverModal
          status={gameStatus}
          winner={winner || undefined}
          eliminatedPlayer={justEliminated || undefined}
          justEliminated={justEliminated || undefined}
          scores={scores}
          capturedPieces={capturedPieces}
          moveCount={history.length}
          eliminatedPlayers={eliminatedPlayers}
          teamMode={teamMode}
          teamAssignments={teamAssignments}
          winningTeam={winningTeam ?? null}
          players={players.map(p => ({
            color: p.color,
            name: p.name,
            isEliminated: p.isEliminated
          }))}
          onReset={async () => {
            try {
              botService.cleanupBotMemory();
              
              // For online games, create a rematch with same players and bots
              if (gameMode === 'online' && gameId) {
                
                // Create rematch game with same players and bots
                const newGameId = await realtimeDatabaseService.createRematchGame(gameId);
                
                // Navigate to the new game
                router.push(`/(tabs)/GameScreen?gameId=${newGameId}&mode=online`);
                
              } else if (gameMode === 'p2p') {
                // For P2P games, reset the game and sync to all clients
                dispatch(resetGame());
                const p2pService = require('../../services/p2pService').default;
                if (p2pService.isGameHost()) {
                  p2pService.syncGameStateToClients();
                }
              } else {
                // For local games, just reset the game
                dispatch(resetGame());
              }
            } catch (error) {
              console.error('Error creating rematch:', error);
              botService.cleanupBotMemory();
              dispatch(resetGame());
            }
          }}
          onWatchReplay={() => {
            dispatch(stepHistory("back"));
            dispatch(clearGameOver());
          }}
          onDismiss={() => {
            // Clear the game over state to dismiss the modal
            dispatch(clearGameOver());
          }}
        />
      )}

      {/* Promotion Modal - Only show to the player who needs to promote in multiplayer games */}
      <PromotionModal
        visible={!isSpectatorMode && promotionState.isAwaiting && 
                (localPlayerColor === null || // Local games - show to all players
                 promotionState.color === localPlayerColor)} // Multiplayer - show only to promoting player
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

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const HUD_PADDING_TOP = clamp(sh(8), 4, 12);
const HUD_PADDING_BOTTOM = clamp(sh(16), 8, 20);
const BOARD_PADDING_Y = clamp(sh(8), 4, 12);

const TOGGLE_SIZE = clamp(sw(44), 44, 64);
const TOGGLE_ICON_SIZE = clamp(sw(18), 18, 28);
const TOGGLE_OFFSET_X = clamp(sw(12), 10, 20);
const TOGGLE_OFFSET_Y = clamp(sh(32), 24, 48);
const DEBUG_OFFSET_TOP = clamp(sh(6), 4, 12);
const DEBUG_OFFSET_RIGHT = clamp(sw(8), 6, 16);

const styles = StyleSheet.create({
  botMachineDebug: {
    position: "absolute",
    right: DEBUG_OFFSET_RIGHT,
    top: DEBUG_OFFSET_TOP,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    zIndex: 10,
  },
  botMachineText: {
    color: "#ffffff",
    fontSize: 12,
    letterSpacing: 0.3,
  },
  toggleButtonContainer: {
    position: 'absolute',
    right: TOGGLE_OFFSET_X,
    top: TOGGLE_OFFSET_Y,
    zIndex: 20,
  },
  toggleButton: {
    width: TOGGLE_SIZE,
    height: TOGGLE_SIZE,
    borderRadius: TOGGLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  toggleButtonActive: {
    backgroundColor: 'rgba(59, 130, 246, 0.9)',
  },
  toggleButtonInactive: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  countdownOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    zIndex: 15,
  },
  countdownText: {
    color: "#ffffff",
    fontSize: 56,
    fontWeight: "700",
    letterSpacing: 2,
  },
  spectatorBanner: {
    position: "absolute",
    top: TOGGLE_OFFSET_Y,
    left: TOGGLE_OFFSET_X + 6,
    zIndex: 20,
  },
  spectatorBadge: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(74, 222, 128, 0.12)",
    borderWidth: 1,
    borderColor: "rgba(74, 222, 128, 0.3)",
    width: 34,
    height: 34,
    borderRadius: 17,
  },
});
