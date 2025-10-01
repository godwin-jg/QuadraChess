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
  
  // OPTIMIZATION: Move batching for reduced network calls
  private moveBatch: any[] = [];
  private batchTimeout: NodeJS.Timeout | null = null;
  private readonly BATCH_DELAY = 50; // 50ms batch delay
  
  // OPTIMIZATION: Connection keep-alive
  private keepAliveInterval: NodeJS.Timeout | null = null;
  private readonly KEEP_ALIVE_INTERVAL = 30000; // 30 seconds

  // Authentication methods with lightweight auth monitoring
  async signInAnonymously(): Promise<string> {
    try {
      console.log("Signing in anonymously to Realtime Database...");
      
      // Check if there's a current user before signing out
      const currentUser = auth().currentUser;
      if (currentUser) {
        console.log("Signing out current user before signing in anonymously");
        await auth().signOut();
      }
      this.currentUser = null;
      
      // Sign in anonymously
      const userCredential = await auth().signInAnonymously();
      this.currentUser = userCredential.user;
      console.log("Successfully signed in:", userCredential.user.uid);
      
      // Set up lightweight auth state listener (minimal overhead)
      this.setupLightweightAuthListener();
      
      // OPTIMIZATION: Start keep-alive to maintain connection
      this.startKeepAlive();
      
      return userCredential.user.uid;
    } catch (error) {
      console.error("Error signing in anonymously:", error);
      // Don't fall back to mock user - throw the error so calling code can handle it
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to authenticate: ${errorMessage}`);
    }
  }

  // Lightweight auth state listener - minimal performance impact
  private setupLightweightAuthListener(): void {
    // Only set up listener once
    if (this.authListenerSetup) return;
    this.authListenerSetup = true;

    auth().onAuthStateChanged((user) => {
      if (user) {
        console.log("Auth state: User signed in", user.uid);
        this.currentUser = user;
      } else {
        console.log("Auth state: User signed out - attempting lightweight reconnection");
        this.currentUser = null;
        
        // Non-blocking reconnection attempt
        this.attemptLightweightReconnection();
      }
    });
  }

  private authListenerSetup = false;

  // Non-blocking reconnection attempt
  private async attemptLightweightReconnection(): Promise<void> {
    try {
      // Only attempt if we were in a game (avoid unnecessary reconnections)
      if (this.gameUnsubscribe) {
        console.log("Attempting lightweight reconnection...");
        // Use setTimeout to make it non-blocking
        setTimeout(async () => {
          try {
            await this.signInAnonymously();
            console.log("Lightweight reconnection successful");
          } catch (error) {
            console.warn("Lightweight reconnection failed:", error);
          }
        }, 1000); // 1 second delay to avoid immediate retry
      }
    } catch (error) {
      console.warn("Lightweight reconnection setup failed:", error);
    }
  }

  getCurrentUser() {
    return this.currentUser || auth().currentUser;
  }

  // Check authentication status
  async checkAuthStatus(): Promise<boolean> {
    try {
      const user = this.getCurrentUser();
      if (!user) {
        console.log("❌ No authenticated user found");
        return false;
      }
      
      console.log("✅ User authenticated:", user.uid);
      console.log("✅ User token:", user.accessToken ? "present" : "missing");
      
      // Test a simple read operation with better error handling
      try {
        const testRef = database().ref("games");
        const snapshot = await testRef.limitToFirst(1).once("value");
        
        if (snapshot.exists()) {
          console.log("✅ Database read access confirmed");
          return true;
        } else {
          console.log("⚠️ Database read access limited (no games found)");
          return true; // Still authenticated, just no data
        }
      } catch (dbError) {
        console.error("❌ Database access error:", dbError);
        console.log("🔧 This might be a rules issue or authentication problem");
        return false;
      }
    } catch (error) {
      console.error("❌ Authentication check failed:", error);
      return false;
    }
  }


  // Create game directly in database (Cloud Functions temporarily disabled)
  async createGame(hostName: string, botColors: string[] = []): Promise<string> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log("Creating game directly in database:", hostName, "with bots:", botColors);
      
      // Use direct database creation method
      return await this.createGameDirectly(hostName, botColors);
    } catch (error) {
      console.error("Error creating game:", error);
      throw error;
    }
  }

  // Fallback method to create game directly in database
  private async createGameDirectly(hostName: string, botColors: string[] = []): Promise<string> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    console.log("Creating game directly in database:", hostName);

    // Import initial board state
    const { initialBoardState } = require("../state/boardState");

    // Create initial game state
    const flattenedBoardState = initialBoardState.map((row: any) =>
      row.map((cell: any) => (cell === null ? "" : cell))
    );

    const newGameState = {
      boardState: flattenedBoardState,
      currentPlayerTurn: "r",
      gameStatus: "waiting",
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

    const hostPlayer = {
      id: user.uid,
      name: hostName,
      color: "r",
      isHost: true,
      isOnline: true,
      lastSeen: Date.now(),
    };

    const gameData = {
      id: "", // Will be set by Firebase
      hostId: user.uid,
      hostName: hostName,
      players: { [user.uid]: hostPlayer },
      gameState: newGameState,
      status: "waiting", // CRITICAL: This must be "waiting" for games to show in lobby
      createdAt: database.ServerValue.TIMESTAMP,
      maxPlayers: 4,
      currentPlayerTurn: "r",
      winner: null,
      lastMove: null,
      lastActivity: Date.now(),
    };

    console.log("Creating game with data:", JSON.stringify({
      ...gameData,
      gameState: "..." // Don't log the full gameState to avoid clutter
    }, null, 2));

    // Push the new game to the database
    const gameRef = await database().ref("games").push(gameData);
    const gameId = gameRef.key as string;

    // Update the game with its ID
    await gameRef.update({ id: gameId });

    // Add bots if requested
    if (botColors.length > 0) {
      await this.addBotsToGame(gameId, botColors);
    }

    console.log(`Game created directly in database: ${gameId} by ${hostName}`);
    console.log(`Game data:`, JSON.stringify(gameData, null, 2));
    
    // Verify the game was created correctly
    const verifySnapshot = await gameRef.once("value");
    if (verifySnapshot.exists()) {
      const createdGame = verifySnapshot.val();
      console.log(`✅ Game verification successful: ${gameId}, status: ${createdGame.status}`);
    } else {
      console.error(`❌ Game verification failed: ${gameId} not found after creation`);
    }
    
    return gameId;
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
      // Ensure authentication before proceeding
      let user = this.getCurrentUser();
      if (!user) {
        console.log("No authenticated user found, signing in anonymously...");
        await this.signInAnonymously();
        user = this.getCurrentUser();
        if (!user) throw new Error("Failed to authenticate user");
      }

      console.log("Leaving game directly in database:", gameId);
      
      // Use direct database leave method
      await this.leaveGameDirectly(gameId);
    } catch (error) {
      console.error("Error calling leave game:", error);
      throw error;
    }
  }

  // Fallback method to leave game directly in database with proper error handling
  private async leaveGameDirectly(gameId: string): Promise<void> {
    // Ensure authentication before proceeding
    let user = this.getCurrentUser();
    if (!user) {
      console.log("No authenticated user found in fallback, signing in anonymously...");
      await this.signInAnonymously();
      user = this.getCurrentUser();
      if (!user) throw new Error("Failed to authenticate user");
    }

    console.log("Leaving game directly in database:", gameId);

    const gameRef = database().ref(`games/${gameId}`);
    
    // Add retry logic with exponential backoff and max retries
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    
    while (retryCount < maxRetries) {
      try {
        const result = await gameRef.transaction((gameData) => {
          if (gameData === null) {
            console.warn(`Game ${gameId} not found`);
            return null;
          }

          const player = gameData.players[user.uid];
          if (!player) {
            console.warn(`Player ${user.uid} not found in game ${gameId}`);
            return gameData;
          }

          // Remove the player from the game
          delete gameData.players[user.uid];

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            console.log(`Game ${gameId} is now empty, deleting`);
            return null; // This will delete the game
          }

          // Check if only bots remain - if so, delete the game
          const remainingPlayers = Object.values(gameData.players);
          const hasHumanPlayers = remainingPlayers.some((p: any) => !p.isBot);
          if (!hasHumanPlayers) {
            console.log(`Game ${gameId} has only bots remaining, deleting`);
            return null; // This will delete the game
          }

          // If host left, assign new host
          if (gameData.hostId === user.uid) {
            const newHostId = Object.keys(gameData.players)[0];
            const newHost = gameData.players[newHostId];
            gameData.hostId = newHostId;
            gameData.hostName = newHost.name;
            gameData.players[newHostId].isHost = true;
          }

          gameData.lastActivity = Date.now();

          console.log(`Player ${user.uid} left game ${gameId}`);
          return gameData;
        });

        if (result.committed) {
          console.log(`Successfully left game ${gameId} after ${retryCount + 1} attempts`);
          return; // Success!
        } else {
          throw new Error("Transaction failed to commit");
        }
      } catch (error: any) {
        retryCount++;
        console.warn(`Leave game attempt ${retryCount} failed:`, error.message);
        
        // Check for specific Firebase errors that should not be retried
        if (error.code === 'database/max-retries' || 
            error.message?.includes('max-retries') ||
            error.message?.includes('too many retries')) {
          console.error(`Max retries exceeded for leaving game ${gameId}. Giving up.`);
          throw new Error(`Failed to leave game after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Check if player is already not in the game (success case)
        if (error.message?.includes('Player') && error.message?.includes('not found')) {
          console.log(`Player already not in game ${gameId}. Consider this a success.`);
          return; // This is actually success - player is already out
        }
        
        if (retryCount >= maxRetries) {
          console.error(`Failed to leave game ${gameId} after ${maxRetries} attempts`);
          throw new Error(`Failed to leave game after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        console.log(`Waiting ${delay}ms before retry ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
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
      // OPTIMIZATION: Removed console.log for better performance
      if (snapshot.exists()) {
        const gameData = { id: gameId, ...snapshot.val() } as RealtimeGame;
        // OPTIMIZATION: Removed console.log for better performance

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
              isBot: player.isBot || false, // Add missing isBot property
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
        // ✅ CRITICAL FIX: Replace problematic forEach with Object.entries for better reliability
        const gamesData = snapshot.val();
        if (gamesData && typeof gamesData === 'object') {
          Object.entries(gamesData).forEach(([gameId, gameData]: [string, any]) => {
            if (gameData && typeof gameData === 'object') {
              // Only include games with valid players
              const players = gameData.players || {};
              const validPlayers = Object.values(players).filter((player: any) => 
                player && player.id && player.name && player.color
              );
              
              if (validPlayers.length > 0) {
                games.push({
                  id: gameId,
                  ...gameData,
                });
              }
            }
          });
        }
      }
      onUpdate(games);
    });

    return () => {
      gamesRef.off("value", listener);
    };
  }

  // Ultra-fast move processing (optimized for real-time)
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

      // Ultra-fast database transaction (minimal validation for speed)
      // OPTIMIZATION: Removed console.log for better performance
      const gameRef = database().ref(`games/${gameId}`);
      const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }

        // Quick player validation
        const player = gameData.players[user.uid];
        // OPTIMIZATION: Removed console.log for better performance
        if (!player || player.color !== gameData.gameState.currentPlayerTurn) {
          return gameData; // Skip move silently (no logging for speed)
        }

        // Direct move application (no board state conversion for speed)
        const boardState = gameData.gameState.boardState;
        const piece = boardState[moveData.from.row][moveData.from.col];
        boardState[moveData.from.row][moveData.from.col] = "";
        boardState[moveData.to.row][moveData.to.col] = piece;

        // Update turn in both places for consistency
        const currentTurn = gameData.gameState.currentPlayerTurn;
        const nextPlayer = this.getNextPlayer(currentTurn);
        gameData.gameState.currentPlayerTurn = nextPlayer;
        gameData.currentPlayerTurn = nextPlayer; // Also update top-level turn
        
        gameData.lastMove = {
          from: moveData.from,
          to: moveData.to,
          piece: moveData.pieceCode,
          player: user.uid,
          timestamp: Date.now(),
        };
        gameData.lastActivity = Date.now();
        
        // OPTIMIZATION: Removed console.log for better performance

        return gameData;
      });

      if (!result.committed) {
        throw new Error("Move transaction failed");
      }
      
      console.log(`Move processed successfully for game ${gameId}`);
    } catch (error) {
      console.error("Error processing move:", error);
      throw error;
    }
  }

  // Resign game - uses direct database method
  async resignGame(gameId: string): Promise<void> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");

      console.log("Resigning game directly in database:", gameId);
      
      // Use direct database resignation method
      await this.resignGameDirectly(gameId);
    } catch (error) {
      console.error("Error calling resign:", error);
      throw error;
    }
  }

  // Fallback method to resign game directly in database with proper error handling
  private async resignGameDirectly(gameId: string): Promise<void> {
    const user = this.getCurrentUser();
    if (!user) throw new Error("User not authenticated");

    console.log("Resigning game directly in database:", gameId);

    const gameRef = database().ref(`games/${gameId}`);
    
    // Add retry logic with exponential backoff and max retries
    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second base delay
    
    while (retryCount < maxRetries) {
      try {
        const result = await gameRef.transaction((gameData) => {
          if (gameData === null) {
            console.warn(`Game ${gameId} not found`);
            return null;
          }

          const player = gameData.players[user.uid];
          if (!player) {
            console.warn(`Player ${user.uid} not found in game ${gameId}`);
            return gameData;
          }

          // Don't allow resigning if game is already over
          if (
            gameData.gameState.gameStatus === "finished" ||
            gameData.gameState.gameStatus === "checkmate" ||
            gameData.gameState.gameStatus === "stalemate"
          ) {
            console.warn(`Player ${user.uid} cannot resign - game is already over`);
            return gameData;
          }

          // Initialize eliminatedPlayers array if it doesn't exist
          if (!gameData.gameState.eliminatedPlayers) {
            gameData.gameState.eliminatedPlayers = [];
          }

          // Add player to eliminated players
          if (!gameData.gameState.eliminatedPlayers.includes(player.color)) {
            gameData.gameState.eliminatedPlayers.push(player.color);
            gameData.gameState.justEliminated = player.color;
          }

          // Remove the player from the game
          delete gameData.players[user.uid];

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            console.log(`Game ${gameId} is now empty after resignation, deleting`);
            return null; // This will delete the game
          }

          // Check if only bots remain - if so, delete the game
          const remainingPlayers = Object.values(gameData.players);
          const hasHumanPlayers = remainingPlayers.some((p: any) => !p.isBot);
          if (!hasHumanPlayers) {
            console.log(`Game ${gameId} has only bots remaining after resignation, deleting`);
            return null; // This will delete the game
          }

          // Update check status for all players
          gameData.gameState.checkStatus = {
            r: false,
            b: false,
            y: false,
            g: false,
          };

          // Check if the entire game is over
          if (gameData.gameState.eliminatedPlayers.length === 3) {
            const turnOrder = ["r", "b", "y", "g"];
            const winner = turnOrder.find(
              (color) => !gameData.gameState.eliminatedPlayers.includes(color)
            );

            if (winner) {
              gameData.gameState.winner = winner;
              gameData.gameState.gameStatus = "finished";
              gameData.gameState.gameOverState = {
                isGameOver: true,
                status: "finished",
                eliminatedPlayer: null,
              };
            }
          } else {
            // Advance to next active player
            const turnOrder = ["r", "b", "y", "g"];
            const currentIndex = turnOrder.indexOf(gameData.gameState.currentPlayerTurn);
            const nextIndex = (currentIndex + 1) % 4;
            const nextPlayerInSequence = turnOrder[nextIndex];

            // Find the next active player (skip eliminated players)
            let nextActivePlayer = nextPlayerInSequence;
            while (gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)) {
              const activeIndex = turnOrder.indexOf(nextActivePlayer);
              const nextActiveIndex = (activeIndex + 1) % 4;
              nextActivePlayer = turnOrder[nextActiveIndex];
            }

            gameData.gameState.currentPlayerTurn = nextActivePlayer;
          }

          gameData.currentPlayerTurn = gameData.gameState.currentPlayerTurn;
          gameData.lastActivity = Date.now();

          console.log(`Player ${user.uid} (${player.color}) resigned from game ${gameId}`);
          return gameData;
        });

        if (result.committed) {
          console.log(`Successfully resigned from game ${gameId} after ${retryCount + 1} attempts`);
          return; // Success!
        } else {
          throw new Error("Transaction failed to commit");
        }
      } catch (error: any) {
        retryCount++;
        console.warn(`Resign game attempt ${retryCount} failed:`, error.message);
        
        // Check for specific Firebase errors that should not be retried
        if (error.code === 'database/max-retries' || 
            error.message?.includes('max-retries') ||
            error.message?.includes('too many retries')) {
          console.error(`Max retries exceeded for resigning game ${gameId}. Giving up.`);
          throw new Error(`Failed to resign game after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Check if player is already not in the game (success case)
        if (error.message?.includes('Player') && error.message?.includes('not found')) {
          console.log(`Player already not in game ${gameId}. Consider this a success.`);
          return; // This is actually success - player is already out
        }
        
        if (retryCount >= maxRetries) {
          console.error(`Failed to resign game ${gameId} after ${maxRetries} attempts`);
          throw new Error(`Failed to resign game after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        console.log(`Waiting ${delay}ms before retry ${retryCount + 1}...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // CRITICAL: This function is DANGEROUS and causes race conditions
  // Clients should NEVER update the authoritative game state

  // OPTIMIZATION: Enhanced move subscription for faster updates
  subscribeToMoves(
    gameId: string,
    onMove: (move: RealtimeMove) => void
  ): () => void {
    console.log("Subscribing to moves for faster updates:", gameId);
    
    const movesRef = database().ref(`moves/${gameId}`).orderByChild("timestamp");
    
    const listener = movesRef.on("child_added", (snapshot) => {
      const moveData = snapshot.val();
      if (moveData && !moveData.isOptimistic) {
        // Only process non-optimistic moves (server-confirmed)
        console.log("Received confirmed move:", moveData);
        onMove({
          from: moveData.from,
          to: moveData.to,
          pieceCode: moveData.pieceCode,
          playerColor: moveData.playerColor,
          playerId: moveData.playerId,
          timestamp: moveData.timestamp,
          moveNumber: moveData.moveNumber,
        });
      }
    });

    return () => {
      movesRef.off("child_added", listener);
      console.log("Move subscription cleaned up");
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

  // OPTIMIZATION: Instant move processing for lowest latency
  private addToMoveBatch(gameId: string, moveRequest: any): void {
    // Process move immediately for instant feedback
    this.processMoveImmediately(gameId, moveRequest);
  }

  private async processMoveImmediately(gameId: string, moveRequest: any): Promise<void> {
    try {
      // Send move directly without batching for instant response
      const moveRequestRef = database().ref(`move-requests/${gameId}`).push();
      await moveRequestRef.set(moveRequest);
      console.log("Move sent immediately for instant response:", moveRequest);
    } catch (error) {
      console.error("Error sending immediate move:", error);
      throw error;
    }
  }

  private async processMoveBatch(): Promise<void> {
    if (this.moveBatch.length === 0) return;
    
    const batch = [...this.moveBatch];
    this.moveBatch = [];
    this.batchTimeout = null;
    
    try {
      // Group moves by gameId
      const movesByGame = new Map<string, any[]>();
      batch.forEach(({ gameId, moveRequest }) => {
        if (!movesByGame.has(gameId)) {
          movesByGame.set(gameId, []);
        }
        movesByGame.get(gameId)!.push(moveRequest);
      });
      
      // Process each game's moves
      for (const [gameId, moves] of movesByGame) {
        if (moves.length === 1) {
          // Single move - send directly
          const moveRequestRef = database().ref(`move-requests/${gameId}`).push();
          await moveRequestRef.set(moves[0]);
        } else {
          // Multiple moves - batch them
          const batchRef = database().ref(`move-batches/${gameId}`).push();
          await batchRef.set({
            moves: moves,
            timestamp: Date.now(),
            batchSize: moves.length
          });
        }
      }
      
      console.log(`Processed move batch: ${batch.length} moves across ${movesByGame.size} games`);
    } catch (error) {
      console.error("Error processing move batch:", error);
      // Fallback: send moves individually
      for (const { gameId, moveRequest } of batch) {
        try {
          const moveRequestRef = database().ref(`move-requests/${gameId}`).push();
          await moveRequestRef.set(moveRequest);
        } catch (fallbackError) {
          console.error("Error sending individual move:", fallbackError);
        }
      }
    }
  }

  // OPTIMIZATION: Connection keep-alive methods
  private startKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
    }
    
    this.keepAliveInterval = setInterval(async () => {
      try {
        // Perform a lightweight operation to keep connection alive
        const testRef = database().ref(".info/connected");
        await testRef.once("value");
        console.log("Keep-alive: Connection maintained");
      } catch (error) {
        console.warn("Keep-alive: Connection check failed:", error);
      }
    }, this.KEEP_ALIVE_INTERVAL);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveInterval) {
      clearInterval(this.keepAliveInterval);
      this.keepAliveInterval = null;
    }
  }

  // Helper functions for direct move processing
  private convertBoardState(boardState: any, toFlattened: boolean): any {
    if (toFlattened) {
      // Convert 2D array to flattened format for Firebase
      return boardState.map((row: any) =>
        row.map((cell: any) => cell === null ? "" : cell)
      );
    } else {
      // Convert flattened format back to 2D array
      return boardState.map((row: any) =>
        row.map((cell: any) => cell === "" ? null : cell)
      );
    }
  }

  private getNextPlayer(currentPlayer: string): string {
    const turnOrder = ["r", "b", "y", "g"];
    const currentIndex = turnOrder.indexOf(currentPlayer);
    const nextPlayer = turnOrder[(currentIndex + 1) % turnOrder.length];
    console.log(`getNextPlayer: ${currentPlayer} (index ${currentIndex}) -> ${nextPlayer} (index ${turnOrder.indexOf(nextPlayer)})`);
    return nextPlayer;
  }

  // Add bots to a game with specific colors
  private async addBotsToGame(gameId: string, botColors: string[]): Promise<void> {
    try {
      const gameRef = database().ref(`games/${gameId}`);
      const snapshot = await gameRef.once("value");
      
      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      const usedColors = Object.values(gameData.players).map((p: any) => p.color);
      
      // Filter out colors that are already taken
      const availableBotColors = botColors.filter(color => !usedColors.includes(color));
      
      if (availableBotColors.length === 0) {
        console.log(`No available colors for bots in game ${gameId}`);
        return;
      }

      const botUpdates: any = {};

      for (const botColor of availableBotColors) {
        const botId = `bot_${botColor}_${Date.now()}`;
        
        botUpdates[`players/${botId}`] = {
          id: botId,
          name: `Bot ${botColor.toUpperCase()}`,
          color: botColor,
          isHost: false,
          isOnline: true,
          isBot: true,
          lastSeen: Date.now(),
        };
      }

      await gameRef.update(botUpdates);
      console.log(`Added ${availableBotColors.length} bots to game ${gameId}:`, availableBotColors);
    } catch (error) {
      console.error("Error adding bots to game:", error);
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
    
    // OPTIMIZATION: Process any remaining moves in batch
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout);
      this.processMoveBatch();
    }
    
    // OPTIMIZATION: Stop keep-alive
    this.stopKeepAlive();
  }

  // Test Firebase connection (optimized)
  async testConnection(): Promise<boolean> {
    try {
      console.log("Testing Firebase connection...");
      
      // Quick connection test - just check if we can access the database
      const gamesRef = database().ref("games");
      const snapshot = await gamesRef.limitToFirst(1).once("value");
      
      console.log("✅ Firebase connection successful!");
      return true;
    } catch (error) {
      console.error("❌ Firebase connection failed:", error);
      return false;
    }
  }

  // Enhanced cleanup for corrupted games with comprehensive detection
  async cleanupCorruptedGames(): Promise<number> {
    try {
      const gamesRef = database().ref("games");
      const snapshot = await gamesRef.once("value");
      
      if (!snapshot.exists()) {
        return 0;
      }

      const games = snapshot.val();
      const corruptedGames: string[] = [];
      
      // Track games by host to detect duplicates
      const gamesByHost = new Map<string, string[]>();
      
      // First pass: collect all games and group by host
      Object.entries(games).forEach(([gameId, gameData]: [string, any]) => {
        if (gameData.hostId) {
          if (!gamesByHost.has(gameData.hostId)) {
            gamesByHost.set(gameData.hostId, []);
          }
          gamesByHost.get(gameData.hostId)!.push(gameId);
        }
      });
      
      // Second pass: analyze and identify corrupted games
      Object.entries(games).forEach(([gameId, gameData]: [string, any]) => {
        // Clean up games with missing required fields
        if (!gameData.status || 
            !gameData.hostName || 
            !gameData.createdAt ||
            !gameData.gameState) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with no players or invalid player data
        if (!gameData.players || Object.keys(gameData.players).length === 0) {
          corruptedGames.push(gameId);
          return;
        }

        // Check for games with invalid player data
        const players = gameData.players || {};
        const validPlayers = Object.values(players).filter((player: any) => 
          player && player.id && player.name && player.color
        );
        
        // If no valid players, mark as corrupted
        if (validPlayers.length === 0) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with invalid game state structure
        if (!gameData.gameState.boardState || 
            !Array.isArray(gameData.gameState.boardState) ||
            !gameData.gameState.currentPlayerTurn ||
            !gameData.gameState.gameStatus) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games where host is not in players list
        if (gameData.hostId && !gameData.players[gameData.hostId]) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with duplicate host (keep only the most recent)
        if (gameData.hostId && gamesByHost.has(gameData.hostId)) {
          const hostGames = gamesByHost.get(gameData.hostId)!;
          if (hostGames.length > 1) {
            // Sort by creation time, keep the most recent
            const sortedGames = hostGames.sort((a, b) => {
              const gameA = games[a];
              const gameB = games[b];
              return (gameB.createdAt || 0) - (gameA.createdAt || 0);
            });
            
            // Delete all but the most recent game
            const gamesToDelete = sortedGames.slice(1);
            if (gamesToDelete.includes(gameId)) {
              corruptedGames.push(gameId);
              return;
            }
          }
        }

        // Clean up games with invalid player colors (not r, b, y, g)
        const validColors = ['r', 'b', 'y', 'g'];
        const invalidColorPlayers = validPlayers.filter((player: any) => 
          !validColors.includes(player.color)
        );
        if (invalidColorPlayers.length > 0) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with duplicate player colors
        const playerColors = validPlayers.map((player: any) => player.color);
        const uniqueColors = [...new Set(playerColors)];
        if (playerColors.length !== uniqueColors.length) {
          corruptedGames.push(gameId);
          return;
        }

        // Clean up games with only 1 player for more than 7 minutes
        if (gameData.status === "waiting" && validPlayers.length === 1 && gameData.lastActivity) {
          const sevenMinutesAgo = Date.now() - 7 * 60 * 1000; // 7 minutes ago
          if (gameData.lastActivity < sevenMinutesAgo) {
            corruptedGames.push(gameId);
            return;
          }
        }
      });

      if (corruptedGames.length > 0) {
        // Delete corrupted games
        const updates: { [key: string]: null } = {};
        corruptedGames.forEach(gameId => {
          updates[gameId] = null;
        });
        
        await gamesRef.update(updates);
        console.log(`Client cleanup: Removed ${corruptedGames.length} corrupted games`);
        return corruptedGames.length;
      } else {
        console.log("Client cleanup: No corrupted games found");
        return 0;
      }
    } catch (error) {
      console.error("Error cleaning up corrupted games:", error);
      return 0;
    }
  }

}

export default new RealtimeDatabaseService();
