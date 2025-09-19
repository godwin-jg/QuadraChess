import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState, resetGame } from "../../state";
import { setPlayers, setIsHost, setCanStartGame } from "../../state/gameSlice";
import networkService, { Player } from "../services/networkService";
import networkConfigService, {
  ServerConfig,
} from "../../services/networkConfigService";
import gameHostService from "../../services/gameHostService";
import ServerStartupGuide from "../../components/ServerStartupGuide";

// Generate random player names
const generateRandomName = (): string => {
  const adjectives = [
    "Swift",
    "Bold",
    "Clever",
    "Sharp",
    "Quick",
    "Wise",
    "Brave",
    "Smart",
  ];
  const nouns = [
    "Player",
    "Chess",
    "King",
    "Queen",
    "Rook",
    "Knight",
    "Bishop",
    "Pawn",
  ];
  const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
  const noun = nouns[Math.floor(Math.random() * nouns.length)];
  return `${adj}${noun}`;
};

interface AvailableGame {
  id: string;
  name: string;
  host: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

export default function LobbyScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const [playerName, setPlayerName] = useState(generateRandomName());
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [availableGames, setAvailableGames] = useState<AvailableGame[]>([]);
  const [showJoinGames, setShowJoinGames] = useState(false);
  const [discoveredServers, setDiscoveredServers] = useState<ServerConfig[]>(
    []
  );
  const [showServerSelection, setShowServerSelection] = useState(false);
  const [selectedServer, setSelectedServer] = useState<ServerConfig | null>(
    null
  );
  const [showServerGuide, setShowServerGuide] = useState(false);
  const [serverGuideInfo, setServerGuideInfo] = useState<
    { host: string; port: number } | undefined
  >();
  const isInGameRef = useRef(false);

  const {
    players = [],
    isHost = false,
    canStartGame = false,
  } = useSelector((state: RootState) => state.game);

  // Auto-connect to server
  useEffect(() => {
    const connectToServer = async () => {
      if (!networkService.connected) {
        setIsConnecting(true);
        try {
          // Try to discover servers first
          const servers = await networkConfigService.discoverServers();
          setDiscoveredServers(servers);

          if (servers.length > 0) {
            // Use the first available server
            const serverConfig = servers[0];
            setSelectedServer(serverConfig);
            await networkService.connect(serverConfig.host, serverConfig.port);
          } else {
            // Fallback to default configuration
            const serverConfig = await networkConfigService.getServerConfig();
            setSelectedServer(serverConfig);
            await networkService.connect(serverConfig.host, serverConfig.port);
          }
        } catch (error) {
          console.error("Connection failed:", error);
          setShowServerSelection(true);
        } finally {
          setIsConnecting(false);
        }
      }
    };
    connectToServer();
  }, []);

