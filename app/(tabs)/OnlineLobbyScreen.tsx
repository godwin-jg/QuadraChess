import React, { useState, useEffect, useMemo } from "react";
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
import { useRouter } from "expo-router";
import { RootState } from "../../state/store";
import { setPlayers, setIsHost, setCanStartGame, resetGame } from "../../state";
import realtimeDatabaseService, {
  RealtimeGame,
} from "../../services/realtimeDatabaseService";
import onlineGameService from "../../services/onlineGameService";
import { useSettings } from "../../context/SettingsContext";
import { SafeAreaView } from "react-native-safe-area-context";
import GridBackground from "../components/ui/GridBackground";
import AnimatedButton from "../components/ui/AnimatedButton";
import { hapticsService } from "../../services/hapticsService";

const OnlineLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings, updateProfile } = useSettings();

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

  // Initialize Firebase auth (optimized)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setConnectionStatus("Authenticating...");
        // Use Realtime Database
        await realtimeDatabaseService.signInAnonymously();
        
        setConnectionStatus("Connecting...");
        setIsConnected(true);
        console.log("Realtime Database initialization successful");
        
        // Skip connection test to reduce loading time
        // Connection will be validated when subscribing to games
        console.log("✅ Firebase connection established");
      } catch (error) {
        console.error("Failed to initialize Firebase auth:", error);
        setConnectionStatus("Connection failed");
        Alert.alert("Connection Error", "Failed to connect to online services");
      }
    };

    initializeAuth();
  }, []);

  // Subscribe to available games
  useEffect(() => {
    if (!isConnected) return;
    
    const unsubscribe = realtimeDatabaseService.subscribeToAvailableGames(
      (games) => {
        setAvailableGames(games);
      }
    );

    return unsubscribe;
  }, [isConnected, refreshKey]);

  // Connect to onlineGameService when currentGameId changes
  useEffect(() => {
    if (!currentGameId) return;

    const connectToGame = async () => {
      try {
        console.log(
          "OnlineLobbyScreen: Connecting to game via onlineGameService:",
          currentGameId
        );
        await onlineGameService.connectToGame(currentGameId);
        console.log("OnlineLobbyScreen: Successfully connected to game");
      } catch (error) {
        console.error("OnlineLobbyScreen: Failed to connect to game:", error);
        Alert.alert("Connection Error", "Failed to connect to the game");
      }
    };

    connectToGame();

    // Cleanup on unmount or game change
    return () => {
      onlineGameService.disconnect();
    };
  }, [currentGameId]);

  // Subscribe to current game updates for navigation
  useEffect(() => {
    if (!currentGameId) return;

    const unsubscribe = realtimeDatabaseService.subscribeToGame(
      currentGameId,
      (game) => {
        if (game) {
          // Check if game status changed to playing
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
  }, [currentGameId, dispatch, router]);

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

    setIsLoading(true);
    try {
      // Reset local game state before creating new game
      dispatch(resetGame());
      
      const gameId = await realtimeDatabaseService.createGame(
        settings.profile.name.trim(),
        botPlayers
      );
      setCurrentGameId(gameId);
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
        setCurrentGameId(null);
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
      } catch (error) {
        console.error("Error leaving game:", error);
      }
    }
  };

  const startGame = async () => {
    if (!currentGameId) return;

    try {
      await realtimeDatabaseService.startGame(currentGameId);
    } catch (error) {
      console.error("Error starting game:", error);
      Alert.alert("Error", "Failed to start game");
    }
  };

  const refreshGames = async () => {
    // Refresh the subscription (real-time query will automatically update)
    setRefreshKey(prev => prev + 1);
  };

  // Toggle bot status for a player color
  const toggleBotPlayer = (color: string) => {
    console.log(`🤖 OnlineLobbyScreen: Toggle bot request for ${color}`);
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    setBotPlayers(newBotPlayers);
    console.log(`🤖 OnlineLobbyScreen: Toggled bot for ${color}, new botPlayers:`, newBotPlayers);
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

    return (
      <TouchableOpacity
        className="bg-white/10 p-4 rounded-xl mb-3 border border-white/20"
        onPress={() => joinGame(item.id)}
        disabled={isLoading}
      >
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-lg font-bold">
              {item.hostName}'s Game
            </Text>
            <Text className="text-gray-300 text-sm">
              {playerCount}/{item.maxPlayers} players
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-green-400 text-sm">Available</Text>
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
            {players && players.length > 0 ? (
              players.map((player, index) => (
                <View
                  key={player.id}
                  className="flex-row items-center justify-between"
                >
                  <Text className="text-white text-lg">
                    {player.name} {player.isHost && "(Host)"}
                  </Text>
                  <View
                    className={`w-3 h-3 rounded-full ${
                      player.color === "r"
                        ? "bg-red-500"
                        : player.color === "b"
                          ? "bg-blue-500"
                          : player.color === "y"
                            ? "bg-yellow-500"
                            : player.color === "g"
                              ? "bg-green-500"
                              : "bg-gray-500"
                    }`}
                  />
                </View>
              ))
            ) : (
              <Text className="text-gray-400 text-center">No players yet</Text>
            )}
          </View>
        </View>

        {isHost && (
          <View className="items-center gap-4 mb-4">
            {players.length < 2 && (
              <Text className="text-gray-400 text-sm mb-3">
                Need 2+ players to start
              </Text>
            )}
            <TouchableOpacity
              className="w-full py-3 px-6 rounded-xl shadow-lg overflow-hidden"
              onPress={startGame}
              disabled={players.length < 2 || isLoading}
            >
              <LinearGradient
                colors={players.length < 2 || isLoading ? ['#6b7280', '#4b5563'] : ['#ffffff', '#f0f0f0']}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <Text
                className={`text-lg font-bold text-center ${
                  players.length < 2 ? "text-gray-300" : "text-black"
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
          onPress={leaveGame}
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
            <Text className="text-white text-2xl font-bold">{settings.profile.name}</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Bot Configuration Section */}
      <View className="mb-6">
        <View className="bg-gray-800 rounded-lg p-4 mb-4">
          <Text className="text-white text-lg font-semibold mb-3 text-center">Bot Configuration</Text>
          <Text className="text-gray-400 text-sm mb-3 text-center">
            Tap to toggle bot players (synchronized across all devices)
          </Text>
          <View className="flex-row justify-around">
            {['r', 'b', 'y', 'g'].map((color) => {
              const isBot = botPlayers.includes(color);
              const colorName = color === 'r' ? 'Red' : color === 'b' ? 'Blue' : color === 'y' ? 'Yellow' : 'Green';
              const colorClass = color === 'r' ? 'bg-red-500' : color === 'b' ? 'bg-blue-500' : color === 'y' ? 'bg-yellow-500' : 'bg-green-500';
              
              return (
                <TouchableOpacity
                  key={color}
                  className={`flex-1 mx-1 py-3 px-2 rounded-lg border-2 ${
                    isBot ? 'border-green-400 bg-green-500/20' : 'border-white/30 bg-white/10'
                  }`}
                  onPress={() => toggleBotPlayer(color)}
                >
                  <View className="items-center">
                    <View className={`w-4 h-4 rounded-full mb-1 ${colorClass}`} />
                    <Text className={`text-xs font-semibold ${isBot ? 'text-green-400' : 'text-gray-300'}`}>
                      {colorName}
                    </Text>
                    <Text className={`text-xs ${isBot ? 'text-green-300' : 'text-gray-400'}`}>
                      {isBot ? '🤖 Bot' : '👤 Human'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>

      <View className="mb-8">
        <AnimatedButton
          icon="🌐"
          title="Create Game"
          subtitle={isLoading ? "Creating..." : `Start an online game${botPlayers.length > 0 ? ` with ${botPlayers.length} bot${botPlayers.length > 1 ? 's' : ''}` : ''}`}
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
            onPress={() => router.back()}
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
              onPress={refreshGames}
            >
              <Text className="text-white text-sm font-bold">Refresh</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-green-600 px-3 py-2 rounded-lg"
              onPress={forceReauth}
            >
              <Text className="text-white text-sm font-bold">Re-auth</Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="bg-red-600 px-3 py-2 rounded-lg"
              onPress={cleanupCorruptedGames}
            >
              <Text className="text-white text-sm font-bold">Cleanup</Text>
            </TouchableOpacity>
          </View>
        </View>

        {availableGames.length === 0 ? (
          <Text className="text-gray-400 text-center mt-8">
            No games available. Create one to get started!
          </Text>
        ) : (
          <FlatList
            data={availableGames}
            renderItem={renderGameItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            style={{ width: '100%' }}
          />
        )}
      </View>
    </SafeAreaView>
  );
};

export default OnlineLobbyScreen;
