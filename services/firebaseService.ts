import auth, {
  getAuth,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
} from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { getApp } from "@react-native-firebase/app";
import { Player, GameState } from "../state/types";
import { testFirebaseConnection } from "./firebaseTest";

export interface FirebaseGame {
  id: string;
  hostId: string;
  hostName: string;
  players: Player[];
  gameState: GameState;
  status: "waiting" | "playing" | "finished";
  createdAt: any;
  maxPlayers: number;
  currentPlayerTurn: string;
  winner: string | null;
}

export interface FirebasePlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isOnline: boolean;
  lastSeen: any;
}

class FirebaseService {
  private currentUser: any = null;
  private gameUnsubscribe: (() => void) | null = null;
  private playersUnsubscribe: (() => void) | null = null;

  // Check if Firebase is properly initialized
  private async ensureFirebaseInitialized(): Promise<void> {
    try {
      const app = getApp();
      console.log("Firebase app is initialized:", app.name);

      // Test Firebase connection
      const isConnected = await testFirebaseConnection();
      if (!isConnected) {
        throw new Error("Firebase connection test failed");
      }
    } catch (error) {
      console.error("Firebase not initialized:", error);
      throw new Error("Firebase not properly initialized");
    }
  }

  // Authentication methods
  async signInAnonymously(): Promise<string> {
    try {
      console.log("Attempting anonymous sign in...");

      // For now, return a mock user ID to test the app without Firebase Auth
      // TODO: Re-enable Firebase Auth once configuration is fixed
      const mockUserId = `mock_user_${Date.now()}`;
      this.currentUser = { uid: mockUserId };
      console.log("Using mock user for testing:", mockUserId);
      return mockUserId;

      /* Firebase Auth temporarily disabled due to configuration issues
      await this.ensureFirebaseInitialized();
      console.log("Attempting anonymous sign in...");

      // Add a small delay to ensure Firebase is fully ready
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Try using the modern Firebase v9+ approach first
      try {
        const authInstance = getAuth();
        const userCredential = await firebaseSignInAnonymously(authInstance);
        this.currentUser = userCredential.user;
        console.log(
          "Successfully signed in anonymously (v9+):",
          userCredential.user.uid
        );
        return userCredential.user.uid;
      } catch (v9Error) {
        console.log("v9+ approach failed, trying legacy approach:", v9Error);
        // Fallback to legacy approach
        const userCredential = await auth().signInAnonymously();
        this.currentUser = userCredential.user;
        console.log(
          "Successfully signed in anonymously (legacy):",
          userCredential.user.uid
        );
        return userCredential.user.uid;
      }
      */
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      // For now, just clear the mock user
      this.currentUser = null;
      console.log("Mock user signed out");

      /* Firebase Auth temporarily disabled
      await this.ensureFirebaseInitialized();

      // Try using the modern Firebase v9+ approach first
      try {
        const authInstance = getAuth();
        await firebaseSignOut(authInstance);
        this.currentUser = null;
        console.log("Successfully signed out (v9+)");
      } catch (v9Error) {
        console.log("v9+ approach failed, trying legacy approach:", v9Error);
        // Fallback to legacy approach
        await auth().signOut();
        this.currentUser = null;
        console.log("Successfully signed out (legacy)");
      }
      */
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  getCurrentUser() {
    try {
      const app = getApp();
      return this.currentUser || auth().currentUser;
    } catch (error) {
      console.error(
        "Firebase not initialized when getting current user:",
        error
      );
      return null;
    }
  }

  // Game management methods
  async createGame(hostName: string, gameState: GameState): Promise<string> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = firestore().collection("games").doc();
      const gameId = gameRef.id;

      const hostPlayer: Player = {
        id: user.uid,
        name: hostName,
        color: "white", // Host always gets white
        isHost: true,
        isOnline: true,
      };

      const gameData: FirebaseGame = {
        id: gameId,
        hostId: user.uid,
        hostName,
        players: [hostPlayer],
        gameState,
        status: "waiting",
        createdAt: firestore.FieldValue.serverTimestamp(),
        maxPlayers: 4,
        currentPlayerTurn: user.uid,
        winner: null,
      };

      await gameRef.set(gameData);
      return gameId;
    } catch (error) {
      console.error("Error creating game:", error);
      throw error;
    }
  }

