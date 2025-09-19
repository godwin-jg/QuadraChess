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
      // Fallback to mock user for development
      console.log("Falling back to mock user for development");
      const mockUserId = `mock_user_${Date.now()}`;
      this.currentUser = { uid: mockUserId };
      return mockUserId;
    }
  }

  async signOut(): Promise<void> {
    try {
      await auth().signOut();
      this.currentUser = null;
      console.log("Successfully signed out");
    } catch (error) {
      console.error("Error signing out:", error);
      // Clear current user even if Firebase signOut fails
      this.currentUser = null;
      console.log("Cleared local user state");
    }
  }

  getCurrentUser() {
    return this.currentUser || auth().currentUser;
  }

  // SECURE: Game creation request - client only sends intent, server creates state
  async createGameRequest(hostName: string): Promise<string> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log("Sending secure game creation request to server");

      // Create game creation request
      const gameCreationRequest = {
        hostId: user.uid,
        hostName: hostName,
        timestamp: Date.now(),
        status: "pending",
      };

      // Send request to server for processing
      const requestRef = database().ref("game-creation-requests").push();
      const requestId = requestRef.key!;

      await requestRef.set(gameCreationRequest);

      console.log("Game creation request sent:", requestId);

      // Return the request ID - the actual game will be created by server
      // Client should listen for the game to appear in available games
      return requestId;
    } catch (error) {
      console.error("Error sending game creation request:", error);
      throw error;
    }
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

  // SERVER-ONLY: Create authoritative initial game state
  // This function should only be called by Firebase Cloud Functions
  async createAuthoritativeGame(
    hostId: string,
    hostName: string
  ): Promise<string> {
    try {
      console.log("Creating authoritative game state on server");

      const gameRef = database().ref("games").push();
      const gameId = gameRef.key!;

      // Create secure, authoritative initial game state
      const initialGameState = {
        boardState: [
          // Row 0-1: Yellow pieces
          [
            "",
            "",
            "",
            "yR",
            "yN",
            "yB",
            "yQ",
            "yK",
            "yB",
            "yN",
            "yR",
            "",
            "",
            "",
          ],
          [
            "",
            "",
            "",
            "yP",
            "yP",
            "yP",
            "yP",
            "yP",
            "yP",
            "yP",
            "yP",
            "",
            "",
            "",
          ],
          // Row 2-11: Empty board
          ...Array(10).fill(Array(14).fill("")),
          // Row 12-13: Red pieces
          [
            "",
            "",
            "",
            "rP",
            "rP",
            "rP",
            "rP",
            "rP",
            "rP",
            "rP",
            "rP",
            "",
            "",
            "",
          ],
          [
            "",
            "",
            "",
            "rR",
            "rN",
            "rB",
            "rQ",
            "rK",
            "rB",
            "rN",
            "rR",
            "",
            "",
            "",
          ],
        ],
        currentPlayerTurn: "r", // Red starts first
        gameStatus: "waiting" as const,
        selectedPiece: null,
        validMoves: [],
        capturedPieces: { r: [], b: [], y: [], g: [] },
        checkStatus: { r: false, b: false, y: false, g: false },
        winner: null,
        eliminatedPlayers: [],
        justEliminated: null,
        scores: { r: 0, b: 0, y: 0, g: 0 },
        promotionState: { isAwaiting: false, position: null, color: null },
        hasMoved: {
          rK: false,
          rR1: false,
          rR2: false,
          bK: false,
          bR1: false,
          bR2: false,
          yK: false,
          yR1: false,
          yR2: false,
          gK: false,
          gR1: false,
          gR2: false,
        },
        enPassantTargets: [],
        gameOverState: {
          isGameOver: false,
          status: null,
          eliminatedPlayer: null,
        },
        history: [],
        historyIndex: 0,
        players: [],
        isHost: true,
        canStartGame: false,
      };

      const hostPlayer: Player = {
        id: hostId,
        name: hostName,
        color: "r", // Red starts first in 4-player chess
        isHost: true,
        isOnline: true,
      };

      const gameData: RealtimeGame = {
        id: gameId,
        hostId: hostId,
        hostName,
        players: { [hostId]: hostPlayer },
        gameState: initialGameState,
        status: "waiting",
        createdAt: Date.now(),
        maxPlayers: 4,
        currentPlayerTurn: "r",
        winner: null,
        lastMove: null,
      };

      await gameRef.set(gameData);
      console.log("Authoritative game created successfully:", gameId);
      return gameId;
    } catch (error) {
      console.error("Error creating authoritative game:", error);
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

        // Debug: Log player data to see what's missing
        console.log(
          "Raw player data from Firebase:",
          JSON.stringify(gameData.players, null, 2)
        );

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
        console.log(
          "Processed player data:",
          JSON.stringify(gameData.players, null, 2)
        );

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

    return gamesRef.on("value", (snapshot) => {
      const games: RealtimeGame[] = [];
      if (snapshot && snapshot.exists()) {
        snapshot.forEach((childSnapshot) => {
          const gameData = {
            id: childSnapshot.key!,
            ...childSnapshot.val(),
          } as RealtimeGame;
          games.push(gameData);
        });
      }
      onUpdate(games);
    });
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

  // CRITICAL: This function is DANGEROUS and causes race conditions
  // Clients should NEVER update the authoritative game state
  // Only server-side functions (Firebase Cloud Functions) should update game state
  async updateGameState(gameId: string, gameState: GameState): Promise<void> {
    console.error(
      "CRITICAL ERROR: Clients should never update game state directly!"
    );
    console.error("This causes race conditions and desynchronization!");
    console.error(
      "Game state updates must be handled by server-side functions only."
    );
    throw new Error(
      "Client-side game state updates are not allowed. Use server-side functions instead."
    );
  }

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

  // Cleanup
  // Clean up abandoned games (games with no active players for 30 minutes)
  async cleanupAbandonedGames(): Promise<void> {
    try {
      console.log("Cleaning up abandoned games...");
      const gamesRef = database().ref("games");
      const snapshot = await gamesRef.once("value");

      if (!snapshot.exists()) return;

      const now = Date.now();
      const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds

      const cleanupPromises: Promise<void>[] = [];

      snapshot.forEach((gameSnapshot) => {
        const gameData = gameSnapshot.val() as RealtimeGame;
        const lastActivity = gameData.lastActivity || gameData.createdAt;

        // If game has been inactive for 30 minutes, clean it up
        if (now - lastActivity > thirtyMinutes) {
          console.log("Cleaning up abandoned game:", gameSnapshot.key);
          const gameRef = database().ref(`games/${gameSnapshot.key}`);
          const movesRef = database().ref(`moves/${gameSnapshot.key}`);

          cleanupPromises.push(gameRef.remove(), movesRef.remove());
        }
      });

      await Promise.all(cleanupPromises);
      console.log("Abandoned games cleanup completed");
    } catch (error) {
      console.error("Error cleaning up abandoned games:", error);
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
