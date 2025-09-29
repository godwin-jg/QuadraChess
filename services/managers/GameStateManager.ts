import { P2PGame, P2PPlayer } from '../../types';

export interface GameStateEvents {
  onGameStateUpdate: (gameState: P2PGame) => void;
  onPlayerJoined: (player: P2PPlayer) => void;
  onPlayerLeft: (playerId: string) => void;
  onGameStarted: (gameState: P2PGame) => void;
}

export class GameStateManager {
  private gameState: P2PGame | null = null;
  private players: Map<string, P2PPlayer> = new Map();
  private eventHandlers: GameStateEvents;
  private isHost: boolean = false;

  constructor(eventHandlers: GameStateEvents) {
    this.eventHandlers = eventHandlers;
  }

  /**
   * Initialize game state for host
   */
  public initializeHostGame(gameInfo: {
    hostName: string;
    hostId: string;
    gameName: string;
    maxPlayers: number;
  }): P2PGame {
    console.log(`🎮 GameStateManager: Initializing host game: ${gameInfo.gameName}`);
    
    const gameState: P2PGame = {
      id: this.generateGameId(),
      name: gameInfo.gameName,
      hostId: gameInfo.hostId,
      hostName: gameInfo.hostName,
      hostIP: '', // Will be set by network manager
      port: 3001,
      maxPlayers: gameInfo.maxPlayers,
      playerCount: 1,
      status: 'waiting',
      createdAt: Date.now(),
    };

    // Add host as first player
    const hostPlayer: P2PPlayer = {
      id: gameInfo.hostId,
      name: gameInfo.hostName,
      isHost: true,
      isConnected: true,
      color: 'r', // Host always gets red color
      joinedAt: Date.now(),
    };

    this.gameState = gameState;
    this.players.set(gameInfo.hostId, hostPlayer);
    this.isHost = true;

    this.eventHandlers.onGameStateUpdate(gameState);
    this.eventHandlers.onPlayerJoined(hostPlayer);

    return gameState;
  }

  /**
   * Add a player to the game (host only)
   */
  public addPlayer(playerInfo: {
    playerId: string;
    playerName: string;
    isHost?: boolean;
  }): P2PPlayer | null {
    if (!this.isHost || !this.gameState) {
      console.warn('🎮 GameStateManager: Cannot add player - not host or no game state');
      return null;
    }

    if (this.players.has(playerInfo.playerId)) {
      console.log(`🎮 GameStateManager: Player ${playerInfo.playerName} already exists`);
      return this.players.get(playerInfo.playerId)!;
    }

    if (this.gameState.playerCount >= this.gameState.maxPlayers) {
      console.warn('🎮 GameStateManager: Cannot add player - game is full');
      return null;
    }

    // Assign color based on player count
    const colors = ['r', 'b', 'g', 'y'];
    const color = colors[this.gameState.playerCount % colors.length];

    const player: P2PPlayer = {
      id: playerInfo.playerId,
      name: playerInfo.playerName,
      isHost: playerInfo.isHost || false,
      isConnected: true,
      color: color,
      joinedAt: Date.now(),
    };

    this.players.set(playerInfo.playerId, player);
    this.gameState.playerCount = this.players.size;

    console.log(`🎮 GameStateManager: Added player ${playerInfo.playerName} (${color})`);
    
    this.eventHandlers.onPlayerJoined(player);
    this.eventHandlers.onGameStateUpdate(this.gameState);

    return player;
  }

  /**
   * Remove a player from the game
   */
  public removePlayer(playerId: string): void {
    if (!this.gameState) {
      return;
    }

    const player = this.players.get(playerId);
    if (!player) {
      return;
    }

    console.log(`🎮 GameStateManager: Removing player ${player.name}`);
    
    this.players.delete(playerId);
    this.gameState.playerCount = this.players.size;

    // If host left, end the game
    if (player.isHost) {
      this.endGame();
      return;
    }

    this.eventHandlers.onPlayerLeft(playerId);
    this.eventHandlers.onGameStateUpdate(this.gameState);
  }

  /**
   * Start the game
   */
  public startGame(): boolean {
    if (!this.isHost || !this.gameState) {
      console.warn('🎮 GameStateManager: Cannot start game - not host or no game state');
      return false;
    }

    if (this.gameState.playerCount < 2) {
      console.warn('🎮 GameStateManager: Cannot start game - need at least 2 players');
      return false;
    }

    console.log(`🎮 GameStateManager: Starting game with ${this.gameState.playerCount} players`);
    
    this.gameState.status = 'playing';
    this.gameState.startedAt = Date.now();

    this.eventHandlers.onGameStarted(this.gameState);
    this.eventHandlers.onGameStateUpdate(this.gameState);

    return true;
  }

  /**
   * End the game
   */
  public endGame(): void {
    console.log('🎮 GameStateManager: Ending game');
    
    if (this.gameState) {
      this.gameState.status = 'ended';
      this.gameState.endedAt = Date.now();
    }

    this.players.clear();
    this.gameState = null;
    this.isHost = false;
  }

  /**
   * Update game state (for client)
   */
  public updateGameState(gameState: P2PGame): void {
    console.log('🎮 GameStateManager: Updating game state from host');
    
    this.gameState = gameState;
    
    // Update players map from game state
    if (gameState.players) {
      this.players.clear();
      gameState.players.forEach(player => {
        this.players.set(player.id, player);
      });
    }

    this.eventHandlers.onGameStateUpdate(gameState);
  }

  /**
   * Get current game state
   */
  public getGameState(): P2PGame | null {
    return this.gameState;
  }

  /**
   * Get all players
   */
  public getPlayers(): P2PPlayer[] {
    return Array.from(this.players.values());
  }

  /**
   * Get player by ID
   */
  public getPlayer(playerId: string): P2PPlayer | null {
    return this.players.get(playerId) || null;
  }

  /**
   * Check if game can start
   */
  public canStartGame(): boolean {
    return this.gameState ? this.gameState.playerCount >= 2 : false;
  }

  /**
   * Check if player is host
   */
  public isPlayerHost(playerId: string): boolean {
    const player = this.players.get(playerId);
    return player ? player.isHost : false;
  }

  /**
   * Get player count
   */
  public getPlayerCount(): number {
    return this.players.size;
  }

  /**
   * Check if game is active
   */
  public isGameActive(): boolean {
    return this.gameState ? this.gameState.status === 'playing' : false;
  }

  /**
   * Check if game is waiting for players
   */
  public isGameWaiting(): boolean {
    return this.gameState ? this.gameState.status === 'waiting' : false;
  }

  /**
   * Generate unique game ID
   */
  private generateGameId(): string {
    return `game-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

}

