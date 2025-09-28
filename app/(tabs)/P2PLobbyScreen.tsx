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
import { setPlayers, setIsHost, setCanStartGame, resetGame } from "../../state/gameSlice";
import { useSettings } from "../../context/SettingsContext";
import p2pService, { P2PGame, P2PPlayer } from "../../services/p2pService";
import networkDiscoveryService from "../../services/networkDiscoveryService";

const P2PLobbyScreen: React.FC = () => {
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
  const [currentGame, setCurrentGame] = useState<P2PGame | null>(null);
  const [discoveredGames, setDiscoveredGames] = useState<any[]>([]);
  const [isDiscovering, setIsDiscovering] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize P2P service
  useEffect(() => {
    const unsubscribeGameState = p2pService.on("game-state-update", (gameState) => {
      console.log("P2PLobbyScreen: Received game-state-update:", gameState);
      setCurrentGame(gameState);
      dispatch(setPlayers(gameState.players || []));
    });

    const unsubscribeMove = p2pService.on("move", (move) => {
      console.log("Move received from P2P service:", move);
    });

    const unsubscribePlayersUpdated = p2pService.on("players-updated", (players) => {
      console.log("P2PLobbyScreen: Received players-updated:", players);
      dispatch(setPlayers(players));
    });

    const unsubscribeHostStatusChanged = p2pService.on("host-status-changed", (status) => {
      dispatch(setIsHost(status.isHost));
      dispatch(setCanStartGame(status.canStartGame));
    });

    const unsubscribeMoveReceived = p2pService.on("move-received", (move) => {
      console.log("Move received from P2P service:", move);
    });

    const unsubscribeDisconnected = p2pService.on("disconnected", (data) => {
      console.log("P2P service disconnected:", data);
      dispatch(resetGame());
    });

    const unsubscribeGameStarted = p2pService.on("game-started", (data) => {
      console.log("Game started notification received:", data);
      if (!isHost) {
        console.log("Joining player navigating to game screen with gameId:", data.gameId);
        if (!currentGame) {
          console.log("No currentGame set, creating basic game state for navigation");
          setCurrentGame({
            id: data.gameId,
            name: "P2P Game",
            hostName: "Host",
            hostId: "unknown",
            hostIP: "unknown",
            port: 3001,
            joinCode: "0000",
            playerCount: 2,
            maxPlayers: 4,
            status: "playing",
            timestamp: data.timestamp || Date.now(),
          });
        }
        router.push(`/(tabs)/GameScreen?gameId=${data.gameId}&mode=simple-p2p`);
      }
    });

    return () => {
      unsubscribeGameState();
      unsubscribeMove();
      unsubscribePlayersUpdated();
      unsubscribeHostStatusChanged();
      unsubscribeMoveReceived();
      unsubscribeDisconnected();
      unsubscribeGameStarted();
    };
  }, [dispatch, isHost]);

  // Auto-discover games on mount
  useEffect(() => {
    discoverGames();
  }, []);

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

  // Create a new P2P game
  const createGame = async () => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      dispatch(resetGame());
      
      const game = await p2pService.createGame(settings.profile.name.trim());
      setCurrentGame(game);
      
      console.log("P2P Game created:", game);
    } catch (error) {
      console.error("Error creating P2P game:", error);
      Alert.alert("Error", "Failed to create game");
    } finally {
      setIsLoading(false);
    }
  };

  // Join a discovered game
  const joinGame = async (gameId: string) => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      dispatch(resetGame());
      
      // Find the game in discovered games to set currentGame as fallback
      const gameToJoin = discoveredGames.find(game => game.id === gameId);
      if (gameToJoin) {
        console.log("Setting currentGame from discovered games:", gameToJoin);
        setCurrentGame({
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
          timestamp: Date.now(),
        });
      }
      
      await p2pService.joinDiscoveredGame(gameId, settings.profile.name.trim());
      
      console.log("Joined P2P game:", gameId);
    } catch (error) {
      console.error("Error joining P2P game:", error);
      Alert.alert("Error", "Failed to join game");
      // Reset currentGame on error
      setCurrentGame(null);
    } finally {
      setIsLoading(false);
    }
  };

  // Discover games on the network
  const discoverGames = async () => {
    setIsDiscovering(true);
    try {
      const games = await p2pService.discoverGames();
      setDiscoveredGames(games);
      console.log("Discovered games:", games);
    } catch (error) {
      console.error("Error discovering games:", error);
      Alert.alert("Error", "Failed to discover games");
    } finally {
      setIsDiscovering(false);
    }
  };

  // Start the game (host only)
  const startGame = () => {
    if (!isHost || !currentGame) return;
    
    const updatedGame = { ...currentGame, status: "playing" as const };
    setCurrentGame(updatedGame);
    
    // Notify all connected players that the game has started
    p2pService.sendGameStarted(currentGame.id);
    
    router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=simple-p2p`);
  };

  // Leave the game
  const leaveGame = () => {
    p2pService.disconnect();
    setCurrentGame(null);
    dispatch(resetGame());
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
          <Text className="text-white text-xl font-bold mb-4">
            {currentGame.name}
          </Text>
          
          <Text className="text-gray-300 text-sm mb-4">
            Join Code: <Text className="text-white font-bold">{currentGame.joinCode}</Text>
          </Text>

          <View className="mb-4">
            <Text className="text-white text-lg font-semibold mb-2">Players ({players.length})</Text>
            {players.map((player, index) => (
              <View key={player.id} className="flex-row items-center justify-between mb-2">
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
            ))}
          </View>

          {isHost && (
            <View className="mb-4">
              <TouchableOpacity
                className={`w-full py-4 px-6 rounded-xl ${
                  players.length < 2 ? "bg-gray-600" : "bg-green-600"
                } shadow-lg`}
                onPress={startGame}
                disabled={players.length < 2}
              >
                <Text className={`text-xl font-bold text-center ${
                  players.length < 2 ? "text-gray-300" : "text-white"
                }`}>
                  {players.length < 2 ? "Waiting for players..." : "Start Game"}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        <TouchableOpacity
          className="w-full py-4 px-6 rounded-xl bg-red-600 shadow-lg"
          onPress={leaveGame}
        >
          <Text className="text-white text-xl font-bold text-center">
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