import realtimeDatabaseService, {
  RealtimeGame,
  RealtimeMove,
} from "./realtimeDatabaseService";
import { GameState } from "../state/types";
import { Player } from "../app/services/networkService";
import database from "@react-native-firebase/database";
import {
  makeMove as makeMoveAction,
  setGameState,
  createStateSnapshot,
  setBotPlayers,
} from "../state/gameSlice";
import { store } from "../state/store";
import {
  getValidMoves,
  isKingInCheck,
  hasAnyLegalMoves,
} from "../functions/src/logic/gameLogic";
import { initialBoardState } from "../state/boardState";

export interface OnlineGameService {
  currentGameId: string | null;
  currentPlayer: Player | null;
  isConnected: boolean;
  connectToGame: (gameId: string) => Promise<void>;
  disconnect: () => void;
  makeMove: (moveData: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
  }) => Promise<void>;
  resignGame: () => Promise<void>;
  onGameUpdate: (callback: (game: RealtimeGame | null) => void) => () => void;
  onMoveUpdate: (callback: (move: RealtimeMove) => void) => () => void;
  updatePlayerPresence: (isOnline: boolean) => Promise<void>;
}

class OnlineGameServiceImpl implements OnlineGameService {
  public currentGameId: string | null = null;
  public currentPlayer: Player | null = null;
  public isConnected: boolean = false;

  private gameUnsubscribe: (() => void) | null = null;
  private movesUnsubscribe: (() => void) | null = null;
  private gameUpdateCallbacks: ((game: RealtimeGame | null) => void)[] = [];
  private moveUpdateCallbacks: ((move: RealtimeMove) => void)[] = [];

  // OPTIMIZATION: Move prediction and rollback system
  private moveHistory: any[] = [];
  private maxHistorySize = 10;

  // OPTIMIZATION: Connection quality detection
  private connectionQuality: 'excellent' | 'good' | 'poor' = 'good';
  private latencyHistory: number[] = [];
  private maxLatencySamples = 10;

  // OPTIMIZATION: Cache board state processing to avoid repeated work
  private lastBoardStateHash: string | null = null;
  private cachedProcessedBoardState: (string | null)[][] | null = null;

  async connectToGame(gameId: string): Promise<void> {
    try {
      // Sign in anonymously if not already signed in
      const user = realtimeDatabaseService.getCurrentUser();
      if (!user) {
        await realtimeDatabaseService.signInAnonymously();
      }

      this.currentGameId = gameId;
      this.isConnected = true; // Mark as connected immediately when connection is established
      // OPTIMIZATION: Removed console.log for better performance

      // Subscribe to game updates
      this.gameUnsubscribe = realtimeDatabaseService.subscribeToGame(
        gameId,
        (game) => {
          if (game) {
            // Keep connected status true when we receive game data
            this.isConnected = true;
            // OPTIMIZATION: Removed console.log for better performance
          } else {
            // Only mark as disconnected if we're sure the game doesn't exist
            // Don't immediately disconnect on temporary null values
            // OPTIMIZATION: Removed console.log for better performance
            // Keep isConnected true for now, let the resign method handle the actual connection check
          }
          this.handleGameUpdate(game);
        }
      );

      // CRITICAL: Do NOT subscribe to individual moves - causes desynchronization
      // Only subscribe to complete game state updates
      console.log("Move subscriptions disabled to prevent desynchronization");
      console.log(
        "Only game state updates are used for reliable synchronization"
      );

      // Set up player presence tracking
      await this.updatePlayerPresence(true);
      this.setupPresenceTracking();
    } catch (error) {
      console.error("Error connecting to enhanced online game:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    console.log("OnlineGameService: disconnect() called - currentGameId:", this.currentGameId);
    try {
      // Clear optimized presence updates first
      this.clearOptimizedPresenceUpdates();

      if (this.currentGameId) {
        try {
          await this.updatePlayerPresence(false);
          await realtimeDatabaseService.leaveGame(this.currentGameId);
          console.log("OnlineGameService: Successfully left game and updated presence");
        } catch (error: any) {
          console.warn("OnlineGameService: Error during server disconnect, continuing with local cleanup:", error.message);
          
          // Don't throw error - continue with local cleanup even if server operations fail
          // This prevents the app from getting stuck when there are connection issues
        }
      }

      // Always clean up subscriptions regardless of server errors
      if (this.gameUnsubscribe) {
        this.gameUnsubscribe();
        this.gameUnsubscribe = null;
      }

      if (this.movesUnsubscribe) {
        this.movesUnsubscribe();
        this.movesUnsubscribe = null;
      }

      // Clear all intervals and timeouts
      this.clearOptimizedPresenceUpdates();

      this.currentGameId = null;
      this.currentPlayer = null;
      this.isConnected = false;
      this.gameUpdateCallbacks = [];
      this.moveUpdateCallbacks = [];
      
      console.log("OnlineGameService: Disconnect completed successfully");
    } catch (error) {
      console.error("Error disconnecting from enhanced online game:", error);
      
      // Force cleanup even if there's an error
      this.clearOptimizedPresenceUpdates();
      this.currentGameId = null;
      this.currentPlayer = null;
      this.isConnected = false;
      this.gameUpdateCallbacks = [];
      this.moveUpdateCallbacks = [];
      
      // Don't re-throw the error to prevent the app from getting stuck
      console.log("OnlineGameService: Forced cleanup completed despite error");
    }
  }

  async makeMove(moveData: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
  }): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }

