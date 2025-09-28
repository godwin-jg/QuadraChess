import { getValidMoves, isKingInCheck } from "../functions/src/logic/gameLogic";
import { initialBoardState } from "../state/boardState";
import { applyNetworkMove, setGameState } from "../state/gameSlice";
import { store } from "../state/store";
import { GameState } from "../state/types";
import p2pService, { P2PMessage, P2PPlayer } from "./p2pService";

export interface P2PGameService {
  currentGameId: string | null;
  currentPlayer: P2PPlayer | null;
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
  onGameUpdate: (callback: (game: any) => void) => () => void;
  onMoveUpdate: (callback: (move: any) => void) => () => void;
  updatePlayerPresence: (isOnline: boolean) => Promise<void>;
}

class P2PGameServiceImpl implements P2PGameService {
  public currentGameId: string | null = null;
  public currentPlayer: P2PPlayer | null = null;
  public isConnected: boolean = false;

  private gameUnsubscribe: (() => void) | null = null;
  private moveUnsubscribe: (() => void) | null = null;
  private gameUpdateCallbacks: ((game: any) => void)[] = [];
  private moveUpdateCallbacks: ((move: any) => void)[] = [];
  private presenceInterval: ReturnType<typeof setInterval> | null = null;

  async connectToGame(gameId: string): Promise<void> {
    try {
      this.currentGameId = gameId;
      this.isConnected = true;

      console.log("P2PGameService: Connecting to serverless P2P game:", gameId);

      // Set up message handlers for our serverless P2P service
      this.setupServerlessMessageHandlers();

      // Get current player info from P2P service
      this.currentPlayer = p2pService.getCurrentPlayer();
      if (this.currentPlayer) {
        console.log("P2PGameService: Current player:", this.currentPlayer);
      }

      // Set up presence tracking
      await this.updatePlayerPresence(true);
      this.setupPresenceTracking();
    } catch (error) {
      console.error("Error connecting to P2P game:", error);
      this.isConnected = false;
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.currentGameId) {
        await this.updatePlayerPresence(false);
        p2pService.leaveGame();
      }

      // Clean up subscriptions
      if (this.gameUnsubscribe) {
        this.gameUnsubscribe();
        this.gameUnsubscribe = null;
      }

      if (this.moveUnsubscribe) {
        this.moveUnsubscribe();
        this.moveUnsubscribe = null;
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
      console.error("Error disconnecting from P2P game:", error);
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

    // Basic client-side validation for UX (not authoritative)
    const state = store.getState();
    const currentGameState = state.game;

    // Check if it's the player's turn
    if (currentGameState.currentPlayerTurn !== moveData.playerColor) {
      throw new Error("Not your turn");
    }

    // Basic move validation (for immediate feedback)
    const isValidMove = this.validateMove(currentGameState, moveData);
    if (!isValidMove) {
      throw new Error("Invalid move");
    }

    // ✅ Apply move locally first (optimistic UI)
    console.log("P2PGameService: Applying move locally:", moveData);
    store.dispatch(applyNetworkMove(moveData));

    // ✅ Send move through P2P service
    console.log("P2PGameService: Sending move through P2P service");
    p2pService.sendChessMove(moveData);
  }

  async resignGame(): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }

    // Send resignation message through serverless P2P service
    p2pService.sendChessMove({
      from: { row: -1, col: -1 },
      to: { row: -1, col: -1 },
      pieceCode: "RESIGN",
      playerColor: this.currentPlayer?.color || "",
    });
  }

  onGameUpdate(callback: (game: any) => void): () => void {
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

  async updatePlayerPresence(isOnline: boolean): Promise<void> {
    // P2P doesn't need explicit presence updates like Firebase
    // Connection status is handled by WebRTC connection state
    console.log(
      "P2PGameService: Player presence:",
      isOnline ? "online" : "offline"
    );
  }

  private setupMessageHandlers(): void {
    // Handle incoming messages from P2P service
    this.gameUnsubscribe = p2pService.onMessage((message: P2PMessage) => {
      switch (message.type) {
        case "gameState":
          this.handleGameStateUpdate(message);
          break;
        case "move":
          this.handleMoveUpdate(message);
          break;
        case "join":
          this.handlePlayerJoined(message);
          break;
        case "leave":
          this.handlePlayerLeft(message);
          break;
        case "error":
          this.handleError(message);
          break;
      }
    });
  }

  private setupServerlessMessageHandlers(): void {
    console.log("P2PGameService: Setting up lightweight P2P message handlers");
    
    // ✅ Simple approach: Only listen for moves, no heavy state sync
    // Each client maintains their own game state, only moves are synchronized
    console.log("P2PGameService: Using move-only synchronization for efficiency");
    
    // Set up dummy unsubscribers since we don't need them anymore
    this.gameUnsubscribe = () => {};
    this.moveUnsubscribe = () => {};
  }

  private handleGameStateUpdate(message: P2PMessage): void {
    const { gameState, players } = message.data;

    if (gameState) {
      // Convert P2P game state to Redux game state
      const reduxGameState = this.convertP2PToReduxGameState(gameState);
      store.dispatch(setGameState(reduxGameState));
    }

    if (players) {
      // Update current player info
      const currentPlayerId = p2pService.getPeerId();
      this.currentPlayer =
        players.find((p: P2PPlayer) => p.id === currentPlayerId) || null;
    }

    // Notify callbacks
    this.gameUpdateCallbacks.forEach((callback) => {
      try {
        callback({ gameState, players });
      } catch (error) {
        console.error("P2PGameService: Error in game update callback:", error);
      }
    });
  }

  private handleMoveUpdate(message: P2PMessage): void {
    const { moveData } = message.data;

    // Apply move to local state
    const state = store.getState();
    const currentGameState = state.game;

    // Validate move before applying
    if (this.validateMove(currentGameState, moveData)) {
      // Apply move using existing game logic
      store.dispatch(applyNetworkMove(moveData));
    }

    // Notify callbacks
    this.moveUpdateCallbacks.forEach((callback) => {
      try {
        callback(moveData);
      } catch (error) {
        console.error("P2PGameService: Error in move update callback:", error);
      }
    });
  }

  private handlePlayerJoined(message: P2PMessage): void {
    console.log("P2PGameService: Player joined:", message.data);
    // This is handled by the game state update
  }

  private handlePlayerLeft(message: P2PMessage): void {
    console.log("P2PGameService: Player left:", message.data);
    // This is handled by the game state update
  }

  private handleError(message: P2PMessage): void {
    console.error("P2PGameService: Error from peer:", message.data);
    // Handle error appropriately
  }

  // ✅ Removed heavy state conversion - no longer needed with move-only sync

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

  private setupPresenceTracking(): void {
    // P2P presence is handled by WebRTC connection state
    // No need for explicit presence updates
    console.log("P2PGameService: Presence tracking setup (handled by WebRTC)");
  }
}

export default new P2PGameServiceImpl();


