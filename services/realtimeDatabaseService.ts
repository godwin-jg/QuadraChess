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
  joinCode?: string; // 4-digit join code for easy sharing
  lastMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
    playerId: string;
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

  // Generate a 4-digit join code
  private generateJoinCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString();
  }
  
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
      
      // Check if there's a current user before signing out
      const currentUser = auth().currentUser;
      if (currentUser) {
        await auth().signOut();
      }
      this.currentUser = null;
      
      // Sign in anonymously
      const userCredential = await auth().signInAnonymously();
      this.currentUser = userCredential.user;
      
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
        this.currentUser = user;
      } else {
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
        // Use setTimeout to make it non-blocking
        setTimeout(async () => {
          try {
            await this.signInAnonymously();
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
        return false;
      }
      
      
      // Test a simple read operation with better error handling
      try {
        const testRef = database().ref("games");
        const snapshot = await testRef.limitToFirst(1).once("value");
        
        if (snapshot.exists()) {
          return true;
        } else {
          return true; // Still authenticated, just no data
        }
      } catch (dbError) {
        console.error("❌ Database access error:", dbError);
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
      joinCode: this.generateJoinCode(), // Generate 4-digit join code
      lastMove: null,
      lastActivity: Date.now(),
    };

    console.log("RealtimeDatabaseService: Creating game with data:", JSON.stringify({
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

    
    // Verify the game was created correctly
    const verifySnapshot = await gameRef.once("value");
    if (verifySnapshot.exists()) {
      const createdGame = verifySnapshot.val();
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
    } catch (error) {
      console.error("Error joining game:", error);
      throw error;
    }
  }

  async leaveGame(gameId: string, onCriticalError?: (error: string) => void): Promise<void> {
    try {
      // Ensure authentication before proceeding
      let user = this.getCurrentUser();
      if (!user) {
        await this.signInAnonymously();
        user = this.getCurrentUser();
        if (!user) throw new Error("Failed to authenticate user");
      }

      
      // Use direct database leave method
      await this.leaveGameDirectly(gameId, onCriticalError);
    } catch (error: any) {
      console.error("Error calling leave game:", error);
      
      // ✅ CRITICAL FIX: Handle max retries exceeded error
      if (error.message?.includes('max-retries') || error.message?.includes('too many retries')) {
        console.error("Critical error: Max retries exceeded for leaveGame");
        if (onCriticalError) {
          onCriticalError(error.message);
        }
        return; // Don't throw - let the caller handle gracefully
      }
      
      throw error;
    }
  }

  // Fallback method to leave game directly in database with proper error handling
  private async leaveGameDirectly(gameId: string, onCriticalError?: (error: string) => void): Promise<void> {
    // Ensure authentication before proceeding
    let user = this.getCurrentUser();
    if (!user) {
      await this.signInAnonymously();
      user = this.getCurrentUser();
      if (!user) throw new Error("Failed to authenticate user");
    }

    // ✅ CRITICAL FIX: Check if game exists before attempting to leave
    try {
      const gameSnapshot = await database().ref(`games/${gameId}`).once('value');
      if (!gameSnapshot.exists()) {
        console.log(`Game ${gameId} does not exist - player already left or game was deleted`);
        return; // Game doesn't exist, consider this success
      }
    } catch (error) {
      console.warn(`Failed to check game existence for ${gameId}:`, error);
      // Continue with leave attempt anyway
    }

    const gameRef = database().ref(`games/${gameId}`);
    
    // Add retry logic with exponential backoff and max retries
    let retryCount = 0;
    const maxRetries = 2; // Reduced from 3 to 2 for faster failure
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
            console.log(`Player ${user.uid} not found in game ${gameId} - already left or never joined`);
            return null; // Consider this success - player is not in the game
          }

          // Remove the player from the game
          delete gameData.players[user.uid];

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            return null; // This will delete the game
          }

          // Check if only bots remain - if so, delete the game
          const remainingPlayers = Object.values(gameData.players);
          const hasHumanPlayers = remainingPlayers.some((p: any) => !p.isBot);
          if (!hasHumanPlayers) {
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

          return gameData;
        });

        if (result.committed) {
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
          console.log(`Max retries exceeded for leaving game ${gameId} - game likely doesn't exist. Treating as success.`);
          return; // Treat this as success - game probably doesn't exist
        }
        
        // Check if player is already not in the game (success case)
        if (error.message?.includes('Player') && error.message?.includes('not found')) {
          return; // This is actually success - player is already out
        }
        
        if (retryCount >= maxRetries) {
          console.error(`Failed to leave game ${gameId} after ${maxRetries} attempts`);
          throw new Error(`Failed to leave game after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
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

      if (Object.keys(gameData.players).length !== 4) {
        throw new Error("Need exactly 4 players to start");
      }

      await gameRef.update({
        status: "playing",
        "gameState/gameStatus": "active",
      });

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
              isBot: player.isBot || false, // Add missing isBot property
              lastSeen: player.lastSeen || Date.now(),
            } as Player;
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

  // Make a promotion move in online game
  async makePromotion(
    gameId: string,
    promotionData: {
      position: { row: number; col: number };
      pieceType: string;
      playerColor: string;
    }
  ): Promise<void> {
    const gameRef = database().ref(`games/${gameId}`);
    const user = this.getCurrentUser();
    
    if (!user) {
      throw new Error("User not authenticated");
    }

    console.log(`🎯 OnlineGame: Processing promotion to ${promotionData.pieceType} at (${promotionData.position.row}, ${promotionData.position.col})`);

    try {
      const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`Promotion failed: Game ${gameId} not found`);
          return null;
        }

        // Validate player turn
        if (gameData.gameState.currentPlayerTurn !== promotionData.playerColor) {
          console.warn(`Promotion validation failed: player=${promotionData.playerColor}, currentTurn=${gameData.gameState.currentPlayerTurn}`);
          return gameData;
        }

        // Validate promotion position
        const { row, col } = promotionData.position;
        if (row < 0 || row >= 14 || col < 0 || col >= 14) {
          console.warn(`Invalid promotion coordinates: (${row}, ${col})`);
          return gameData;
        }

        // Apply promotion to board state
        const boardState = gameData.gameState.boardState;
        const pieceCode = boardState[row][col];
        
        // Validate that there's a pawn to promote
        if (!pieceCode || pieceCode[0] !== promotionData.playerColor || pieceCode[1] !== 'P') {
          console.warn(`Invalid promotion: piece=${pieceCode}, playerColor=${promotionData.playerColor}`);
          return gameData;
        }

        // Replace pawn with promoted piece
        boardState[row][col] = `${promotionData.playerColor}${promotionData.pieceType}`;

        // Clear promotion state
        gameData.gameState.promotionState = { isAwaiting: false, position: null, color: null };
        gameData.gameState.gameStatus = "active";

        // Update turn
        const currentTurn = gameData.gameState.currentPlayerTurn;
        const nextPlayer = this.getNextPlayer(currentTurn, gameData.gameState.eliminatedPlayers || []);
        gameData.gameState.currentPlayerTurn = nextPlayer;
        gameData.currentPlayerTurn = nextPlayer;

        // ✅ CRITICAL FIX: Detect bot moves and set correct playerId for promotions
        // Check if this is a bot move by looking at the player's bot status
        const player = gameData.players[user.uid];
        const isBotMove = player && player.isBot;
        const playerId = isBotMove ? `bot_${promotionData.playerColor}` : user.uid;
        
        // Update move history
        gameData.lastMove = {
          from: { row: -1, col: -1 }, // Special promotion move
          to: promotionData.position,
          pieceCode: `${promotionData.playerColor}${promotionData.pieceType}`,
          playerColor: promotionData.playerColor,
          playerId: playerId,
          timestamp: Date.now(),
        };
        gameData.lastActivity = Date.now();

        return gameData;
      });

      if (!result.committed) {
        console.error("Promotion transaction failed:", result);
        throw new Error(`Promotion transaction failed: Transaction not committed`);
      }

      console.log(`🎯 OnlineGame: Successfully promoted to ${promotionData.pieceType}`);

    } catch (error) {
      console.error("Failed to make promotion:", error);
      throw error;
    }
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
      const gameRef = database().ref(`games/${gameId}`);
      const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }

        // Quick player validation
        const player = gameData.players[user.uid];
        if (!player || player.color !== gameData.gameState.currentPlayerTurn) {
          console.warn(`Move validation failed: player=${player?.color}, currentTurn=${gameData.gameState.currentPlayerTurn}`);
          return gameData; // Skip move silently (no logging for speed)
        }

        // Direct move application (no board state conversion for speed)
        const boardState = gameData.gameState.boardState;
        const piece = boardState[moveData.from.row][moveData.from.col];
        
        // Validate that the piece exists and belongs to the current player
        if (!piece || piece[0] !== moveData.playerColor) {
          console.warn(`Invalid piece move: piece=${piece}, playerColor=${moveData.playerColor}`);
          return gameData;
        }
        
        // Validate move coordinates are within bounds
        if (moveData.from.row < 0 || moveData.from.row >= 14 || 
            moveData.from.col < 0 || moveData.from.col >= 14 ||
            moveData.to.row < 0 || moveData.to.row >= 14 || 
            moveData.to.col < 0 || moveData.to.col >= 14) {
          console.warn(`Invalid move coordinates: from=(${moveData.from.row},${moveData.from.col}), to=(${moveData.to.row},${moveData.to.col})`);
          return gameData;
        }
        
        // ✅ CRITICAL FIX: Check if this is a capture move
        const capturedPiece = boardState[moveData.to.row][moveData.to.col];
        if (capturedPiece && capturedPiece[1] === "K") {
          // Prevent king capture
          console.warn(`King capture prevented: trying to capture ${capturedPiece}`);
          return gameData;
        }
        
        // ✅ CRITICAL FIX: Update scores for captures
        if (capturedPiece && capturedPiece[0] !== moveData.playerColor) {
          const capturedPieceType = capturedPiece[1];
          let points = 0;
          switch (capturedPieceType) {
            case "P": // Pawn
              points = 1;
              break;
            case "N": // Knight
              points = 3;
              break;
            case "B": // Bishop
            case "R": // Rook
              points = 5;
              break;
            case "Q": // Queen
              points = 9;
              break;
            case "K": // King
              points = 20; // Special bonus for king capture
              break;
            default:
              points = 0;
          }
          
          // Update scores in game state
          if (!gameData.gameState.scores) {
            gameData.gameState.scores = { r: 0, b: 0, y: 0, g: 0 };
          }
          gameData.gameState.scores[moveData.playerColor as keyof typeof gameData.gameState.scores] += points;
          
          // Update captured pieces
          if (!gameData.gameState.capturedPieces) {
            gameData.gameState.capturedPieces = { r: [], b: [], y: [], g: [] };
          }
          const capturedColor = capturedPiece[0] as keyof typeof gameData.gameState.capturedPieces;
          if (!gameData.gameState.capturedPieces[capturedColor]) {
            gameData.gameState.capturedPieces[capturedColor] = [];
          }
          gameData.gameState.capturedPieces[capturedColor].push(capturedPiece);
          
          console.log(`🎯 OnlineGame: ${moveData.playerColor} captured ${capturedPiece} for ${points} points`);
        }
        
        // ✅ CRITICAL FIX: Check if this is a castling move
        const isCastling = (() => {
          const pieceType = piece[1];
          if (pieceType !== "K") return false;
          
          const rowDiff = Math.abs(moveData.to.row - moveData.from.row);
          const colDiff = Math.abs(moveData.to.col - moveData.from.col);
          
          return (rowDiff === 2 && colDiff === 0) || (rowDiff === 0 && colDiff === 2);
        })();
        
        console.log(`🔍 DEBUG Server makeMove: Checking castling for piece=${piece}, from=(${moveData.from.row},${moveData.from.col}), to=(${moveData.to.row},${moveData.to.col}), isCastling=${isCastling}`);
        
        if (isCastling) {
          // Handle castling - move both King and Rook
          const playerColor = piece[0];
          const kingTargetRow = moveData.to.row;
          const kingTargetCol = moveData.to.col;
          
          console.log(`🔍 DEBUG Server makeMove: CASTLING DETECTED for ${playerColor}K!`);
          
          // Determine rook positions based on castling direction
          let rookStartRow: number = 0, rookStartCol: number = 0, rookTargetRow: number = 0, rookTargetCol: number = 0;
          
          if (playerColor === "r") {
            // Red - bottom row (row 13)
            if (kingTargetCol === 9) {
              // Kingside castling (right)
              rookStartRow = 13; rookStartCol = 10; // rR2
              rookTargetRow = 13; rookTargetCol = 8;
            } else {
              // Queenside castling (left)
              rookStartRow = 13; rookStartCol = 3; // rR1
              rookTargetRow = 13; rookTargetCol = 5;
            }
          } else if (playerColor === "y") {
            // Yellow - top row (row 0)
            if (kingTargetCol === 4) {
              // Kingside castling (right)
              rookStartRow = 0; rookStartCol = 5; // yR2
              rookTargetRow = 0; rookTargetCol = 3;
            } else {
              // Queenside castling (left)
              rookStartRow = 0; rookStartCol = 10; // yR1
              rookTargetRow = 0; rookTargetCol = 8;
            }
          } else if (playerColor === "b") {
            // Blue - left column (col 0)
            if (kingTargetRow === 4) {
              // Kingside castling (up)
              rookStartRow = 5; rookStartCol = 0; // bR2
              rookTargetRow = 3; rookTargetCol = 0;
            } else {
              // Queenside castling (down)
              rookStartRow = 10; rookStartCol = 0; // bR1
              rookTargetRow = 8; rookTargetCol = 0;
            }
          } else if (playerColor === "g") {
            // Green - right column (col 13)
            if (kingTargetRow === 9) {
              // Kingside castling (up)
              rookStartRow = 8; rookStartCol = 13; // gR2
              rookTargetRow = 10; rookTargetCol = 13;
            } else {
              // Queenside castling (down)
              rookStartRow = 3; rookStartCol = 13; // gR1
              rookTargetRow = 5; rookTargetCol = 13;
            }
          }
          
          // Move the king
          boardState[moveData.from.row][moveData.from.col] = "";
          boardState[kingTargetRow][kingTargetCol] = piece;
          
          // Move the rook
          const rookPiece = boardState[rookStartRow][rookStartCol];
          boardState[rookStartRow][rookStartCol] = "";
          boardState[rookTargetRow][rookTargetCol] = rookPiece;
          
          console.log(`🔍 DEBUG Server makeMove: Moved rook from (${rookStartRow},${rookStartCol}) to (${rookTargetRow},${rookTargetCol})`);
          
          // Update hasMoved flags
          if (!gameData.gameState.hasMoved) {
            gameData.gameState.hasMoved = {
              rK: false, rR1: false, rR2: false,
              bK: false, bR1: false, bR2: false,
              yK: false, yR1: false, yR2: false,
              gK: false, gR1: false, gR2: false,
            };
          }
          
          // Mark king and rook as moved
          gameData.gameState.hasMoved[`${playerColor}K`] = true;
          if (playerColor === "r") {
            gameData.gameState.hasMoved[kingTargetCol === 9 ? "rR2" : "rR1"] = true;
          } else if (playerColor === "y") {
            gameData.gameState.hasMoved[kingTargetCol === 4 ? "yR2" : "yR1"] = true;
          } else if (playerColor === "b") {
            gameData.gameState.hasMoved[kingTargetRow === 4 ? "bR2" : "bR1"] = true;
          } else if (playerColor === "g") {
            gameData.gameState.hasMoved[kingTargetRow === 9 ? "gR2" : "gR1"] = true;
          }
          
          console.log(`🔍 DEBUG Server makeMove: Updated hasMoved flags for ${playerColor}K and rook`);
        } else {
          // Normal move - just move the piece
          boardState[moveData.from.row][moveData.from.col] = "";
          boardState[moveData.to.row][moveData.to.col] = piece;
          
          // Update hasMoved flag for king and rook
          if (!gameData.gameState.hasMoved) {
            gameData.gameState.hasMoved = {
              rK: false, rR1: false, rR2: false,
              bK: false, bR1: false, bR2: false,
              yK: false, yR1: false, yR2: false,
              gK: false, gR1: false, gR2: false,
            };
          }
          
          const pieceType = piece[1];
          const playerColor = piece[0];
          
          if (pieceType === "K") {
            gameData.gameState.hasMoved[`${playerColor}K`] = true;
          } else if (pieceType === "R") {
            // Determine which rook moved based on position
            if (playerColor === "r") {
              if (moveData.from.row === 13 && moveData.from.col === 3) gameData.gameState.hasMoved.rR1 = true;
              if (moveData.from.row === 13 && moveData.from.col === 10) gameData.gameState.hasMoved.rR2 = true;
            } else if (playerColor === "y") {
              if (moveData.from.row === 0 && moveData.from.col === 3) gameData.gameState.hasMoved.yR1 = true;
              if (moveData.from.row === 0 && moveData.from.col === 10) gameData.gameState.hasMoved.yR2 = true;
            } else if (playerColor === "b") {
              if (moveData.from.row === 3 && moveData.from.col === 0) gameData.gameState.hasMoved.bR1 = true;
              if (moveData.from.row === 10 && moveData.from.col === 0) gameData.gameState.hasMoved.bR2 = true;
            } else if (playerColor === "g") {
              if (moveData.from.row === 3 && moveData.from.col === 13) gameData.gameState.hasMoved.gR1 = true;
              if (moveData.from.row === 10 && moveData.from.col === 13) gameData.gameState.hasMoved.gR2 = true;
            }
          }
        }

        // ✅ CRITICAL FIX: Check if this is a promotion move
        const isPawn = piece?.endsWith("P");
        let isPromotion = false;
        
        console.log(`🔍 DEBUG Server makeMove: Checking promotion for piece=${piece}, to=(${moveData.to.row},${moveData.to.col})`);
        
        if (isPawn) {
          // Check if pawn reached promotion rank
          const { row, col } = moveData.to;
          const playerColor = piece[0];
          
          console.log(`🔍 DEBUG Server makeMove: Pawn ${playerColor}P at (${row},${col})`);
          
          // Promotion ranks: 
          // 1. NEW UNIVERSAL RULE: Opposing player's first rank
          //    - Yellow's first rank (row 0, cols 3-10): Red, Blue, Green pawns promote here
          //    - Red's first rank (row 13, cols 3-10): Yellow, Blue, Green pawns promote here  
          //    - Blue's first rank (col 0, rows 3-10): Red, Yellow, Green pawns promote here
          //    - Green's first rank (col 13, rows 3-10): Red, Yellow, Blue pawns promote here
          // 2. TRADITIONAL RULE: Specific promotion ranks
          //    - Red pawns promote on row 6
          //    - Yellow pawns promote on row 7
          //    - Blue pawns promote on col 7
          //    - Green pawns promote on col 6
          
          const isUniversalPromotion = (
            (playerColor === 'r' && row === 0 && col >= 3 && col <= 10) || // Red pawn reaches Yellow's back rank
            (playerColor === 'y' && row === 13 && col >= 3 && col <= 10) || // Yellow pawn reaches Red's back rank
            (playerColor === 'b' && col === 13 && row >= 3 && row <= 10) || // Blue pawn reaches Green's back rank
            (playerColor === 'g' && col === 0 && row >= 3 && row <= 10) // Green pawn reaches Blue's back rank
          );
          
          const isTraditionalPromotion = (
            (playerColor === 'r' && row === 6) || // Red pawns promote on row 6
            (playerColor === 'y' && row === 7) || // Yellow pawns promote on row 7
            (playerColor === 'b' && col === 7) || // Blue pawns promote on col 7
            (playerColor === 'g' && col === 6) // Green pawns promote on col 6
          );
          
          if (isUniversalPromotion || isTraditionalPromotion) {
            isPromotion = true;
            console.log(`🔍 DEBUG Server makeMove: PROMOTION DETECTED for ${playerColor}P at (${row},${col})!`);
            console.log(`🔍 DEBUG Server makeMove: Universal=${isUniversalPromotion}, Traditional=${isTraditionalPromotion}`);
          }
        }

        if (isPromotion) {
          // Set promotion state and pause game
          gameData.gameState.promotionState = {
            isAwaiting: true,
            position: moveData.to,
            color: moveData.playerColor,
          };
          gameData.gameState.gameStatus = "promotion";
          console.log(`🔍 DEBUG Server makeMove: Set promotion state:`, gameData.gameState.promotionState);
          console.log(`🔍 DEBUG Server makeMove: Set game status to:`, gameData.gameState.gameStatus);
          // Don't advance turn yet - wait for promotion completion
        } else {
          // ✅ CRITICAL FIX: Check for elimination after move
          const eliminationResult = this.checkForElimination(
            gameData.gameState.boardState,
            gameData.gameState.currentPlayerTurn,
            gameData.gameState.eliminatedPlayers || [],
            gameData.gameState.hasMoved || {},
            gameData.gameState.enPassantTargets || []
          );
          
          if (eliminationResult.eliminatedPlayer) {
            console.log(`🎯 OnlineGame: Player ${eliminationResult.eliminatedPlayer} eliminated by ${eliminationResult.reason}`);
            
            // Initialize eliminatedPlayers array if it doesn't exist
            if (!gameData.gameState.eliminatedPlayers) {
              gameData.gameState.eliminatedPlayers = [];
            }
            
            // Add eliminated player to the list
            if (!gameData.gameState.eliminatedPlayers.includes(eliminationResult.eliminatedPlayer)) {
              gameData.gameState.eliminatedPlayers.push(eliminationResult.eliminatedPlayer);
              gameData.gameState.justEliminated = eliminationResult.eliminatedPlayer;
            }
            
            // Award points to the player who made the move
            if (eliminationResult.reason === 'checkmate') {
              gameData.gameState.scores[moveData.playerColor as keyof typeof gameData.gameState.scores] += 50; // CHECKMATE bonus
            } else if (eliminationResult.reason === 'stalemate') {
              // Award points for stalemating opponent: +10 for each player still in game
              const remainingPlayers = ['r', 'b', 'y', 'g'].filter(
                (player) => !gameData.gameState.eliminatedPlayers.includes(player)
              );
              const stalematePoints = remainingPlayers.length * 10;
              gameData.gameState.scores[moveData.playerColor as keyof typeof gameData.gameState.scores] += stalematePoints;
            }
            
            // Check if game is over (3 players eliminated)
            if (gameData.gameState.eliminatedPlayers.length >= 3) {
              const turnOrder = ['r', 'b', 'y', 'g'];
              const winner = turnOrder.find(
                (color) => !gameData.gameState.eliminatedPlayers.includes(color)
              );
              
              if (winner) {
                gameData.gameState.winner = winner;
                gameData.gameState.gameStatus = 'finished';
                gameData.gameState.gameOverState = {
                  isGameOver: true,
                  status: 'finished',
                  eliminatedPlayer: null,
                };
              }
            } else {
              // Reset game status to active after elimination (unless game is finished)
              gameData.gameState.gameStatus = 'active';
            }
          }
          
          // Update turn in both places for consistency
          const currentTurn = gameData.gameState.currentPlayerTurn;
          const nextPlayer = this.getNextPlayer(currentTurn, gameData.gameState.eliminatedPlayers || []);
          gameData.gameState.currentPlayerTurn = nextPlayer;
          gameData.currentPlayerTurn = nextPlayer; // Also update top-level turn
        }
        
        // ✅ CRITICAL FIX: Detect bot moves and set correct playerId
        // Check if this is a bot move by looking at the player's bot status
        const isBotMove = player && player.isBot;
        const playerId = isBotMove ? `bot_${moveData.playerColor}` : user.uid;
        
        gameData.lastMove = {
          from: moveData.from,
          to: moveData.to,
          pieceCode: moveData.pieceCode,
          playerColor: moveData.playerColor,
          playerId: playerId,
          timestamp: Date.now(),
        };
        gameData.lastActivity = Date.now();
        
        // ✅ CRITICAL FIX: Update move history
        if (!gameData.gameState.history) {
          gameData.gameState.history = [];
        }
        if (!gameData.gameState.historyIndex) {
          gameData.gameState.historyIndex = 0;
        }
        
        // Create a snapshot of the current game state for history
        const historySnapshot = {
          boardState: gameData.gameState.boardState,
          currentPlayerTurn: gameData.gameState.currentPlayerTurn,
          gameStatus: gameData.gameState.gameStatus,
          scores: gameData.gameState.scores,
          capturedPieces: gameData.gameState.capturedPieces,
          eliminatedPlayers: gameData.gameState.eliminatedPlayers,
          winner: gameData.gameState.winner,
          justEliminated: gameData.gameState.justEliminated,
          checkStatus: gameData.gameState.checkStatus,
          promotionState: gameData.gameState.promotionState,
          hasMoved: gameData.gameState.hasMoved,
          enPassantTargets: gameData.gameState.enPassantTargets,
          gameOverState: gameData.gameState.gameOverState,
          lastMove: gameData.lastMove,
        };
        
        // Add to history
        gameData.gameState.history.push(historySnapshot);
        gameData.gameState.historyIndex = gameData.gameState.history.length - 1;

        return gameData;
      });

      if (!result.committed) {
        console.error("Move transaction failed:", result);
        throw new Error(`Move transaction failed: Transaction not committed`);
      }
      
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
            return null; // This will delete the game
          }

          // Check if only bots remain - if so, delete the game
          const remainingPlayers = Object.values(gameData.players);
          const hasHumanPlayers = remainingPlayers.some((p: any) => !p.isBot);
          if (!hasHumanPlayers) {
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
          if (gameData.gameState.eliminatedPlayers && gameData.gameState.eliminatedPlayers.length === 3) {
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
            while (gameData.gameState.eliminatedPlayers && gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)) {
              const activeIndex = turnOrder.indexOf(nextActivePlayer);
              const nextActiveIndex = (activeIndex + 1) % 4;
              nextActivePlayer = turnOrder[nextActiveIndex];
            }

            gameData.gameState.currentPlayerTurn = nextActivePlayer;
          }

          gameData.currentPlayerTurn = gameData.gameState.currentPlayerTurn;
          gameData.lastActivity = Date.now();

          return gameData;
        });

        if (result.committed) {
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
          return; // This is actually success - player is already out
        }
        
        if (retryCount >= maxRetries) {
          console.error(`Failed to resign game ${gameId} after ${maxRetries} attempts`);
          throw new Error(`Failed to resign game after ${maxRetries} attempts: ${error.message}`);
        }
        
        // Wait before retrying with exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
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
    
    const movesRef = database().ref(`moves/${gameId}`).orderByChild("timestamp");
    
    const listener = movesRef.on("child_added", (snapshot) => {
      const moveData = snapshot.val();
      if (moveData && !moveData.isOptimistic) {
        // Only process non-optimistic moves (server-confirmed)
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

    } catch (error) {
      console.error("Error updating player presence:", error);
      throw error;
    }
  }

  async runManualCleanup(): Promise<{ cleaned: number; resigned: number }> {
    try {
      const user = this.getCurrentUser();
      if (!user) throw new Error("User not authenticated");


      const functions = require("@react-native-firebase/functions").default;
      const manualCleanupFunction = functions().httpsCallable("manualCleanup");

      const result = await manualCleanupFunction({});

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

  private getNextPlayer(currentPlayer: string, eliminatedPlayers: string[] = []): string {
    const turnOrder = ["r", "b", "y", "g"];
    const currentIndex = turnOrder.indexOf(currentPlayer);
    let nextIndex = (currentIndex + 1) % turnOrder.length;
    let nextPlayer = turnOrder[nextIndex];

    // Skip eliminated players
    while (eliminatedPlayers.includes(nextPlayer)) {
      nextIndex = (nextIndex + 1) % turnOrder.length;
      nextPlayer = turnOrder[nextIndex];
    }

    return nextPlayer;
  }

  // ✅ CRITICAL FIX: Check for elimination after a move
  private checkForElimination(
    boardState: string[][],
    currentPlayerTurn: string,
    eliminatedPlayers: string[],
    hasMoved: any,
    enPassantTargets: any[]
  ): { eliminatedPlayer: string | null; reason: string | null } {
    try {
      // Import game logic functions
      const { hasAnyLegalMoves, isKingInCheck } = require('../functions/src/logic/gameLogic');
      
      // Check each opponent for checkmate/stalemate
      const turnOrder = ['r', 'b', 'y', 'g'];
      const otherPlayers = turnOrder.filter(
        (player) => player !== currentPlayerTurn && !eliminatedPlayers.includes(player)
      );
      
      for (const opponent of otherPlayers) {
        const opponentHasMoves = hasAnyLegalMoves(
          opponent,
          boardState,
          eliminatedPlayers,
          hasMoved,
          enPassantTargets
        );
        
        if (!opponentHasMoves) {
          // This opponent has no legal moves
          const isInCheck = isKingInCheck(
            opponent,
            boardState,
            eliminatedPlayers,
            hasMoved
          );
          
          if (isInCheck) {
            // Checkmate - eliminate the player
            return { eliminatedPlayer: opponent, reason: 'checkmate' };
          } else {
            // Stalemate - eliminate the player
            return { eliminatedPlayer: opponent, reason: 'stalemate' };
          }
        }
      }
      
      return { eliminatedPlayer: null, reason: null };
    } catch (error) {
      console.error('Error checking for elimination:', error);
      return { eliminatedPlayer: null, reason: null };
    }
  }

  // Create a rematch game with the same players and bots
  async createRematchGame(currentGameId: string): Promise<string> {
    const currentGameRef = database().ref(`games/${currentGameId}`);
    
    try {
      const snapshot = await currentGameRef.once("value");
      if (!snapshot.exists()) {
        throw new Error("Current game not found");
      }
      
      const currentGame = snapshot.val();
      const players = Object.values(currentGame.players || {});
      
      // Create new game with same host
      const newGameId = database().ref().push().key;
      if (!newGameId) throw new Error("Failed to generate game ID");
      const newGameRef = database().ref(`games/${newGameId}`);
      
      // Import initial board state
      const { initialBoardState } = require("../state/boardState");
      const flattenedBoardState = initialBoardState.map((row: any) =>
        row.map((cell: any) => (cell === null ? "" : cell))
      );
      
      // Prepare new game data
      const newGameData = {
        id: newGameId,
        hostId: currentGame.hostId,
        hostName: currentGame.hostName,
        status: "waiting",
        createdAt: Date.now(),
        players: {},
        joinCode: this.generateJoinCode(), // Generate new 4-digit join code for rematch
        gameState: {
          boardState: flattenedBoardState,
          currentPlayerTurn: "r",
          gameStatus: "waiting",
          scores: { r: 0, b: 0, y: 0, g: 0 },
          capturedPieces: { r: [], b: [], y: [], g: [] },
          eliminatedPlayers: [],
          justEliminated: null,
          winner: null,
          checkStatus: { r: false, b: false, y: false, g: false },
          promotionState: { isAwaiting: false, position: null, color: null },
          hasMoved: {
            rK: false, rR1: false, rR2: false,
            bK: false, bR1: false, bR2: false,
            yK: false, yR1: false, yR2: false,
            gK: false, gR1: false, gR2: false,
          },
          enPassantTargets: [],
          gameOverState: {
            isGameOver: false,
            status: null,
            eliminatedPlayer: null,
          },
          history: [],
          historyIndex: 0,
        }
      };
      
      // Add all players from the previous game (including bots)
      const playersToAdd: any = {};
      for (const player of players) {
        const playerData = player as any;
        playersToAdd[playerData.id] = {
          id: playerData.id,
          name: playerData.name,
          color: playerData.color,
          isHost: playerData.isHost,
          isOnline: true,
          isBot: playerData.isBot || false,
          lastSeen: Date.now(),
        };
      }
      
      newGameData.players = playersToAdd;
      
      // Create the new game
      await newGameRef.set(newGameData);
      
      console.log(`🎯 RealtimeDatabaseService: Created rematch game ${newGameId} with ${players.length} players`);
      return newGameId;
      
    } catch (error) {
      console.error('Error creating rematch game:', error);
      throw error;
    }
  }

  // Clear justEliminated flag from server
  async clearJustEliminated(gameId: string): Promise<void> {
    const gameRef = database().ref(`games/${gameId}`);
    
    try {
      await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`RealtimeDatabaseService: Game ${gameId} not found when clearing justEliminated`);
          return null;
        }
        
        // Clear the justEliminated flag
        gameData.gameState.justEliminated = null;
        
        return gameData;
      });
      
      console.log(`🎯 RealtimeDatabaseService: Cleared justEliminated flag for game ${gameId}`);
    } catch (error) {
      console.error('Error clearing justEliminated flag:', error);
      throw error;
    }
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
    } catch (error) {
      console.error("Error adding bots to game:", error);
      throw error;
    }
  }

  // Update bot configuration for a game (host only)
  async updateBotConfiguration(gameId: string, botColors: string[]): Promise<void> {
    try {
      const gameRef = database().ref(`games/${gameId}`);
      const snapshot = await gameRef.once("value");
      
      if (!snapshot.exists()) {
        throw new Error("Game not found");
      }

      const gameData = snapshot.val();
      const currentPlayers = gameData.players || {};
      
      // Remove existing bots
      const updates: any = {};
      Object.keys(currentPlayers).forEach(playerId => {
        if (currentPlayers[playerId].isBot) {
          updates[`players/${playerId}`] = null; // Remove bot
        }
      });

      // Add new bots for specified colors
      for (const botColor of botColors) {
        const botId = `bot_${botColor}_${Date.now()}`;
        updates[`players/${botId}`] = {
          id: botId,
          name: `Bot ${botColor.toUpperCase()}`,
          color: botColor,
          isHost: false,
          isOnline: true,
          isBot: true,
          lastSeen: Date.now(),
        };
      }

      await gameRef.update(updates);
      console.log(`🤖 Updated bot configuration for game ${gameId}:`, botColors);
    } catch (error) {
      console.error("Error updating bot configuration:", error);
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
      
      // Quick connection test - just check if we can access the database
      const gamesRef = database().ref("games");
      const snapshot = await gamesRef.limitToFirst(1).once("value");
      
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
        return corruptedGames.length;
      } else {
        return 0;
      }
    } catch (error) {
      console.error("Error cleaning up corrupted games:", error);
      return 0;
    }
  }

}

export default new RealtimeDatabaseService();
