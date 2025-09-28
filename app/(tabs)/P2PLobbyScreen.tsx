import React, { useEffect, useMemo } from "react";
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
import { 
  resetGame, 
  setCurrentGame, 
  setDiscoveredGames, 
  setIsDiscovering, 
  setIsLoading, 
  setIsConnected, 
  setConnectionError, 
  setIsEditingName, 
  setTempName,
  syncP2PGameState 
} from "../../state/gameSlice";
import { useSettings } from "../../context/SettingsContext";
import p2pService, { P2PGame, P2PPlayer } from "../../services/p2pService";
import networkDiscoveryService from "../../services/networkDiscoveryService";

const P2PLobbyScreen: React.FC = () => {
  console.log("🎮 P2PLobbyScreen: Component mounted/rendered");
  
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings, updateProfile } = useSettings();

  // ✅ All state now comes from Redux
  const {
    players,
    isHost,
    canStartGame,
    currentGame,
    discoveredGames,
    isDiscovering,
    isLoading,
    isConnected,
    connectionError,
    isEditingName,
    tempName,
  } = useSelector((state: RootState) => state.game);

  // Debug logging
  console.log("🎮 P2PLobbyScreen: Current Redux state:", {
    players: players.length,
    isHost,
    canStartGame,
    currentGame: currentGame ? "present" : "null",
    isLoading,
    isConnected,
    connectionError
  });

  // ✅ No more event listeners! All state comes from Redux
  // The P2P service now directly updates Redux state
  
  // Handle navigation when game starts
  useEffect(() => {
    console.log("🎮 UI: Navigation effect triggered - currentGame:", currentGame, "isHost:", isHost);
    if (currentGame && currentGame.status === 'playing' && !isHost) {
      console.log("🎮 UI: Game status is 'playing', navigating to game screen...");
      console.log("🎮 UI: Current game:", currentGame);
      router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=p2p`);
    } else {
      console.log("🎮 UI: Not navigating - conditions not met:", {
        hasCurrentGame: !!currentGame,
        gameStatus: currentGame?.status,
        isHost: isHost
      });
    }
  }, [currentGame, isHost, router]);

  // Auto-discover games on mount
  useEffect(() => {
    discoverGames();
  }, []);

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

  // Create a new P2P game
  const createGame = async () => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    dispatch(setIsLoading(true));
    dispatch(setConnectionError(null));
    try {
      dispatch(resetGame());
      
      const game = await p2pService.createGame(settings.profile.name.trim());
      // ✅ P2P service now updates Redux directly, no need to set local state
      
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
    console.log(`🎮 P2PLobbyScreen: joinGame called with gameId: ${gameId}`);
    
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    dispatch(setIsLoading(true));
    dispatch(setConnectionError(null));
    try {
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

  // Discover games on the network
  const discoverGames = async () => {
    // ✅ P2P service now handles Redux updates directly
    try {
      const games = await p2pService.discoverGames();
      console.log("Discovered games:", games);
    } catch (error) {
      console.error("Error discovering games:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to discover games";
      Alert.alert("Error", errorMessage);
    }
  };

  // Start the game (host only)
  const startGame = async () => {
    if (!isHost || !currentGame) return;
    
    dispatch(setIsLoading(true));
    try {
      // Check if all players are connected before starting
      const allPlayersConnected = players.every(p => p.isHost || p.connectionState === 'connected');
      console.log(`🔗 P2PLobbyScreen: Starting game - all players connected: ${allPlayersConnected}`);
      players.forEach((player: any) => {
        console.log(`🔗 P2PLobbyScreen: Player ${player.name} (${player.isHost ? 'host' : 'client'}): connectionState=${player.connectionState}, isConnected=${player.isConnected}`);
      });
      
      // This will update the host's state and trigger the sync to clients
      p2pService.sendGameStarted(); 
      
      // The host navigates itself
      router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=p2p`);
    } catch (error) {
      console.error("Error starting game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start game";
      Alert.alert("Error", errorMessage);
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  // Leave the game
  const leaveGame = () => {
    p2pService.disconnect();
    // ✅ P2P service now handles Redux updates directly
  };

  // Render discovered game item
  const renderGameItem = ({ item }: { item: any }) => {
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
              {item.playerCount}/{item.maxPlayers} players
            </Text>
            <Text className="text-gray-400 text-xs">
              Code: {item.joinCode}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-green-400 text-sm">Available</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

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
          
          <Text className="text-gray-300 text-sm mb-4 text-center">
            Join Code: <Text className="text-white font-bold">{currentGame.joinCode}</Text>
          </Text>

          <View className="space-y-3">
            <Text className="text-white text-lg font-semibold mb-2">Players ({players.length})</Text>
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
                              ? "bg-yellow-500"
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
                  players.length < 2 || players.some(p => !p.isHost && p.connectionState && p.connectionState !== 'connected')
                    ? "bg-gray-600" 
                    : "bg-white"
                }`}
                onPress={startGame}
                disabled={
                  players.length < 2 || 
                  players.some(p => !p.isHost && p.connectionState && p.connectionState !== 'connected') ||
                  isLoading
                }
              >
                <Text className={`text-lg font-bold text-center ${
                  players.length < 2 || players.some(p => !p.isHost && p.connectionState && p.connectionState !== 'connected')
                    ? "text-gray-300" 
                    : "text-black"
                }`}>
                  {isLoading ? "Starting..." : 
                    players.some(p => !p.isHost && p.connectionState && p.connectionState !== 'connected')
                      ? "Connecting..."
                      : players.length < 2
                        ? "Waiting for players..."
                        : "Start Game"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          className="w-full py-3 px-6 rounded-xl bg-red-600"
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
        
        {/* Connection status indicator */}
        <View className="flex-row items-center mt-2">
          <View className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <Text className="text-gray-400 text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View className="space-y-4 mb-8">
        <TouchableOpacity
          className="w-full py-4 px-6 rounded-xl bg-white shadow-lg"
          onPress={createGame}
          disabled={isLoading}
        >
          <Text className="text-black text-xl font-bold text-center">
            {isLoading ? "Creating..." : "Create Game"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-full py-4 px-6 rounded-xl bg-white/20 border-2 border-white/30"
          onPress={discoverGames}
          disabled={isDiscovering}
        >
          <Text className="text-white text-xl font-bold text-center">
            {isDiscovering ? "Discovering..." : "Refresh Games"}
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
        <Text className="text-white text-xl font-bold mb-4">
          Available Games
        </Text>

        {discoveredGames.length === 0 ? (
          <Text className="text-gray-400 text-center mt-8">
            No games available. Create one to get started!
          </Text>
        ) : (
          <FlatList
            data={discoveredGames}
            renderItem={renderGameItem}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
    </View>
  );
};

export default P2PLobbyScreen;