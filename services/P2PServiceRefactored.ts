import { P2PGameCoordinator, P2PGameCoordinatorEvents } from './managers/P2PGameCoordinator';
import { P2PGame, P2PPlayer } from '../types';
import { store } from '../state/store';
import { syncP2PGameState, setPlayers, setConnectionError, setIsDiscovering, setIsLoading } from '../state/gameSlice';
import networkDiscoveryService from './networkDiscoveryService';
import serverlessSignalingService from './serverlessSignalingService';

/**
 * Refactored P2P Service - Clean, modular architecture
 * 
 * This service now acts as a thin wrapper around the P2PGameCoordinator,
 * handling Redux integration and providing a simple API for the UI.
 */
export class P2PServiceRefactored {
  private coordinator: P2PGameCoordinator;
  private static instance: P2PServiceRefactored;

  private constructor() {
    this.coordinator = new P2PGameCoordinator({
      onGameCreated: this.handleGameCreated.bind(this),
      onGameJoined: this.handleGameJoined.bind(this),
      onPlayerJoined: this.handlePlayerJoined.bind(this),
      onPlayerLeft: this.handlePlayerLeft.bind(this),
      onGameStateUpdate: this.handleGameStateUpdate.bind(this),
      onConnectionEstablished: this.handleConnectionEstablished.bind(this),
      onConnectionFailed: this.handleConnectionFailed.bind(this),
      onGameStarted: this.handleGameStarted.bind(this),
    });
  }

  public static getInstance(): P2PServiceRefactored {
    if (!P2PServiceRefactored.instance) {
      P2PServiceRefactored.instance = new P2PServiceRefactored();
    }
    return P2PServiceRefactored.instance;
  }

