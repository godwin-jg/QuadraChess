import realtimeDatabaseService, {
  RealtimeGame,
  RealtimeMove,
} from "./realtimeDatabaseService";
import { GameState } from "../state/types";
import { Player } from "../app/services/networkService";
import {
  makeMove as makeMoveAction,
  applyNetworkMove,
  setGameState,
} from "../state/gameSlice";
import { store } from "../state/store";
import { getValidMoves, isKingInCheck, hasAnyLegalMoves } from "../logic";
import { updateAllCheckStatus } from "../state/gameHelpers";
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
  private presenceInterval: ReturnType<typeof setInterval> | null = null;

  async connectToGame(gameId: string): Promise<void> {
    try {
      console.log("Connecting to enhanced online game:", gameId);

      // Sign in anonymously if not already signed in
      const user = realtimeDatabaseService.getCurrentUser();
      if (!user) {
        try {
          await realtimeDatabaseService.signInAnonymously();
        } catch (authError) {
          console.error("Failed to sign in, using mock user:", authError);
          // Continue with mock user
        }
      }

      this.currentGameId = gameId;

      // Subscribe to game updates
      this.gameUnsubscribe = realtimeDatabaseService.subscribeToGame(
        gameId,
        (game) => {
          console.log("Enhanced game update received:", game);
          if (game) {
            this.isConnected = true; // Mark as connected when we receive game data
          } else {
            this.isConnected = false; // Mark as disconnected if game is null
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

      console.log("Successfully connected to enhanced online game");
    } catch (error) {
      console.error("Error connecting to enhanced online game:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      console.log("Disconnecting from enhanced online game");

      if (this.currentGameId) {
        await this.updatePlayerPresence(false);
        await realtimeDatabaseService.leaveGame(this.currentGameId);
      }

      // Clean up subscriptions
      if (this.gameUnsubscribe) {
        this.gameUnsubscribe();
        this.gameUnsubscribe = null;
      }

      if (this.movesUnsubscribe) {
        this.movesUnsubscribe();
        this.movesUnsubscribe = null;
      }

      if (this.presenceInterval) {
        clearInterval(this.presenceInterval);
        this.presenceInterval = null;
      }

      this.currentGameId = null;
      this.currentPlayer = null;
      this.isConnected = false;
      this.gameUpdateCallbacks = [];
      this.moveUpdateCallbacks = [];

      console.log("Successfully disconnected from enhanced online game");
    } catch (error) {
      console.error("Error disconnecting from enhanced online game:", error);
      throw error;
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
      console.log("Sending move to server:", moveData);

      // Basic client-side validation for UX (not authoritative)
      const state = store.getState();
      const currentGameState = state.game;

      // Check if it's the player's turn (for immediate feedback)
      if (currentGameState.currentPlayerTurn !== moveData.playerColor) {
        throw new Error("Not your turn");
      }

      // Basic move validation (for immediate feedback)
      const isValidMove = this.validateMove(currentGameState, moveData);
      if (!isValidMove) {
        throw new Error("Invalid move");
      }

      // ONLY send the move to the server - do NOT calculate game state
      await realtimeDatabaseService.makeMove(this.currentGameId, moveData);

      console.log("Move sent to server successfully");
    } catch (error) {
      console.error("Error sending move to server:", error);
      throw error;
    }
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
    if (game) {
      // Update current player info
      const user = realtimeDatabaseService.getCurrentUser();
      console.log("OnlineGameService: Current user:", user);
      console.log(
        "OnlineGameService: Available player IDs:",
        Object.keys(game.players)
      );
      console.log("OnlineGameService: Looking for user.uid:", user?.uid);

      if (user) {
        this.currentPlayer = game.players[user.uid] || null;
        console.log(
          "OnlineGameService: Found current player:",
          this.currentPlayer
        );
      } else {
        console.log("OnlineGameService: No current user found");
      }

      // Ensure game state is properly initialized
      if (
        game.gameState &&
        game.gameState.boardState &&
        Array.isArray(game.gameState.boardState) &&
        game.gameState.boardState.length > 0
      ) {
        console.log("Updating game state with valid boardState");
        console.log("Board state length:", game.gameState.boardState.length);
        console.log("First row length:", game.gameState.boardState[0]?.length);
        console.log(
          "Sample pieces:",
          game.gameState.boardState[0]?.slice(0, 5)
        );

        // Ensure board state is properly copied
        const gameState = {
          ...game.gameState,
          boardState: game.gameState.boardState.map((row) => {
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
          }),
          history: game.gameState.history || [],
          historyIndex: game.gameState.historyIndex || 0,
        };
        store.dispatch(setGameState(gameState));
      } else {
        console.warn("Game state is missing boardState, using fallback");
        // Fallback to a complete game state with proper initialization
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
          players: [],
          isHost: false,
          canStartGame: false,
        };
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

    console.log("Move received from server:", move);
    console.log(
      "WARNING: Individual move processing disabled to prevent desync"
    );

    // Notify callbacks (for UI feedback, not state changes)
    this.moveUpdateCallbacks.forEach((callback) => callback(move));
  }

  private setupPresenceTracking(): void {
    // Update presence every 30 seconds
    this.presenceInterval = setInterval(() => {
      this.updatePlayerPresence(true);
    }, 30000);
  }

  private validateMove(
    gameState: GameState,
    moveData: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
    }
  ): boolean {
    try {
      // Check if it's the player's turn
      if (gameState.currentPlayerTurn !== moveData.playerColor) {
        return false;
      }

      // Check if the piece belongs to the player
      const piece = gameState.boardState[moveData.from.row][moveData.from.col];
      if (!piece || piece[0] !== moveData.playerColor) {
        return false;
      }

      // Check if the move is valid using game logic
      const validMoves = getValidMoves(
        piece,
        moveData.from,
        gameState.boardState,
        gameState.eliminatedPlayers,
        gameState.hasMoved,
        gameState.enPassantTargets
      );

      const isValidMove = validMoves.some(
        (move) => move.row === moveData.to.row && move.col === moveData.to.col
      );

      if (!isValidMove) {
        return false;
      }

      // Check if the move would put the player in check
      const tempBoard = gameState.boardState.map((row) => [...row]);
      tempBoard[moveData.to.row][moveData.to.col] = piece;
      tempBoard[moveData.from.row][moveData.from.col] = null;

      const isInCheck = isKingInCheck(
        moveData.playerColor,
        tempBoard,
        gameState.eliminatedPlayers,
        gameState.hasMoved
      );

      return !isInCheck;
    } catch (error) {
      console.error("Error validating move:", error);
      return false;
    }
  }

  // CRITICAL: Clients should NEVER calculate game state changes
  // This function is DANGEROUS and causes race conditions
  // Game state calculation must happen server-side only
  private applyMoveToState(
    gameState: GameState,
    moveData: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
    }
  ): GameState {
    console.error(
      "CRITICAL ERROR: Clients should never calculate game state changes!"
    );
    console.error("This causes race conditions and desynchronization!");
    console.error("Game state calculation must happen server-side only.");
    throw new Error(
      "Client-side game state calculation is not allowed. Use server-side functions instead."
    );
  }
}

export default new OnlineGameServiceImpl();
