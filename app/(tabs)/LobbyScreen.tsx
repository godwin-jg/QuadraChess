import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  ScrollView,
} from "react-native";
import { useDispatch } from "react-redux";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import networkService, { Player } from "../services/networkService";

const { width } = Dimensions.get("window");

export default function LobbyScreen() {
  const dispatch = useDispatch();
  const router = useRouter();

  const [playerName, setPlayerName] = useState("");
  const [serverIp, setServerIp] = useState("192.168.1.9:3001"); // Updated default IP with port
  const [roomId, setRoomId] = useState("");
  const [isConnecting, setIsConnecting] = useState(false);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [isJoiningRoom, setIsJoiningRoom] = useState(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [isHost, setIsHost] = useState(false);
  const [canStartGame, setCanStartGame] = useState(false);
  const [showConnectionSettings, setShowConnectionSettings] = useState(false);
  const [autoConnectAttempted, setAutoConnectAttempted] = useState(false);

  useEffect(() => {
    // Set up network event listeners
    networkService.on("update-players", (data) => {
      setPlayers(data.players);
      setCanStartGame(data.players.length >= 2 && isHost);
    });

    networkService.on("game-started", () => {
      router.push("/(tabs)/GameScreen");
    });

    networkService.on("room-error", (error) => {
      Alert.alert("Error", (error as Error).message);
      setIsConnecting(false);
      setIsCreatingRoom(false);
      setIsJoiningRoom(false);
    });

    return () => {
      networkService.off("update-players");
      networkService.off("game-started");
      networkService.off("room-error");
    };
  }, [isHost, router]);

  // Auto-connect on component mount
  useEffect(() => {
    const autoConnect = async () => {
      if (!autoConnectAttempted && !networkService.connected) {
        setAutoConnectAttempted(true);
        setIsConnecting(true);

        try {
          const [ip, port] = serverIp.includes(":")
            ? serverIp.split(":")
            : [serverIp, "3001"];

          await networkService.connect(ip, parseInt(port));
          setIsConnecting(false);
        } catch (error) {
          setIsConnecting(false);
          setShowConnectionSettings(true);
        }
      }
    };

    autoConnect();
  }, [autoConnectAttempted, serverIp]);

  const connectToServer = async () => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter your name");
      return;
    }

    if (!serverIp.trim()) {
      Alert.alert("Error", "Please enter server IP address");
      return;
    }

    setIsConnecting(true);
    try {
      const [ip, port] = serverIp.includes(":")
        ? serverIp.split(":")
        : [serverIp, "3001"];

      await networkService.connect(ip, parseInt(port));
      Alert.alert("Connected", `Successfully connected to ${ip}:${port}`);
      setIsConnecting(false);
    } catch (error) {
      setIsConnecting(false);
      Alert.alert(
        "Connection Error",
        `Could not connect to server: ${(error as Error).message}`
      );
    }
  };

  const createRoom = async () => {
    if (!networkService.connected) {
      Alert.alert("Error", "Not connected to server");
      return;
    }

    setIsCreatingRoom(true);
    try {
      const result = await networkService.createRoom({ name: playerName });
      setIsHost(true);
      setCanStartGame(false);
      Alert.alert(
        "Room Created",
        `Room ID: ${result.roomId}\nShare this with other players!`
      );
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    } finally {
      setIsCreatingRoom(false);
    }
  };

  const joinRoom = async () => {
    if (!networkService.connected) {
      Alert.alert("Error", "Not connected to server");
      return;
    }

    if (!roomId.trim()) {
      Alert.alert("Error", "Please enter room ID");
      return;
    }

    setIsJoiningRoom(true);
    try {
      const result = await networkService.joinRoom(roomId, {
        name: playerName,
      });
      setIsHost(false);
      setPlayers(result.players);
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    } finally {
      setIsJoiningRoom(false);
    }
  };

  const startGame = async () => {
    if (!isHost) return;

    try {
      await networkService.startGame();
    } catch (error) {
      Alert.alert("Error", (error as Error).message);
    }
  };

  const getPlayerColorName = (color: string) => {
    switch (color) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Yellow";
      case "g":
        return "Green";
      default:
        return color;
    }
  };

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1e3a8a", "#1e40af", "#3b82f6"]}
        style={styles.gradient}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>🌐 Local Multiplayer</Text>
            <Text style={styles.subtitle}>Connect and play with friends</Text>
          </View>

          {!networkService.connected ? (
            <View style={styles.content}>
              {isConnecting ? (
                <View style={styles.loadingSection}>
                  <ActivityIndicator color="#FFFFFF" size="large" />
                  <Text style={styles.loadingText}>
                    Connecting to server...
                  </Text>
                </View>
              ) : showConnectionSettings ? (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>🔌 Connection Failed</Text>
                  <Text style={styles.errorText}>
                    Could not connect to {serverIp}. Please check your settings.
                  </Text>

                  <TextInput
                    style={styles.input}
                    placeholder="Your Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={playerName}
                    onChangeText={setPlayerName}
                    maxLength={20}
                  />

                  <TextInput
                    style={styles.input}
                    placeholder="Server IP:Port (e.g., 192.168.1.9:3001)"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={serverIp}
                    onChangeText={setServerIp}
                    autoCapitalize="none"
                  />

                  <TouchableOpacity
                    style={[styles.button, styles.connectButton]}
                    onPress={connectToServer}
                    disabled={isConnecting}
                  >
                    {isConnecting ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>🚀 Retry Connection</Text>
                    )}
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
          ) : (
            <View style={styles.content}>
              {/* Connection Status */}
              <View style={styles.statusSection}>
                <View style={styles.statusDot} />
                <Text style={styles.connectedText}>
                  Connected to {serverIp}
                </Text>
              </View>

              {/* Player Name Input */}
              {!playerName && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>👤 Enter Your Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Your Name"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={playerName}
                    onChangeText={setPlayerName}
                    maxLength={20}
                    autoFocus
                  />
                </View>
              )}

              {/* Action Buttons */}
              {playerName && (
                <View style={styles.buttonsContainer}>
                  <TouchableOpacity
                    style={[styles.button, styles.createButton]}
                    onPress={createRoom}
                    disabled={isCreatingRoom}
                  >
                    {isCreatingRoom ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>🏠 Create Room</Text>
                    )}
                  </TouchableOpacity>

                  <View style={styles.divider}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR</Text>
                    <View style={styles.dividerLine} />
                  </View>

                  <TextInput
                    style={styles.input}
                    placeholder="Enter Room ID"
                    placeholderTextColor="rgba(255, 255, 255, 0.7)"
                    value={roomId}
                    onChangeText={setRoomId}
                    autoCapitalize="characters"
                  />

                  <TouchableOpacity
                    style={[styles.button, styles.joinButton]}
                    onPress={joinRoom}
                    disabled={isJoiningRoom}
                  >
                    {isJoiningRoom ? (
                      <ActivityIndicator color="#FFFFFF" size="small" />
                    ) : (
                      <Text style={styles.buttonText}>🚪 Join Room</Text>
                    )}
                  </TouchableOpacity>
                </View>
              )}

              {/* Players List */}
              {players.length > 0 && (
                <View style={styles.playersSection}>
                  <Text style={styles.playersTitle}>
                    👥 Players ({players.length}/4)
                  </Text>
                  {players.map((player, index) => (
                    <View key={player.id} style={styles.playerItem}>
                      <View
                        style={[
                          styles.colorIndicator,
                          { backgroundColor: getPlayerColor(player.color) },
                        ]}
                      />
                      <Text style={styles.playerName}>
                        {player.name} {player.isHost && "👑"}
                      </Text>
                      <Text style={styles.playerColor}>
                        {getPlayerColorName(player.color)}
                      </Text>
                    </View>
                  ))}
                </View>
              )}

              {/* Start Game Button */}
              {isHost && canStartGame && (
                <TouchableOpacity
                  style={[styles.button, styles.startButton]}
                  onPress={startGame}
                >
                  <Text style={styles.buttonText}>🎯 Start Game</Text>
                </TouchableOpacity>
              )}

              {/* Disconnect Button */}
              <TouchableOpacity
                style={[styles.button, styles.disconnectButton]}
                onPress={() => {
                  networkService.disconnect();
                  setPlayers([]);
                  setIsHost(false);
                  setCanStartGame(false);
                }}
              >
                <Text style={styles.buttonText}>❌ Disconnect</Text>
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>
      </LinearGradient>
    </View>
  );
}

