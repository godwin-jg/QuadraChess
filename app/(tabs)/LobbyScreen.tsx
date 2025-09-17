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
          await networkService.connect("192.168.1.9", 3001);
        } catch (error) {
          Alert.alert("Connection Error", "Could not connect to server.");
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
      const response = await fetch("http://192.168.1.9:3001/api/games");
      const games = await response.json();
      setAvailableGames(games);
    } catch (error) {
      Alert.alert("Error", "Could not load available games");
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
      const result = await networkService.createRoom({ name: playerName });
      dispatch(setIsHost(true));
      dispatch(setCanStartGame(false));
      dispatch(setPlayers(result.players || []));
      isInGameRef.current = true;
      Alert.alert(
        "Game Created!",
        "Your game is now available for others to join."
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
