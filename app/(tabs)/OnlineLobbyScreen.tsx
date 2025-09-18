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
import {
  setPlayers,
  setIsHost,
  setCanStartGame,
  baseInitialState,
} from "../../state";
import {
  firebaseService,
  testFirebaseConnection,
  FirebaseGame,
} from "../../services";
import realtimeDatabaseService, {
  RealtimeGame,
} from "../../services/realtimeDatabaseService";
import { generateRandomName } from "../utils/nameGenerator";

const OnlineLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();

  const gameState = useSelector((state: RootState) => state.game);

  const { players, isHost, canStartGame } = useMemo(
    () => ({
      players: gameState.players || [],
      isHost: gameState.isHost || false,
      canStartGame: gameState.canStartGame || false,
    }),
    [gameState.players, gameState.isHost, gameState.canStartGame]
  );

  const [playerName, setPlayerName] = useState("");
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState("");
  const [availableGames, setAvailableGames] = useState<
    (RealtimeGame | FirebaseGame)[]
  >([]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentGameId, setCurrentGameId] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [useRealtimeDB, setUseRealtimeDB] = useState(true);

  // Initialize Firebase auth and generate player name
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        if (useRealtimeDB) {
          // Use Realtime Database
          await realtimeDatabaseService.signInAnonymously();
          const name = generateRandomName();
          setPlayerName(name);
          setIsConnected(true);
          console.log("Realtime Database initialization successful");
        } else {
          // Use Firestore
          const isConnected = await testFirebaseConnection();
          if (!isConnected) {
            throw new Error("Firebase connection test failed");
          }

          await firebaseService.signInAnonymously();
          const name = generateRandomName();
          setPlayerName(name);
          setIsConnected(true);
          console.log("Firestore initialization successful");
        }
      } catch (error) {
        console.error("Failed to initialize Firebase auth:", error);
        Alert.alert("Connection Error", "Failed to connect to online services");
      }
    };

    initializeAuth();
  }, [useRealtimeDB]);

  // Subscribe to available games
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = useRealtimeDB
      ? realtimeDatabaseService.subscribeToAvailableGames((games) => {
          setAvailableGames(games);
        })
      : firebaseService.subscribeToAvailableGames((games) => {
          setAvailableGames(games);
        });

    return unsubscribe;
  }, [isConnected, useRealtimeDB]);

  // Subscribe to current game updates
  useEffect(() => {
    if (!currentGameId) return;

    const unsubscribe = useRealtimeDB
      ? realtimeDatabaseService.subscribeToGame(currentGameId, (game) => {
          if (game) {
            const playersArray = Object.values(game.players);
            dispatch(setPlayers(playersArray));
            dispatch(
              setIsHost(
                game.hostId === realtimeDatabaseService.getCurrentUser()?.uid
              )
            );
            dispatch(
              setCanStartGame(
                playersArray.length >= 2 && game.status === "waiting"
              )
            );

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
        })
      : firebaseService.subscribeToGame(currentGameId, (game) => {
          if (game) {
            dispatch(setPlayers(game.players));
            dispatch(
              setIsHost(game.hostId === firebaseService.getCurrentUser()?.uid)
            );
            dispatch(
              setCanStartGame(
                game.players.length >= 2 && game.status === "waiting"
              )
            );

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
        });

    return unsubscribe;
  }, [currentGameId, dispatch, router, useRealtimeDB]);

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

  const createGame = async () => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      const gameState = {
        ...baseInitialState,
        // Override only multiplayer-specific properties
        players: [],
        isHost: true,
        canStartGame: false,
      };

      console.log("baseInitialState keys:", Object.keys(baseInitialState));
      console.log(
        "baseInitialState sample:",
        JSON.stringify(
          {
            boardState: baseInitialState.boardState ? "present" : "missing",
            currentPlayerTurn: baseInitialState.currentPlayerTurn,
            gameStatus: baseInitialState.gameStatus,
            selectedPiece: baseInitialState.selectedPiece,
            validMoves: baseInitialState.validMoves ? "present" : "missing",
            capturedPieces: baseInitialState.capturedPieces
              ? "present"
              : "missing",
            checkStatus: baseInitialState.checkStatus ? "present" : "missing",
            winner: baseInitialState.winner,
            eliminatedPlayers: baseInitialState.eliminatedPlayers
              ? "present"
              : "missing",
            justEliminated: baseInitialState.justEliminated,
            scores: baseInitialState.scores ? "present" : "missing",
            promotionState: baseInitialState.promotionState
              ? "present"
              : "missing",
            hasMoved: baseInitialState.hasMoved ? "present" : "missing",
            enPassantTargets: baseInitialState.enPassantTargets
              ? "present"
              : "missing",
            gameOverState: baseInitialState.gameOverState
              ? "present"
              : "missing",
            history: baseInitialState.history ? "present" : "missing",
            historyIndex: baseInitialState.historyIndex,
            players: baseInitialState.players ? "present" : "missing",
            isHost: baseInitialState.isHost,
            canStartGame: baseInitialState.canStartGame,
          },
          null,
          2
        )
      );
      console.log("Game state to create:", JSON.stringify(gameState, null, 2));

      const gameId = useRealtimeDB
        ? await realtimeDatabaseService.createGame(playerName, gameState)
        : await firebaseService.createGame(playerName, gameState);

      setCurrentGameId(gameId);
    } catch (error) {
      console.error("Error creating game:", error);
      Alert.alert("Error", "Failed to create game");
    } finally {
      setIsLoading(false);
    }
  };

  const joinGame = async (gameId: string) => {
    if (!playerName.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    setIsLoading(true);
    try {
      if (useRealtimeDB) {
        await realtimeDatabaseService.joinGame(gameId, playerName);
      } else {
        await firebaseService.joinGame(gameId, playerName);
      }
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
        if (useRealtimeDB) {
          await realtimeDatabaseService.leaveGame(currentGameId);
        } else {
          await firebaseService.leaveGame(currentGameId);
        }
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
      if (useRealtimeDB) {
        await realtimeDatabaseService.startGame(currentGameId);
      } else {
        await firebaseService.startGame(currentGameId);
      }
    } catch (error) {
      console.error("Error starting game:", error);
      Alert.alert("Error", "Failed to start game");
    }
  };

  const renderGameItem = ({ item }: { item: RealtimeGame | FirebaseGame }) => {
    const playerCount = useRealtimeDB
      ? Object.keys((item as RealtimeGame).players).length
      : (item as FirebaseGame).players.length;

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
                {playerName}
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
                      player.color === "white"
                        ? "bg-white"
                        : player.color === "black"
                          ? "bg-gray-800"
                          : player.color === "red"
                            ? "bg-red-500"
                            : "bg-blue-500"
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
            <Text className="text-white text-2xl font-bold">{playerName}</Text>
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
