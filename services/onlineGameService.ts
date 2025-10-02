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
  applyNetworkMove,
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
  
  // ✅ CRITICAL FIX: Track processed captures to prevent duplicate animations
  private lastProcessedMove: any = null;
  
  // ✅ CRITICAL FIX: Debounce game updates to prevent excessive calls
  private gameUpdateTimeout: NodeJS.Timeout | null = null;
  
  // ✅ CRITICAL FIX: Handle critical errors (max retries exceeded, etc.)
  private handleCriticalError(error: string): void {
    console.error("OnlineGameService: Handling critical error:", error);
    
    // Force immediate cleanup
    this.forceCleanup();
    
    // Reset game state
    const store = require('../state/store').default;
    store.dispatch(require('../state/gameSlice').resetGame());
    
    // Show user-friendly error message
    try {
      const { Alert } = require('react-native');
      Alert.alert(
        "Connection Error",
        "There was a problem with the server connection. You've been returned to the lobby.",
        [
          {
            text: "OK",
            onPress: () => {
              // Navigate to lobby
              try {
                const { router } = require('expo-router');
                router.replace('/online-lobby');
              } catch (navError) {
              }
            }
          }
        ]
      );
    } catch (alertError) {
    }
  }
  
  // ✅ CRITICAL FIX: Force cleanup when critical errors occur
  private forceCleanup(): void {
    
    // Clear all timeouts
    if (this.gameUpdateTimeout) {
      clearTimeout(this.gameUpdateTimeout);
      this.gameUpdateTimeout = null;
    }
    
    // Clear subscriptions
    if (this.gameUnsubscribe) {
      this.gameUnsubscribe();
      this.gameUnsubscribe = null;
    }
    
    if (this.movesUnsubscribe) {
      this.movesUnsubscribe();
      this.movesUnsubscribe = null;
    }
    
    // Clear presence updates
    this.clearOptimizedPresenceUpdates();
    
    // Reset connection state
    this.currentGameId = null;
    this.currentPlayer = null;
    this.isConnected = false;
    this.gameUpdateCallbacks = [];
    this.moveUpdateCallbacks = [];
    this.cachedProcessedBoardState = null;
    this.lastProcessedMove = null;
  }

  async connectToGame(gameId: string): Promise<void> {
    try {
      // Sign in anonymously if not already signed in
      const user = realtimeDatabaseService.getCurrentUser();
      if (!user) {
        await realtimeDatabaseService.signInAnonymously();
      }

      this.currentGameId = gameId;
      this.isConnected = true; // Mark as connected immediately when connection is established

      // Subscribe to game updates
      this.gameUnsubscribe = realtimeDatabaseService.subscribeToGame(
        gameId,
        (game) => {
          if (game) {
            // Keep connected status true when we receive game data
            this.isConnected = true;
          } else {
            // Only mark as disconnected if we're sure the game doesn't exist
            // Don't immediately disconnect on temporary null values
            // Keep isConnected true for now, let the resign method handle the actual connection check
          }
          this.handleGameUpdate(game);
        }
      );

      // CRITICAL: Do NOT subscribe to individual moves - causes desynchronization
      // Only subscribe to complete game state updates
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
    try {
      // Clear optimized presence updates first
      this.clearOptimizedPresenceUpdates();

      if (this.currentGameId) {
        try {
          await this.updatePlayerPresence(false);
          await realtimeDatabaseService.leaveGame(this.currentGameId, (criticalError: string) => {
            // ✅ CRITICAL FIX: Handle max retries exceeded - force cleanup and redirect
            console.error("OnlineGameService: Critical error during disconnect:", criticalError);
            this.handleCriticalError(criticalError);
          });
        } catch (error: any) {
          console.warn("OnlineGameService: Error during server disconnect, continuing with local cleanup:", error.message);
          
          // ✅ CRITICAL FIX: Check if this is a critical error
          if (error.message?.includes('max-retries') || error.message?.includes('too many retries')) {
            this.handleCriticalError(error.message);
          }
          
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
      
      // ✅ CRITICAL FIX: Clear any cached board state and processed moves to prevent stale data
      this.cachedProcessedBoardState = null;
      this.lastProcessedMove = null;
      
      // Clear any pending game update timeout
      if (this.gameUpdateTimeout) {
        clearTimeout(this.gameUpdateTimeout);
        this.gameUpdateTimeout = null;
      }
      
    } catch (error) {
      console.error("Error disconnecting from enhanced online game:", error);
      
      // Force cleanup even if there's an error
      this.clearOptimizedPresenceUpdates();
      this.currentGameId = null;
      this.currentPlayer = null;
      this.isConnected = false;
      this.gameUpdateCallbacks = [];
      this.moveUpdateCallbacks = [];
      
      // ✅ CRITICAL FIX: Clear any cached board state to prevent stale data
      this.cachedProcessedBoardState = null;
      
      // Don't re-throw the error to prevent the app from getting stuck
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
        console.error("🎮 OnlineGameService: Server rejected move, rolling back local state:", error);
        
        // ✅ CRITICAL FIX: Preserve local selection state during rollback
        const currentLocalState = store.getState().game;
        const rollbackStateWithSelection = {
          ...stateSnapshot,
          selectedPiece: currentLocalState.selectedPiece,
          validMoves: currentLocalState.validMoves,
          // Include all required GameState properties
          gameMode: currentLocalState.gameMode,
          botPlayers: currentLocalState.botPlayers,
          currentGame: currentLocalState.currentGame,
          discoveredGames: currentLocalState.discoveredGames,
          isDiscovering: currentLocalState.isDiscovering,
          isLoading: currentLocalState.isLoading,
          isConnected: currentLocalState.isConnected,
          connectionError: currentLocalState.connectionError,
          isEditingName: currentLocalState.isEditingName,
          tempName: currentLocalState.tempName,
        };
        
        store.dispatch(setGameState(rollbackStateWithSelection));
        
        // Re-throw error so UI can show appropriate message
        throw error;
      }

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
      // Note: gameId is not stored in Redux state, only in the service
      throw new Error("No game ID available in service");
    }

    // ✅ CRITICAL FIX: Ensure we have the correct current player info
    const user = realtimeDatabaseService.getCurrentUser();
    if (!user) {
      throw new Error("User not authenticated for resignation");
    }

    // ✅ CRITICAL FIX: Get current player info directly from database to ensure accuracy
    let currentPlayerInfo = this.currentPlayer;
    if (!currentPlayerInfo || !currentPlayerInfo.color) {
      console.warn("OnlineGameService: currentPlayer not set or missing color, fetching from database");
      try {
        const gameRef = database().ref(`games/${this.currentGameId}`);
        const gameSnapshot = await gameRef.once("value");
        if (gameSnapshot.exists()) {
          const gameData = gameSnapshot.val();
          currentPlayerInfo = gameData.players[user.uid];
          if (currentPlayerInfo) {
            this.currentPlayer = currentPlayerInfo; // Update the service's current player
            console.log("OnlineGameService: Retrieved current player from database:", currentPlayerInfo);
          }
        }
      } catch (error) {
        console.error("OnlineGameService: Failed to fetch current player from database:", error);
      }
    }

    if (!currentPlayerInfo || !currentPlayerInfo.color) {
      console.error("OnlineGameService: No current player found with valid color for resignation");
      throw new Error("Player color not available for resignation");
    }

    console.log("OnlineGameService: Resigning player:", currentPlayerInfo.name, "with color:", currentPlayerInfo.color);

    // ✅ CRITICAL FIX: Dispatch resignation action immediately for turn advancement
    const { applyNetworkMove } = require('../state/gameSlice');
    store.dispatch(applyNetworkMove({
      from: { row: -1, col: -1 },
      to: { row: -1, col: -1 },
      pieceCode: "RESIGN",
      playerColor: currentPlayerInfo.color,
    }));

    // Add retry logic for network failures
    let retryCount = 0;
    const maxRetries = 2; // Reduced from 3 to 2 for faster failure
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Call the Cloud Function to resign
        await realtimeDatabaseService.resignGame(this.currentGameId!);

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
    // ✅ CRITICAL FIX: Don't process updates if current game mode is not online
    const currentGameMode = store.getState().game.gameMode;
    if (currentGameMode !== "online") {
      console.log(`OnlineGameService: Skipping handleGameUpdate - current mode is ${currentGameMode}, not online`);
      return;
    }
    
    // ✅ CRITICAL FIX: Debounce game updates to prevent excessive calls
    if (this.gameUpdateTimeout) {
      clearTimeout(this.gameUpdateTimeout);
    }
    
    this.gameUpdateTimeout = setTimeout(() => {
      this.processGameUpdate(game);
    }, 100); // 100ms debounce
  }
  
  private processGameUpdate(game: RealtimeGame | null): void {
    // ✅ CRITICAL FIX: Don't process updates if service is disconnected
    if (!this.isConnected || !this.currentGameId) {
      console.log("OnlineGameService: Skipping game update - service is disconnected");
      return;
    }
    
    // ✅ CRITICAL FIX: Don't process updates if current game mode is not online
    const currentGameMode = store.getState().game.gameMode;
    if (currentGameMode !== "online") {
      console.log(`OnlineGameService: Skipping game update - current mode is ${currentGameMode}, not online`);
      return;
    }
    
    if (game) {
      
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
        
        // ✅ CRITICAL FIX: Preserve local selection state in fallback
        const currentLocalState = store.getState().game;
        const fallbackStateWithSelection = {
          ...fallbackState,
          // Preserve local UI state
          selectedPiece: currentLocalState.selectedPiece,
          validMoves: currentLocalState.validMoves,
          // Include all required GameState properties
          gameMode: currentLocalState.gameMode,
          botPlayers: currentLocalState.botPlayers,
          currentGame: currentLocalState.currentGame,
          discoveredGames: currentLocalState.discoveredGames,
          isDiscovering: currentLocalState.isDiscovering,
          isLoading: currentLocalState.isLoading,
          isConnected: currentLocalState.isConnected,
          connectionError: currentLocalState.connectionError,
          isEditingName: currentLocalState.isEditingName,
          tempName: currentLocalState.tempName,
        };
        
        store.dispatch(setGameState(fallbackStateWithSelection));
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
        

        // Update bot players in Redux store
        store.dispatch(setBotPlayers(botPlayers));

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
        

        if (hasSignificantChanges) {
          
          // ✅ OPTIMIZED: Efficient capture detection using lastMove data
          const currentLocalState = store.getState().game;
          let capturedPiece = null;
          let capturePosition = null;
          
          // ✅ CRITICAL FIX: Only process capture if this is a new move
          if (game.lastMove && game.lastMove.from && game.lastMove.to && game.lastMove.pieceCode) {
            const lastMove = game.lastMove;
            const moveKey = `${lastMove.from.row},${lastMove.from.col}-${lastMove.to.row},${lastMove.to.col}-${lastMove.timestamp}`;
            
            // Check if we've already processed this move
            if (this.lastProcessedMove !== moveKey) {
              this.lastProcessedMove = moveKey;
              const oldBoardState = currentLocalState.boardState;
              
              // ✅ CRITICAL FIX: Add bounds checking for safety
              if (oldBoardState && 
                  lastMove.to.row >= 0 && lastMove.to.row < 14 && 
                  lastMove.to.col >= 0 && lastMove.to.col < 14 &&
                  oldBoardState[lastMove.to.row] && 
                  oldBoardState[lastMove.to.row][lastMove.to.col]) {
                
                // Check if the destination square had a piece before the move
                const pieceAtDestination = oldBoardState[lastMove.to.row][lastMove.to.col];
                if (pieceAtDestination && pieceAtDestination[0] !== lastMove.pieceCode[0]) {
                  capturedPiece = pieceAtDestination;
                  capturePosition = { row: lastMove.to.row, col: lastMove.to.col };
                }
              }
            }
          }
          
          // ✅ CRITICAL FIX: Preserve local selection state when syncing from server
          const gameStateWithLocalSelection = {
            ...gameState,
            // Preserve local UI state that shouldn't be overwritten by server
            selectedPiece: currentLocalState.selectedPiece,
            validMoves: currentLocalState.validMoves,
            // Include all required GameState properties
            gameMode: currentLocalState.gameMode,
            botPlayers: currentLocalState.botPlayers,
            currentGame: currentLocalState.currentGame,
            discoveredGames: currentLocalState.discoveredGames,
            isDiscovering: currentLocalState.isDiscovering,
            isLoading: currentLocalState.isLoading,
            isConnected: currentLocalState.isConnected,
            connectionError: currentLocalState.connectionError,
            isEditingName: currentLocalState.isEditingName,
            tempName: currentLocalState.tempName,
          };
          
          store.dispatch(setGameState(gameStateWithLocalSelection));
          
          // ✅ CRITICAL FIX: Trigger capture animation if a capture was detected
          if (capturedPiece && capturePosition) {
            // Calculate points for captured piece
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
            
            // Calculate screen coordinates for the capture square
            const squareSize = 600 / 14; // Assuming 600px board size
            const boardX = (capturePosition.col * squareSize) + (squareSize / 2);
            const boardY = (capturePosition.row * squareSize) + (squareSize / 2);
            
            // Trigger capture animation through the capture animation service
            try {
              const captureAnimationService = require('./captureAnimationService').default;
              captureAnimationService.triggerCaptureAnimation(points, boardX, boardY, gameState.currentPlayerTurn);
            } catch (error) {
            }
          }
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

        // ✅ CRITICAL FIX: Preserve local selection state in fallback
        const currentLocalState = store.getState().game;
        const fallbackStateWithSelection = {
          ...fallbackState,
          // Preserve local UI state
          selectedPiece: currentLocalState.selectedPiece,
          validMoves: currentLocalState.validMoves,
          // Include all required GameState properties
          gameMode: currentLocalState.gameMode,
          botPlayers: currentLocalState.botPlayers,
          currentGame: currentLocalState.currentGame,
          discoveredGames: currentLocalState.discoveredGames,
          isDiscovering: currentLocalState.isDiscovering,
          isLoading: currentLocalState.isLoading,
          isConnected: currentLocalState.isConnected,
          connectionError: currentLocalState.connectionError,
          isEditingName: currentLocalState.isEditingName,
          tempName: currentLocalState.tempName,
        };
        
        // Apply the fallback state
        store.dispatch(setGameState(fallbackStateWithSelection));
      }

      // Notify callbacks
      this.gameUpdateCallbacks.forEach((callback) => callback(game));
    } else {
      // Game not found or deleted
      this.gameUpdateCallbacks.forEach((callback) => callback(null));
    }
  }

  private handleMoveUpdate(move: RealtimeMove): void {
    // ✅ CRITICAL FIX: Don't process moves if service is disconnected
    if (!this.isConnected || !this.currentGameId) {
      console.log("OnlineGameService: Skipping move update - service is disconnected");
      return;
    }
    
    // ✅ CRITICAL FIX: Don't process moves if current game mode is not online
    const currentGameMode = store.getState().game.gameMode;
    if (currentGameMode !== "online") {
      console.log(`OnlineGameService: Skipping move update - current mode is ${currentGameMode}, not online`);
      return;
    }
    
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
    const pingRef = database().ref('.info/serverTimeOffset');
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
