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
          console.log(`🔗 Coordinator: WebRTC connection state: ${state}`);
        },
        onDataChannelOpen: (dataChannel, peerId) => {
          console.log(`🔗 Coordinator: Data channel opened with ${peerId}`);
          this.handleDataChannelOpen(peerId);
        },
        onDataChannelMessage: (message, peerId) => {
          this.handleDataChannelMessage(message, peerId);
        },
        onIceCandidate: (candidate) => {
          console.log(`🔗 Coordinator: ICE candidate generated`);
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
          console.log(`🔗 Coordinator: WebRTC connection established with ${peerId}`);
          this.eventHandlers.onConnectionEstablished('webrtc');
        },
        onWebRTCConnectionFailed: (error) => {
          console.log(`🔗 Coordinator: WebRTC connection failed:`, error);
        },
        onHTTPFallbackActivated: (hostIP) => {
          console.log(`🔄 Coordinator: HTTP fallback activated for ${hostIP}`);
          this.eventHandlers.onConnectionEstablished('http');
        },
        onGameStateReceived: (gameState) => {
          console.log(`🔄 Coordinator: Game state received via HTTP`);
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
    console.log(`🎮 Coordinator: Creating game: ${options.gameName}`);
    
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
    console.log(`🎮 Coordinator: Joining game at ${options.hostIP}`);
    
    this.isHost = false;
    
    try {
      await this.connectionStrategyManager.connectToHost({
        hostIP: options.hostIP,
        hostId: options.hostId,
        playerName: options.playerName,
        gameId: options.gameId,
      });
      
      console.log(`🎮 Coordinator: Successfully joined game`);
      
    } catch (error) {
      console.error(`🎮 Coordinator: Failed to join game:`, error);
      this.eventHandlers.onConnectionFailed(error as Error);
      throw error;
    }
  }

  /**
   * Start the game (host only)
   */
  public startGame(): boolean {
    if (!this.isHost) {
      console.warn('🎮 Coordinator: Only host can start the game');
      return false;
    }

    return this.gameStateManager.startGame();
  }

  /**
   * End the game
   */
  public endGame(): void {
    console.log('🎮 Coordinator: Ending game');
    
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
    console.log(`🔗 Coordinator: Data channel opened with ${peerId}`);
    
    if (this.isHost) {
      // Host: Send current game state to new client
      const gameState = this.gameStateManager.getGameState();
      if (gameState) {
        this.webRTCManager.sendMessage(peerId, {
          type: 'game-state',
          gameState: gameState,
        });
      }
    } else {
      // Client: Send join request to host
      this.webRTCManager.sendMessage(peerId, {
        type: 'join-request',
        playerId: this.peerId,
        playerName: 'Player', // This should come from the join options
        gameId: this.gameStateManager.getGameState()?.id || '',
      });
    }
  }

  /**
   * Handle data channel messages
   */
  private handleDataChannelMessage(message: any, peerId: string): void {
    console.log(`📥 Coordinator: Received message from ${peerId}:`, message.type);
    
    switch (message.type) {
      case 'join-request':
        this.handleJoinRequest(message, peerId);
        break;
      case 'game-state':
        this.handleGameStateUpdate(message.gameState);
        break;
      case 'lobby-state-sync':
        this.handleLobbyStateSync(message.lobbyState);
        break;
      default:
        console.warn(`📥 Coordinator: Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle join request (host only)
   */
  private handleJoinRequest(message: any, peerId: string): void {
    if (!this.isHost) {
      return;
    }

    console.log(`📥 Coordinator: Handling join request from ${message.playerName}`);
    
    const player = this.gameStateManager.addPlayer({
      playerId: message.playerId,
      playerName: message.playerName,
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
    if (this.isHost) {
      return;
    }

    console.log(`📥 Coordinator: Updating game state from host`);
    this.gameStateManager.updateGameState(gameState);
  }

  /**
   * Handle lobby state sync (client only)
   */
  private handleLobbyStateSync(lobbyState: any): void {
    if (this.isHost) {
      return;
    }

    console.log(`📥 Coordinator: Syncing lobby state from host`);
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

    this.webRTCManager.sendMessage('broadcast', {
      type: 'lobby-state-sync',
      lobbyState: lobbyState,
    });
  }

  /**
   * Add a player to the game (host only)
   */
  public addPlayer(playerId: string, playerName: string): P2PPlayer | null {
    if (!this.isHost) {
      console.warn('📥 Coordinator: Only host can add players');
      return null;
    }

    console.log(`📥 Coordinator: Adding player ${playerName} (${playerId})`);
    
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
      console.warn('📥 Coordinator: Only host can setup data channel listeners');
      return;
    }

    console.log(`📥 Coordinator: Setting up data channel listeners for ${playerName}`);
    
    this.webRTCManager.setupDataChannelListeners(
      dataChannel,
      peerId,
      playerName,
      (message) => this.handleDataChannelMessage(message, peerId),
      () => console.log(`✅ Coordinator: Data channel opened with ${playerName}`),
      () => console.log(`🔌 Coordinator: Data channel closed with ${playerName}`),
      (error) => console.error(`❌ Coordinator: Data channel error with ${playerName}:`, error)
    );
  }
}

