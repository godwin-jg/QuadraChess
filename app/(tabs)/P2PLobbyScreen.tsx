import { useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import p2pService, { P2PMessage } from "../../services/p2pService";
import { RootState, resetGame } from "../../state";
import { setCanStartGame, setIsHost, setPlayers } from "../../state/gameSlice";
import { generateRandomName } from "../utils/nameGenerator";

interface AvailableGame {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export default function P2PLobbyScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [playerName, setPlayerName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [showJoinGames, setShowJoinGames] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [signalingServerUrl, setSignalingServerUrl] = useState(
    "http://localhost:3002"
  );
  const isInGameRef = useRef(false);

  const {
    players = [],
    isHost = false,
    canStartGame = false,
  } = useSelector((state: RootState) => state.game);

  // Initialize P2P service
  useEffect(() => {
    const initializeP2P = async () => {
      try {
        setIsConnecting(true);
        await p2pService.initialize(signalingServerUrl);
        setIsInitialized(true);

        // Set up message handlers
        setupMessageHandlers();

        // Generate random name
        const name = generateRandomName();
        setPlayerName(name);

        console.log("P2P Service initialized successfully");
      } catch (error) {
        console.error("Failed to initialize P2P service:", error);
        Alert.alert(
          "Connection Error",
          "Failed to connect to P2P services. Please check your network connection."
        );
      } finally {
        setIsConnecting(false);
      }
    };

    initializeP2P();
  }, [signalingServerUrl]);

  // Set up message handlers
  const setupMessageHandlers = () => {
    // Handle game state updates
    p2pService.onMessage((message: P2PMessage) => {
      if (message.type === "gameState") {
        const { players: updatedPlayers, gameState } = message.data;

        if (updatedPlayers) {
          dispatch(setPlayers(updatedPlayers));
        }

        if (gameState) {
          // Update game state in Redux store
          // This would integrate with your existing game state management
          console.log("Game state updated:", gameState);
        }
      }
    });
  };

  // Load available games
  const loadAvailableGames = async () => {
    try {
      const games = await p2pService.discoverGames();
      setAvailableGames(games);
    } catch (error) {
      console.error("Error loading games:", error);
      Alert.alert("Error", "Could not load available games");
    }
  };

  // Create room
  const createRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    if (!isInitialized) {
      Alert.alert("Error", "P2P service not initialized");
      return;
    }

    setIsCreatingRoom(true);
    try {
      const result = await p2pService.createGame(playerName.trim());
      dispatch(setIsHost(true));
      dispatch(setCanStartGame(false));
      dispatch(
        setPlayers([
          {
            id: result.playerId,
            name: playerName,
            color: "r",
            isHost: true,
            isConnected: true,
            lastSeen: Date.now(),
          },
        ])
      );
      isInGameRef.current = true;

      Alert.alert(
        "Game Created!",
        "Your P2P game is now available for others to join."
      );
    } catch (error) {
      Alert.alert(
        "Error",
        `Could not create game: ${(error as Error).message}`
      );
    } finally {
      setIsCreatingRoom(false);
    }
  };

  // Join game
  const joinGame = async (game: AvailableGame) => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    if (!isInitialized) {
      Alert.alert("Error", "P2P service not initialized");
      return;
    }

    setIsJoiningRoom(true);
    try {
      const result = await p2pService.joinGame(game.id, playerName.trim());
      dispatch(setIsHost(false));
      dispatch(setPlayers([])); // Will be updated when we receive game state
      isInGameRef.current = true;
      setShowJoinGames(false);
      Alert.alert("Joined Game!", `You joined ${game.hostName}'s game`);
    } catch (error) {
      Alert.alert("Error", `Could not join game: ${(error as Error).message}`);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  // Start game
  const startGame = async () => {
    if (!isHost) return;
    try {
      p2pService.startGame();
      router.push("/(tabs)/GameScreen?mode=p2p");
    } catch (error) {
      Alert.alert("Error", "Could not start game");
    }
  };

  // Disconnect
  const disconnect = () => {
    p2pService.leaveGame();
    dispatch(resetGame());
    isInGameRef.current = false;
  };

  // Name editing functions
  const startEditingName = () => {
    setTempName(playerName);
    setIsEditingName(true);
  };

  const saveName = () => {
    if (tempName.trim()) {
      setPlayerName(tempName.trim());
    }
    setIsEditingName(false);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInGameRef.current) {
        p2pService.leaveGame();
      }
    };
  }, []);

  // Loading state
  if (isConnecting || !isInitialized) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text className="text-white text-lg mt-4">
          Connecting to P2P services...
        </Text>
        <Text className="text-gray-400 text-sm mt-2 text-center px-6">
          Server: {signalingServerUrl}
        </Text>
      </View>
    );
  }

  // In game state
  if (players.length > 0) {
    return (
      <View className="flex-1 bg-black">
        <View className="flex-1 px-6 pt-16 pb-10 justify-between">
          <View className="items-center">
            <Text className="text-white text-3xl font-bold mb-2">
              🔗 P2P Chess
            </Text>
            <Text className="text-gray-300 text-base mb-6">
              Playing as: {playerName}
            </Text>
            <Text className="text-blue-400 text-sm mb-2">
              Peer ID: {p2pService.getPeerId().substring(0, 8)}...
            </Text>
          </View>

          <View className="flex-1 justify-center">
            <Text className="text-white text-xl font-semibold mb-4 text-center">
              Players ({players.length}/4)
            </Text>
            <View className="gap-3 mb-8">
              {players.map((player) => (
                <View
                  key={player.id}
                  className="flex-row items-center gap-3 bg-white/10 py-3 px-4 rounded-lg border border-white/20"
                >
                  <View
                    className="w-5 h-5 rounded-full"
                    style={{ backgroundColor: getColorHex(player.color) }}
                  />
                  <Text className="text-white text-base font-medium">
                    {player.name} {player.isHost && "(Host)"}
                  </Text>
                  <View
                    className={`w-2 h-2 rounded-full ${
                      player.isConnected ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                </View>
              ))}
            </View>

            {/* Action Buttons */}
            <View className="items-center gap-4">
              {isHost && (
                <View className="items-center w-full">
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
                    disabled={players.length < 2}
                  >
                    <Text
                      className={`text-lg font-bold text-center ${
                        players.length < 2 ? "text-gray-300" : "text-black"
                      }`}
                    >
                      Start Game
                    </Text>
                  </TouchableOpacity>
                </View>
              )}

              <TouchableOpacity
                className="bg-red-600 py-3 px-6 rounded-xl shadow-lg w-full"
                onPress={disconnect}
              >
                <Text className="text-white text-lg font-bold text-center">
                  Leave Game
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    );
  }

  // Main menu
  return (
    <View className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-16 pb-10 justify-between">
        <View className="items-center">
          <Text className="text-white text-4xl font-bold mb-2">
            🔗 P2P Chess
          </Text>
          <Text className="text-gray-300 text-lg mb-6">
            Peer-to-Peer Multiplayer
          </Text>
          <View className="w-20 h-20 rounded-full bg-white/10 justify-center items-center border-2 border-white/20">
            <Text className="text-4xl text-white">♛</Text>
          </View>
        </View>

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
                {playerName}
              </Text>
            </TouchableOpacity>
          )}
          <Text className="text-blue-400 text-xs mt-2">
            Peer ID: {p2pService.getPeerId().substring(0, 8)}...
          </Text>
        </View>

        <View className="gap-4">
          <TouchableOpacity
            className="bg-white py-4 px-6 rounded-xl shadow-lg"
            onPress={createRoom}
            disabled={isCreatingRoom}
          >
            {isCreatingRoom ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text className="text-black text-lg font-bold text-center">
                Create P2P Game
              </Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white/20 py-4 px-6 rounded-xl border-2 border-white/30 shadow-lg"
            onPress={() => {
              setShowJoinGames(true);
              loadAvailableGames();
            }}
          >
            <Text className="text-white text-lg font-bold text-center">
              Join P2P Game
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-600/20 py-4 px-6 rounded-xl border-2 border-blue-400/30 shadow-lg"
            onPress={() => {
              // Show server configuration modal
              Alert.prompt(
                "Signaling Server",
                "Enter signaling server URL:",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Update",
                    onPress: (url) => {
                      if (url) {
                        setSignalingServerUrl(url);
                        setIsInitialized(false);
                      }
                    },
                  },
                ],
                "plain-text",
                signalingServerUrl
              );
            }}
          >
            <Text className="text-blue-300 text-lg font-bold text-center">
              Server Settings
            </Text>
            <Text className="text-blue-200 text-sm text-center mt-1">
              {signalingServerUrl}
            </Text>
          </TouchableOpacity>
        </View>

        {showJoinGames && (
          <View className="mt-6">
            <Text className="text-white text-xl font-semibold mb-4">
              Available P2P Games:
            </Text>
            {availableGames.length === 0 ? (
              <Text className="text-gray-400 text-center py-4">
                No P2P games available
              </Text>
            ) : (
              <FlatList
                data={availableGames}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    className="bg-white/10 py-3 px-4 rounded-lg border border-white/20 mb-3"
                    onPress={() => joinGame(item)}
                    disabled={isJoiningRoom}
                  >
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-white text-base font-semibold">
                          {item.hostName}'s Game
                        </Text>
                        <Text className="text-gray-300 text-sm">
                          {item.playerCount}/{item.maxPlayers} players
                        </Text>
                      </View>
                      {isJoiningRoom && (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      )}
                    </View>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
              />
            )}
            <TouchableOpacity
              className="bg-gray-600 py-3 px-4 rounded-lg mt-4 shadow-lg"
              onPress={() => setShowJoinGames(false)}
            >
              <Text className="text-white text-center font-semibold">
                ← Back
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function getColorHex(color: string): string {
  const colors = { r: "#EF4444", b: "#3B82F6", y: "#F59E0B", g: "#10B981" };
  return colors[color as keyof typeof colors] || "#FFFFFF";
}


