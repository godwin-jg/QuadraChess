import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
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
import GridBackground from "../components/ui/GridBackground";
import AnimatedButton from "../components/ui/AnimatedButton";
import { hapticsService } from "../../services/hapticsService";

type TeamAssignments = { r: "A" | "B"; b: "A" | "B"; y: "A" | "B"; g: "A" | "B" };
const DEFAULT_TEAM_ASSIGNMENTS: TeamAssignments = { r: "A", y: "A", b: "B", g: "B" };

const OnlineLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { resigned } = useLocalSearchParams<{ resigned?: string }>();
  const { settings, updateProfile } = useSettings();
  const insets = useSafeAreaInsets();
  
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
  const [isLoading, setIsLoading] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState("Initializing...");
  const [refreshKey, setRefreshKey] = useState(0);
  const [botPlayers, setBotPlayers] = useState<string[]>([]);
  const [teamMode, setTeamMode] = useState(false);
  const [teamAssignments, setTeamAssignments] = useState<TeamAssignments>(DEFAULT_TEAM_ASSIGNMENTS);
  const isFocused = useIsFocused();
  const authInFlightRef = useRef(false);

  useEffect(() => {
    if (gameState.teamAssignments) {
      setTeamAssignments(gameState.teamAssignments);
    }
    setTeamMode(!!gameState.teamMode);
  }, [gameState.teamAssignments, gameState.teamMode]);

  // ✅ CRITICAL FIX: Clear game context immediately when user resigned
  // This ensures the waiting room is not shown after resignation
  useEffect(() => {
    if (resigned === "true") {
      console.log("[OnlineLobby] User resigned from game, clearing game context immediately");
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
  }, [isConnected, refreshKey, isFocused]);

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
            console.log("[OnlineLobby] User is no longer in the game, clearing game context");
            setCurrentGameId(null);
            dispatch(setPlayers([]));
            dispatch(setIsHost(false));
            dispatch(setCanStartGame(false));
            return;
          }
          
          // If game is finished, clear the game context
          if (game.status === "finished") {
            console.log("[OnlineLobby] Game is finished, clearing game context");
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
          console.log(`[BotSnapshot] Players from Firebase:`, normalizedPlayers.map(p => ({ color: p.color, isBot: p.isBot })));
          console.log(`[BotSnapshot] Extracted botPlayers:`, botPlayersFromGame);
          setBotPlayers(botPlayersFromGame);
          
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
        [] // Start with no bots - will be configured in waiting room
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

  const joinGame = async (gameId: string) => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      // Reset local game state before joining new game
      dispatch(resetGame());
      // ✅ CRITICAL FIX: Set game mode to "online" when joining a game
      dispatch(setGameMode("online"));
      
      await realtimeDatabaseService.joinGame(gameId, settings.profile.name);
      setCurrentGameId(gameId);
    } catch (error) {
      console.error("Error joining game:", error);
      Alert.alert("Error", "Failed to join game");
    } finally {
      setIsLoading(false);
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
          
          console.log("Left game despite connection issues - continuing normally");
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

  // Back to home action
  const handleBackToHome = () => {
    // 🔊 Play button sound for back to home action
    try {
      const soundService = require('../../services/soundService').default;
      soundService.playButtonSound();
    } catch (error) {
    }
    
    router.back();
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

  const refreshGames = async () => {
    // Refresh the subscription (real-time query will automatically update)
    setRefreshKey(prev => prev + 1);
  };

  // Toggle bot status for a player color (host only)
  const toggleBotPlayer = async (color: string) => {
    console.log(`[BotToggle] Toggle called for color: ${color}, isHost: ${isHost}, gameId: ${currentGameId}`);
    console.log(`[BotToggle] Current botPlayers state:`, botPlayers);
    
    if (!isHost || !currentGameId) {
      console.log(`[BotToggle] Aborting - not host or no game`);
      return;
    }
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    console.log(`[BotToggle] New botPlayers will be:`, newBotPlayers);
    setBotPlayers(newBotPlayers);
    
    // Update bot configuration in database
    try {
      await realtimeDatabaseService.updateBotConfiguration(currentGameId, newBotPlayers);
      console.log(`[BotToggle] Update successful`);
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

  const cleanupCorruptedGames = async () => {
    try {
      const deletedCount = await realtimeDatabaseService.cleanupCorruptedGames();
      
      if (deletedCount > 0) {
        Alert.alert("Cleanup Complete", `Deleted ${deletedCount} corrupted games`);
        // Refresh the games list after cleanup
        setRefreshKey(prev => prev + 1);
      } else {
        Alert.alert("Cleanup Complete", "No corrupted games found");
      }
    } catch (error) {
      console.error("Error cleaning up games:", error);
      Alert.alert("Error", "Failed to clean up corrupted games");
    }
  };

  const forceReauth = async () => {
    try {
      await realtimeDatabaseService.signInAnonymously();
      Alert.alert("Re-authentication Complete", "Successfully re-authenticated with Firebase");
      // Refresh everything after re-auth
      setRefreshKey(prev => prev + 1);
    } catch (error) {
      console.error("Error re-authenticating:", error);
      Alert.alert("Error", "Failed to re-authenticate");
    }
  };


  const renderGameItem = ({ item }: { item: RealtimeGame }) => {
    // Only count valid players (with proper data)
    const validPlayers = Object.values(item.players || {}).filter(player => 
      player && player.id && player.name && player.color
    );
    const playerCount = validPlayers.length;
    const isFull = playerCount >= (item.maxPlayers || 4);

    return (
      <TouchableOpacity
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
          <View>
            <Text className={`text-lg font-bold ${isFull ? "text-gray-400" : "text-white"}`}>
              {item.hostName}'s Game
            </Text>
            <Text className="text-gray-300 text-sm">
              {playerCount}/{item.maxPlayers} players
            </Text>
          </View>
          <View className="items-end">
            <Text className={`text-sm ${isFull ? "text-red-400" : "text-green-400"}`}>
              {isFull ? "Full" : "Available"}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  if (!isConnected) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4">
          {connectionStatus}
        </Text>
        <Text className="text-gray-400 text-sm mt-2">
          Please wait while we connect...
        </Text>
        <TouchableOpacity
          className="bg-blue-600 px-4 py-2 rounded-lg mt-5"
          onPress={() => initializeAuth("Re-authenticating...")}
        >
          <Text className="text-white text-sm font-bold">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (currentGameId) {
    // In-game waiting room
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-black p-6">
        {/* Subtle blueprint grid background */}
        <GridBackground />
        
        <View className="items-center mb-8">
          <Text className="text-gray-300 text-sm mb-3">Playing as:</Text>
          {isEditingName ? (
            <TextInput
              className="text-white text-2xl font-bold text-center border-b border-white/30 pb-1"
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
              <Text className="text-white text-2xl font-bold">
                {settings.profile.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-white/10 p-6 rounded-xl mb-6 items-center">
          <Text className="text-white text-xl font-bold mb-4 text-center">
            Waiting for Players
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
                      {player.name} {player.isHost && "(Host)"} {player.isBot && "🤖"}
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
                      <Text className="text-gray-400 text-sm">
                        {player.isBot ? 'Bot' : (player.connectionState || 'connected')}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-400 text-center">No players yet</Text>
              );
            })()}
            
            {/* Bot Configuration Section (Host Only) */}
            {isHost && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <Text className="text-white text-lg font-semibold mb-3 text-center">Bot Configuration</Text>
                <Text className="text-gray-400 text-sm mb-3 text-center">
                  Tap to toggle bot players (host controls all bots)
                </Text>
                <View className="flex-row justify-around">
                  {['r', 'b', 'y', 'g'].map((color) => {
                    const isBot = botPlayers.includes(color);
                    const colorName = color === 'r' ? 'Red' : color === 'b' ? 'Blue' : color === 'y' ? 'Yellow' : 'Green';
                    const colorClass = color === 'r' ? 'bg-red-500' : color === 'b' ? 'bg-blue-500' : color === 'y' ? 'bg-purple-500' : 'bg-green-500';
                    
                    // Check if adding a bot would exceed 4 players
                    // Count humans (players minus current bots) + would-be bots
                    const humanCount = players.filter(p => !p.isBot).length;
                    const wouldBeBotCount = isBot ? botPlayers.length - 1 : botPlayers.length + 1;
                    const wouldExceedMax = !isBot && (humanCount + wouldBeBotCount > 4);
                    
                    return (
                      <TouchableOpacity
                        key={color}
                        className={`flex-1 mx-1 py-3 px-2 rounded-lg border-2 ${
                          isBot ? 'border-green-400 bg-green-500/20' : 
                          wouldExceedMax ? 'border-gray-600 bg-gray-800/50 opacity-50' : 
                          'border-white/30 bg-white/10'
                        }`}
                        onPress={() => {
                          if (wouldExceedMax) return; // Don't allow if would exceed max
                          hapticsService.selection();
                          toggleBotPlayer(color);
                        }}
                        disabled={wouldExceedMax}
                      >
                        <View className="items-center">
                          <View className={`w-4 h-4 rounded-full mb-1 ${colorClass}`} />
                          <Text className={`text-xs font-semibold ${isBot ? 'text-green-400' : wouldExceedMax ? 'text-gray-500' : 'text-gray-300'}`}>
                            {colorName}
                          </Text>
                          <Text className={`text-xs ${isBot ? 'text-green-300' : wouldExceedMax ? 'text-gray-500' : 'text-gray-400'}`}>
                            {isBot ? '🤖 Bot' : '👤 Human'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
            {isHost && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <View className="flex-row items-center justify-between mb-2">
                  <Text className="text-white text-base font-semibold">Team Play</Text>
                  <View className="flex-row bg-white/5 rounded-full p-1">
                    <TouchableOpacity
                      className={`px-3 py-1 rounded-full ${
                        !teamMode ? "bg-red-500/30" : "bg-transparent"
                      }`}
                      onPress={() => updateTeamConfiguration(false, teamAssignments)}
                    >
                      <Text className={`text-xs ${!teamMode ? "text-red-200 font-semibold" : "text-gray-400"}`}>
                        Off
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      className={`ml-1 px-3 py-1 rounded-full ${
                        teamMode ? "bg-green-500/30" : "bg-transparent"
                      }`}
                      onPress={() => updateTeamConfiguration(true, teamAssignments)}
                    >
                      <Text className={`text-xs ${teamMode ? "text-green-200 font-semibold" : "text-gray-400"}`}>
                        On
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
                {teamMode && (
                  <View className="flex-row flex-wrap -mx-2">
                    {(['r', 'b', 'y', 'g'] as const).map((color) => {
                      const colorName = color === 'r' ? 'Red' : color === 'b' ? 'Blue' : color === 'y' ? 'Yellow' : 'Green';
                      const colorClass = color === 'r' ? 'bg-red-500' : color === 'b' ? 'bg-blue-500' : color === 'y' ? 'bg-purple-500' : 'bg-green-500';
                      return (
                        <View key={color} className="w-1/2 px-2 mb-2">
                          <View className="flex-row items-center justify-between bg-white/5 rounded-lg px-2 py-2">
                            <View className="flex-row items-center">
                              <View className={`w-2.5 h-2.5 rounded-full mr-2 ${colorClass}`} />
                              <Text className="text-white text-sm">{colorName}</Text>
                            </View>
                            <View className="flex-row">
                              {(['A', 'B'] as const).map((teamId) => {
                                const active = teamAssignments[color] === teamId;
                                return (
                                  <TouchableOpacity
                                    key={`${color}-${teamId}`}
                                    className={`px-2 py-1 rounded-full border ml-1 ${
                                      active ? "border-blue-400 bg-blue-500/20" : "border-white/20 bg-white/5"
                                    }`}
                                    onPress={() => updateTeamConfiguration(teamMode, { ...teamAssignments, [color]: teamId })}
                                  >
                                    <Text className={`text-xs ${active ? "text-blue-200 font-semibold" : "text-gray-400"}`}>
                                      {teamId}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            )}
          </View>
        </View>

        {isHost && (
          <View className="items-center gap-4 mb-4">
            {players.length < 4 && (
              <Text className="text-gray-400 text-sm mb-3">
                Need exactly 4 players to start
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
                className={`text-lg font-bold text-center ${
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
            className="text-white text-lg font-bold text-center"
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
      </SafeAreaView>
    );
  }

  // Main menu
  return (
    <SafeAreaView style={{ flex: 1, marginBottom: 130 }} className="bg-black p-6">
      {/* Subtle blueprint grid background */}
      <GridBackground />
      <View className="items-center mb-8">
        <Text className="text-gray-300 text-sm mb-3">Playing as:</Text>
        {isEditingName ? (
          <TextInput
            className="text-white text-2xl font-bold text-center border-b border-white/30 pb-1"
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
            <Text className="text-white text-2xl font-bold">{settings.profile.name}</Text>
          </TouchableOpacity>
        )}
      </View>


      <View className="mb-8">
        <AnimatedButton
          icon="🌐"
          title="Create Game"
          subtitle={isLoading ? "Creating..." : "Start an online game"}
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
            onPress={handleBackToHome}
            disabled={false}
            delay={150}
          />
        </View>
      </View>

      <View className="flex-1 items-center">
        <View className="items-center mb-4">
          <Text className="text-white text-xl font-bold text-center mb-4">
            Available Games
          </Text>
          <View className="flex-row gap-2">
            <TouchableOpacity
              className="bg-blue-600 px-3 py-2 rounded-lg"
              onPress={() => {
                // ✅ Add haptic feedback for buttons that don't play sounds
                try {
                  const { hapticsService } = require('../../services/hapticsService');
                  hapticsService.buttonPress();
                } catch (error) {
                }
                refreshGames();
              }}
            >
              <Text className="text-white text-sm font-bold">Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-green-600 px-3 py-2 rounded-lg"
              onPress={() => {
                // ✅ Add haptic feedback for buttons that don't play sounds
                try {
                  const { hapticsService } = require('../../services/hapticsService');
                  hapticsService.buttonPress();
                } catch (error) {
                }
                forceReauth();
              }}
            >
              <Text className="text-white text-sm font-bold">Re-auth</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-red-600 px-3 py-2 rounded-lg"
              onPress={() => {
                // ✅ Add haptic feedback for buttons that don't play sounds
                try {
                  const { hapticsService } = require('../../services/hapticsService');
                  hapticsService.buttonPress();
                } catch (error) {
                }
                cleanupCorruptedGames();
              }}
            >
              <Text className="text-white text-sm font-bold">Cleanup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {availableGames.length === 0 ? (
          <Text className="text-gray-400 text-center mt-8 pb-4">
            No games available. Create one to get started!
          </Text>
        ) : (
          <View style={{ position: 'relative', width: '100%' }}>
            <FlatList
              data={availableGames
                .slice()
                // Deduplicate by id
                .filter((game, index, self) => 
                  game.id && self.findIndex(g => g.id === game.id) === index
                )
                .sort((a, b) => {
                  // Sort by timestamp (newest first), with createdAt as fallback
                  const timestampA = a.lastActivity || a.createdAt || 0;
                  const timestampB = b.lastActivity || b.createdAt || 0;
                  return timestampB - timestampA;
                })}
              renderItem={renderGameItem}
              keyExtractor={(item, index) => item.id || `game-${index}`}
              showsVerticalScrollIndicator={false}
              style={{ 
                width: '100%',
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
            {/* Smooth fade-out gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 1)']}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
                pointerEvents: 'none',
              }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default OnlineLobbyScreen;