  /**
   * Create a new game (host)
   */
  public async createGame(hostName: string, gameName?: string): Promise<P2PGame> {
    console.log(`🎮 P2PService: Creating game: ${gameName || `${hostName}'s Game`}`);
    
    const game = await this.coordinator.createGame({
      hostName,
      gameName: gameName || `${hostName}'s Game`,
      maxPlayers: 4,
    });

    return game;
  }

  /**
   * Join an existing game (client)
   */
  public async joinGame(hostIP: string, hostId: string, playerName: string, gameId: string): Promise<void> {
    console.log(`🎮 P2PService: Joining game at ${hostIP}`);
    
    await this.coordinator.joinGame({
      hostIP,
      hostId,
      playerName,
      gameId,
    });
  }

  /**
   * Start the game (host only)
   */
  public startGame(): boolean {
    return this.coordinator.startGame();
  }

  /**
   * End the game
   */
  public endGame(): void {
    this.coordinator.endGame();
  }

  /**
   * Disconnect from current game
   */
  public async disconnect(): Promise<void> {
    console.log('🎮 P2PService: Disconnecting from game');
    this.coordinator.endGame();
  }

  /**
   * Get current game state
   */
  public getGameState(): P2PGame | null {
    return this.coordinator.getGameState();
  }

  /**
   * Get all players
   */
  public getPlayers(): P2PPlayer[] {
    return this.coordinator.getPlayers();
  }

  /**
   * Get player count
   */
  public getPlayerCount(): number {
    return this.coordinator.getPlayerCount();
  }

  /**
   * Check if game can start
   */
  public canStartGame(): boolean {
    return this.coordinator.canStartGame();
  }

  /**
   * Check if this peer is the host
   */
  public isHost(): boolean {
    return this.coordinator.isHostPeer();
  }

  /**
   * Get connection status
   */
  public getConnectionStatus() {
    return this.coordinator.getConnectionStatus();
  }

  /**
   * Send a message to all connected players
   */
  public sendMessage(message: any): void {
    this.coordinator.broadcastMessage(message);
  }

  // Event Handlers - Bridge between coordinator and Redux

  private handleGameCreated(game: P2PGame): void {
    console.log(`🎮 P2PService: Game created: ${game.name}`);
    
    store.dispatch(syncP2PGameState({
      currentGame: game,
      players: this.coordinator.getPlayers(),
      playerCount: game.playerCount,
      canStartGame: this.coordinator.canStartGame(),
      isConnected: true,
      isHost: true,
      connectionError: null,
    }));
  }

  private handleGameJoined(game: P2PGame): void {
    console.log(`🎮 P2PService: Game joined: ${game.name}`);
    
    store.dispatch(syncP2PGameState({
      currentGame: game,
      players: this.coordinator.getPlayers(),
      playerCount: game.playerCount,
      canStartGame: this.coordinator.canStartGame(),
      isConnected: true,
      isHost: false,
      connectionError: null,
    }));
  }

  private handlePlayerJoined(player: P2PPlayer): void {
    console.log(`🎮 P2PService: Player joined: ${player.name}`);
    
    const currentState = store.getState().game;
    store.dispatch(setPlayers(this.coordinator.getPlayers()));
    
    if (currentState.currentGame) {
      store.dispatch(syncP2PGameState({
        ...currentState,
        players: this.coordinator.getPlayers(),
        playerCount: this.coordinator.getPlayerCount(),
        canStartGame: this.coordinator.canStartGame(),
      }));
    }
  }

  private handlePlayerLeft(playerId: string): void {
    console.log(`🎮 P2PService: Player left: ${playerId}`);
    
    const currentState = store.getState().game;
    store.dispatch(setPlayers(this.coordinator.getPlayers()));
    
    if (currentState.currentGame) {
      store.dispatch(syncP2PGameState({
        ...currentState,
        players: this.coordinator.getPlayers(),
        playerCount: this.coordinator.getPlayerCount(),
        canStartGame: this.coordinator.canStartGame(),
      }));
    }
  }

  private handleGameStateUpdate(gameState: P2PGame): void {
    console.log(`🎮 P2PService: Game state updated`);
    
    const currentState = store.getState().game;
    store.dispatch(syncP2PGameState({
      ...currentState,
      currentGame: gameState,
      players: this.coordinator.getPlayers(),
      playerCount: gameState.playerCount,
      canStartGame: this.coordinator.canStartGame(),
    }));
  }

  private handleConnectionEstablished(connectionType: 'webrtc' | 'http'): void {
    console.log(`🎮 P2PService: Connection established via ${connectionType}`);
    
    const currentState = store.getState().game;
    store.dispatch(syncP2PGameState({
      ...currentState,
      isConnected: true,
      connectionError: null,
    }));
  }

  private handleConnectionFailed(error: Error): void {
    console.error(`🎮 P2PService: Connection failed:`, error);
    
    store.dispatch(setConnectionError(error.message));
  }

  private handleGameStarted(gameState: P2PGame): void {
    console.log(`🎮 P2PService: Game started`);
    
    const currentState = store.getState().game;
    store.dispatch(syncP2PGameState({
      ...currentState,
      currentGame: gameState,
      players: this.coordinator.getPlayers(),
      playerCount: gameState.playerCount,
      canStartGame: false, // Game has started
    }));
  }

  // Additional methods required by existing codebase
  public async discoverGames(): Promise<any[]> {
    console.log("P2PServiceRefactored: Discovering games on network");
    store.dispatch(setIsDiscovering(true));
    store.dispatch(setConnectionError(null));
    
    try {
      await networkDiscoveryService.startDiscovery();
      store.dispatch(setIsDiscovering(false));
      return []; // Return empty array for now - discovery results are handled via Redux
    } catch (error) {
      console.error("P2PServiceRefactored: Error discovering games:", error);
      store.dispatch(setIsDiscovering(false));
      store.dispatch(setConnectionError("Failed to discover games"));
      return [];
    }
  }

  public async joinDiscoveredGame(gameId: string, playerName: string): Promise<void> {
    console.log("P2PServiceRefactored: Joining discovered game:", gameId);
    store.dispatch(setIsLoading(true));
    
    try {
      // Use the coordinator's joinGame method - we need to extract host info from gameId
      // For now, we'll use a simplified approach
      await this.coordinator.joinGame({
        hostIP: gameId, // This might need adjustment based on how gameId is structured
        hostId: gameId,
        playerName,
        gameId,
      });
      store.dispatch(setIsLoading(false));
    } catch (error) {
      console.error("P2PServiceRefactored: Error joining discovered game:", error);
      store.dispatch(setIsLoading(false));
      store.dispatch(setConnectionError("Failed to join game"));
      throw error;
    }
  }

  public sendGameStarted(gameId?: string): void {
    console.log("P2PServiceRefactored: Sending game started signal");
    this.coordinator.startGame();
  }

  public addPlayer(playerId: string, playerName: string): void {
    console.log("P2PServiceRefactored: Adding player:", playerId, playerName);
    // This will be handled by the coordinator's event system
    this.coordinator.addPlayer(playerId, playerName);
  }

  public createConnectionForPlayer(playerId: string): any {
    console.log("P2PServiceRefactored: Creating connection for player:", playerId);
    return serverlessSignalingService.getConnection(playerId);
  }

  public setupHostDataChannelListeners(dataChannel: RTCDataChannel, peerId: string, playerName: string): void {
    console.log("P2PServiceRefactored: Setting up host data channel listeners for:", playerName);
    // This will be handled by the coordinator's WebRTC manager
    this.coordinator.setupDataChannelListeners(dataChannel, peerId, playerName);
  }
}

// Export singleton instance
export default P2PServiceRefactored.getInstance();
