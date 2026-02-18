import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
  Platform,
} from "react-native";
import Slider from "@react-native-community/slider";
import ThickSlider from "../components/ui/ThickSlider";
import { LinearGradient } from "expo-linear-gradient";
import { FontAwesome, FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useIsFocused } from "@react-navigation/native";
import { RootState } from "../../state/store";
import { setPlayers, setIsHost, setCanStartGame, resetGame } from "../../state";
import { setGameMode } from "../../state/gameSlice";
import realtimeDatabaseService, {
  RealtimeGame,
} from "../../services/realtimeDatabaseService";
import { useSettings } from "../../context/SettingsContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
} from "react-native-reanimated";
import GridBackground from "../components/ui/GridBackground";
import RadialGlowBackground from "../components/ui/RadialGlowBackground";
import TeamAssignmentDnD from "../components/ui/TeamAssignmentDnD";
import { hapticsService } from "../../services/hapticsService";
import { getTabBarSpacer } from "../utils/responsive";

type TeamAssignments = { r: "A" | "B"; b: "A" | "B"; y: "A" | "B"; g: "A" | "B" };
type TimeControlSettings = { baseMinutes: number; incrementSeconds: number };
const DEFAULT_TEAM_ASSIGNMENTS: TeamAssignments = { r: "A", y: "A", b: "B", g: "B" };
const DEFAULT_TIME_CONTROL: TimeControlSettings = { baseMinutes: 5, incrementSeconds: 0 };
const COLOR_LABELS: Record<string, string> = {
  r: "Red",
  b: "Blue",
  y: "Purple",
  g: "Green",
};
const SECTION_TITLE_CLASS = "text-white text-lg font-semibold";
const TIME_CONTROL_LIMITS = {
  baseMinutes: { min: 1, max: 30, step: 1 },
  incrementSeconds: { min: 0, max: 30, step: 1 },
};
const AUTO_CLEANUP_INTERVAL_MS = 30 * 60 * 1000;
const AUTO_CLEANUP_MIN_AGE_MS = 30 * 60 * 1000;

const LOBBY_FONTS = {
  title: "Rajdhani_700Bold",
  heading: "Rajdhani_600SemiBold",
  body: "Rajdhani_500Medium",
};

interface LobbyMenuButtonProps {
  onPress: () => void;
  disabled: boolean;
  iconName: string;
  iconColor: string;
  title: string;
  subtitle: string;
  borderColor?: string;
  delay?: number;
}

const LobbyMenuButton: React.FC<LobbyMenuButtonProps> = ({
  onPress,
  disabled,
  iconName,
  iconColor,
  title,
  subtitle,
  borderColor = "rgba(255,255,255,0.15)",
  delay = 0,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 12, stiffness: 80 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    hapticsService.buttonPress();
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const iconFill =
    iconColor.startsWith("#") && iconColor.length === 7
      ? `${iconColor}26`
      : "rgba(255,255,255,0.08)";

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        className="py-4 px-5 rounded-2xl active:opacity-80 flex-row items-center overflow-hidden"
        style={{
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor,
        }}
      >
        <View
          className="w-12 h-12 rounded-xl justify-center items-center mr-4"
          style={{ backgroundColor: iconFill }}
        >
          <MaterialCommunityIcons
            name={iconName as any}
            size={26}
            color={iconColor}
          />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl tracking-wide"
            style={{ color: "#ffffff", fontFamily: LOBBY_FONTS.heading }}
          >
            {title}
          </Text>
          <Text
            className="text-base mt-0.5"
            style={{
              color: "rgba(255,255,255,0.5)",
              fontFamily: LOBBY_FONTS.body,
            }}
          >
            {subtitle}
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-right"
          size={24}
          color="rgba(255,255,255,0.3)"
        />
      </TouchableOpacity>
    </Animated.View>
  );
};

const OnlineLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { resigned } = useLocalSearchParams<{ resigned?: string }>();
  const { settings, updateProfile } = useSettings();
  const insets = useSafeAreaInsets();
  const tabBarSpacer = getTabBarSpacer(insets.bottom);
  
  // Debug logging

  const gameState = useSelector((state: RootState) => state.game);

  const { players, isHost, canStartGame } = useMemo(
    () => ({
      players: gameState.players || [],
      isHost: gameState.isHost || false,
      canStartGame: gameState.canStartGame || false,
    }),
    [gameState.players, gameState.isHost, gameState.canStartGame]
  );

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [availableGames, setAvailableGames] = useState<RealtimeGame[]>([]);
  const [playingGames, setPlayingGames] = useState<RealtimeGame[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [currentGameStatus, setCurrentGameStatus] = useState<RealtimeGame["status"] | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [botPlayers, setBotPlayers] = useState<string[]>([]);
  const [teamMode, setTeamMode] = useState(false);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignments>(DEFAULT_TEAM_ASSIGNMENTS);
  const [timeControl, setTimeControl] = useState<TimeControlSettings>(DEFAULT_TIME_CONTROL);
  const [isUpdatingTimeControl, setIsUpdatingTimeControl] = useState(false);
  const [isTimeControlExpanded, setIsTimeControlExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'available'>('available');
  const [joinCodeInput, setJoinCodeInput] = useState("");
  const [isJoiningByCode, setIsJoiningByCode] = useState(false);
  const [currentGameJoinCode, setCurrentGameJoinCode] = useState<string | null>(null);
  const [currentGameIsPrivate, setCurrentGameIsPrivate] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showFullGames, setShowFullGames] = useState(false);
  const [staleTick, setStaleTick] = useState(0);
  const isFocused = useIsFocused();
  const authInFlightRef = useRef(false);
  const lastAutoCleanupAtRef = useRef(0);
  const autoCleanupInFlightRef = useRef(false);
  const isAdjustingTimeControlRef = useRef(false);
  const lastSyncedTimeControlRef = useRef(
    `${DEFAULT_TIME_CONTROL.baseMinutes}:${DEFAULT_TIME_CONTROL.incrementSeconds}`
  );

  useEffect(() => {
    if (gameState.teamAssignments) {
      setTeamAssignments(gameState.teamAssignments);
    }
    setTeamMode(!!gameState.teamMode);
  }, [gameState.teamAssignments, gameState.teamMode]);

  useEffect(() => {
    if (!currentGameId) {
      setCurrentGameStatus(null);
      setCurrentGameJoinCode(null);
      setCurrentGameIsPrivate(false);
      setTimeControl(DEFAULT_TIME_CONTROL);
      lastSyncedTimeControlRef.current = `${DEFAULT_TIME_CONTROL.baseMinutes}:${DEFAULT_TIME_CONTROL.incrementSeconds}`;
    }
  }, [currentGameId]);

  // ✅ CRITICAL FIX: Clear game context immediately when user resigned
  // This ensures the waiting room is not shown after resignation
  useEffect(() => {
    if (resigned === "true") {
      setCurrentGameId(null);
      setBotPlayers([]);
      dispatch(setPlayers([]));
      dispatch(setIsHost(false));
      dispatch(setCanStartGame(false));
      
      // Clear the query param to avoid re-triggering on subsequent renders
      router.setParams({ resigned: undefined });
    }
  }, [resigned, dispatch, router]);

  const initializeAuth = useCallback(
    async (statusLabel?: string) => {
      if (authInFlightRef.current) return;
      authInFlightRef.current = true;
      setIsConnected(false);
      try {
        setConnectionStatus(statusLabel ?? "Authenticating...");
        // Use Realtime Database
        await realtimeDatabaseService.signInAnonymously();
        
        setConnectionStatus("Connecting...");
        setIsConnected(true);
        
        // Skip connection test to reduce loading time
        // Connection will be validated when subscribing to games
      } catch (error) {
        console.error("Failed to initialize Firebase auth:", error);
        const message = error instanceof Error ? error.message : String(error);
        const timedOut = message.toLowerCase().includes("timed out");
        setConnectionStatus(timedOut ? "Authentication timed out" : "Connection failed");
        Alert.alert(
          "Connection Error",
          timedOut
            ? "Authentication timed out. Check your network and device time, then try again."
            : "Failed to connect to online services"
        );
      } finally {
        authInFlightRef.current = false;
      }
    },
    []
  );

  // Initialize Firebase auth (optimized)
  useEffect(() => {
    initializeAuth();
  }, [initializeAuth]);

  // Subscribe to available games
  useEffect(() => {
    if (!isConnected || !isFocused) return;
    
    const unsubscribe = realtimeDatabaseService.subscribeToAvailableGames(
      (games) => {
        setAvailableGames(games);
      }
    );

    return unsubscribe;
  }, [isConnected, isFocused]);

  // Subscribe to live (playing) games for spectating
  useEffect(() => {
    if (!isConnected || !isFocused) return;
    
    const unsubscribe = realtimeDatabaseService.subscribeToPlayingGames(
      (games) => {
        setPlayingGames(games);
      }
    );

    return unsubscribe;
  }, [isConnected, isFocused]);

  // Periodic tick to re-evaluate playing games staleness
  // (Firebase listener only fires on data changes; if all players left a
  //  game and nothing else writes to it, the listener won't re-fire.)
  useEffect(() => {
    if (!isFocused) return;
    const id = setInterval(() => setStaleTick((t) => t + 1), 60_000);
    return () => clearInterval(id);
  }, [isFocused]);

  // Subscribe to current game updates for navigation
  useEffect(() => {
    if (!currentGameId || !isFocused) return;

    const unsubscribe = realtimeDatabaseService.subscribeToGame(
      currentGameId,
      (game) => {
        if (game) {
          const user = realtimeDatabaseService.getCurrentUser();
          
          // Check if current user is still a participant in the game
          const isUserInGame = user && game.players && game.players[user.uid];
          
          // If user is not in the game anymore (resigned/left), clear the game context
          if (!isUserInGame) {
            setCurrentGameId(null);
            dispatch(setPlayers([]));
            dispatch(setIsHost(false));
            dispatch(setCanStartGame(false));
            return;
          }
          
          // If game is finished, clear the game context
          if (game.status === "finished") {
            setCurrentGameId(null);
            dispatch(setPlayers([]));
            dispatch(setIsHost(false));
            dispatch(setCanStartGame(false));
            return;
          }
          
          const normalizedPlayers = Object.entries(game.players || {}).map(
            ([playerId, player]) => ({
              id: player.id || playerId,
              name: player.name || `Player ${playerId.slice(0, 8)}`,
              color: player.color || "g",
              isHost: player.isHost || false,
              isOnline: player.isOnline || false,
              isBot: player.isBot || false,
              lastSeen: player.lastSeen || Date.now(),
              connectionState: player.connectionState,
            })
          );
          dispatch(setPlayers(normalizedPlayers));

          dispatch(setIsHost(!!user && game.hostId === user.uid));
          dispatch(setCanStartGame(game.status === "waiting" && normalizedPlayers.length === 4));

          const botPlayersFromGame = normalizedPlayers
            .filter((player: any) => player.isBot === true)
            .map((player: any) => player.color);
          setBotPlayers(botPlayersFromGame);

          setCurrentGameStatus(game.status);
          setCurrentGameJoinCode(game.joinCode || null);
          setCurrentGameIsPrivate(!!game.isPrivate);
          const baseMs = game.gameState?.timeControl?.baseMs ?? DEFAULT_TIME_CONTROL.baseMinutes * 60 * 1000;
          const incrementMs = game.gameState?.timeControl?.incrementMs ?? DEFAULT_TIME_CONTROL.incrementSeconds * 1000;
          const nextBaseMinutes = clampValue(
            Math.round(baseMs / (60 * 1000)),
            TIME_CONTROL_LIMITS.baseMinutes.min,
            TIME_CONTROL_LIMITS.baseMinutes.max
          );
          const nextIncrementSeconds = clampValue(
            Math.round(incrementMs / 1000),
            TIME_CONTROL_LIMITS.incrementSeconds.min,
            TIME_CONTROL_LIMITS.incrementSeconds.max
          );
          const nextKey = `${nextBaseMinutes}:${nextIncrementSeconds}`;
          lastSyncedTimeControlRef.current = nextKey;
          if (!isAdjustingTimeControlRef.current) {
            setTimeControl({
              baseMinutes: nextBaseMinutes,
              incrementSeconds: nextIncrementSeconds,
            });
          }
          
          // Only redirect to game if:
          // 1. Game status is "playing"
          // 2. User is still an active participant (checked above)
          if (game.status === "playing") {
            router.push(
              `/(tabs)/GameScreen?gameId=${currentGameId}&mode=online`
            );
          }
        } else {
          // Game was deleted
          setCurrentGameId(null);
          dispatch(setPlayers([]));
          dispatch(setIsHost(false));
          dispatch(setCanStartGame(false));
          Alert.alert("Game Ended", "The game you were in has ended");
        }
      }
    );

    return unsubscribe;
  }, [currentGameId, dispatch, router, isFocused]);

  const runAutoCleanup = useCallback(
    async (source: string) => {
      if (!isConnected) return;
      const now = Date.now();
      if (autoCleanupInFlightRef.current) return;
      if (now - lastAutoCleanupAtRef.current < AUTO_CLEANUP_INTERVAL_MS) return;

      autoCleanupInFlightRef.current = true;
      try {
        await realtimeDatabaseService.cleanupCorruptedGames({
          minAgeMs: AUTO_CLEANUP_MIN_AGE_MS,
        });
      } catch (error) {
        // Auto cleanup failed - continue silently
      } finally {
        lastAutoCleanupAtRef.current = now;
        autoCleanupInFlightRef.current = false;
      }
    },
    [isConnected]
  );

  useEffect(() => {
    if (!isFocused) return;
    void runAutoCleanup("lobby-focus");
  }, [isFocused, runAutoCleanup]);

  // Name editing functions
  const startEditingName = () => {
    setTempName(settings.profile.name);
    setIsEditingName(true);
  };

  const saveName = () => {
    if (tempName.trim()) {
      updateProfile({ name: tempName.trim() });
    }
    setIsEditingName(false);
  };

  const clampValue = (value: number, min: number, max: number) =>
    Math.min(max, Math.max(min, value));

  const formatTimeControlLabel = useCallback((control: TimeControlSettings) => {
    const baseLabel = `${control.baseMinutes} min`;
    const incrementLabel =
      control.incrementSeconds > 0
        ? `+${control.incrementSeconds}s`
        : "no increment";
    return `${baseLabel} | ${incrementLabel}`;
  }, []);

  const commitTimeControl = useCallback(
    async (nextControl: TimeControlSettings) => {
      if (!isHost || !currentGameId || currentGameStatus !== "waiting") {
        return;
      }
      const key = `${nextControl.baseMinutes}:${nextControl.incrementSeconds}`;
      if (key === lastSyncedTimeControlRef.current) {
        return;
      }

      setIsUpdatingTimeControl(true);
      try {
        await realtimeDatabaseService.updateTimeControl(
          currentGameId,
          nextControl.baseMinutes * 60 * 1000,
          nextControl.incrementSeconds * 1000
        );
        lastSyncedTimeControlRef.current = key;
      } catch (error) {
        const [baseMinutes, incrementSeconds] =
          lastSyncedTimeControlRef.current.split(":").map(Number);
        setTimeControl({
          baseMinutes: Number.isFinite(baseMinutes)
            ? baseMinutes
            : DEFAULT_TIME_CONTROL.baseMinutes,
          incrementSeconds: Number.isFinite(incrementSeconds)
            ? incrementSeconds
            : DEFAULT_TIME_CONTROL.incrementSeconds,
        });
        Alert.alert("Time Control", "Failed to update time control.");
      } finally {
        setIsUpdatingTimeControl(false);
      }
    },
    [currentGameId, currentGameStatus, isHost]
  );

  const createGame = async () => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    // 🔊 Play button sound for create game action
    try {
      const soundService = require('../../services/soundService').default;
      soundService.playButtonSound();
    } catch (error) {
    }

    setIsLoading(true);
    try {
      // Reset local game state before creating new game
      dispatch(resetGame());
      // ✅ CRITICAL FIX: Set game mode to "online" when creating a game
      dispatch(setGameMode("online"));
      
      const gameId = await realtimeDatabaseService.createGame(
        settings.profile.name.trim(),
        []
      );
      setCurrentGameId(gameId);
      
      // 🔊 Play success sound for creating game
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playSuccessSound();
      } catch (error) {
      }
    } catch (error) {
      console.error("Error creating game:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      Alert.alert("Error", `Failed to create game: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const joinGame = async (gameId: string, code?: string) => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      // Reset local game state before joining new game
      dispatch(resetGame());
      dispatch(setGameMode("online"));
      
      await realtimeDatabaseService.joinGame(gameId, settings.profile.name, code);
      setCurrentGameId(gameId);
    } catch (error: any) {
      console.error("Error joining game:", error);
      const msg = error?.message || "";
      if (msg.includes("Invalid game code")) {
        Alert.alert("Invalid Code", "The code you entered is incorrect.");
      } else {
        Alert.alert("Error", "Failed to join game");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const joinGameWithCode = async () => {
    const code = joinCodeInput.replace(/[^0-9]/g, "").slice(0, 4);
    if (code.length !== 4) {
      Alert.alert("Invalid Code", "Please enter a 4-digit game code.");
      return;
    }
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsJoiningByCode(true);
    try {
      const game = await realtimeDatabaseService.findGameByJoinCode(code);
      if (!game) {
        Alert.alert("Not Found", "No waiting game found with that code.");
        return;
      }
      await joinGame(game.id, code);
      setJoinCodeInput("");
    } catch (error: any) {
      console.error("Error joining by code:", error);
      const msg = error?.message || "";
      if (msg.includes("Invalid game code")) {
        Alert.alert("Invalid Code", "The code you entered is incorrect.");
      } else {
        Alert.alert("Error", "Failed to join game with that code.");
      }
    } finally {
      setIsJoiningByCode(false);
    }
  };

  const leaveGame = async () => {
    if (currentGameId) {
      try {
        await realtimeDatabaseService.leaveGame(currentGameId);
        
        // Clean up local state
        setCurrentGameId(null);
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        
        // Stay in the lobby - no navigation needed
        
      } catch (error: any) {
        console.error("Error leaving game:", error);
        
        // Handle specific error cases - don't treat max-retries as critical
        if (error.message?.includes('max-retries') || 
            error.message?.includes('too many retries') ||
            error.message?.includes('Failed to leave game after')) {
          
          // Just clean up locally without showing error - max-retries is not critical
          setCurrentGameId(null);
          dispatch(setPlayers([]));
          dispatch(setIsHost(false));
          dispatch(setCanStartGame(false));
        } else {
          // For other errors, still try to clean up locally
          setCurrentGameId(null);
          dispatch(setPlayers([]));
          dispatch(setIsHost(false));
          dispatch(setCanStartGame(false));
          
          Alert.alert(
            "Leave Game", 
            "There was an issue leaving the game, but you've been removed locally.",
          );
        }
      }
    } else {
      // No game ID, just stay in lobby
    }
  };

  const spectateGame = (gameId: string) => {
    try {
      const { hapticsService } = require('../../services/hapticsService');
      hapticsService.buttonPress();
    } catch (error) {
    }
    router.push(`/(tabs)/GameScreen?gameId=${gameId}&mode=spectate&spectate=true`);
  };

  const startGame = async () => {
    if (!currentGameId) return;

    // 🔊 Play button sound for start game action
    try {
      const soundService = require('../../services/soundService').default;
      soundService.playButtonSound();
    } catch (error) {
    }

    try {
      await realtimeDatabaseService.startGame(currentGameId);
      
      // 🔊 Play game start sound
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playGameStartSound();
      } catch (error) {
      }
    } catch (error) {
      console.error("Error starting game:", error);
      Alert.alert("Error", "Failed to start game");
    }
  };

  // Toggle bot status for a player color (host only)
  const toggleBotPlayer = async (color: string) => {
    if (!isHost || !currentGameId) {
      return;
    }
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    setBotPlayers(newBotPlayers);
    
    // Update bot configuration in database
    try {
      await realtimeDatabaseService.updateBotConfiguration(currentGameId, newBotPlayers);
    } catch (error) {
      console.error("Error updating bot configuration:", error);
      // Revert local state on error
      setBotPlayers(botPlayers);
      Alert.alert("Error", "Failed to update bot configuration");
    }
  };

  const updateTeamConfiguration = async (
    nextTeamMode: boolean,
    nextAssignments: TeamAssignments
  ) => {
    if (!isHost || !currentGameId) {
      return;
    }
    setTeamMode(nextTeamMode);
    setTeamAssignments(nextAssignments);
    try {
      await realtimeDatabaseService.updateTeamConfiguration(
        currentGameId,
        nextTeamMode,
        nextAssignments
      );
    } catch (error) {
      console.error("Error updating team configuration:", error);
      setTeamMode(!!gameState.teamMode);
      setTeamAssignments(gameState.teamAssignments || DEFAULT_TEAM_ASSIGNMENTS);
      Alert.alert("Error", "Failed to update team configuration");
    }
  };

  const renderGameItem = (item: RealtimeGame, index: number, isLive: boolean = false) => {
    const validPlayers = Object.values(item.players || {}).filter(player => 
      player && player.id && player.name && player.color
    );
    const playerCount = validPlayers.length;
    const isFull = playerCount >= (item.maxPlayers || 4);
    const isPrivateGame = !!item.isPrivate;

    const baseMs = item.gameState?.timeControl?.baseMs ?? 5 * 60 * 1000;
    const incrementMs = item.gameState?.timeControl?.incrementMs ?? 0;
    const baseMinutes = Math.round(baseMs / (60 * 1000));
    const incrementSeconds = Math.round(incrementMs / 1000);
    const timeControlLabel = incrementSeconds > 0 
      ? `${baseMinutes}+${incrementSeconds}` 
      : `${baseMinutes} min`;

    const blocked = !isLive && isFull;

    return (
      <TouchableOpacity
        key={item.id || `game-${index}`}
        className={`p-4 rounded-xl mb-3 border ${
          isLive
            ? "bg-blue-900/20 border-blue-500/30"
            : blocked 
              ? "bg-white/5 border-white/10 opacity-60" 
              : "bg-green-900/20 border-green-500/30"
        }`}
        onPress={() => {
          if (isLive) {
            spectateGame(item.id);
            return;
          }
          if (isFull) {
            Alert.alert("Game Full", "This game already has 4 players.");
            return;
          }
          if (isPrivateGame) {
            if (Platform.OS === "ios" && typeof Alert.prompt === "function") {
              Alert.prompt(
                "Private Game",
                "Enter the 4-digit code to join this game:",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Join",
                    onPress: (code: string | undefined) => {
                      const trimmed = (code || "").replace(/[^0-9]/g, "").slice(0, 4);
                      if (trimmed.length !== 4) {
                        Alert.alert("Invalid Code", "Please enter a 4-digit game code.");
                        return;
                      }
                      setJoinCodeInput(trimmed);
                      void joinGame(item.id, trimmed);
                    },
                  },
                ],
                "plain-text",
                "",
                "number-pad"
              );
            } else {
              Alert.alert(
                "Private Game",
                "Enter the 4-digit code in the Join with Code section, then tap Join."
              );
            }
            return;
          }
          hapticsService.buttonPress();
          joinGame(item.id);
        }}
        disabled={!isLive && (isLoading || isFull)}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-1 flex-row items-center">
            {isLive && (
              <FontAwesome name="eye" size={14} color="#3b82f6" style={{ marginRight: 8 }} />
            )}
            {!isLive && isPrivateGame && (
              <FontAwesome name="lock" size={14} color="#facc15" style={{ marginRight: 8 }} />
            )}
            <View className="flex-1">
              <Text
                className={`text-lg font-bold ${isLive ? "text-blue-300" : blocked ? "text-gray-400" : "text-white"}`}
                style={{ fontFamily: LOBBY_FONTS.heading }}
              >
                {item.hostName}'s Game
              </Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 3 }}>
                {Array.from({ length: item.maxPlayers || 4 }).map((_, i) => (
                  <FontAwesome5
                    key={i}
                    name="couch"
                    size={12}
                    color={i < playerCount ? (isLive ? '#3b82f6' : '#facc15') : '#4b5563'}
                  />
                ))}
                <Text style={{ color: '#9ca3af', fontSize: 11, marginLeft: 3, fontFamily: LOBBY_FONTS.body }}>
                  {isLive ? `${playerCount} in game` : isFull ? 'Full' : `${(item.maxPlayers || 4) - playerCount} open`}
                </Text>
              </View>
            </View>
          </View>
          <View className="items-end flex-row items-center gap-2">
            <View className="items-end">
              <Text
                className={`text-sm ${
                  isLive ? "text-blue-400" : isFull ? "text-red-400" : isPrivateGame ? "text-yellow-400" : "text-green-400"
                }`}
                style={{ fontFamily: LOBBY_FONTS.heading }}
              >
                {isLive ? "Live" : isFull ? "Full" : isPrivateGame ? "Private" : "Available"}
              </Text>
              <Text
                className="text-gray-400 text-xs mt-0.5"
                style={{ fontFamily: LOBBY_FONTS.body }}
              >
                {timeControlLabel}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const displayAvailableGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return availableGames
      .slice()
      .filter((game, index, self) =>
        game.id && self.findIndex(g => g.id === game.id) === index
      )
      .filter((game) => {
        if (!showFullGames) {
          const playerCount = Object.values(game.players || {}).filter(
            (p) => p && p.id && p.name && p.color
          ).length;
          if (playerCount >= (game.maxPlayers || 4)) return false;
        }
        if (query) {
          const hostMatch = (game.hostName || "").toLowerCase().includes(query);
          const codeMatch = (game.joinCode || "").toLowerCase().includes(query);
          return hostMatch || codeMatch;
        }
        return true;
      })
      .sort((a, b) => {
        const timestampA = a.lastActivity || a.createdAt || 0;
        const timestampB = b.lastActivity || b.createdAt || 0;
        return timestampB - timestampA;
      });
  }, [availableGames, searchQuery, showFullGames]);

  const displayPlayingGames = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const now = Date.now();
    const ALL_OFFLINE_MS = 3 * 60_000;
    return playingGames
      .slice()
      .filter((game, index, self) =>
        game.id && self.findIndex(g => g.id === game.id) === index
      )
      .filter((game) => {
        // Drop games where every non-eliminated human player is offline
        const gs = game.gameState;
        const eliminated: string[] = gs?.eliminatedPlayers ?? [];
        const humans = Object.values(game.players || {}).filter(
          (p) => p && !p.isBot && p.color && !eliminated.includes(p.color)
        );
        if (humans.length > 0) {
          const allOffline = humans.every(
            (p) => now - (p.lastSeen ?? 0) > ALL_OFFLINE_MS
          );
          if (allOffline) return false;
        }
        if (!query) return true;
        const hostMatch = (game.hostName || "").toLowerCase().includes(query);
        return hostMatch;
      })
      .sort((a, b) => {
        const timestampA = a.lastActivity || a.createdAt || 0;
        const timestampB = b.lastActivity || b.createdAt || 0;
        return timestampB - timestampA;
      });
  }, [playingGames, searchQuery, staleTick]);

  const timeControlLocked =
    !isHost || currentGameStatus !== "waiting" || isUpdatingTimeControl;
  const timeControlLabel = formatTimeControlLabel(timeControl);
  const sliderAccentColors = timeControlLocked ? ["#4b5563", "#374151"] : ["#14b8a6", "#6366f1"];
  const sliderTrackColor = timeControlLocked ? "#1f2937" : "rgba(255,255,255,0.1)";
  const sliderThumbColor = timeControlLocked ? "#6b7280" : "#ffffff";

  if (!isConnected) {
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-black">
        <RadialGlowBackground />
        <GridBackground />
        <View className="flex-1 justify-center items-center" style={{ zIndex: 1 }}>
          <ActivityIndicator size="large" color="#ffffff" />
          <Text
            className="text-white text-lg mt-4"
            style={{ fontFamily: LOBBY_FONTS.heading }}
          >
            {connectionStatus}
          </Text>
          <Text
            className="text-gray-400 text-sm mt-2"
            style={{ fontFamily: LOBBY_FONTS.body }}
          >
            Please wait while we connect...
          </Text>
          <TouchableOpacity
            className="px-5 py-2.5 rounded-xl mt-5"
            style={{
              backgroundColor: "rgba(255,255,255,0.05)",
              borderWidth: 1,
              borderColor: "rgba(59,130,246,0.3)",
            }}
            onPress={() => initializeAuth("Re-authenticating...")}
          >
            <Text
              className="text-white text-sm font-bold"
              style={{ fontFamily: LOBBY_FONTS.heading }}
            >
              Retry
            </Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (currentGameId) {
    // In-game waiting room
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-black">
        <RadialGlowBackground />
        <GridBackground />
        <ScrollView
          contentContainerStyle={{ padding: 18, paddingBottom: tabBarSpacer }}
          showsVerticalScrollIndicator={false}
          style={{ zIndex: 1 }}
        >
        <View className="items-center mb-6">
          <Text
            className="text-gray-300 text-base mb-2"
            style={{ fontFamily: LOBBY_FONTS.body }}
          >
            Playing as:
          </Text>
          <Text
            className="text-white text-2xl font-semibold"
            style={{ fontFamily: LOBBY_FONTS.title }}
          >
            {settings.profile.name}
          </Text>
        </View>

        <View className="bg-white/10 p-5 rounded-xl mb-5 items-center">
          <View className="space-y-3 w-full">
            <Text
              className="text-white text-lg font-semibold mb-2 text-center"
              style={{ fontFamily: LOBBY_FONTS.heading }}
            >
              Players ({players.length})
            </Text>
            {(() => {
              // All players (including bots) come from Redux players array
              // No need to duplicate bots from botPlayers state
              const allPlayers = players;
              
              return allPlayers.length > 0 ? (
                allPlayers.map((player, index) => (
                  <View
                    key={player.id || `player-${index}`}
                    className="flex-row items-center justify-between"
                  >
                    <Text
                      className="text-white text-lg"
                      style={{ fontFamily: LOBBY_FONTS.heading }}
                    >
                      {player.isBot
                        ? `Bot ${COLOR_LABELS[player.color] ?? "Player"}`
                        : player.name}{" "}
                      {player.isHost && "(Host)"} {player.isBot && "🤖"}
                    </Text>
                    <View className="flex-row items-center">
                      <View
                        className={`w-3 h-3 rounded-full mr-2 ${
                          player.color === "r"
                            ? "bg-red-500"
                            : player.color === "b"
                              ? "bg-blue-500"
                              : player.color === "y"
                                ? "bg-purple-500"
                                : player.color === "g"
                                  ? "bg-green-500"
                                  : "bg-gray-500"
                        }`}
                      />
                      <Text
                        className="text-gray-400 text-base"
                        style={{ fontFamily: LOBBY_FONTS.body }}
                      >
                        {player.isBot ? 'Bot' : (player.connectionState || 'connected')}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text
                  className="text-gray-400 text-base text-center"
                  style={{ fontFamily: LOBBY_FONTS.body }}
                >
                  No players yet
                </Text>
              );
            })()}
            
            {/* Bot Configuration Section (Host Only) */}
            {isHost && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <Text
                  className="text-white text-lg font-semibold mb-2 text-center"
                  style={{ fontFamily: LOBBY_FONTS.heading }}
                >
                  Add Bots
                </Text>
                <Text className="text-gray-400 text-xs mb-3 text-center">
                  Tap to toggle bot players
                </Text>
                <View className="flex-row justify-center gap-3">
                  {(['r', 'b', 'y', 'g'] as const).map((color) => {
                    const isBot = botPlayers.includes(color);
                    const bgColor = color === 'r' ? '#dc2626' : color === 'b' ? '#3b82f6' : color === 'y' ? '#a855f7' : '#22c55e';
                    
                    // Check if adding a bot would exceed 4 players
                    const humanCount = players.filter(p => !p.isBot).length;
                    const wouldBeBotCount = isBot ? botPlayers.length - 1 : botPlayers.length + 1;
                    const wouldExceedMax = !isBot && (humanCount + wouldBeBotCount > 4);
                    
                    return (
                      <TouchableOpacity
                        key={color}
                        style={{
                          width: 56,
                          height: 56,
                          borderRadius: 28,
                          backgroundColor: isBot ? bgColor : `${bgColor}1A`,
                          borderWidth: 2,
                          borderColor: isBot ? bgColor : `${bgColor}40`,
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: wouldExceedMax ? 0.4 : 1,
                        }}
                        onPress={() => {
                          if (wouldExceedMax) return;
                          hapticsService.selection();
                          toggleBotPlayer(color);
                        }}
                        disabled={wouldExceedMax}
                      >
                        <MaterialCommunityIcons
                          name={isBot ? 'robot' : 'account-outline'}
                          size={26}
                          color="#ffffff"
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {isHost && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className={SECTION_TITLE_CLASS} numberOfLines={1} style={{ fontFamily: LOBBY_FONTS.heading }}>Team Play</Text>
                  <Switch
                    value={teamMode}
                    onValueChange={(nextValue) => {
                      if (settings.game.hapticsEnabled) {
                        hapticsService.selection();
                      }
                      updateTeamConfiguration(nextValue, teamAssignments);
                    }}
                    trackColor={{ false: "#374151", true: "#22c55e" }}
                    thumbColor={teamMode ? "#ffffff" : "#d1d5db"}
                    ios_backgroundColor="#374151"
                  />
                </View>
                {teamMode && (
                  <TeamAssignmentDnD
                    teamAssignments={teamAssignments}
                    players={players.map((p) => ({
                      color: p.color as "r" | "b" | "y" | "g",
                      name: p.name,
                      isBot: p.isBot,
                    }))}
                    onAssignmentChange={(newAssignments) => {
                      if (settings.game.hapticsEnabled) {
                        hapticsService.selection();
                      }
                      updateTeamConfiguration(teamMode, newAssignments);
                    }}
                    disabled={!isHost}
                  />
                )}
              </View>
            )}
            {currentGameJoinCode && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <Text className={SECTION_TITLE_CLASS} style={{ fontFamily: LOBBY_FONTS.heading }}>Private</Text>
                    <FontAwesome name="lock" size={18} color="#facc15" style={{ marginLeft: 6 }} />
                  </View>
                  {isHost && currentGameStatus === "waiting" && (
                    <View className="flex-row items-center">
                      <Switch
                        value={currentGameIsPrivate}
                        onValueChange={async (val) => {
                          hapticsService.selection();
                          try {
                            await realtimeDatabaseService.updateGamePrivacy(currentGameId!, val);
                          } catch (error) {
                            console.error("Error updating game privacy:", error);
                            Alert.alert("Error", "Failed to update game privacy");
                          }
                        }}
                        trackColor={{ false: "#374151", true: "#eab308" }}
                        thumbColor={currentGameIsPrivate ? "#ffffff" : "#d1d5db"}
                        ios_backgroundColor="#374151"
                      />
                    </View>
                  )}
                </View>
                {currentGameIsPrivate && (
                  <Text className="text-white text-2xl font-bold tracking-[6px] mt-3 text-center">
                    {currentGameJoinCode}
                  </Text>
                )}
                {currentGameIsPrivate && (
                  <Text className="text-yellow-600 text-xs mt-2 text-center" style={{ lineHeight: 16 }}>
                    Only players with the code can join this game.
                  </Text>
                )}
              </View>
            )}
            <View className="mt-4 pt-4 border-t border-white/20">
              <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center">
                  <MaterialCommunityIcons name="clock-outline" size={16} color="#9ca3af" style={{ marginRight: 6 }} />
                  <Text className={SECTION_TITLE_CLASS} style={{ fontFamily: LOBBY_FONTS.heading }}>Time Control</Text>
                </View>
                <View className="flex-row items-center gap-2">
                  <Text className="text-gray-400 text-sm">{timeControlLabel}</Text>
                  <TouchableOpacity
                    className="px-2 py-1 rounded-full bg-white/5"
                    onPress={() => {
                      if (settings.game.hapticsEnabled) {
                        hapticsService.selection();
                      }
                      setIsTimeControlExpanded((prev) => !prev);
                    }}
                    accessibilityRole="button"
                    accessibilityLabel="Toggle time control settings"
                  >
                    <FontAwesome
                      name={isTimeControlExpanded ? "chevron-up" : "chevron-down"}
                      size={14}
                      color="#9ca3af"
                    />
                  </TouchableOpacity>
                </View>
              </View>
              {isTimeControlExpanded && (
                <>
                  <View className="mb-2">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-400 text-xs uppercase tracking-wider" style={{ fontFamily: LOBBY_FONTS.body }}>Base time</Text>
                      <View style={{
                        backgroundColor: 'rgba(96,165,250,0.15)',
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(96,165,250,0.25)',
                      }}>
                        <Text style={{ color: '#93c5fd', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], fontFamily: LOBBY_FONTS.heading }}>
                          {timeControl.baseMinutes} min
                        </Text>
                      </View>
                    </View>
                    <ThickSlider
                      minimumValue={TIME_CONTROL_LIMITS.baseMinutes.min}
                      maximumValue={TIME_CONTROL_LIMITS.baseMinutes.max}
                      step={TIME_CONTROL_LIMITS.baseMinutes.step}
                      value={timeControl.baseMinutes}
                      accentColors={sliderAccentColors}
                      trackColor={sliderTrackColor}
                      thumbColor={sliderThumbColor}
                      disabled={timeControlLocked}
                      onValueChange={(value) => {
                        if (timeControlLocked) return;
                        isAdjustingTimeControlRef.current = true;
                        const nextBaseMinutes = clampValue(
                          Math.round(value),
                          TIME_CONTROL_LIMITS.baseMinutes.min,
                          TIME_CONTROL_LIMITS.baseMinutes.max
                        );
                        setTimeControl((prev) => ({
                          ...prev,
                          baseMinutes: nextBaseMinutes,
                        }));
                      }}
                      onSlidingComplete={(value) => {
                        if (timeControlLocked) return;
                        const nextBaseMinutes = clampValue(
                          Math.round(value),
                          TIME_CONTROL_LIMITS.baseMinutes.min,
                          TIME_CONTROL_LIMITS.baseMinutes.max
                        );
                        isAdjustingTimeControlRef.current = false;
                        if (settings.game.hapticsEnabled) {
                          hapticsService.selection();
                        }
                        setTimeControl((prev) => {
                          const next = { ...prev, baseMinutes: nextBaseMinutes };
                          void commitTimeControl(next);
                          return next;
                        });
                      }}
                    />
                  </View>
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-gray-400 text-xs uppercase tracking-wider" style={{ fontFamily: LOBBY_FONTS.body }}>Increment</Text>
                      <View style={{
                        backgroundColor: 'rgba(96,165,250,0.15)',
                        paddingHorizontal: 10,
                        paddingVertical: 3,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: 'rgba(96,165,250,0.25)',
                      }}>
                        <Text style={{ color: '#93c5fd', fontSize: 13, fontWeight: '700', fontVariant: ['tabular-nums'], fontFamily: LOBBY_FONTS.heading }}>
                          {timeControl.incrementSeconds > 0 ? `+${timeControl.incrementSeconds}s` : "0s"}
                        </Text>
                      </View>
                    </View>
                    <ThickSlider
                      minimumValue={TIME_CONTROL_LIMITS.incrementSeconds.min}
                      maximumValue={TIME_CONTROL_LIMITS.incrementSeconds.max}
                      step={TIME_CONTROL_LIMITS.incrementSeconds.step}
                      value={timeControl.incrementSeconds}
                      accentColors={sliderAccentColors}
                      trackColor={sliderTrackColor}
                      thumbColor={sliderThumbColor}
                      disabled={timeControlLocked}
                      onValueChange={(value) => {
                        if (timeControlLocked) return;
                        isAdjustingTimeControlRef.current = true;
                        const nextIncrementSeconds = clampValue(
                          Math.round(value),
                          TIME_CONTROL_LIMITS.incrementSeconds.min,
                          TIME_CONTROL_LIMITS.incrementSeconds.max
                        );
                        setTimeControl((prev) => ({
                          ...prev,
                          incrementSeconds: nextIncrementSeconds,
                        }));
                      }}
                      onSlidingComplete={(value) => {
                        if (timeControlLocked) return;
                        const nextIncrementSeconds = clampValue(
                          Math.round(value),
                          TIME_CONTROL_LIMITS.incrementSeconds.min,
                          TIME_CONTROL_LIMITS.incrementSeconds.max
                        );
                        isAdjustingTimeControlRef.current = false;
                        if (settings.game.hapticsEnabled) {
                          hapticsService.selection();
                        }
                        setTimeControl((prev) => {
                          const next = {
                            ...prev,
                            incrementSeconds: nextIncrementSeconds,
                          };
                          void commitTimeControl(next);
                          return next;
                        });
                      }}
                    />
                  </View>
                </>
              )}
              {!isHost && (
                <Text className="text-gray-500 text-sm text-center mt-3">
                  Host controls time settings
                </Text>
              )}
              {isUpdatingTimeControl && (
                <Text className="text-gray-500 text-sm text-center mt-2">
                  Updating...
                </Text>
              )}
            </View>
          </View>
        </View>

        {isHost && (
          <View className="items-center gap-4 mb-4">
            {players.length < 4 && (
              <Text
                className="text-gray-400 text-base mb-3"
                style={{ fontFamily: LOBBY_FONTS.body }}
              >
                Need 4 players to start
              </Text>
            )}
            <TouchableOpacity
              className="w-full py-3 px-6 rounded-xl shadow-lg overflow-hidden"
              onPress={startGame}
              disabled={players.length !== 4 || isLoading}
            >
              <LinearGradient
                colors={players.length !== 4 || isLoading ? ['#6b7280', '#4b5563'] : ['#ffffff', '#f0f0f0']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <Text
                className={`text-xl font-bold text-center ${
                  players.length !== 4 ? "text-gray-300" : "text-black"
                }`}
                style={{
                  fontFamily: LOBBY_FONTS.title,
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  textShadowColor: 'rgba(0,0,0,0.3)',
                  textShadowOffset: {width: 1, height: 1},
                  textShadowRadius: 2,
                  textTransform: 'uppercase',
                }}
              >
                {isLoading ? "Starting..." : "Start Game"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          className="w-full py-3 px-6 rounded-xl overflow-hidden"
          onPress={() => {
            // ✅ Add haptic feedback for buttons that don't play sounds
            try {
              const { hapticsService } = require('../../services/hapticsService');
              hapticsService.buttonPress();
            } catch (error) {
            }
            leaveGame();
          }}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Text 
            className="text-white text-xl font-bold text-center"
            style={{
              fontFamily: LOBBY_FONTS.title,
              fontWeight: '900',
              letterSpacing: 1.2,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: {width: 1, height: 1},
              textShadowRadius: 2,
              textTransform: 'uppercase',
            }}
          >
            Leave Game
          </Text>
        </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // Main menu
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-black">
      <RadialGlowBackground />
      <GridBackground />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: tabBarSpacer }}
        showsVerticalScrollIndicator={false}
        style={{ zIndex: 1 }}
      >
      <View className="items-center mb-8">
        <Text
          className="text-gray-300 text-sm mb-3"
          style={{ fontFamily: LOBBY_FONTS.body }}
        >
          Playing as:
        </Text>
        {isEditingName ? (
          <TextInput
            className="text-white text-2xl font-bold text-center border-b border-white/30 pb-1"
            style={{ fontFamily: LOBBY_FONTS.title }}
            value={tempName}
            onChangeText={setTempName}
            onSubmitEditing={saveName}
            onBlur={saveName}
            autoFocus
            placeholder="Enter name"
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <TouchableOpacity onPress={() => {
            hapticsService.selection();
            startEditingName();
          }}>
            <Text
              className="text-white text-2xl font-bold"
              style={{ fontFamily: LOBBY_FONTS.title }}
            >
              {settings.profile.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="gap-3 mb-6">
        <LobbyMenuButton
          iconName="earth"
          iconColor="#3b82f6"
          title="Create Game"
          subtitle={isLoading ? "Creating..." : "Start an online game"}
          borderColor="rgba(59, 130, 246, 0.3)"
          onPress={createGame}
          disabled={isLoading}
          delay={0}
        />
      </View>

      <View
        className="mb-6 p-4 rounded-2xl"
        style={{
          backgroundColor: "rgba(255,255,255,0.05)",
          borderWidth: 1,
          borderColor: "rgba(250, 204, 21, 0.28)",
        }}
      >
        <View className="flex-row items-center mb-2">
          <FontAwesome name="lock" size={13} color="#facc15" style={{ marginRight: 8 }} />
          <Text
            className="text-white text-sm tracking-wide"
            style={{ fontFamily: LOBBY_FONTS.heading }}
          >
            Join with Code
          </Text>
        </View>
        <Text
          className="text-gray-400 text-xs mb-3"
          style={{ fontFamily: LOBBY_FONTS.body }}
        >
          Enter a 4-digit private game code shared by the host.
        </Text>
        <View className="flex-row items-center">
          <TextInput
            value={joinCodeInput}
            onChangeText={(text) =>
              setJoinCodeInput(text.replace(/[^0-9]/g, "").slice(0, 4))
            }
            placeholder="0000"
            placeholderTextColor="#6b7280"
            keyboardType="number-pad"
            maxLength={4}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (!isLoading && !isJoiningByCode && joinCodeInput.length === 4) {
                void joinGameWithCode();
              }
            }}
            style={{
              flex: 1,
              color: "#ffffff",
              fontSize: 18,
              letterSpacing: 6,
              textAlign: "center",
              borderRadius: 10,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderWidth: 1,
              borderColor: "rgba(255,255,255,0.18)",
              backgroundColor: "rgba(0,0,0,0.25)",
              fontFamily: LOBBY_FONTS.title,
            }}
          />
          <TouchableOpacity
            className="ml-3 px-4 py-2.5 rounded-xl"
            style={{
              backgroundColor:
                !isLoading && !isJoiningByCode && joinCodeInput.length === 4
                  ? "rgba(250, 204, 21, 0.2)"
                  : "rgba(107, 114, 128, 0.25)",
              borderWidth: 1,
              borderColor:
                !isLoading && !isJoiningByCode && joinCodeInput.length === 4
                  ? "rgba(250, 204, 21, 0.45)"
                  : "rgba(107, 114, 128, 0.35)",
              minWidth: 74,
              alignItems: "center",
            }}
            disabled={isLoading || isJoiningByCode || joinCodeInput.length !== 4}
            onPress={() => {
              hapticsService.buttonPress();
              void joinGameWithCode();
            }}
            activeOpacity={0.75}
          >
            {isJoiningByCode ? (
              <ActivityIndicator size="small" color="#facc15" />
            ) : (
              <Text
                className="text-yellow-300 text-sm"
                style={{ fontFamily: LOBBY_FONTS.heading }}
              >
                Join
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Game Tab Toggle */}
      <View style={{
        flexDirection: 'row',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 28,
        padding: 4,
        marginBottom: 16,
      }}>
        <TouchableOpacity
          onPress={() => {
            hapticsService.selection();
            setActiveTab('available');
          }}
          style={{
            flex: 1,
            paddingVertical: 11,
            borderRadius: 24,
            backgroundColor: activeTab === 'available' ? '#ffffff' : 'transparent',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
          activeOpacity={0.7}
        >
          <FontAwesome
            name="plus-circle"
            size={13}
            color={activeTab === 'available' ? '#000000' : '#6b7280'}
          />
          <Text style={{
            color: activeTab === 'available' ? '#000000' : '#9ca3af',
            fontWeight: '700',
            fontSize: 14,
            fontFamily: LOBBY_FONTS.heading,
          }}>
            Available
          </Text>
          {displayAvailableGames.length > 0 && (
            <View style={{
              backgroundColor: activeTab === 'available' ? 'rgba(34,197,94,0.15)' : 'rgba(34,197,94,0.3)',
              paddingHorizontal: 7,
              paddingVertical: 1,
              borderRadius: 10,
              minWidth: 20,
              alignItems: 'center',
            }}>
              <Text style={{
                color: activeTab === 'available' ? '#16a34a' : '#4ade80',
                fontSize: 11,
                fontWeight: '700',
              }}>
                {displayAvailableGames.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => {
            hapticsService.selection();
            setActiveTab('live');
          }}
          style={{
            flex: 1,
            paddingVertical: 11,
            borderRadius: 24,
            backgroundColor: activeTab === 'live' ? '#ffffff' : 'transparent',
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 6,
          }}
          activeOpacity={0.7}
        >
          <FontAwesome
            name="eye"
            size={13}
            color={activeTab === 'live' ? '#000000' : '#6b7280'}
          />
          <Text style={{
            color: activeTab === 'live' ? '#000000' : '#9ca3af',
            fontWeight: '700',
            fontSize: 14,
            fontFamily: LOBBY_FONTS.heading,
          }}>
            Live Games
          </Text>
          {displayPlayingGames.length > 0 && (
            <View style={{
              backgroundColor: activeTab === 'live' ? 'rgba(59,130,246,0.15)' : 'rgba(59,130,246,0.3)',
              paddingHorizontal: 7,
              paddingVertical: 1,
              borderRadius: 10,
              minWidth: 20,
              alignItems: 'center',
            }}>
              <Text style={{
                color: activeTab === 'live' ? '#2563eb' : '#60a5fa',
                fontSize: 11,
                fontWeight: '700',
              }}>
                {displayPlayingGames.length}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      {/* Search & Filter */}
      <View style={{ marginBottom: 12 }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(255,255,255,0.08)',
          borderRadius: 12,
          paddingHorizontal: 12,
          height: 42,
        }}>
          <FontAwesome name="search" size={14} color="#6b7280" style={{ marginRight: 8 }} />
          <TextInput
            style={{
              flex: 1,
              color: '#ffffff',
              fontSize: 14,
              paddingVertical: 0,
              fontFamily: LOBBY_FONTS.body,
            }}
            placeholder={activeTab === 'live' ? "Search live games..." : "Search by host or code..."}
            placeholderTextColor="#6b7280"
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <FontAwesome name="times-circle" size={16} color="#6b7280" />
            </TouchableOpacity>
          )}
        </View>
        {activeTab === 'available' && (
          <TouchableOpacity
            onPress={() => {
              hapticsService.selection();
              setShowFullGames((prev) => !prev);
            }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: 10,
              paddingHorizontal: 4,
            }}
            activeOpacity={0.7}
          >
            <Text style={{ color: '#9ca3af', fontSize: 13, fontFamily: LOBBY_FONTS.body }}>Show all games</Text>
            <Switch
              value={showFullGames}
              onValueChange={(val) => {
                hapticsService.selection();
                setShowFullGames(val);
              }}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor={showFullGames ? '#ffffff' : '#d1d5db'}
              ios_backgroundColor="#374151"
              style={{ transform: [{ scale: 0.8 }] }}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* Tab Content */}
      {activeTab === 'live' ? (
        <View style={{ minHeight: 120 }}>
          {displayPlayingGames.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <FontAwesome name="eye" size={28} color="#374151" style={{ marginBottom: 12 }} />
              <Text
                className="text-gray-500 text-center text-base"
                style={{ fontFamily: LOBBY_FONTS.heading }}
              >
                No live games right now
              </Text>
              <Text
                className="text-gray-600 text-xs text-center mt-1"
                style={{ fontFamily: LOBBY_FONTS.body }}
              >
                Active games will appear here to spectate
              </Text>
            </View>
          ) : (
            <View style={{ paddingBottom: 20 }}>
              {displayPlayingGames.map((game, index) => renderGameItem(game, index, true))}
            </View>
          )}
        </View>
      ) : (
        <View style={{ minHeight: 120 }}>
          {displayAvailableGames.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 32 }}>
              <FontAwesome name="gamepad" size={28} color="#374151" style={{ marginBottom: 12 }} />
              <Text
                className="text-gray-400 text-center text-base"
                style={{ fontFamily: LOBBY_FONTS.heading }}
              >
                No games available
              </Text>
              <Text
                className="text-gray-600 text-xs text-center mt-1"
                style={{ fontFamily: LOBBY_FONTS.body }}
              >
                Be the first to create a game!
              </Text>
            </View>
          ) : (
            <View style={{ paddingBottom: 20 }}>
              {displayAvailableGames.map((game, index) => renderGameItem(game, index, false))}
            </View>
          )}
        </View>
      )}
      </ScrollView>
    </SafeAreaView>
  );
};

export default OnlineLobbyScreen;
