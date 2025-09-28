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

    // Send move through serverless P2P service
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
    console.log("P2PGameService: Setting up serverless P2P message handlers");
    
    // Set up handlers for our serverless P2P service using the new message system
    this.gameUnsubscribe = p2pService.onMessage("game-state-update", (gameState) => {
      console.log("P2PGameService: Received game state update:", gameState);
      this.gameUpdateCallbacks.forEach(callback => callback(gameState));
    });

    this.moveUnsubscribe = p2pService.onMessage("move-received", (move) => {
      console.log("P2PGameService: Received move:", move);
      this.moveUpdateCallbacks.forEach(callback => callback(move));
    });
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

  private convertP2PToReduxGameState(p2pGameState: any): GameState {
    // Convert P2P game state format to Redux game state format
    return {
      boardState:
        p2pGameState.boardState || initialBoardState.map((row) => [...row]),
      currentPlayerTurn: p2pGameState.currentPlayerTurn || "r",
      gameStatus: p2pGameState.gameStatus || "active",
      selectedPiece: null,
      validMoves: [],
      capturedPieces: p2pGameState.capturedPieces || {
        r: [],
        b: [],
        y: [],
        g: [],
      },
      checkStatus: p2pGameState.checkStatus || {
        r: false,
        b: false,
        y: false,
        g: false,
      },
      winner: p2pGameState.winner || null,
      eliminatedPlayers: p2pGameState.eliminatedPlayers || [],
      justEliminated: p2pGameState.justEliminated || null,
      scores: p2pGameState.scores || { r: 0, b: 0, y: 0, g: 0 },
      promotionState: p2pGameState.promotionState || {
        isAwaiting: false,
        position: null,
        color: null,
      },
      hasMoved: p2pGameState.hasMoved || {
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
      enPassantTargets: p2pGameState.enPassantTargets || [],
      gameOverState: p2pGameState.gameOverState || {
        isGameOver: false,
        status: null,
        eliminatedPlayer: null,
      },
      history: p2pGameState.history || [],
      historyIndex: p2pGameState.historyIndex || 0,
      viewingHistoryIndex: null,
      players: Array.from(p2pGameState.players?.values() || []),
      isHost: p2pGameState.hostId === p2pService.getPeerId(),
      canStartGame:
        Array.from(p2pGameState.players?.values() || []).length >= 2 &&
        p2pGameState.gameStatus === "waiting",
    };
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

  private setupPresenceTracking(): void {
    // P2P presence is handled by WebRTC connection state
    // No need for explicit presence updates
    console.log("P2PGameService: Presence tracking setup (handled by WebRTC)");
  }
}

export default new P2PGameServiceImpl();