    try {
      // Basic client-side validation for UX (not authoritative)
      const state = store.getState();
      const currentGameState = state.game;

      // ✅ CRITICAL: Add turn validation for better UX
      if (currentGameState.currentPlayerTurn !== moveData.playerColor) {
        throw new Error("Not your turn");
      }

      // OPTIMIZATION: Skip client validation - server validation is authoritative
      // This eliminates redundant getValidMoves() call and improves performance

      // OPTIMIZATION: Apply move locally first for instant feedback
      // Server validation is minimal (just turn check + move application)
      // We can do this locally and sync to server
      
      // Basic validation to prevent obviously invalid moves
      const piece = currentGameState.boardState[moveData.from.row][moveData.from.col];
      if (!piece || piece[0] !== moveData.playerColor) {
        throw new Error("Invalid piece selection");
      }
      
      // Check if destination is within bounds
      if (moveData.to.row < 0 || moveData.to.row >= 14 || 
          moveData.to.col < 0 || moveData.to.col >= 14) {
        throw new Error("Move out of bounds");
      }
      
      // Save current state for potential rollback
      const currentState = store.getState().game;
      const stateSnapshot = JSON.parse(JSON.stringify(currentState));
      
      // Apply move locally immediately
      store.dispatch(makeMoveAction({
        from: moveData.from,
        to: moveData.to
      }));

      // Send move to server for synchronization with rollback capability
      try {
        await realtimeDatabaseService.makeMove(this.currentGameId, moveData);
        // Move successful - no rollback needed
      } catch (error) {
        // Server rejected the move - rollback local state
        console.error("Server rejected move, rolling back local state:", error);
        store.dispatch(setGameState(stateSnapshot));
        
        // Re-throw error so UI can show appropriate message
        throw error;
      }

      // OPTIMIZATION: Removed console.log for better performance
    } catch (error) {
      // OPTIMIZATION: Simplified error handling - no rollback needed
      throw error;
    }
  }

  async resignGame(): Promise<void> {
    // If currentGameId is null, try to get it from the Redux store
    if (!this.currentGameId) {
      console.warn("OnlineGameService: currentGameId is null, attempting to get from store");
      const state = store.getState();
      const gameId = state.game.gameId;
      if (gameId) {
        console.log("OnlineGameService: Found gameId in store:", gameId);
        this.currentGameId = gameId;
      } else {
        throw new Error("No game ID available in service or store");
      }
    }

    // Store current player info before calling Cloud Function
    // (Cloud Function removes player from game.players, so we need to store it first)
    const currentPlayerInfo = this.currentPlayer;
    if (!currentPlayerInfo) {
      console.warn("OnlineGameService: No current player found, but proceeding with resign anyway");
      // Don't throw error - let the Cloud Function handle the validation
    }

    console.log("OnlineGameService: Attempting resign with gameId:", this.currentGameId, "player:", currentPlayerInfo);

    // Add retry logic for network failures
    let retryCount = 0;
    const maxRetries = 2; // Reduced from 3 to 2 for faster failure
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Call the Cloud Function to resign
        console.log("OnlineGameService: Calling Cloud Function with player:", currentPlayerInfo);
        await realtimeDatabaseService.resignGame(this.currentGameId);

        // If we get here, the resign was sent successfully
        return;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        console.warn(`Resign attempt ${retryCount} failed:`, error);

        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );
        }
      }
    }

    // If we get here, all retries failed
    console.error(`Failed to resign after ${maxRetries} attempts:`, lastError);
    throw lastError || new Error("Failed to resign after multiple attempts");
  }

  onGameUpdate(callback: (game: RealtimeGame | null) => void): () => void {
    this.gameUpdateCallbacks.push(callback);

    return () => {
      const index = this.gameUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.gameUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onMoveUpdate(callback: (move: RealtimeMove) => void): () => void {
    this.moveUpdateCallbacks.push(callback);

    return () => {
      const index = this.moveUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.moveUpdateCallbacks.splice(index, 1);
      }
    };
  }

  async updatePlayerPresence(isOnline: boolean): Promise<void> {
    if (this.currentGameId) {
      await realtimeDatabaseService.updatePlayerPresence(
        this.currentGameId,
        isOnline
      );
    }
  }

  private handleGameUpdate(game: RealtimeGame | null): void {
    console.log("OnlineGameService: handleGameUpdate called with game:", game ? "present" : "null");
    if (game) {
      console.log("OnlineGameService: Game update received - eliminatedPlayers:", game.gameState?.eliminatedPlayers);
      console.log("OnlineGameService: Game update received - currentPlayerTurn:", game.gameState?.currentPlayerTurn);
      
      // Check if game data is complete
      if (!game.gameState) {
        console.warn(
          "OnlineGameService: Game data incomplete, waiting for full data..."
        );
        // Use fallback state with basic game info
        const fallbackState = {
          boardState: initialBoardState.map((row) => [...row]),
          currentPlayerTurn: "r",
          gameStatus: "active" as const,
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
          viewingHistoryIndex: null,
          players: [],
          isHost: true,
          canStartGame: false,
        };
        store.dispatch(setGameState(fallbackState));
        return;
      }

      // Update current player info
      const user = realtimeDatabaseService.getCurrentUser();
      if (user) {
        this.currentPlayer = game.players[user.uid] || null;
      }

      // Ensure game state is properly initialized
      if (
        game.gameState &&
        game.gameState.boardState &&
        Array.isArray(game.gameState.boardState) &&
        game.gameState.boardState.length > 0
      ) {
        // Convert players object to array for Redux state
        const playersArray = Object.values(game.players || {});

        // Determine if current user is host
        const user = realtimeDatabaseService.getCurrentUser();
        const isHost = user ? game.hostId === user.uid : false;

        // Determine if game can start (at least 2 players and waiting status)
        const canStartGame =
          playersArray.length >= 2 && game.status === "waiting";

        // Extract bot players for online games
        const botPlayers = playersArray
          .filter((player: any) => player.isBot === true)
          .map((player: any) => player.color);
        
        console.log(`OnlineGameService: Detected bot players:`, botPlayers);

        // Update bot players in Redux store
        console.log(`OnlineGameService: Dispatching setBotPlayers with:`, botPlayers);
        store.dispatch(setBotPlayers(botPlayers));
        console.log(`OnlineGameService: Redux store botPlayers after dispatch:`, store.getState().game.botPlayers);

        // Ensure board state is properly copied
        const gameState = {
          ...game.gameState,
          currentPlayerTurn:
            game.gameState.currentPlayerTurn || game.currentPlayerTurn || "r",
          gameStatus: (game.gameState.gameStatus || game.status || "active") as
            | "waiting"
            | "active"
            | "checkmate"
            | "stalemate"
            | "finished"
            | "promotion",
          justEliminated: game.gameState.justEliminated || null,
          winner: game.gameState.winner || null,
          boardState: this.processBoardStateOptimized(game.gameState.boardState),
          // Multiplayer state
          players: playersArray,
          isHost: isHost,
          canStartGame: canStartGame,
          // Use server-stored history for synchronization
          history: game.gameState.history || [],
          historyIndex: game.gameState.historyIndex || 0,
          // CRITICAL: Always set viewingHistoryIndex to null when syncing from server
          // This ensures we're viewing the live game state, not historical moves
          viewingHistoryIndex: null,
        };

        // OPTIMIZATION: Use selective updates instead of full state replacement
        // Only update if the game state has actually changed
        const currentState = store.getState().game;
        const hasSignificantChanges = 
          JSON.stringify(currentState.boardState) !== JSON.stringify(gameState.boardState) ||
          currentState.currentPlayerTurn !== gameState.currentPlayerTurn ||
          currentState.gameStatus !== gameState.gameStatus ||
          currentState.eliminatedPlayers?.length !== gameState.eliminatedPlayers?.length;
        
        console.log(`Turn check: current=${currentState.currentPlayerTurn}, new=${gameState.currentPlayerTurn}, changed=${currentState.currentPlayerTurn !== gameState.currentPlayerTurn}`);

        if (hasSignificantChanges) {
          console.log("OnlineGameService: Dispatching setGameState with eliminatedPlayers:", gameState.eliminatedPlayers);
          console.log("OnlineGameService: Current turn:", gameState.currentPlayerTurn);
          store.dispatch(setGameState(gameState));
        } else {
          console.log("OnlineGameService: Skipping state update - no significant changes detected");
        }
      } else {
        console.warn("Game state is missing boardState, using fallback");

        // Convert players object to array for Redux state
        const playersArray = Object.values(game.players || {});

        // Determine if current user is host
        const user = realtimeDatabaseService.getCurrentUser();
        const isHost = user ? game.hostId === user.uid : false;

        // Determine if game can start (at least 2 players and waiting status)
        const canStartGame =
          playersArray.length >= 2 && game.status === "waiting";

        // Fallback to a complete game state with proper initialization
        const fallbackState = {
          boardState: initialBoardState.map((row) => [...row]),
          currentPlayerTurn: game.currentPlayerTurn || "r",
          gameStatus: (game.status || "active") as
            | "waiting"
            | "active"
            | "checkmate"
            | "stalemate"
            | "finished"
            | "promotion",
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
          // History state
          history: game.gameState?.history || [],
          historyIndex: game.gameState?.historyIndex || 0,
          viewingHistoryIndex: null,
          // Multiplayer state
          players: playersArray,
          isHost: isHost,
          canStartGame: canStartGame,
        };

        // Apply the fallback state
        store.dispatch(setGameState(fallbackState));
      }

      // Notify callbacks
      this.gameUpdateCallbacks.forEach((callback) => callback(game));
    } else {
      // Game not found or deleted
      this.gameUpdateCallbacks.forEach((callback) => callback(null));
    }
  }

  private handleMoveUpdate(move: RealtimeMove): void {
    // CRITICAL: Do NOT apply individual moves to local state
    // This causes desynchronization if any game state update is missed
    // The only source of truth is the complete game state from handleGameUpdate

    // Notify callbacks (for UI feedback, not state changes)
    this.moveUpdateCallbacks.forEach((callback) => callback(move));
  }

  private setupPresenceTracking(): void {
    // Use Firebase onDisconnect for automatic presence management
    // This is more reliable and efficient than polling
    const user = realtimeDatabaseService.getCurrentUser();
    if (!user || !this.currentGameId) return;

    const userRef = database().ref(
      `games/${this.currentGameId}/players/${user.uid}`
    );

    // Set online status immediately
    userRef.update({ 
      isOnline: true, 
      lastSeen: Date.now() 
    });

    // Firebase automatically handles disconnection
    userRef.onDisconnect().update({ 
      isOnline: false, 
      lastSeen: Date.now() 
    });

    // Set up optimized periodic presence updates (much longer intervals)
    this.setupOptimizedPresenceUpdates();

    console.log("Presence tracking set up with Firebase onDisconnect and optimized updates");
  }

  private presenceUpdateInterval: NodeJS.Timeout | null = null;

  // Optimized presence updates with longer intervals to minimize performance impact
  private setupOptimizedPresenceUpdates(): void {
    // Clear any existing interval
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
    }

    // Update presence every 2 minutes (much longer than 15 seconds)
    // This prevents false disconnections while minimizing network traffic
    this.presenceUpdateInterval = setInterval(async () => {
      try {
        await this.updatePlayerPresence(true);
        console.log("Optimized presence update sent (2min interval)");
      } catch (error) {
        console.warn("Optimized presence update failed:", error);
        // Don't clear the interval on error - keep trying
      }
    }, 120000); // 2 minutes instead of 15 seconds
  }

  private clearOptimizedPresenceUpdates(): void {
    if (this.presenceUpdateInterval) {
      clearInterval(this.presenceUpdateInterval);
      this.presenceUpdateInterval = null;
    }
  }

  private revertOptimisticMove(moveData: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
  }): void {
    // Revert the optimistic move by moving the piece back
    const revertMoveData = {
      from: moveData.to,
      to: moveData.from,
      pieceCode: moveData.pieceCode,
      playerColor: moveData.playerColor,
    };
    
    console.log("OnlineGameService: Reverting move:", revertMoveData);
    store.dispatch(applyNetworkMove(revertMoveData));
  }

  private hasBoardStateChanged(oldBoard: any[][], newBoard: any[][]): boolean {
    if (!oldBoard || !newBoard) return true;
    if (oldBoard.length !== newBoard.length) return true;

    for (let i = 0; i < oldBoard.length; i++) {
      if (oldBoard[i].length !== newBoard[i].length) return true;
      for (let j = 0; j < oldBoard[i].length; j++) {
        if (oldBoard[i][j] !== newBoard[i][j]) return true;
      }
    }
    return false;
  }

  // OPTIMIZATION: Removed validateMove function - server validation is authoritative
  // This eliminates redundant getValidMoves() calls and improves performance

  // OPTIMIZATION: Removed rollback methods - not needed for performance

  // OPTIMIZATION: Connection quality detection methods
  private measureLatency(): number {
    const startTime = Date.now();
    // Send ping to Firebase to measure latency
    const pingRef = realtimeDatabaseService.getDatabase().ref('.info/serverTimeOffset');
    pingRef.once('value', () => {
      const latency = Date.now() - startTime;
      this.updateConnectionQuality(latency);
    });
    return Date.now() - startTime;
  }

  private updateConnectionQuality(latency: number): void {
    this.latencyHistory.push(latency);
    if (this.latencyHistory.length > this.maxLatencySamples) {
      this.latencyHistory.shift();
    }

    const avgLatency = this.latencyHistory.reduce((a, b) => a + b, 0) / this.latencyHistory.length;
    
    if (avgLatency < 100) {
      this.connectionQuality = 'excellent';
    } else if (avgLatency < 300) {
      this.connectionQuality = 'good';
    } else {
      this.connectionQuality = 'poor';
    }

    console.log(`Connection quality: ${this.connectionQuality} (avg latency: ${avgLatency}ms)`);
  }

  public getConnectionQuality(): string {
    return this.connectionQuality;
  }

  // OPTIMIZATION: Optimized board state processing with caching
  private processBoardStateOptimized(boardState: any): (string | null)[][] {
    // Create a simple hash of the board state
    const boardHash = JSON.stringify(boardState);
    
    // Return cached version if unchanged
    if (this.lastBoardStateHash === boardHash && this.cachedProcessedBoardState) {
      return this.cachedProcessedBoardState;
    }

    // Process the board state
    const processedBoardState = boardState.map((row: any) => {
      if (!row) return Array(14).fill(null);
      // Handle both arrays and objects (Firebase sometimes converts arrays to objects)
      if (Array.isArray(row)) {
        return [...row];
      } else if (typeof row === "object") {
        // Convert object to array (Firebase object with numeric keys)
        const arrayRow = Array(14).fill(null);
        Object.keys(row).forEach((key) => {
          const index = parseInt(key);
          if (!isNaN(index) && index >= 0 && index < 14) {
            arrayRow[index] = row[key];
          }
        });
        return arrayRow;
      }
      return Array(14).fill(null);
    });

    // Cache the result
    this.lastBoardStateHash = boardHash;
    this.cachedProcessedBoardState = processedBoardState;

    return processedBoardState;
  }

  // History navigation removed from online multiplayer
}

export default new OnlineGameServiceImpl();
