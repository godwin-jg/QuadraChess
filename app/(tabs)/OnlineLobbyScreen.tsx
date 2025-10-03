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
import { setGameMode } from "../../state/gameSlice";
import realtimeDatabaseService, {
  RealtimeGame,
} from "../../services/realtimeDatabaseService";
import onlineGameService from "../../services/onlineGameService";
import { useSettings } from "../../context/SettingsContext";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import GridBackground from "../components/ui/GridBackground";
import AnimatedButton from "../components/ui/AnimatedButton";
import { hapticsService } from "../../services/hapticsService";

const OnlineLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings, updateProfile } = useSettings();
  const insets = useSafeAreaInsets();
  
  // Debug logging
  console.log('🔍 SafeAreaInsets:', insets);

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
  const [currentGame, setCurrentGame] = useState<RealtimeGame | null>(null);

  // Initialize Firebase auth (optimized)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setConnectionStatus("Authenticating...");
        // Use Realtime Database
        await realtimeDatabaseService.signInAnonymously();
        
        setConnectionStatus("Connecting...");
        setIsConnected(true);
        
        // Skip connection test to reduce loading time
        // Connection will be validated when subscribing to games
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
          // Store current game data for join code display
          setCurrentGame(game);
          
          // ✅ CRITICAL FIX: Update players in Redux state when they join/leave
          const playersArray = Object.values(game.players || {});
          
          // Update Redux players state
          dispatch(setPlayers(playersArray));
          
          // Update host status
          const user = realtimeDatabaseService.getCurrentUser();
          const isHost = user ? game.hostId === user.uid : false;
          dispatch(setIsHost(isHost));
          
          // Update can start game status
          const canStartGame = playersArray.length >= 2 && game.status === "waiting";
          dispatch(setCanStartGame(canStartGame));
          
          // Sync bot players from game data
          const botPlayersFromGame = playersArray
            .filter((player: any) => player.isBot === true)
            .map((player: any) => player.color);
          setBotPlayers(botPlayersFromGame);
          
          console.log(`🔍 OnlineLobbyScreen: Updated players (${playersArray.length}):`, playersArray.map(p => p.name));
          
          // Check if game status changed to playing
          if (game.status === "playing") {
            router.push(
              `/(tabs)/GameScreen?gameId=${currentGameId}&mode=online`
            );
          }
        } else {
          // Game was deleted
          setCurrentGameId(null);
          setCurrentGame(null);
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
        
        // Handle specific error cases
        if (error.message?.includes('max-retries') || 
            error.message?.includes('too many retries') ||
            error.message?.includes('Failed to leave game after')) {
          
          
          // Force local cleanup even if server operation failed
          setCurrentGameId(null);
          dispatch(setPlayers([]));
          dispatch(setIsHost(false));
          dispatch(setCanStartGame(false));
          
          // Show user-friendly message and navigate home
          Alert.alert(
            "Connection Issue", 
            "There was a connection issue leaving the game, but you've been removed locally. You can safely continue.",
          );
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
    if (!isHost || !currentGameId) {
      console.log(`🤖 OnlineLobbyScreen: Not host or no game, ignoring bot toggle`);
      return;
    }
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    setBotPlayers(newBotPlayers);
    
    // Update bot configuration in database
    try {
      await realtimeDatabaseService.updateBotConfiguration(currentGameId, newBotPlayers);
      console.log(`🤖 OnlineLobbyScreen: Host updated bot configuration:`, newBotPlayers);
    } catch (error) {
      console.error("Error updating bot configuration:", error);
      // Revert local state on error
      setBotPlayers(botPlayers);
      Alert.alert("Error", "Failed to update bot configuration");
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

    return (
      <TouchableOpacity
        className="bg-white/10 p-4 rounded-xl mb-3 border border-white/20"
        onPress={() => {
          // ✅ Add haptic feedback for buttons that don't play sounds
          try {
            const { hapticsService } = require('../../services/hapticsService');
            hapticsService.buttonPress();
          } catch (error) {
          }
          joinGame(item.id);
        }}
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
            <Text className="text-gray-500 text-xs mt-1">
              Join Code: {item.joinCode || item.id.substring(0, 8)}
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
          
          <Text className="text-gray-300 text-sm mb-4 text-center">
            Join Code: <Text className="text-white font-bold">{currentGame?.joinCode || 'Loading...'}</Text>
          </Text>

          <View className="space-y-3 w-full">
            <Text className="text-white text-lg font-semibold mb-2 text-center">Players ({players.length})</Text>
            {players && players.length > 0 ? (
              players.map((player, index) => (
                <View
                  key={player.id}
                  className="flex-row items-center justify-between"
                >
                  <Text className="text-white text-lg">
                    {player.name} {player.isHost && "(Host)"}
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
                      {player.connectionState || 'connected'}
                    </Text>
                  </View>
                </View>
              ))
            ) : (
              <Text className="text-gray-400 text-center">No players yet</Text>
            )}
            
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
                    
                    return (
                      <TouchableOpacity
                        key={color}
                        className={`flex-1 mx-1 py-3 px-2 rounded-lg border-2 ${
                          isBot ? 'border-green-400 bg-green-500/20' : 'border-white/30 bg-white/10'
                        }`}
                        onPress={() => {
                          hapticsService.selection();
                          toggleBotPlayer(color);
                        }}
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
              data={availableGames}
              renderItem={renderGameItem}
              keyExtractor={(item) => item.id}
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
