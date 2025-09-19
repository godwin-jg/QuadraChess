import database from "@react-native-firebase/database";
import auth from "@react-native-firebase/auth";
import { GameState } from "../state/types";
import { Player } from "../app/services/networkService";

export interface RealtimeGame {
  id: string;
  hostId: string;
  hostName: string;
  players: { [playerId: string]: Player };
  gameState: GameState;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  maxPlayers: number;
  currentPlayerTurn: string;
  winner: string | null;
  lastMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
    timestamp: number;
    moveNumber?: number;
  } | null;
  lastActivity?: number;
}

export interface RealtimeMove {
  from: { row: number; col: number };
  to: { row: number; col: number };
  pieceCode: string;
  playerColor: string;
  playerId: string;
  timestamp: number;
  moveNumber: number;
}

class RealtimeDatabaseService {
  private currentUser: any = null;
  private gameUnsubscribe: (() => void) | null = null;
  private movesUnsubscribe: (() => void) | null = null;

  // Authentication methods
  async signInAnonymously(): Promise<string> {
    try {
      console.log("Signing in anonymously to Realtime Database...");
      const userCredential = await auth().signInAnonymously();
      this.currentUser = userCredential.user;
      console.log("Successfully signed in:", userCredential.user.uid);
      return userCredential.user.uid;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      // Don't fall back to mock user - throw the error so calling code can handle it
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to authenticate: ${errorMessage}`);
    }
  }

  getCurrentUser() {
    return this.currentUser || auth().currentUser;
  }

  // NEW: Call Cloud Function to create game (server-authoritative)
  async createGame(hostName: string): Promise<string> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log("Creating game via Cloud Function:", hostName);

      // Call the Cloud Function directly
      const functions = require("@react-native-firebase/functions").default;
      const createGameFunction = functions().httpsCallable("createGame");

      const result = await createGameFunction({
        playerName: hostName,
      });

      const gameId = result.data.gameId;
      console.log("Game created via Cloud Function:", gameId);
      return gameId;
    } catch (error) {
      console.error("Error creating game via Cloud Function:", error);
      throw error;
    }
  }

  async joinGame(gameId: string, playerName: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = database().ref(`games/${gameId}`);
      const gameSnapshot = await gameRef.once("value");

      if (!gameSnapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameSnapshot.val() as RealtimeGame;

      if (Object.keys(gameData.players).length >= gameData.maxPlayers) {
        throw new Error("Game is full");
      }

      if (gameData.status !== "waiting") {
        throw new Error("Game is not available for joining");
      }

      // Check if player is already in the game
      if (gameData.players[user.uid]) {
        return; // Player already in game
      }

      // Assign color based on order of joining
      const colors = ["r", "b", "y", "g"];
      const usedColors = Object.values(gameData.players).map((p) => p.color);
      const availableColor =
        colors.find((color) => !usedColors.includes(color)) || "g";

      const newPlayer: Player = {
        id: user.uid,
        name: playerName,
        color: availableColor,
        isHost: false,
        isOnline: true,
      };

      await gameRef.child(`players/${user.uid}`).set(newPlayer);
      console.log("Successfully joined game:", gameId);
    } catch (error) {
      console.error("Error joining game:", error);
      throw error;
    }
  }

  async leaveGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = database().ref(`games/${gameId}`);
      const gameSnapshot = await gameRef.once("value");

      if (!gameSnapshot.exists()) {
        return; // Game doesn't exist
      }

      const gameData = gameSnapshot.val() as RealtimeGame;
      const updatedPlayers = { ...gameData.players };
      delete updatedPlayers[user.uid];

      if (Object.keys(updatedPlayers).length === 0) {
        // Delete game if no players left
        console.log("No players left, destroying game:", gameId);
        await gameRef.remove();

        // Also clean up moves collection
        const movesRef = database().ref(`moves/${gameId}`);
        await movesRef.remove();

        console.log("Game and all associated data destroyed");
      } else {
        // Update players list
        await gameRef.child("players").set(updatedPlayers);

        // If host left, assign new host
        if (gameData.hostId === user.uid) {
          const newHostId = Object.keys(updatedPlayers)[0];
          const newHost = updatedPlayers[newHostId];
          await gameRef.update({
            hostId: newHostId,
            hostName: newHost.name,
            [`players/${newHostId}/isHost`]: true,
          });
        }
      }

      console.log("Successfully left game:", gameId);
    } catch (error) {
      console.error("Error leaving game:", error);
      throw error;
    }
  }

  async startGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = database().ref(`games/${gameId}`);
      const gameSnapshot = await gameRef.once("value");

      if (!gameSnapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameSnapshot.val() as RealtimeGame;

      if (gameData.hostId !== user.uid) {
        throw new Error("Only host can start the game");
      }

      if (Object.keys(gameData.players).length < 2) {
        throw new Error("Need at least 2 players to start");
      }

      await gameRef.update({
        status: "playing",
        "gameState/gameStatus": "active",
      });

      console.log("Game started successfully:", gameId);
    } catch (error) {
      console.error("Error starting game:", error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToGame(
    gameId: string,
    onUpdate: (game: RealtimeGame | null) => void
  ): () => void {
    const gameRef = database().ref(`games/${gameId}`);

    const listener = gameRef.on("value", (snapshot) => {
      if (snapshot.exists()) {
        const gameData = { id: gameId, ...snapshot.val() } as RealtimeGame;

        // Ensure all players have required fields
        const processedPlayers: { [playerId: string]: Player } = {};
        Object.entries(gameData.players).forEach(([playerId, player]) => {
          if (player && typeof player === "object") {
            processedPlayers[playerId] = {
              id: playerId,
              name: player.name || `Player ${playerId.slice(0, 8)}`,
              color: player.color || "g", // Default to green if missing
              isHost: player.isHost || false,
              isOnline: player.isOnline || false,
              lastSeen: player.lastSeen || Date.now(),
            };
          }
        });

        gameData.players = processedPlayers;

        onUpdate(gameData);
      } else {
        onUpdate(null);
      }
    });

    return () => {
      gameRef.off("value", listener);
    };
  }

  subscribeToAvailableGames(
    onUpdate: (games: RealtimeGame[]) => void
  ): () => void {
    const gamesRef = database()
      .ref("games")
      .orderByChild("status")
      .equalTo("waiting");

    const listener = gamesRef.on("value", (snapshot) => {
      const games: RealtimeGame[] = [];
      if (snapshot && snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const gameData = {
            id: childSnapshot.key!,
            ...childSnapshot.val(),
          } as RealtimeGame;
          games.push(gameData);
          return true; // Continue iteration
        });
      }
      onUpdate(games);
    });

    return () => {
      gamesRef.off("value", listener);
    };
  }

  // Move management - CLIENT ONLY SENDS MOVE REQUESTS
  async makeMove(
    gameId: string,
    moveData: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
    }
  ): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      // CRITICAL: Client only sends move request, does NOT validate or calculate
      // All validation and game state calculation must happen server-side
      const moveRequest = {
        ...moveData,
        playerId: user.uid,
        timestamp: Date.now(),
        gameId: gameId,
      };

      // Send move request to server for processing
      const moveRequestRef = database().ref(`move-requests/${gameId}`).push();
      await moveRequestRef.set(moveRequest);

      console.log("Move request sent to server:", moveRequest);
    } catch (error) {
      console.error("Error sending move request:", error);
      throw error;
    }
  }

  // Resign game - calls Cloud Function
  async resignGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log("Calling resign Cloud Function for game:", gameId);

      // Call the Cloud Function directly
      const functions = require("@react-native-firebase/functions").default;
      const resignGameFunction = functions().httpsCallable("resignGame");

      const result = await resignGameFunction({
        gameId: gameId,
      });

      console.log("Resign request processed:", result.data);
    } catch (error) {
      console.error("Error calling resign Cloud Function:", error);
      throw error;
    }
  }

  // CRITICAL: This function is DANGEROUS and causes race conditions
  // Clients should NEVER update the authoritative game state

  // CRITICAL: Individual move subscriptions cause desynchronization
  // Only subscribe to the complete game state to prevent desync
  subscribeToMoves(
    gameId: string,
    onMove: (move: RealtimeMove) => void
  ): () => void {
    console.warn(
      "WARNING: subscribeToMoves is disabled to prevent desynchronization"
    );
    console.warn(
      "Use subscribeToGame instead for reliable state synchronization"
    );

    // Return a no-op unsubscribe function
    return () => {
      console.log("Move subscription disabled - no cleanup needed");
    };
  }

  // Player presence management
  async updatePlayerPresence(gameId: string, isOnline: boolean): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = database().ref(`games/${gameId}/players/${user.uid}`);
      await gameRef.update({
        isOnline,
        lastSeen: Date.now(),
      });

      console.log("Player presence updated:", isOnline);
    } catch (error) {
      console.error("Error updating player presence:", error);
      throw error;
    }
  }

  async runManualCleanup(): Promise<{ cleaned: number; resigned: number }> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log("Calling manual cleanup Cloud Function");

      const functions = require("@react-native-firebase/functions").default;
      const manualCleanupFunction = functions().httpsCallable("manualCleanup");

      const result = await manualCleanupFunction({});

      console.log("Manual cleanup completed:", result.data);
      return {
        cleaned: result.data.cleaned || 0,
        resigned: result.data.resigned || 0,
      };
    } catch (error) {
      console.error("Error calling manual cleanup Cloud Function:", error);
      throw error;
    }
  }

  cleanup(): void {
    if (this.gameUnsubscribe) {
      this.gameUnsubscribe();
      this.gameUnsubscribe = null;
    }
    if (this.movesUnsubscribe) {
      this.movesUnsubscribe();
      this.movesUnsubscribe = null;
    }
  }
}

export default new RealtimeDatabaseService();