  async joinGame(gameId: string, playerName: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = firestore().collection("games").doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as FirebaseGame;

      if (gameData.players.length >= gameData.maxPlayers) {
        throw new Error("Game is full");
      }

      if (gameData.status !== "waiting") {
        throw new Error("Game is not available for joining");
      }

      // Check if player is already in the game
      const existingPlayer = gameData.players.find((p) => p.id === user.uid);
      if (existingPlayer) {
        return; // Player already in game
      }

      const colors = ["black", "red", "blue"];
      const usedColors = gameData.players.map((p) => p.color);
      const availableColor =
        colors.find((color) => !usedColors.includes(color)) || "black";

      const newPlayer: Player = {
        id: user.uid,
        name: playerName,
        color: availableColor,
        isHost: false,
        isOnline: true,
      };

      await gameRef.update({
        players: firestore.FieldValue.arrayUnion(newPlayer),
      });
    } catch (error) {
      console.error("Error joining game:", error);
      throw error;
    }
  }

  async leaveGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = firestore().collection("games").doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        return; // Game doesn't exist
      }

      const gameData = gameDoc.data() as FirebaseGame;
      const updatedPlayers = gameData.players.filter((p) => p.id !== user.uid);

      if (updatedPlayers.length === 0) {
        // Delete game if no players left
        await gameRef.delete();
      } else {
        // Update players list
        await gameRef.update({
          players: updatedPlayers,
        });

        // If host left, assign new host
        if (gameData.hostId === user.uid && updatedPlayers.length > 0) {
          const newHost = updatedPlayers[0];
          await gameRef.update({
            hostId: newHost.id,
            hostName: newHost.name,
            players: updatedPlayers.map((p) => ({
              ...p,
              isHost: p.id === newHost.id,
            })),
          });
        }
      }
    } catch (error) {
      console.error("Error leaving game:", error);
      throw error;
    }
  }

  async startGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = firestore().collection("games").doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as FirebaseGame;

      if (gameData.hostId !== user.uid) {
        throw new Error("Only host can start the game");
      }

      if (gameData.players.length < 2) {
        throw new Error("Need at least 2 players to start");
      }

      await gameRef.update({
        status: "playing",
      });
    } catch (error) {
      console.error("Error starting game:", error);
      throw error;
    }
  }

  // Real-time subscriptions
  subscribeToGame(
    gameId: string,
    onUpdate: (game: FirebaseGame | null) => void
  ): () => void {
    const gameRef = firestore().collection("games").doc(gameId);

    this.gameUnsubscribe = gameRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          const gameData = { id: doc.id, ...doc.data() } as FirebaseGame;
          onUpdate(gameData);
        } else {
          onUpdate(null);
        }
      },
      (error) => {
        console.error("Error listening to game updates:", error);
        onUpdate(null);
      }
    );

    return () => {
      if (this.gameUnsubscribe) {
        this.gameUnsubscribe();
        this.gameUnsubscribe = null;
      }
    };
  }

  subscribeToAvailableGames(
    onUpdate: (games: FirebaseGame[]) => void
  ): () => void {
    const gamesRef = firestore()
      .collection("games")
      .where("status", "==", "waiting")
      .orderBy("createdAt", "desc");

    return gamesRef.onSnapshot(
      (snapshot) => {
        const games = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as FirebaseGame[];
        onUpdate(games);
      },
      (error) => {
        console.error("Error listening to available games:", error);
        onUpdate([]);
      }
    );
  }

  // Game state updates
  async makeMove(gameId: string, move: any): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      const gameRef = firestore().collection("games").doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as FirebaseGame;

      if (gameData.currentPlayerTurn !== user.uid) {
        throw new Error("Not your turn");
      }

      // Add move to moves collection
      await firestore()
        .collection("moves")
        .doc(gameId)
        .collection("moves")
        .add({
          playerId: user.uid,
          move,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });

      // Update game state
      await gameRef.update({
        gameState: move.newGameState,
        currentPlayerTurn: move.nextPlayerId,
      });
    } catch (error) {
      console.error("Error making move:", error);
      throw error;
    }
  }

  // Real-time move synchronization
  async makeMoveRealTime(
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

      const gameRef = firestore().collection("games").doc(gameId);
      const gameDoc = await gameRef.get();

      if (!gameDoc.exists) {
        throw new Error("Game not found");
      }

      const gameData = gameDoc.data() as FirebaseGame;

      // Check if it's the player's turn
      const currentPlayer = gameData.players.find((p) => p.id === user.uid);
      if (!currentPlayer) {
        throw new Error("Player not in game");
      }

      if (gameData.gameState.currentPlayerTurn !== currentPlayer.color) {
        throw new Error("Not your turn");
      }

      // Add move to moves collection for history
      await firestore()
        .collection("moves")
        .doc(gameId)
        .collection("moves")
        .add({
          playerId: user.uid,
          playerColor: currentPlayer.color,
          move: moveData,
          timestamp: firestore.FieldValue.serverTimestamp(),
        });

      // The actual game state update will be handled by the client-side logic
      // and then synced back to Firebase
    } catch (error) {
      console.error("Error making move:", error);
      throw error;
    }
  }

  // Update game state in Firebase
  async updateGameState(gameId: string, gameState: GameState): Promise<void> {
    try {
      const gameRef = firestore().collection("games").doc(gameId);
      await gameRef.update({
        gameState,
        currentPlayerTurn: gameState.currentPlayerTurn,
        status: gameState.gameStatus === "finished" ? "finished" : "playing",
        winner: gameState.winner,
      });
    } catch (error) {
      console.error("Error updating game state:", error);
      throw error;
    }
  }

  // Subscribe to moves for a specific game
  subscribeToMoves(gameId: string, onMove: (move: any) => void): () => void {
    const movesRef = firestore()
      .collection("moves")
      .doc(gameId)
      .collection("moves")
      .orderBy("timestamp", "desc")
      .limit(1);

    return movesRef.onSnapshot(
      (snapshot) => {
        if (!snapshot.empty) {
          const latestMove = snapshot.docs[0].data();
          onMove(latestMove);
        }
      },
      (error) => {
        console.error("Error listening to moves:", error);
      }
    );
  }

  // Cleanup
  cleanup(): void {
    if (this.gameUnsubscribe) {
      this.gameUnsubscribe();
      this.gameUnsubscribe = null;
    }
    if (this.playersUnsubscribe) {
      this.playersUnsubscribe();
      this.playersUnsubscribe = null;
    }
  }
}

export default new FirebaseService();
