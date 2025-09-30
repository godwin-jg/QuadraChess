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
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { RootState } from "../../state/store";
import { setPlayers, setIsHost, setCanStartGame, resetGame } from "../../state";
import realtimeDatabaseService, {
  RealtimeGame,
} from "../../services/realtimeDatabaseService";
import onlineGameService from "../../services/onlineGameService";
import { useSettings } from "../../context/SettingsContext";

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
  const [refreshKey, setRefreshKey] = useState(0);

  // Initialize Firebase auth
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        // Use Realtime Database
        await realtimeDatabaseService.signInAnonymously();
        setIsConnected(true);
        console.log("Realtime Database initialization successful");
        
        // Test the connection
        const connectionTest = await realtimeDatabaseService.testConnection();
        if (connectionTest) {
          console.log("✅ Firebase connection test passed");
        } else {
          console.warn("⚠️ Firebase connection test failed");
        }
      } catch (error) {
        console.error("Failed to initialize Firebase auth:", error);
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
        settings.profile.name.trim()
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
          Connecting to online services...
        </Text>
      </View>
    );
  }

  if (currentGameId) {
    // In-game waiting room
    return (
      <View className="flex-1 bg-black p-6">
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
            <TouchableOpacity onPress={startEditingName}>
              <Text className="text-white text-2xl font-bold">
                {settings.profile.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-white/10 p-6 rounded-xl mb-6">
          <Text className="text-white text-xl font-bold mb-4 text-center">
            Waiting for Players
          </Text>

          <View className="space-y-3">
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
          <View className="items-center gap-4">
            {players.length < 2 && (
              <Text className="text-gray-400 text-sm mb-3">
                Need 2+ players to start
              </Text>
            )}
            <TouchableOpacity
              className={`w-full py-3 px-6 rounded-xl shadow-lg ${
                players.length < 2 ? "bg-gray-600" : "bg-white"
              }`}
              onPress={startGame}
              disabled={players.length < 2 || isLoading}
            >
              <Text
                className={`text-lg font-bold text-center ${
                  players.length < 2 ? "text-gray-300" : "text-black"
                }`}
              >
                {isLoading ? "Starting..." : "Start Game"}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          className="w-full py-3 px-6 rounded-xl bg-red-600 mt-4"
          onPress={leaveGame}
          disabled={isLoading}
        >
          <Text className="text-white text-lg font-bold text-center">
            Leave Game
          </Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main menu
  return (
    <View className="flex-1 bg-black p-6">
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
          <TouchableOpacity onPress={startEditingName}>
            <Text className="text-white text-2xl font-bold">{settings.profile.name}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View className="space-y-6 mb-8">
        <TouchableOpacity
          className="w-full py-4 px-6 mb-2 rounded-xl bg-white shadow-lg"
          onPress={createGame}
          disabled={isLoading}
        >
          <Text className="text-black text-xl font-bold text-center">
            {isLoading ? "Creating..." : "Create Game"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full py-4 px-6 rounded-xl bg-white/20 border-2 border-white/30"
          onPress={() => router.back()}
        >
          <Text className="text-white text-xl font-bold text-center">
            Back to Home
          </Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1">
        <View className="flex-row justify-between items-center mb-4">
          <Text className="text-white text-xl font-bold">
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
          />
        )}
      </View>
    </View>
  );
};

export default OnlineLobbyScreen;
