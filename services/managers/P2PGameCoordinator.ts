import { WebRTCConnectionManager, WebRTCConnectionConfig } from './WebRTCConnectionManager';
import { GameStateManager, GameStateEvents } from './GameStateManager';
import { ConnectionStrategyManager, ConnectionStrategyEvents } from './ConnectionStrategyManager';
import { P2PGame, P2PPlayer } from '../../types';
import { generateUUID } from '../utils/uuidGenerator';

export interface P2PGameCoordinatorEvents {
  onGameCreated: (game: P2PGame) => void;
  onGameJoined: (game: P2PGame) => void;
  onPlayerJoined: (player: P2PPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onGameStateUpdate: (gameState: P2PGame) => void;
  onConnectionEstablished: (connectionType: 'webrtc' | 'http') => void;
  onConnectionFailed: (error: Error) => void;
  onGameStarted: (gameState: P2PGame) => void;
}

export interface CreateGameOptions {
  hostName: string;
  gameName: string;
  maxPlayers?: number;
}

export interface JoinGameOptions {
  hostIP: string;
  hostId: string;
  playerName: string;
  gameId: string;
}

export class P2PGameCoordinator {
  private webRTCManager!: WebRTCConnectionManager;
  private gameStateManager!: GameStateManager;
  private connectionStrategyManager!: ConnectionStrategyManager;
  private eventHandlers: P2PGameCoordinatorEvents;
  private peerId: string;
  private isHost: boolean = false;

  constructor(eventHandlers: P2PGameCoordinatorEvents) {
    this.eventHandlers = eventHandlers;
    this.peerId = generateUUID();
    
    // Initialize managers
    this.initializeManagers();
  }

  /**
   * Initialize all managers with proper event handling
   */
  private initializeManagers(): void {
    // WebRTC Configuration
    const webRTCConfig: WebRTCConnectionConfig = {
      iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.cloudflare.com:3478" },
      ],
      iceCandidatePoolSize: 20,
      iceTransportPolicy: 'all',
      bundlePolicy: 'max-bundle',
      rtcpMuxPolicy: 'require',
    };

    // WebRTC Manager
    this.webRTCManager = new WebRTCConnectionManager(
      {
        onConnectionStateChange: (state) => {
        },
        onDataChannelOpen: (dataChannel, peerId) => {
          this.handleDataChannelOpen(peerId);
        },
        onDataChannelMessage: (message, peerId) => {
          this.handleDataChannelMessage(message, peerId);
        },
        onIceCandidate: (candidate) => {
        },
        onConnectionFailed: (error) => {
          this.eventHandlers.onConnectionFailed(error);
        },
      },
      webRTCConfig
    );

    // Game State Manager
    this.gameStateManager = new GameStateManager({
      onGameStateUpdate: (gameState) => {
        this.eventHandlers.onGameStateUpdate(gameState);
      },
      onPlayerJoined: (player) => {
        this.eventHandlers.onPlayerJoined(player);
      },
      onPlayerLeft: (playerId) => {
        this.eventHandlers.onPlayerLeft(playerId);
      },
      onGameStarted: (gameState) => {
        this.eventHandlers.onGameStarted(gameState);
      },
    });

    // Connection Strategy Manager
    this.connectionStrategyManager = new ConnectionStrategyManager(
      this.webRTCManager,
      this.gameStateManager,
      {
        onWebRTCConnectionEstablished: (peerId) => {
          this.eventHandlers.onConnectionEstablished('webrtc');
        },
        onWebRTCConnectionFailed: (error) => {
        },
        onHTTPFallbackActivated: (hostIP) => {
          this.eventHandlers.onConnectionEstablished('http');
        },
        onGameStateReceived: (gameState) => {
          this.eventHandlers.onGameStateUpdate(gameState);
        },
        onConnectionError: (error) => {
          this.eventHandlers.onConnectionFailed(error);
        },
      }
    );
  }

  /**
   * Create a new game (host)
   */
  public async createGame(options: CreateGameOptions): Promise<P2PGame> {
    
    this.isHost = true;
    
    const gameState = this.gameStateManager.initializeHostGame({
      hostName: options.hostName,
      hostId: this.peerId,
      gameName: options.gameName,
      maxPlayers: options.maxPlayers || 4,
    });

    // Setup host-side WebRTC listeners
    this.setupHostWebRTCListeners();

    this.eventHandlers.onGameCreated(gameState);
    return gameState;
  }

  /**
   * Join an existing game (client)
   */
  public async joinGame(options: JoinGameOptions): Promise<void> {
    
    this.isHost = false;
    
    try {
      await this.connectionStrategyManager.connectToHost({
        hostIP: options.hostIP,
        hostId: options.hostId,
        playerName: options.playerName,
        gameId: options.gameId,
      });
      
      
    } catch (error) {
      this.eventHandlers.onConnectionFailed(error as Error);
      throw error;
    }
  }

  /**
   * Start the game (host only)
   */
  public startGame(): boolean {
    if (!this.isHost) {
      return false;
    }

    return this.gameStateManager.startGame();
  }

  /**
   * End the game
   */
  public endGame(): void {
    
    this.gameStateManager.endGame();
    this.connectionStrategyManager.disconnect();
    this.isHost = false;
  }

  /**
   * Send a message to all connected players
   */
  public broadcastMessage(message: any): void {
    if (this.isHost) {
      // Host broadcasts to all connected clients
      const activePeers = this.webRTCManager.getActivePeerIds();
      activePeers.forEach(peerId => {
        this.webRTCManager.sendMessage(peerId, message);
      });
    } else {
      // Client sends to host
      const gameState = this.gameStateManager.getGameState();
      if (gameState) {
        this.connectionStrategyManager.sendMessage(gameState.hostId, message);
      }
    }
  }

