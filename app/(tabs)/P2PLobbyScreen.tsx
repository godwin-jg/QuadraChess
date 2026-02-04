import React, { useEffect, useMemo, useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  ScrollView,
  Switch,
} from "react-native";
import Slider from "@react-native-community/slider";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RootState } from "../../state/store";
import { 
  resetGame, 
  setCurrentGame, 
  setDiscoveredGames, 
  setIsLoading, 
  setIsConnected, 
  setConnectionError, 
  setIsEditingName, 
  setTempName,
  syncP2PGameState,
  setPlayers,
  setIsHost,
  setCanStartGame,
  setBotPlayers,
  setTeamConfig,
  setGameMode
} from "../../state/gameSlice";
import { useSettings } from "../../context/SettingsContext";
import p2pService, { P2PGame, P2PPlayer } from "../../services/p2pService";
import networkDiscoveryService from "../../services/networkDiscoveryService";
import { FontAwesome, MaterialCommunityIcons } from "@expo/vector-icons";
import GridBackground from "../components/ui/GridBackground";
import AnimatedButton from "../components/ui/AnimatedButton";
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

const P2PLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { resigned } = useLocalSearchParams<{ resigned?: string }>();
  const { settings, updateProfile } = useSettings();
  const insets = useSafeAreaInsets();
  const tabBarSpacer = getTabBarSpacer(insets.bottom);
  
  const isFocused = useIsFocused();

  // ✅ All state now comes from Redux
  const {
    players,
    isHost,
    canStartGame,
    currentGame,
    discoveredGames,
    isLoading,
    isConnected,
    connectionError,
    isEditingName,
    tempName,
    botPlayers,
    teamMode,
    teamAssignments,
    timeControl: reduxTimeControl,
  } = useSelector((state: RootState) => state.game);

  // Time control state (local for P2P - synced to clients via game state)
  const [timeControl, setTimeControl] = useState<TimeControlSettings>(DEFAULT_TIME_CONTROL);
  const [isTimeControlExpanded, setIsTimeControlExpanded] = useState(false);
  const isAdjustingTimeControlRef = useRef(false);

  // ✅ No more event listeners! All state comes from Redux
  // The P2P service now directly updates Redux state
  
  // ✅ CRITICAL FIX: Clear game context immediately when user resigned
  useEffect(() => {
    if (resigned === "true") {
      console.log("[P2PLobby] User resigned from game, clearing game context immediately");
      dispatch(setCurrentGame(null));
      dispatch(setBotPlayers([]));
      dispatch(setPlayers([]));
      dispatch(setIsHost(false));
      dispatch(setCanStartGame(false));
      setTimeControl(DEFAULT_TIME_CONTROL);
      
      // Clear the query param to avoid re-triggering on subsequent renders
      router.setParams({ resigned: undefined });
    }
  }, [resigned, dispatch, router]);

  // Reset time control when leaving a game
  useEffect(() => {
    if (!currentGame) {
      setTimeControl(DEFAULT_TIME_CONTROL);
    }
  }, [currentGame]);
  
  // Handle navigation when game starts - only when focused
  useEffect(() => {
    if (!isFocused) return; // Only run when screen is actually focused
    
    if (currentGame && currentGame.status === 'playing' && !isHost) {
      try {
        router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=p2p`);
      } catch (navError) {
        // Navigation error handled silently
      }
    }
  }, [currentGame, isHost, router, isFocused]);

  // Handle discovery when screen gains/loses focus
  useFocusEffect(
    React.useCallback(() => {
      try {
        p2pService.discoverGames().catch(error => {
          console.error("Error restarting discovery on focus:", error);
        });
      } catch (error) {
        console.error("Error starting discovery on focus:", error);
      }

      // Set up periodic refresh every 5 seconds while screen is focused
      const refreshInterval = setInterval(() => {
        p2pService.discoverGames().catch(error => {
          console.error("Error in periodic discovery:", error);
        });
      }, 5000);
      
      // Return cleanup function when screen loses focus
      return () => {
        clearInterval(refreshInterval);
        try {
          networkDiscoveryService.stopDiscovery();
          p2pService.stopDiscovery();
        } catch (error) {
          console.error("Error stopping discovery on focus loss:", error);
        }
      };
    }, [])
  );

  // Name editing functions
  const startEditingName = () => {
    dispatch(setTempName(settings.profile.name));
    dispatch(setIsEditingName(true));
  };

  const saveName = () => {
    if (tempName.trim()) {
      updateProfile({ name: tempName.trim() });
    }
    dispatch(setIsEditingName(false));
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
    (nextControl: TimeControlSettings) => {
      if (!isHost || !currentGame || currentGame.status !== "waiting") {
        return;
      }
      try {
        p2pService.updateTimeControl(
          nextControl.baseMinutes * 60 * 1000,
          nextControl.incrementSeconds * 1000
        );
      } catch (error) {
        console.error("Failed to update time control:", error);
      }
    },
    [currentGame, isHost]
  );

  useEffect(() => {
    if (!reduxTimeControl) return;
    const nextBaseMinutes = clampValue(
      Math.round(reduxTimeControl.baseMs / (60 * 1000)),
      TIME_CONTROL_LIMITS.baseMinutes.min,
      TIME_CONTROL_LIMITS.baseMinutes.max
    );
    const nextIncrementSeconds = clampValue(
      Math.round(reduxTimeControl.incrementMs / 1000),
      TIME_CONTROL_LIMITS.incrementSeconds.min,
      TIME_CONTROL_LIMITS.incrementSeconds.max
    );
    if (!isAdjustingTimeControlRef.current) {
      setTimeControl({
        baseMinutes: nextBaseMinutes,
        incrementSeconds: nextIncrementSeconds,
      });
    }
  }, [reduxTimeControl?.baseMs, reduxTimeControl?.incrementMs]);

  // Toggle bot status for a player color (host only)
  const toggleBotPlayer = (color: string) => {
    console.log(`[BotToggle] Toggle called for color: ${color}, isHost: ${isHost}, gameId: ${currentGame?.id}`);
    console.log(`[BotToggle] Current botPlayers state:`, botPlayers);
    
    if (!isHost || !currentGame) {
      console.log(`[BotToggle] Aborting - not host or no game`);
      return;
    }
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    console.log(`[BotToggle] New botPlayers will be:`, newBotPlayers);
    dispatch(setBotPlayers(newBotPlayers));
    
    // Update bot configuration in P2P service
    try {
      p2pService.updateBotConfiguration(newBotPlayers);
      console.log(`[BotToggle] Update successful`);
    } catch (error) {
      console.error("Error updating bot configuration:", error);
      // Revert local state on error
      dispatch(setBotPlayers(botPlayers));
      Alert.alert("Error", "Failed to update bot configuration");
    }
  };

  const updateTeamConfiguration = (nextTeamMode: boolean, nextAssignments: TeamAssignments) => {
    if (!isHost) {
      return;
    }
    dispatch(setTeamConfig({ teamMode: nextTeamMode, teamAssignments: nextAssignments }));
    p2pService.updateTeamConfiguration(nextTeamMode, nextAssignments);
  };

  // Create a new P2P game
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

    dispatch(setIsLoading(true));
    dispatch(setConnectionError(null));
    try {
      // ✅ CRITICAL FIX: Set game mode before reset so bots default to none
      dispatch(setGameMode("p2p"));
      // Reset local game state before creating new game
      dispatch(resetGame());
      
      const game = await p2pService.createGame(settings.profile.name.trim());
      // ✅ P2P service now updates Redux directly, no need to set local state
      
      // 🔊 Play success sound for creating game
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playSuccessSound();
      } catch (error) {
      }
      
      console.log("P2P Game created:", game);
    } catch (error) {
      console.error("Error creating P2P game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create game";
      dispatch(setConnectionError(errorMessage));
      Alert.alert("Error", errorMessage);
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  // Join a discovered game
  const joinGame = async (gameId: string) => {
    
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    dispatch(setIsLoading(true));
    dispatch(setConnectionError(null));
    try {
      // ✅ CRITICAL FIX: Set game mode before reset so bots default to none
      dispatch(setGameMode("p2p"));
      // Reset local game state before joining new game
      dispatch(resetGame());
      
      // Find the game in discovered games to set currentGame as fallback
      const gameToJoin = discoveredGames.find(game => game.id === gameId);
      if (gameToJoin) {
        console.log("Setting currentGame from discovered games:", gameToJoin);
        dispatch(setCurrentGame({
          id: gameToJoin.id,
          name: gameToJoin.name,
          hostName: gameToJoin.hostName,
          hostId: gameToJoin.hostId,
          hostIP: gameToJoin.hostIP,
          port: gameToJoin.port,
          joinCode: gameToJoin.joinCode,
          playerCount: gameToJoin.playerCount,
          maxPlayers: gameToJoin.maxPlayers,
          status: "waiting",
          createdAt: gameToJoin.createdAt || Date.now(),
          timestamp: Date.now(),
        }));
      }
      
      await p2pService.joinDiscoveredGame(gameId, settings.profile.name.trim());
      
      // 🔊 Play success sound for joining game
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playSuccessSound();
      } catch (error) {
      }
      
      console.log("Joined P2P game:", gameId);
    } catch (error) {
      console.error("Error joining P2P game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to join game";
      dispatch(setConnectionError(errorMessage));
      Alert.alert("Error", errorMessage);
      // Reset currentGame on error
      dispatch(setCurrentGame(null));
    } finally {
      dispatch(setIsLoading(false));
    }
  };


  // Start the game (host only)
  const startGame = async () => {
    if (!isHost || !currentGame) return;

    // 🔊 Play button sound for start game action
    try {
      const soundService = require('../../services/soundService').default;
      soundService.playButtonSound();
    } catch (error) {
    }
    
    dispatch(setIsLoading(true));
    try {
      // Check if all players are connected before starting
      const allPlayersConnected = players.every(p => p.isHost || p.connectionState === 'connected');
      players.forEach((player: any) => {
      });
      
      // ✅ Include botPlayers and timeControl in the initial game state
      // Note: sendGameStarted() will handle resetting the game state properly
      p2pService.updateTimeControl(
        timeControl.baseMinutes * 60 * 1000,
        timeControl.incrementSeconds * 1000
      );
      
      // This will update the host's state and trigger the sync to clients
      p2pService.sendGameStarted(); 
      
      // 🔊 Play game start sound
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playGameStartSound();
      } catch (error) {
      }
      
      // The host navigates itself
      try {
        router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=p2p`);
      } catch (navError) {
      }
    } catch (error) {
      console.error("Error starting game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start game";
      Alert.alert("Error", errorMessage);
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  // Leave the game - manual state reset
  const leaveGame = () => {
    console.log("P2PLobbyScreen: Leaving game manually...");
    
    try {
      // 1. Try to disconnect from P2P service (but don't rely on it for state)
      try {
        (p2pService as any).disconnect(false); // Don't notify UI to avoid connection error
        console.log("P2PLobbyScreen: P2P service disconnected");
      } catch (p2pError) {
        console.warn("P2PLobbyScreen: P2P disconnect failed, continuing with manual reset:", p2pError);
      }
      
      // 2. Stop discovery if running
      try {
        p2pService.stopDiscovery();
        console.log("P2PLobbyScreen: Discovery stopped");
      } catch (discoveryError) {
        console.warn("P2PLobbyScreen: Stop discovery failed:", discoveryError);
      }
      
      // 3. Manually reset all Redux state
      console.log("P2PLobbyScreen: Resetting Redux state manually...");
      
      // Clear connection error first to prevent "Connection lost" message
      dispatch(setConnectionError(null));
      
      // Reset game state
      dispatch(resetGame());
      
      // Clear P2P-specific state
      dispatch(setCurrentGame(null));
      dispatch(setPlayers([]));
      dispatch(setIsHost(false));
      dispatch(setCanStartGame(false));
      dispatch(setIsConnected(false));
      dispatch(setConnectionError(null));
      dispatch(setIsLoading(false));
      
      // Clear editing state
      dispatch(setIsEditingName(false));
      dispatch(setTempName(""));
       
      // Clear P2P game state
      dispatch(syncP2PGameState(null));
      
      console.log("P2PLobbyScreen: Manual state reset completed successfully");
      
    } catch (error) {
      console.error("P2PLobbyScreen: Error during manual leave game:", error);
      
      // Even if there's an error, try to reset the critical state
      try {
        dispatch(setConnectionError(null)); // Clear connection error first
        dispatch(resetGame());
        dispatch(setCurrentGame(null));
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setIsConnected(false));
        console.log("P2PLobbyScreen: Emergency state reset completed");
      } catch (emergencyError) {
        console.error("P2PLobbyScreen: Emergency state reset failed:", emergencyError);
      }
    }
  };

  // Render discovered game item
  const renderGameItem = (item: any, index: number) => {
    const playerCount = item.playerCount || 0;
    const isFull = playerCount >= (item.maxPlayers || 4);

    // Extract time control from discovered game
    const baseMinutes = item.baseMinutes ?? 5;
    const incrementSeconds = item.incrementSeconds ?? 0;
    const timeControlLabel = incrementSeconds > 0 
      ? `${baseMinutes}+${incrementSeconds}` 
      : `${baseMinutes} min`;

    return (
      <TouchableOpacity
        key={item.id || `game-${index}`}
        className={`p-4 rounded-xl mb-3 border ${
          isFull 
            ? "bg-white/5 border-white/10 opacity-60" 
            : "bg-white/10 border-white/20"
        }`}
        onPress={() => {
          if (isFull) {
            Alert.alert("Game Full", "This game already has 4 players.");
            return;
          }
          // ✅ Add haptic feedback for buttons that don't play sounds
          try {
            const { hapticsService } = require('../../services/hapticsService');
            hapticsService.buttonPress();
          } catch (error) {
          }
          joinGame(item.id);
        }}
        disabled={isLoading || isFull}
      >
        <View className="flex-row justify-between items-center">
          <View className="flex-1">
            <Text className={`text-lg font-bold ${isFull ? "text-gray-400" : "text-white"}`}>
              {item.hostName}'s Game
            </Text>
            <Text className="text-gray-300 text-sm">
              {playerCount}/{item.maxPlayers} players
            </Text>
            <Text className="text-gray-400 text-xs">
              Code: {item.joinCode}
            </Text>
          </View>
          <View className="items-end">
            <Text className={`text-sm ${isFull ? "text-red-400" : "text-green-400"}`}>
              {isFull ? "Full" : "Available"}
            </Text>
            <Text className="text-gray-400 text-xs mt-0.5">
              {timeControlLabel}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const displayDiscoveredGames = useMemo(
    () =>
      discoveredGames
        .slice()
        .filter((game, index, self) =>
          game.id && self.findIndex(g => g.id === game.id) === index
        )
        .sort((a, b) => {
          const timestampA = a.timestamp || a.createdAt || 0;
          const timestampB = b.timestamp || b.createdAt || 0;
          return timestampB - timestampA;
        }),
    [discoveredGames]
  );

  const timeControlLocked = !isHost || currentGame?.status !== "waiting";
  const sliderAccentColor = timeControlLocked ? "#6b7280" : "#ffffff";
  const sliderTrackColor = timeControlLocked ? "#374151" : "#9ca3af";
  const sliderThumbColor = timeControlLocked ? "#9ca3af" : "#ffffff";

  // Show connection error screen
  if (connectionError) {
    return (
      <View className="flex-1 bg-black justify-center items-center p-6">
        <Text className="text-red-400 text-xl font-bold mb-4">Connection Error</Text>
        <Text className="text-white text-lg text-center mb-6">{connectionError}</Text>
        <TouchableOpacity
          className="w-full py-4 px-6 rounded-xl bg-white shadow-lg"
          onPress={() => {
            dispatch(setConnectionError(null));
            dispatch(setIsConnected(true));
          }}
        >
          <Text className="text-black text-xl font-bold text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading screen
  if (isLoading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4">
          {isHost ? "Creating game..." : "Joining game..."}
        </Text>
      </View>
    );
  }

  // In-game waiting room
  if (currentGame) {
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-black">
        {/* Subtle blueprint grid background */}
        <GridBackground />
        <ScrollView
          contentContainerStyle={{ padding: 24, paddingBottom: tabBarSpacer }}
          showsVerticalScrollIndicator={false}
        >
        <View className="items-center mb-6">
          <Text className="text-gray-300 text-base mb-2">Playing as:</Text>
          {isEditingName ? (
            <TextInput
              className="text-white text-2xl font-semibold text-center border-b border-white/30 pb-1"
              value={tempName}
              onChangeText={(text) => dispatch(setTempName(text))}
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
              <Text className="text-white text-2xl font-semibold">
                {settings.profile.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-white/10 p-5 rounded-xl mb-5 items-center">
          <Text className="text-gray-300 text-sm mb-4 text-center">
            Join Code: <Text className="text-white font-bold">{currentGame.joinCode}</Text>
          </Text>

          <View className="space-y-3 w-full">
            <Text className="text-white text-lg font-semibold mb-2 text-center">Players ({players.length})</Text>
            {/* ✅ CRITICAL FIX: Show all players (bots are already included in Redux players array) */}
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
                    <Text className="text-white text-lg">
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
                      <Text className="text-gray-400 text-base">
                        {player.isBot ? 'Bot' : (player.connectionState || 'connected')}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-400 text-base text-center">No players yet</Text>
              );
            })()}
            
            {/* Bot Configuration Section (Host Only) */}
            {isHost && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <Text className="text-white text-lg font-semibold mb-2 text-center">Add Bots</Text>
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
                  <Text className={SECTION_TITLE_CLASS} numberOfLines={1}>Team Play</Text>
                  <Switch
                    value={teamMode}
                    onValueChange={(nextValue) => {
                      if (settings.game.hapticsEnabled) {
                        hapticsService.selection();
                      }
                      updateTeamConfiguration(nextValue, teamAssignments || DEFAULT_TEAM_ASSIGNMENTS);
                    }}
                    trackColor={{ false: "#374151", true: "#22c55e" }}
                    thumbColor={teamMode ? "#ffffff" : "#d1d5db"}
                    ios_backgroundColor="#374151"
                  />
                </View>
                {teamMode && (
                  <TeamAssignmentDnD
                    teamAssignments={teamAssignments || DEFAULT_TEAM_ASSIGNMENTS}
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
            <View className="mt-4 pt-4 border-t border-white/20">
              <View className="flex-row items-center justify-between mb-3">
                <Text className={SECTION_TITLE_CLASS}>Time Control</Text>
                <View className="flex-row items-center gap-2">
                  <Text className="text-gray-400 text-sm">{formatTimeControlLabel(timeControl)}</Text>
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
                  <View className="mb-3">
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-white text-sm">Base time</Text>
                      <Text className="text-gray-300 text-sm">
                        {timeControl.baseMinutes} min
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%", height: 30 }}
                      minimumValue={TIME_CONTROL_LIMITS.baseMinutes.min}
                      maximumValue={TIME_CONTROL_LIMITS.baseMinutes.max}
                      step={TIME_CONTROL_LIMITS.baseMinutes.step}
                      value={timeControl.baseMinutes}
                      minimumTrackTintColor={sliderAccentColor}
                      maximumTrackTintColor={sliderTrackColor}
                      thumbTintColor={sliderThumbColor}
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
                          commitTimeControl(next);
                          return next;
                        });
                      }}
                    />
                  </View>
                  <View>
                    <View className="flex-row items-center justify-between mb-1">
                      <Text className="text-white text-sm">Increment</Text>
                      <Text className="text-gray-300 text-sm">
                        {timeControl.incrementSeconds > 0
                          ? `+${timeControl.incrementSeconds}s`
                          : "0s"}
                      </Text>
                    </View>
                    <Slider
                      style={{ width: "100%", height: 30 }}
                      minimumValue={TIME_CONTROL_LIMITS.incrementSeconds.min}
                      maximumValue={TIME_CONTROL_LIMITS.incrementSeconds.max}
                      step={TIME_CONTROL_LIMITS.incrementSeconds.step}
                      value={timeControl.incrementSeconds}
                      minimumTrackTintColor={sliderAccentColor}
                      maximumTrackTintColor={sliderTrackColor}
                      thumbTintColor={sliderThumbColor}
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
                          commitTimeControl(next);
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
            </View>
          </View>
        </View>

        {isHost && (
          <View className="items-center gap-4 mb-4">
            {players.length < 4 && (
              <Text className="text-gray-400 text-base mb-3">
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
      {/* Subtle blueprint grid background */}
      <GridBackground />
      <ScrollView
        contentContainerStyle={{ padding: 24, paddingBottom: tabBarSpacer }}
        showsVerticalScrollIndicator={false}
      >
      <View className="items-center mb-8">
        <Text className="text-gray-300 text-sm mb-3">Playing as:</Text>
        {isEditingName ? (
          <TextInput
            className="text-white text-2xl font-bold text-center border-b border-white/30 pb-1"
            value={tempName}
            onChangeText={(text) => dispatch(setTempName(text))}
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
            <Text className="text-white text-2xl font-bold">{settings.profile.name}</Text>
          </TouchableOpacity>
        )}
        
        {/* Connection status indicator */}
        <View className="flex-row items-center mt-2">
          <View className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <Text className="text-gray-400 text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View className="mb-8">
        <AnimatedButton
          icon="🎮"
          title="Create Game"
          subtitle={isLoading ? "Creating..." : "Start a new game"}
          gradientColors={['#ffffff', '#f0f0f0']}
          textColor="black"
          subtitleColor="gray-600"
          onPress={createGame}
          disabled={isLoading}
          delay={0}
        />

        <View style={{ marginTop: 16 }}>
          <AnimatedButton
            icon="🏠"
            title="Back to Home"
            subtitle="Return to main menu"
            gradientColors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            textColor="white"
            subtitleColor="gray-300"
            onPress={() => {
              // 🔊 Play button sound for back to home action
              try {
                const soundService = require('../../services/soundService').default;
                soundService.playButtonSound();
              } catch (error) {
              }
              router.back();
            }}
            disabled={false}
            delay={150}
          />
        </View>
      </View>

      <View className="flex-1 items-center">
        <View className="flex-row items-center justify-between w-full mb-4">
          <Text className="text-white text-xl font-bold text-center flex-1">
            Available Games
          </Text>
          <TouchableOpacity
            onPress={() => {
              p2pService.discoverGames().catch(error => {
                console.error("Error refreshing games:", error);
              });
            }}
            className="bg-blue-500 px-3 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Refresh</Text>
          </TouchableOpacity>
        </View>

        {displayDiscoveredGames.length === 0 ? (
          <Text className="text-gray-400 text-center mt-8 pb-4">
            The arena stands empty... Be the first to spill digital blood!
          </Text>
        ) : (
          <View style={{ position: 'relative', width: '100%' }}>
            <View style={{ width: '100%', paddingBottom: 20 }}>
              {displayDiscoveredGames.map((game, index) => renderGameItem(game, index))}
            </View>
            {/* Smooth fade-out gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 1)']}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 40 + insets.bottom,
                pointerEvents: 'none',
              }}
            />
          </View>
        )}
      </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default P2PLobbyScreen;