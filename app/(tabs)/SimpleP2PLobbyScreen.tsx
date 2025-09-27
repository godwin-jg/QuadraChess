import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  Alert,
  Modal,
  StyleSheet,
  Dimensions,
  Clipboard,
} from "react-native";
import { useRouter } from "expo-router";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../../state/store";
import { setPlayers, setIsHost, setCanStartGame, resetGame } from "../../state/gameSlice";
import { useSettings } from "../../context/SettingsContext";
import p2pService, { P2PGame, P2PPlayer } from "../../services/p2pService";

const { width } = Dimensions.get("window");

export default function P2PLobbyScreen() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings, updateProfile } = useSettings();

  const gameState = useSelector((state: RootState) => state.game);
  const { players, isHost, canStartGame } = gameState;

  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [showJoinOptions, setShowJoinOptions] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [gameId, setGameId] = useState("");
  const [currentGame, setCurrentGame] = useState<P2PGame | null>(null);

  // Initialize P2P service
  useEffect(() => {
    const unsubscribeGameState = p2pService.on("game-state-update", (gameState) => {
      setCurrentGame(gameState);
      dispatch(setPlayers(gameState.players || []));
    });

    const unsubscribeMove = p2pService.on("move", (move) => {
      console.log("Received move:", move);
    });

    return () => {
      unsubscribeGameState();
      unsubscribeMove();
    };
  }, [dispatch]);

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

    try {
      dispatch(resetGame());
      
      const game = await p2pService.createGame(settings.profile.name.trim());
      setCurrentGame(game);
      
      dispatch(setIsHost(true));
      dispatch(setCanStartGame(false));
      
      console.log("Simple P2P Game created:", game);
    } catch (error) {
      console.error("Error creating simple P2P game:", error);
      Alert.alert("Error", "Failed to create game");
    }
  };

  // Join game with simple code
  const joinGameWithCode = async () => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    if (!joinCode.trim()) {
      Alert.alert("Error", "Please enter a join code");
      return;
    }

    try {
      dispatch(resetGame());
      
      await p2pService.joinGameWithCode(joinCode.trim(), settings.profile.name.trim());
      
      dispatch(setIsHost(false));
      dispatch(setCanStartGame(false));
      
      Alert.alert("Success", `Joining game with code: ${joinCode}`);
      setShowJoinOptions(false);
    } catch (error) {
      console.error("Error joining game with code:", error);
      Alert.alert("Error", "Failed to join game");
    }
  };

  // Join game with game ID
  const joinGameWithId = async () => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    if (!gameId.trim()) {
      Alert.alert("Error", "Please enter a game ID");
      return;
    }

    try {
      dispatch(resetGame());
      
      await p2pService.joinGameById(gameId.trim(), settings.profile.name.trim());
      
      dispatch(setIsHost(false));
      dispatch(setCanStartGame(false));
      
      Alert.alert("Success", `Joining game with ID: ${gameId}`);
      setShowJoinOptions(false);
    } catch (error) {
      console.error("Error joining game with ID:", error);
      Alert.alert("Error", "Failed to join game");
    }
  };

  // Copy join code to clipboard
  const copyJoinCode = () => {
    const code = p2pService.getJoinCode();
    if (code) {
      Clipboard.setString(code);
      Alert.alert("Copied!", `Join code ${code} copied to clipboard`);
    }
  };

  // Start the game (host only)
  const startGame = () => {
    if (!isHost || !currentGame) return;
    
    const updatedGame = { ...currentGame, status: "playing" as const };
    setCurrentGame(updatedGame);
    
    router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=simple-p2p`);
  };

  // Leave the game
  const leaveGame = () => {
    p2pService.disconnect();
    setCurrentGame(null);
    dispatch(setPlayers([]));
    dispatch(setIsHost(false));
    dispatch(setCanStartGame(false));
  };

  // Render Join Options Modal
  const renderJoinOptionsModal = () => (
    <Modal visible={showJoinOptions} animationType="slide" transparent>
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Join Game</Text>
          <Text style={styles.modalSubtitle}>
            Choose how you want to join a game
          </Text>
          
          {/* Join Code Option */}
          <View style={styles.joinOption}>
            <Text style={styles.optionTitle}>🎯 Join Code</Text>
            <Text style={styles.optionDescription}>
              Enter the 4-digit code shared by the host
            </Text>
            <TextInput
              style={styles.codeInput}
              placeholder="Enter join code (e.g., 1234)"
              value={joinCode}
              onChangeText={setJoinCode}
              keyboardType="numeric"
              maxLength={4}
            />
            <TouchableOpacity
              style={styles.joinButton}
              onPress={joinGameWithCode}
            >
              <Text style={styles.joinButtonText}>Join with Code</Text>
            </TouchableOpacity>
          </View>

          {/* Game ID Option */}
          <View style={styles.joinOption}>
            <Text style={styles.optionTitle}>🔗 Game ID</Text>
            <Text style={styles.optionDescription}>
              Enter the full game ID if you know it
            </Text>
            <TextInput
              style={styles.idInput}
              placeholder="Enter game ID"
              value={gameId}
              onChangeText={setGameId}
            />
            <TouchableOpacity
              style={styles.joinButton}
              onPress={joinGameWithId}
            >
              <Text style={styles.joinButtonText}>Join with ID</Text>
            </TouchableOpacity>
          </View>
          
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => setShowJoinOptions(false)}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (currentGame) {
    // In-game waiting room
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>P2P Game</Text>
          <Text style={styles.headerSubtitle}>
            {isHost ? "Hosting" : "Playing"} • {currentGame.playerCount}/4 players
          </Text>
        </View>

        {/* Join Code Display */}
        {isHost && currentGame.joinCode && (
          <View style={styles.joinCodeSection}>
            <Text style={styles.joinCodeTitle}>Join Code</Text>
            <View style={styles.joinCodeContainer}>
              <Text style={styles.joinCodeText}>{currentGame.joinCode}</Text>
              <TouchableOpacity style={styles.copyButton} onPress={copyJoinCode}>
                <Text style={styles.copyButtonText}>Copy</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.joinCodeDescription}>
              Share this code with other players
            </Text>
          </View>
        )}

        <View style={styles.playerList}>
          <Text style={styles.playerListTitle}>Players</Text>
          {players.map((player, index) => (
            <View key={player.id} style={styles.playerItem}>
              <Text style={styles.playerName}>
                {player.name} {player.isHost && "(Host)"}
              </Text>
              <View style={[
                styles.playerStatus,
                { backgroundColor: player.isConnected ? "#4CAF50" : "#F44336" }
              ]} />
            </View>
          ))}
        </View>

        {isHost && (
          <View style={styles.hostControls}>
            {players.length < 2 && (
              <Text style={styles.waitingText}>
                Waiting for players to join...
              </Text>
            )}
            
            <TouchableOpacity
              style={[
                styles.startButton,
                players.length < 2 && styles.disabledButton
              ]}
              onPress={startGame}
              disabled={players.length < 2}
            >
              <Text style={[
                styles.startButtonText,
                players.length < 2 && styles.disabledButtonText
              ]}>
                Start Game
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity style={styles.leaveButton} onPress={leaveGame}>
          <Text style={styles.leaveButtonText}>Leave Game</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Main menu
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>P2P Chess</Text>
        <Text style={styles.headerSubtitle}>
          Connect and play without servers
        </Text>
      </View>

      <View style={styles.nameSection}>
        <Text style={styles.nameLabel}>Playing as:</Text>
        {isEditingName ? (
          <TextInput
            style={styles.nameInput}
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
            <Text style={styles.nameText}>{settings.profile.name}</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity style={styles.createButton} onPress={createGame}>
          <Text style={styles.createButtonText}>Create Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.joinButton}
          onPress={() => setShowJoinOptions(true)}
        >
          <Text style={styles.joinButtonText}>Join Game</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Back to Home</Text>
        </TouchableOpacity>
      </View>

      {renderJoinOptionsModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    padding: 20,
  },
  header: {
    alignItems: "center",
    marginBottom: 30,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: "#9CA3AF",
    textAlign: "center",
  },
  nameSection: {
    alignItems: "center",
    marginBottom: 40,
  },
  nameLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 8,
  },
  nameInput: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#374151",
    paddingBottom: 4,
    minWidth: 200,
  },
  nameText: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#fff",
  },
  buttonSection: {
    gap: 16,
  },
  createButton: {
    backgroundColor: "#fff",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  createButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#000",
  },
  joinButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.3)",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
  },
  joinButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  backButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
  },
  joinCodeSection: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    alignItems: "center",
  },
  joinCodeTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  joinCodeContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 8,
  },
  joinCodeText: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#fff",
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    letterSpacing: 4,
  },
  copyButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  copyButtonText: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#fff",
  },
  joinCodeDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  playerList: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
  },
  playerListTitle: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 12,
  },
  playerItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
  },
  playerName: {
    fontSize: 16,
    color: "#fff",
  },
  playerStatus: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  hostControls: {
    alignItems: "center",
    marginBottom: 20,
  },
  waitingText: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 16,
    textAlign: "center",
  },
  startButton: {
    backgroundColor: "#fff",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    minWidth: 200,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#000",
    textAlign: "center",
  },
  disabledButton: {
    backgroundColor: "#6B7280",
  },
  disabledButtonText: {
    color: "#9CA3AF",
  },
  leaveButton: {
    backgroundColor: "#EF4444",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  leaveButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#1F2937",
    borderRadius: 16,
    padding: 24,
    width: width * 0.9,
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#fff",
    textAlign: "center",
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
    marginBottom: 24,
  },
  joinOption: {
    marginBottom: 24,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  optionDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    marginBottom: 12,
  },
  codeInput: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 18,
    fontWeight: "bold",
    textAlign: "center",
    letterSpacing: 2,
    marginBottom: 12,
  },
  idInput: {
    backgroundColor: "#fff",
    padding: 12,
    borderRadius: 8,
    fontSize: 14,
    color: "#000",
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
  },
});