  /**
   * Get current game state
   */
  public getGameState(): P2PGame | null {
    return this.gameStateManager.getGameState();
  }

  /**
   * Get all players
   */
  public getPlayers(): P2PPlayer[] {
    return this.gameStateManager.getPlayers();
  }

  /**
   * Get player count
   */
  public getPlayerCount(): number {
    return this.gameStateManager.getPlayerCount();
  }

  /**
   * Check if game can start
   */
  public canStartGame(): boolean {
    return this.gameStateManager.canStartGame();
  }

  /**
   * Check if this peer is the host
   */
  public isHostPeer(): boolean {
    return this.isHost;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus() {
    return this.connectionStrategyManager.getConnectionStatus();
  }

  /**
   * Setup host-side WebRTC listeners
   */
  private setupHostWebRTCListeners(): void {
    // Host listens for incoming connections
    // This would be set up when a client connects
  }

  /**
   * Handle data channel opening
   */
  private handleDataChannelOpen(peerId: string): void {
    
    if (this.isHost) {
      // Host: Send current game state to new client
      const gameState = this.gameStateManager.getGameState();
      if (gameState) {
        this.webRTCManager.sendMessage(peerId, this.buildMessage('game-state', gameState));
      }
    } else {
      // Client: Send join request to host
      this.webRTCManager.sendMessage(peerId, this.buildMessage('join-request', {
        playerId: this.peerId,
        playerName: 'Player', // This should come from the join options
        gameId: this.gameStateManager.getGameState()?.id || '',
      }));
    }
  }

  /**
   * Handle data channel messages
   */
  private handleDataChannelMessage(message: any, peerId: string): void {
    const normalized = this.normalizeMessage(message);
    if (!normalized) {
      return;
    }

    const { type, payload } = normalized;

    switch (type) {
      case 'join-request':
        this.handleJoinRequest(payload, peerId);
        break;
      case 'game-state':
        this.handleGameStateUpdate(payload);
        break;
      case 'lobby-state-sync':
        this.handleLobbyStateSync(payload);
        break;
      default:
    }
  }

  /**
   * Handle join request (host only)
   */
  private handleJoinRequest(
    payload: { playerId?: string; playerName?: string } | null,
    peerId: string
  ): void {
    if (!this.isHost) {
      return;
    }

    if (!payload || !payload.playerId || !payload.playerName) {
      return;
    }

    
    const player = this.gameStateManager.addPlayer({
      playerId: payload.playerId,
      playerName: payload.playerName,
    });

    if (player) {
      // Send updated game state to all clients
      this.broadcastLobbyState();
    }
  }

  /**
   * Handle game state update (client only)
   */
  private handleGameStateUpdate(gameState: P2PGame): void {
    if (!gameState) {
      return;
    }
    if (this.isHost) {
      return;
    }

    this.gameStateManager.updateGameState(gameState);
  }

  /**
   * Handle lobby state sync (client only)
   */
  private handleLobbyStateSync(lobbyState: any): void {
    if (!lobbyState) {
      return;
    }
    if (this.isHost) {
      return;
    }

    this.gameStateManager.updateGameState(lobbyState);
  }

  /**
   * Broadcast lobby state to all clients (host only)
   */
  private broadcastLobbyState(): void {
    if (!this.isHost) {
      return;
    }

    const gameState = this.gameStateManager.getGameState();
    if (!gameState) {
      return;
    }

    const lobbyState = {
      ...gameState,
      players: this.gameStateManager.getPlayers(),
    };

    this.webRTCManager.sendMessage('broadcast', this.buildMessage('lobby-state-sync', lobbyState));
  }

  private buildMessage(type: string, payload?: any): any {
    const message: any = {
      type,
      payload,
      timestamp: Date.now(),
    };

    if (type === 'game-state') {
      message.gameState = payload;
    }
    if (type === 'lobby-state-sync') {
      message.lobbyState = payload;
    }
    if (type === 'join-request' && payload) {
      message.playerId = payload.playerId;
      message.playerName = payload.playerName;
      message.gameId = payload.gameId;
    }

    return message;
  }

  private normalizeMessage(message: any): { type: string; payload: any; timestamp?: number } | null {
    if (!message || typeof message !== 'object') {
      return null;
    }

    const type = message.type;
    if (!type) {
      return null;
    }

    let payload = message.payload;
    if (payload == null) {
      switch (type) {
        case 'game-state':
          payload = message.gameState;
          break;
        case 'lobby-state-sync':
          payload = message.lobbyState;
          break;
        case 'join-request':
          payload = {
            playerId: message.playerId,
            playerName: message.playerName,
            gameId: message.gameId,
          };
          break;
        default:
          break;
      }
    }

    const timestamp = message.timestamp ?? payload?.timestamp;
    return { type, payload, timestamp };
  }

  /**
   * Add a player to the game (host only)
   */
  public addPlayer(playerId: string, playerName: string): P2PPlayer | null {
    if (!this.isHost) {
      return null;
    }

    
    const player = this.gameStateManager.addPlayer({
      playerId,
      playerName,
    });

    if (player) {
      this.eventHandlers.onPlayerJoined(player);
      this.broadcastLobbyState();
    }

    return player;
  }

  /**
   * Setup data channel listeners for host
   */
  public setupDataChannelListeners(dataChannel: RTCDataChannel, peerId: string, playerName: string): void {
    if (!this.isHost) {
      return;
    }

    
    this.webRTCManager.setupDataChannelListeners(
      dataChannel,
      peerId,
      playerName,
      (message) => this.handleDataChannelMessage(message, peerId),
      () => console.log(`✅ Coordinator: Data channel opened with ${playerName}`),
      (error) => console.error(`❌ Coordinator: Data channel error with ${playerName}:`, error)
    );
  }
}