  // Handle game events
  useEffect(() => {
    if (!networkService.connected) return;

    const handleGameDestroyed = (data: { reason: string }) => {
      isInGameRef.current = false;
      Alert.alert("Game Ended", data.reason, [
        { text: "OK", onPress: () => dispatch(resetGame()) },
      ]);
    };

    const handleGameStarted = () => {
      router.push("/(tabs)/GameScreen");
    };

    const handleUpdatePlayers = (data: { players: Player[] }) => {
      dispatch(setPlayers(data.players));
    };

    networkService.on("game-destroyed", handleGameDestroyed);
    networkService.on("game-started", handleGameStarted);
    networkService.on("update-players", handleUpdatePlayers);

    return () => {
      networkService.off("game-destroyed", handleGameDestroyed);
      networkService.off("game-started", handleGameStarted);
      networkService.off("update-players", handleUpdatePlayers);
    };
  }, [networkService.connected, dispatch]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isInGameRef.current) {
        networkService.leaveGame();
      }
    };
  }, []);

  // Load available games
  const loadAvailableGames = async () => {
    try {
      const serverConfig =
        selectedServer || (await networkConfigService.getServerConfig());
      const serverURL = networkConfigService.buildServerURL(serverConfig);
      const response = await fetch(`${serverURL}/api/games`);
      const games = await response.json();
      setAvailableGames(games);
    } catch (error) {
      console.error("Error loading games:", error);
      Alert.alert("Error", "Could not load available games");
    }
  };

  const connectToSelectedServer = async (serverConfig: ServerConfig) => {
    try {
      setIsConnecting(true);
      await networkService.connect(serverConfig.host, serverConfig.port);
      setSelectedServer(serverConfig);
      setShowServerSelection(false);
    } catch (error) {
      console.error("Failed to connect to server:", error);
      Alert.alert(
        "Connection Error",
        `Could not connect to ${networkConfigService.getServerDisplayName(serverConfig)}`
      );
    } finally {
      setIsConnecting(false);
    }
  };

  const discoverServers = async () => {
    try {
      setIsConnecting(true);
      const servers = await networkConfigService.discoverServers();
      setDiscoveredServers(servers);
      if (servers.length === 0) {
        Alert.alert(
          "No Servers Found",
          "No servers were discovered on your network. Make sure the server is running."
        );
      }
    } catch (error) {
      console.error("Server discovery failed:", error);
      Alert.alert(
        "Discovery Error",
        "Failed to discover servers on your network."
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // Create room
  const createRoom = async () => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsCreatingRoom(true);
    try {
      // Check if we can host a game
      const hostingCheck = await gameHostService.canHostGame();

      if (!hostingCheck.canHost) {
        // Show server startup guide
        setServerGuideInfo(hostingCheck.serverInfo);
        setShowServerGuide(true);
        return;
      }

      // Start hosting
      const hostingResult = await gameHostService.startHosting();

      if (!hostingResult.success) {
        Alert.alert(
          "Hosting Failed",
          hostingResult.instructions ||
            "Failed to start hosting. Please try again."
        );
        return;
      }

      // Create the room
      const result = await networkService.createRoom({ name: playerName });
      dispatch(setIsHost(true));
      dispatch(setCanStartGame(false));
      dispatch(setPlayers(result.players || []));
      isInGameRef.current = true;

      // Show hosting instructions
      const connectionInfo = gameHostService.getServerConnectionInfo();
      const message = connectionInfo
        ? `Game created! Server: ${connectionInfo.host}:${connectionInfo.port}\n\n${connectionInfo.instructions}`
        : "Game created! Your game is now available for others to join.";

      Alert.alert("Game Created!", message);
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

    setIsJoiningRoom(true);
    try {
      const result = await networkService.joinRoom(game.id, {
        name: playerName,
      });
      dispatch(setIsHost(false));
      dispatch(setPlayers(result.players));
      isInGameRef.current = true;
      setShowJoinGames(false);
      Alert.alert("Joined Game!", `You joined ${game.name}`);
    } catch (error) {
      Alert.alert("Error", `Could not join game: ${(error as Error).message}`);
      setIsJoiningRoom(false);
    }
  };

  // Start game
  const startGame = async () => {
    if (!isHost) return;
    try {
      await networkService.startGame();
    } catch (error) {
      Alert.alert("Error", "Could not start game");
    }
  };

  // Disconnect
  const disconnect = () => {
    networkService.leaveGame();
    networkService.disconnect();
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

  // Server startup guide
  if (showServerGuide) {
    return (
      <ServerStartupGuide
        onDismiss={() => setShowServerGuide(false)}
        serverInfo={serverGuideInfo}
      />
    );
  }

  // Server selection modal
  if (showServerSelection) {
    return (
      <View className="flex-1 bg-black justify-center items-center p-6">
        <View className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
          <Text className="text-white text-2xl font-bold text-center mb-6">
            Select Server
          </Text>

          <Text className="text-gray-300 text-center mb-6">
            Choose a server to connect to for local multiplayer
          </Text>

          {discoveredServers.length > 0 ? (
            <View className="space-y-3 mb-6">
              {discoveredServers.map((server, index) => (
                <TouchableOpacity
                  key={index}
                  className="bg-gray-700 p-4 rounded-xl border border-gray-600"
                  onPress={() => connectToSelectedServer(server)}
                >
                  <Text className="text-white text-lg font-semibold">
                    {networkConfigService.getServerDisplayName(server)}
                  </Text>
                  <Text className="text-gray-400 text-sm">
                    {server.host}:{server.port}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View className="mb-6">
              <Text className="text-gray-400 text-center mb-4">
                No servers discovered
              </Text>
              <TouchableOpacity
                className="bg-blue-600 py-3 px-4 rounded-xl"
                onPress={discoverServers}
                disabled={isConnecting}
              >
                <Text className="text-white text-center font-semibold">
                  {isConnecting ? "Discovering..." : "Discover Servers"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          <TouchableOpacity
            className="bg-gray-600 py-3 px-4 rounded-xl"
            onPress={() => setShowServerSelection(false)}
          >
            <Text className="text-white text-center font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // Loading state
  if (isConnecting) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text className="text-white text-lg mt-4">Connecting...</Text>
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
              🌐 Multiplayer Chess
            </Text>
            <Text className="text-gray-300 text-base mb-6">
              Playing as: {playerName}
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
            🌐 Multiplayer Chess
          </Text>
          <Text className="text-gray-300 text-lg mb-6">
            Connect and Play with Friends
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
                Create Game
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
              Join Game
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-600/20 py-4 px-6 rounded-xl border-2 border-blue-400/30 shadow-lg"
            onPress={() => setShowServerSelection(true)}
          >
            <Text className="text-blue-300 text-lg font-bold text-center">
              Change Server
            </Text>
            {selectedServer && (
              <Text className="text-blue-200 text-sm text-center mt-1">
                {networkConfigService.getServerDisplayName(selectedServer)}
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {showJoinGames && (
          <View className="mt-6">
            <Text className="text-white text-xl font-semibold mb-4">
              Available Games:
            </Text>
            {availableGames.length === 0 ? (
              <Text className="text-gray-400 text-center py-4">
                No games available
              </Text>
            ) : (
              <View className="gap-3">
                {availableGames.map((game) => (
                  <TouchableOpacity
                    key={game.id}
                    className="bg-white/10 py-3 px-4 rounded-lg border border-white/20"
                    onPress={() => joinGame(game)}
                    disabled={isJoiningRoom}
                  >
                    <View className="flex-row justify-between items-center">
                      <View>
                        <Text className="text-white text-base font-semibold">
                          {game.name}
                        </Text>
                        <Text className="text-gray-300 text-sm">
                          {game.playerCount}/{game.maxPlayers} players
                        </Text>
                      </View>
                      {isJoiningRoom && (
                        <ActivityIndicator color="#FFFFFF" size="small" />
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
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