const getPlayerColor = (color: string) => {
  switch (color) {
    case "r":
      return "#DC2626";
    case "b":
      return "#2563EB";
    case "y":
      return "#EAB308";
    case "g":
      return "#16A34A";
    default:
      return "#6B7280";
  }
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    opacity: 0.9,
  },
  content: {
    flex: 1,
    justifyContent: "center",
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 24,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  statusSection: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 32,
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#10B981",
    marginRight: 8,
  },
  connectedText: {
    color: "#10B981",
    fontSize: 16,
    fontWeight: "600",
  },
  buttonsContainer: {
    gap: 20,
  },
  input: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
    borderRadius: 20,
    paddingVertical: 16,
    paddingHorizontal: 20,
    color: "#FFFFFF",
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  button: {
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
  },
  connectButton: {
    backgroundColor: "#10B981",
  },
  createButton: {
    backgroundColor: "#3B82F6",
  },
  joinButton: {
    backgroundColor: "#8B5CF6",
  },
  startButton: {
    backgroundColor: "#F59E0B",
    marginTop: 16,
  },
  disconnectButton: {
    backgroundColor: "#EF4444",
    marginTop: 16,
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: "rgba(255, 255, 255, 0.3)",
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    fontWeight: "600",
  },
  playersSection: {
    marginTop: 32,
    marginBottom: 24,
  },
  playersTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  playerItem: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  colorIndicator: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 16,
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
  },
  playerName: {
    flex: 1,
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 2,
  },
  playerColor: {
    color: "rgba(255, 255, 255, 0.7)",
    fontSize: 14,
    fontWeight: "500",
  },
  loadingSection: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 40,
  },
  loadingText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 16,
    textAlign: "center",
  },
  errorText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 20,
  },
});
