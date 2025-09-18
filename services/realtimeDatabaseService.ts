import database from "@react-native-firebase/database";
import auth from "@react-native-firebase/auth";
import { GameState, Player } from "../state/types";

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
  } | null;
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
      throw error;
    }
  }

  async signOut(): Promise<void> {
    try {
      await auth().signOut();
      this.currentUser = null;
      console.log("Successfully signed out");
    } catch (error) {
      console.error("Error signing out:", error);
      throw error;
    }
  }

  getCurrentUser() {
    return this.currentUser || auth().currentUser;
  }

  // Game management methods
  async createGame(hostName: string, gameState: GameState): Promise<string> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log(
        "Creating game with gameState:",
        JSON.stringify(gameState, null, 2)
      );
      console.log("GameState keys:", Object.keys(gameState));

      const gameRef = database().ref("games").push();
      const gameId = gameRef.key!;

      const hostPlayer: Player = {
        id: user.uid,
        name: hostName,
        color: "r", // Red starts first in 4-player chess
        isHost: true,
        isOnline: true,
      };

      // Create a simplified game state for testing
      const simplifiedGameState = {
        boardState: gameState.boardState,
        currentPlayerTurn: gameState.currentPlayerTurn,
        gameStatus: gameState.gameStatus,
        selectedPiece: gameState.selectedPiece,
        validMoves: gameState.validMoves,
        capturedPieces: gameState.capturedPieces,
        checkStatus: gameState.checkStatus,
        winner: gameState.winner,
        eliminatedPlayers: gameState.eliminatedPlayers,
        justEliminated: gameState.justEliminated,
        scores: gameState.scores,
        promotionState: gameState.promotionState,
        hasMoved: gameState.hasMoved,
        enPassantTargets: gameState.enPassantTargets,
        gameOverState: gameState.gameOverState,
        history: gameState.history,
        historyIndex: gameState.historyIndex,
        // Multiplayer state
        players: [],
        isHost: true,
        canStartGame: false,
      };

      const gameData: RealtimeGame = {
        id: gameId,
        hostId: user.uid,
        hostName,
        players: { [user.uid]: hostPlayer },
        gameState: simplifiedGameState,
        status: "waiting",
        createdAt: Date.now(),
        maxPlayers: 4,
        currentPlayerTurn: gameState.currentPlayerTurn,
        winner: null,
        lastMove: null,
      };

      await gameRef.set(gameData);
      console.log("Game created successfully:", gameId);
      console.log("Game data stored:", JSON.stringify(gameData, null, 2));
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
        await gameRef.remove();
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

    this.gameUnsubscribe = gameRef.on("value", (snapshot) => {
      if (snapshot.exists()) {
        const gameData = { id: gameId, ...snapshot.val() } as RealtimeGame;
        onUpdate(gameData);
      } else {
        onUpdate(null);
      }
    });

    return () => {
      if (this.gameUnsubscribe) {
        gameRef.off("value", this.gameUnsubscribe);
        this.gameUnsubscribe = null;
      }
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
      snapshot.forEach((childSnapshot) => {
        const gameData = {
          id: childSnapshot.key!,
          ...childSnapshot.val(),
        } as RealtimeGame;
        games.push(gameData);
      });
      onUpdate(games);
    });
  }

  // Move management
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

      const gameRef = database().ref(`games/${gameId}`);
      const gameSnapshot = await gameRef.once("value");

      if (!gameSnapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = gameSnapshot.val() as RealtimeGame;

      // Check if it's the player's turn
      const currentPlayer = gameData.players[user.uid];
      if (!currentPlayer) {
        throw new Error("Player not in game");
      }

      // Use the top-level currentPlayerTurn for validation
      console.log(
        "Move validation - Current turn:",
        gameData.currentPlayerTurn,
        "Player color:",
        currentPlayer.color
      );
      if (gameData.currentPlayerTurn !== currentPlayer.color) {
        throw new Error(
          `Not your turn. Current turn: ${gameData.currentPlayerTurn}, Your color: ${currentPlayer.color}`
        );
      }

      // Create move data
      const move: RealtimeMove = {
        ...moveData,
        playerId: user.uid,
        timestamp: Date.now(),
        moveNumber: (gameData.lastMove?.moveNumber || 0) + 1,
      };

      // Add move to moves collection
      const moveRef = database().ref(`moves/${gameId}`).push();
      await moveRef.set(move);

      // Update game with last move
      await gameRef.update({
        lastMove: move,
      });

      console.log("Move made successfully:", move);
    } catch (error) {
      console.error("Error making move:", error);
      throw error;
    }
  }

  async updateGameState(gameId: string, gameState: GameState): Promise<void> {
    try {
      const gameRef = database().ref(`games/${gameId}`);
      const updateData = {
        gameState,
        currentPlayerTurn: gameState.currentPlayerTurn,
        status: gameState.gameStatus === "finished" ? "finished" : "playing",
        winner: gameState.winner,
      };

      console.log("Updating game state:", JSON.stringify(updateData, null, 2));
      await gameRef.update(updateData);

      console.log("Game state updated successfully");
    } catch (error) {
      console.error("Error updating game state:", error);
      throw error;
    }
  }

  // Subscribe to moves for a specific game
  subscribeToMoves(
    gameId: string,
    onMove: (move: RealtimeMove) => void
  ): () => void {
    const movesRef = database()
      .ref(`moves/${gameId}`)
      .orderByChild("timestamp")
      .limitToLast(1);

    this.movesUnsubscribe = movesRef.on("child_added", (snapshot) => {
      const move = snapshot.val() as RealtimeMove;
      onMove(move);
    });

    return () => {
      if (this.movesUnsubscribe) {
        movesRef.off("child_added", this.movesUnsubscribe);
        this.movesUnsubscribe = null;
      }
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
