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
  createStateSnapshot,
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
  private presenceInterval: ReturnType<typeof setInterval> | null = null;

  async connectToGame(gameId: string): Promise<void> {
    try {
      // Sign in anonymously if not already signed in
      const user = realtimeDatabaseService.getCurrentUser();
      if (!user) {
        await realtimeDatabaseService.signInAnonymously();
      }

      this.currentGameId = gameId;
      this.isConnected = true; // Mark as connected immediately when connection is established
      console.log(
        "OnlineGameService: Connection established, isConnected:",
        this.isConnected,
        "currentGameId:",
        this.currentGameId
      );

      // Subscribe to game updates
      this.gameUnsubscribe = realtimeDatabaseService.subscribeToGame(
        gameId,
        (game) => {
          if (game) {
            // Keep connected status true when we receive game data
            this.isConnected = true;
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
    } catch (error) {
      console.error("Error connecting to enhanced online game:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
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

    // Add retry logic for network failures
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Basic client-side validation for UX (not authoritative)
        const state = store.getState();
        const currentGameState = state.game;

        // Re-enable turn validation to prevent race conditions
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

        // If we get here, the move was sent successfully
        return;
      } catch (error) {
        lastError = error as Error;
        retryCount++;

        // Don't retry for validation errors
        if (
          error instanceof Error &&
          (error.message.includes("Not your turn") ||
            error.message.includes("Invalid move"))
        ) {
          throw error;
        }

        console.warn(`Move attempt ${retryCount} failed:`, error);

        if (retryCount < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * retryCount)
          );
        }
      }
    }

    // If we get here, all retries failed
    console.error(
      `Failed to send move after ${maxRetries} attempts:`,
      lastError
    );
    throw lastError || new Error("Failed to send move after multiple attempts");
  }

  async resignGame(): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }

    if (!this.currentPlayer) {
      throw new Error("No current player found");
    }

    // Add retry logic for network failures
    let retryCount = 0;
    const maxRetries = 3;
    let lastError: Error | null = null;

    while (retryCount < maxRetries) {
      try {
        // Call the Cloud Function to resign
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

        // Ensure board state is properly copied
        const gameState = {
          ...game.gameState,
          currentPlayerTurn:
            game.currentPlayerTurn || game.gameState.currentPlayerTurn || "r",
          gameStatus: (game.gameState.gameStatus || game.status || "active") as
            | "waiting"
            | "active"
            | "checkmate"
            | "stalemate"
            | "finished"
            | "promotion",
          justEliminated: game.gameState.justEliminated || null,
          winner: game.gameState.winner || null,
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
          // Multiplayer state
          players: playersArray,
          isHost: isHost,
          canStartGame: canStartGame,
          // Use server-stored history for synchronization
          history: game.gameState.history || [],
          historyIndex: game.gameState.historyIndex || 0,
        };

        // Apply the complete game state from server (including history)
        store.dispatch(setGameState(gameState));
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
    // Update presence every 10 seconds for better disconnect detection
    this.presenceInterval = setInterval(() => {
      this.updatePlayerPresence(true);
    }, 10000);
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

  // History navigation removed from online multiplayer
}

export default new OnlineGameServiceImpl();
