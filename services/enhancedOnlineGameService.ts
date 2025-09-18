import realtimeDatabaseService, {
  RealtimeGame,
  RealtimeMove,
} from "./realtimeDatabaseService";
import { GameState, Player } from "../state/types";
import {
  makeMove as makeMoveAction,
  applyNetworkMove,
  setGameState,
} from "../state/gameSlice";
import { store } from "../state/store";
import { getValidMoves, isKingInCheck, hasAnyLegalMoves } from "../logic";
import { updateAllCheckStatus } from "../state/gameHelpers";

export interface EnhancedOnlineGameService {
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

class EnhancedOnlineGameServiceImpl implements EnhancedOnlineGameService {
  public currentGameId: string | null = null;
  public currentPlayer: Player | null = null;
  public isConnected: boolean = false;

  private gameUnsubscribe: (() => void) | null = null;
  private movesUnsubscribe: (() => void) | null = null;
  private gameUpdateCallbacks: ((game: RealtimeGame | null) => void)[] = [];
  private moveUpdateCallbacks: ((move: RealtimeMove) => void)[] = [];
  private presenceInterval: NodeJS.Timeout | null = null;

  async connectToGame(gameId: string): Promise<void> {
    try {
      console.log("Connecting to enhanced online game:", gameId);

      // Sign in anonymously if not already signed in
      const user = realtimeDatabaseService.getCurrentUser();
      if (!user) {
        await realtimeDatabaseService.signInAnonymously();
      }

      this.currentGameId = gameId;
      this.isConnected = true;

      // Subscribe to game updates
      this.gameUnsubscribe = realtimeDatabaseService.subscribeToGame(
        gameId,
        (game) => {
          console.log("Enhanced game update received:", game);
          this.handleGameUpdate(game);
        }
      );

      // Subscribe to move updates
      this.movesUnsubscribe = realtimeDatabaseService.subscribeToMoves(
        gameId,
        (move) => {
          console.log("Enhanced move update received:", move);
          this.handleMoveUpdate(move);
        }
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
      console.log("Making enhanced move in online game:", moveData);

      // Validate move using game logic
      const state = store.getState();
      const currentGameState = state.game;

      // Check if it's the player's turn
      if (currentGameState.currentPlayerTurn !== moveData.playerColor) {
        throw new Error("Not your turn");
      }

      // Validate the move using game logic
      const isValidMove = this.validateMove(currentGameState, moveData);
      if (!isValidMove) {
        throw new Error("Invalid move");
      }

      // Send move to Realtime Database first
      await realtimeDatabaseService.makeMove(this.currentGameId, moveData);

      // Apply move locally for immediate feedback
      const newGameState = this.applyMoveToState(currentGameState, moveData);

      // Update Redux store
      store.dispatch(setGameState(newGameState));

      // Update game state in database
      await realtimeDatabaseService.updateGameState(
        this.currentGameId,
        newGameState
      );

      console.log("Enhanced move successfully made in online game");
    } catch (error) {
      console.error("Error making enhanced move in online game:", error);
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
      if (user) {
        this.currentPlayer = game.players[user.uid] || null;
      }

      // Update Redux store with game state
      store.dispatch(setGameState(game.gameState));

      // Notify callbacks
      this.gameUpdateCallbacks.forEach((callback) => callback(game));
    } else {
      // Game not found or deleted
      this.gameUpdateCallbacks.forEach((callback) => callback(null));
    }
  }

  private handleMoveUpdate(move: RealtimeMove): void {
    // Apply the move to the local game state using proper game logic
    const state = store.getState();
    const currentGameState = state.game;

    // Only apply the move if it's from another player
    const user = realtimeDatabaseService.getCurrentUser();
    if (user && move.playerId !== user.uid) {
      console.log("Applying move from other player:", move);
      const newGameState = this.applyMoveToState(currentGameState, move);
      store.dispatch(setGameState(newGameState));
    }

    // Notify callbacks
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

  private applyMoveToState(
    gameState: GameState,
    moveData: {
      from: { row: number; col: number };
      to: { row: number; col: number };
      pieceCode: string;
      playerColor: string;
    }
  ): GameState {
    // Create a deep copy of the game state
    const newState = {
      ...gameState,
      boardState: gameState.boardState.map((row) => [...row]),
      capturedPieces: {
        r: [...gameState.capturedPieces.r],
        b: [...gameState.capturedPieces.b],
        y: [...gameState.capturedPieces.y],
        g: [...gameState.capturedPieces.g],
      },
      checkStatus: { ...gameState.checkStatus },
      scores: { ...gameState.scores },
      hasMoved: { ...gameState.hasMoved },
      enPassantTargets: gameState.enPassantTargets.map((target) => ({
        ...target,
        position: { ...target.position },
      })),
      promotionState: { ...gameState.promotionState },
      gameOverState: { ...gameState.gameOverState },
      eliminatedPlayers: [...gameState.eliminatedPlayers],
      history: [...gameState.history],
    };

    // Move the piece
    newState.boardState[moveData.to.row][moveData.to.col] = moveData.pieceCode;
    newState.boardState[moveData.from.row][moveData.from.col] = null;

    // Handle capture
    const capturedPiece =
      gameState.boardState[moveData.to.row][moveData.to.col];
    if (capturedPiece) {
      const capturingPlayer = moveData.pieceCode[0];
      newState.capturedPieces[
        capturingPlayer as keyof typeof newState.capturedPieces
      ].push(capturedPiece);

      // Add points for captured piece
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
          points = 20;
          break;
        default:
          points = 0;
      }
      newState.scores[capturingPlayer as keyof typeof newState.scores] +=
        points;
    }

    // Update check status
    newState.checkStatus = updateAllCheckStatus(
      newState.boardState,
      newState.eliminatedPlayers,
      newState.hasMoved
    );

    // Advance turn
    const turnOrder = ["r", "b", "y", "g"];
    const currentIndex = turnOrder.indexOf(moveData.playerColor);
    const nextIndex = (currentIndex + 1) % turnOrder.length;
    newState.currentPlayerTurn = turnOrder[nextIndex];

    // Update check status after move
    newState.checkStatus = updateAllCheckStatus(
      newState.boardState,
      newState.eliminatedPlayers,
      newState.hasMoved
    );

    // Clear selection
    newState.selectedPiece = null;
    newState.validMoves = [];

    return newState;
  }
}

export default new EnhancedOnlineGameServiceImpl();
