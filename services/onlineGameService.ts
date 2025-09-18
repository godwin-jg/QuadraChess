import firebaseService, { FirebaseGame } from "./firebaseService";
import { GameState, Player } from "../state/types";
import {
  makeMove as makeMoveAction,
  applyNetworkMove,
  setGameState,
} from "../state/gameSlice";
import { store } from "../state/store";

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
  onGameUpdate: (callback: (game: FirebaseGame | null) => void) => () => void;
  onMoveUpdate: (callback: (move: any) => void) => () => void;
}

class OnlineGameServiceImpl implements OnlineGameService {
  public currentGameId: string | null = null;
  public currentPlayer: Player | null = null;
  public isConnected: boolean = false;

  private gameUnsubscribe: (() => void) | null = null;
  private movesUnsubscribe: (() => void) | null = null;
  private gameUpdateCallbacks: ((game: FirebaseGame | null) => void)[] = [];
  private moveUpdateCallbacks: ((move: any) => void)[] = [];

  async connectToGame(gameId: string): Promise<void> {
    try {
      console.log("Connecting to online game:", gameId);

      // Sign in anonymously if not already signed in
      const user = firebaseService.getCurrentUser();
      if (!user) {
        await firebaseService.signInAnonymously();
      }

      this.currentGameId = gameId;
      this.isConnected = true;

      // Subscribe to game updates
      this.gameUnsubscribe = firebaseService.subscribeToGame(gameId, (game) => {
        console.log("Game update received:", game);
        this.handleGameUpdate(game);
      });

      // Subscribe to move updates
      this.movesUnsubscribe = firebaseService.subscribeToMoves(
        gameId,
        (move) => {
          console.log("Move update received:", move);
          this.handleMoveUpdate(move);
        }
      );

      console.log("Successfully connected to online game");
    } catch (error) {
      console.error("Error connecting to online game:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      console.log("Disconnecting from online game");

      if (this.currentGameId) {
        await firebaseService.leaveGame(this.currentGameId);
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

      this.currentGameId = null;
      this.currentPlayer = null;
      this.isConnected = false;
      this.gameUpdateCallbacks = [];
      this.moveUpdateCallbacks = [];

      console.log("Successfully disconnected from online game");
    } catch (error) {
      console.error("Error disconnecting from online game:", error);
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
      console.log("Making move in online game:", moveData);

      // Send move to Firebase
      await firebaseService.makeMoveRealTime(this.currentGameId, moveData);

      // Apply move locally
      const state = store.getState();
      const currentGameState = state.game;

      // Create a temporary move action to apply the move locally
      const moveAction = makeMoveAction({
        row: moveData.to.row,
        col: moveData.to.col,
      });

      // Apply the move to get the new game state
      const newGameState = this.applyMoveToState(currentGameState, moveData);

      // Update Firebase with the new game state
      await firebaseService.updateGameState(this.currentGameId, newGameState);

      console.log("Move successfully made in online game");
    } catch (error) {
      console.error("Error making move in online game:", error);
      throw error;
    }
  }

  onGameUpdate(callback: (game: FirebaseGame | null) => void): () => void {
    this.gameUpdateCallbacks.push(callback);

    return () => {
      const index = this.gameUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.gameUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onMoveUpdate(callback: (move: any) => void): () => void {
    this.moveUpdateCallbacks.push(callback);

    return () => {
      const index = this.moveUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.moveUpdateCallbacks.splice(index, 1);
      }
    };
  }

  private handleGameUpdate(game: FirebaseGame | null): void {
    if (game) {
      // Update current player info
      const user = firebaseService.getCurrentUser();
      if (user) {
        this.currentPlayer =
          game.players.find((p) => p.id === user.uid) || null;
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

  private handleMoveUpdate(move: any): void {
    // Apply the move to the local game state
    if (move && move.move) {
      store.dispatch(applyNetworkMove(move.move));
    }

    // Notify callbacks
    this.moveUpdateCallbacks.forEach((callback) => callback(move));
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
    // This is a simplified version - in a real implementation,
    // you'd want to use the actual game logic to apply the move
    // For now, we'll just update the board state
    const newState = { ...gameState };

    // Move the piece
    newState.boardState[moveData.to.row][moveData.to.col] = moveData.pieceCode;
    newState.boardState[moveData.from.row][moveData.from.col] = null;

    // Clear selection
    newState.selectedPiece = null;
    newState.validMoves = [];

    return newState;
  }
}

export default new OnlineGameServiceImpl();
