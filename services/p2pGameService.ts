import { getValidMoves, isKingInCheck } from "../functions/src/logic/gameLogic";
import { initialBoardState } from "../state/boardState";
import { applyNetworkMove, setGameState } from "../state/gameSlice";
import { store } from "../state/store";
import { GameState, EnPassantTarget } from "../state/types";
import p2pService from "./p2pService";

export interface P2PGameService {
  currentGameId: string | null;
  currentPlayer: any | null;
  isConnected: boolean;
  connectToGame: (gameId: string) => Promise<void>;
  disconnect: () => void;
  makeMove: (moveData: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
    isEnPassant?: boolean;
    enPassantTarget?: EnPassantTarget | null; // ✅ Enhanced type safety
  }) => Promise<void>;
  makePromotion: (pieceType: string) => Promise<void>;
  resignGame: () => Promise<void>;
  onGameUpdate: (callback: (game: any) => void) => () => void;
  onMoveUpdate: (callback: (move: any) => void) => () => void;
  updatePlayerPresence: (isOnline: boolean) => Promise<void>;
}

class P2PGameServiceImpl implements P2PGameService {
  public currentGameId: string | null = null;
  public currentPlayer: any | null = null;
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

      
      // ✅ CRITICAL: Set gameMode to p2p when connecting to P2P game
      const { store } = require("../state/store");
      const { setGameMode } = require("../state/gameSlice");
      store.dispatch(setGameMode("p2p"));

      // Set up message handlers for our serverless P2P service
      this.setupServerlessMessageHandlers();

      // Get current player info from P2P service
      this.currentPlayer = p2pService.getCurrentPlayer();
      if (this.currentPlayer) {
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
        p2pService.disconnect();
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
    isEnPassant?: boolean;
    enPassantTarget?: EnPassantTarget | null; // ✅ Enhanced type safety
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

    // Store previous state to check for elimination
    const previousState = store.getState().game;
    const previousEliminatedPlayers = [...previousState.eliminatedPlayers];

    // ✅ Apply move locally first (optimistic UI)
    store.dispatch(applyNetworkMove(moveData));

    // ✅ CRITICAL FIX: Check if elimination occurred and sync game state
    const newState = store.getState().game;
    const newEliminatedPlayers = [...newState.eliminatedPlayers];
    
    // Check if any players were eliminated
    const eliminationOccurred = newEliminatedPlayers.length > previousEliminatedPlayers.length;
    
    // ✅ CRITICAL FIX: Also check if game ended (3 players eliminated)
    const gameEnded = newEliminatedPlayers.length >= 3 && previousEliminatedPlayers.length < 3;
    
    if (eliminationOccurred || gameEnded) {
      console.log("🎮 P2PGameService: Game state change detected! Syncing complete game state to all clients");
      console.log("🎮 P2PGameService: Previous eliminated players:", previousEliminatedPlayers);
      console.log("🎮 P2PGameService: New eliminated players:", newEliminatedPlayers);
      console.log("🎮 P2PGameService: Just eliminated:", newState.justEliminated);
      console.log("🎮 P2PGameService: Game ended:", gameEnded);
      console.log("🎮 P2PGameService: Game status:", newState.gameStatus);
      console.log("🎮 P2PGameService: Winner:", newState.winner);
      console.log("🎮 P2PGameService: Game over state:", newState.gameOverState);
      
      // Sync the complete game state to all clients
      p2pService.syncGameStateToClients();
    }

    // ✅ Send move through P2P service
    p2pService.sendChessMove(moveData);
  }

  async makePromotion(pieceType: string): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }

    const gameState = store.getState().game;
    if (!gameState.promotionState.isAwaiting || !gameState.promotionState.position) {
      throw new Error("No pending promotion");
    }

    const { row, col } = gameState.promotionState.position;
    const playerColor = gameState.promotionState.color!;

    console.log(`🎯 P2PGame: Making promotion to ${pieceType} at (${row}, ${col}) for ${playerColor}`);

    // ✅ Apply promotion locally first (optimistic UI)
    const { completePromotion } = require("../state/gameSlice");
    store.dispatch(completePromotion({ pieceType }));

    // ✅ Send promotion through P2P service
    p2pService.sendChessMove({
      from: { row, col },
      to: { row, col },
      pieceCode: `${playerColor}P`,
      playerColor: playerColor,
      isPromotion: true,
      promotionPieceType: pieceType,
    });
  }

  async resignGame(): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }

    // ✅ CRITICAL FIX: Debug current player info
    
    // ✅ CRITICAL FIX: Get current player from P2P service if not set
    if (!this.currentPlayer || !this.currentPlayer.color) {
      this.currentPlayer = p2pService.getCurrentPlayer();
    }

    const playerColor = this.currentPlayer?.color || "";
    if (!playerColor) {
      console.error("🎮 P2PGameService: No player color available for resignation");
      throw new Error("Player color not available for resignation");
    }


    // Send resignation message through serverless P2P service
    p2pService.sendChessMove({
      from: { row: -1, col: -1 },
      to: { row: -1, col: -1 },
      pieceCode: "RESIGN",
      playerColor: playerColor,
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
    this.gameUnsubscribe = p2pService.onMessage("gameState", (message: any) => {
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
    
    // ✅ Simple approach: Only listen for moves, no heavy state sync
    // Each client maintains their own game state, only moves are synchronized
    
    // Set up dummy unsubscribers since we don't need them anymore
    this.gameUnsubscribe = () => {};
    this.moveUnsubscribe = () => {};
  }

  private handleGameStateUpdate(message: any): void {
    const { gameState, players } = message.data;

    if (gameState) {
      // Use the game state directly
      store.dispatch(setGameState(gameState));
    }

    if (players) {
      // Update current player info
      const currentPlayerId = p2pService.getPeerId();
      this.currentPlayer =
        players.find((p: any) => p.id === currentPlayerId) || null;
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

  private handleMoveUpdate(message: any): void {
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

  private handlePlayerJoined(message: any): void {
    // This is handled by the game state update
  }

  private handlePlayerLeft(message: any): void {
    // This is handled by the game state update
  }

  private handleError(message: any): void {
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
  }
}

export default new P2PGameServiceImpl();


