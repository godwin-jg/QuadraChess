import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';
import Zeroconf from 'react-native-zeroconf';

export interface DiscoveredGame {
  id: string;
  name: string;
  hostName: string;
  hostId: string;
  hostIP: string;
  port: number;
  joinCode?: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  timestamp: number;
}

export interface GameService {
  name: string;
  type: string;
  domain: string;
  hostName: string;
  addresses: string[];
  port: number;
  txt: Record<string, string>;
}

class NetworkDiscoveryService {
  private static instance: NetworkDiscoveryService;
  private isSearching: boolean = false;
  private discoveredGames: Map<string, DiscoveredGame> = new Map();
  private gameFoundListeners: ((game: DiscoveredGame) => void)[] = [];
  private gameLostListeners: ((gameId: string) => void)[] = [];
  private serviceFoundListener: any = null;
  private serviceLostListener: any = null;
  private zeroconf: Zeroconf;

  private constructor() {
    this.zeroconf = new Zeroconf();
    this.setupEventListeners();
  }

  public static getInstance(): NetworkDiscoveryService {
    if (!NetworkDiscoveryService.instance) {
      NetworkDiscoveryService.instance = new NetworkDiscoveryService();
    }
    return NetworkDiscoveryService.instance;
  }

  private setupEventListeners(): void {
    // Listen for services found via ServiceDiscovery
    this.serviceFoundListener = ServiceDiscovery.addEventListener('serviceFound', (service: GameService) => {
      console.log('NetworkDiscovery: ServiceDiscovery found service:', service);
      this.handleServiceFound(service);
    });

    // Listen for services lost via ServiceDiscovery
    this.serviceLostListener = ServiceDiscovery.addEventListener('serviceLost', (service: GameService) => {
      console.log('NetworkDiscovery: ServiceDiscovery lost service:', service);
      this.handleServiceLost(service);
    });

    // Also listen for zeroconf events as backup
    this.zeroconf.on('found', (service: any) => {
      // Reduced logging - only log QuadChess games
      if (service.name && service.name.includes("Game")) {
        console.log('NetworkDiscovery: Zeroconf found QuadChess game:', service.name);
      }
    });

    this.zeroconf.on('resolved', (service: any) => {
      // Only log QuadChess games to reduce noise
      if (service.name && service.name.includes("Game")) {
        console.log('NetworkDiscovery: Zeroconf service resolved:', service.name);
        console.log('NetworkDiscovery: Service txt:', service.txt);
      }
      
      // Check if this is a QuadChess game by looking at the TXT record
      const txt = service.txt || {};
      if (txt.gameId && txt.joinCode && txt.hostName) {
        console.log('NetworkDiscovery: Found QuadChess game via TXT record:', service.name);
        
        // Convert zeroconf service format to our format
        const gameService: GameService = {
          name: service.name,
          type: '_quadchess._tcp.', // This is a QuadChess game
          domain: 'local.',
          hostName: service.host,
          addresses: service.addresses,
          port: service.port,
          txt: txt,
        };
        this.handleServiceFound(gameService);
      } else {
        console.log('NetworkDiscovery: Ignoring non-QuadChess service:', service.name);
      }
    });

    this.zeroconf.on('start', () => {
      console.log('NetworkDiscovery: Zeroconf scan started');
    });

    this.zeroconf.on('stop', () => {
      console.log('NetworkDiscovery: Zeroconf scan stopped');
    });
  }

  private handleServiceFound(service: GameService): void {
    // Only handle QuadChess games
    if (service.type !== '_quadchess._tcp.') {
      return;
    }

    console.log('NetworkDiscovery: QuadChess game found:', service.name);

    // Parse game info from TXT record
    const gameInfo = this.parseGameInfo(service);
    
    if (gameInfo) {
      this.discoveredGames.set(gameInfo.id, gameInfo);
      
      // Notify listeners
      this.gameFoundListeners.forEach(listener => {
        listener(gameInfo);
      });
    }
  }

  private handleServiceLost(service: GameService): void {
    // Only handle QuadChess games
    if (service.type !== '_quadchess._tcp.') {
      return;
    }

    console.log('NetworkDiscovery: QuadChess game lost:', service.name);

    // Find and remove the game
    const gameId = this.findGameIdByName(service.name);
    if (gameId) {
      this.discoveredGames.delete(gameId);
      
      // Notify listeners
      this.gameLostListeners.forEach(listener => {
        listener(gameId);
      });
    }
  }

  private parseGameInfo(service: GameService): DiscoveredGame | null {
    try {
      // Extract game info from TXT record
      const txt = service.txt;
      const gameId = txt.gameId || service.name;
      const hostName = txt.hostName || 'Unknown Host';
      const hostId = txt.hostId || 'unknown';
      const joinCode = txt.joinCode;
      const playerCount = parseInt(txt.playerCount || '1');
      const maxPlayers = parseInt(txt.maxPlayers || '4');
      const status = txt.status || 'waiting';
      const timestamp = parseInt(txt.timestamp || '0');

      // Filter out old games (older than 5 minutes)
      const now = Date.now();
      const gameAge = now - timestamp;
      const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
      
      if (gameAge > maxAge) {
        console.log('NetworkDiscovery: Ignoring old game:', service.name, 'age:', Math.round(gameAge / 1000), 'seconds');
        return null;
      }

      // Get the first IPv4 address
      const hostIP = service.addresses.find(addr => 
        addr.includes('.') && !addr.includes(':')
      ) || service.addresses[0];

      return {
        id: gameId,
        name: service.name,
        hostName,
        hostId,
        hostIP,
        port: service.port,
        joinCode,
        playerCount,
        maxPlayers,
        status,
        timestamp,
      };
    } catch (error) {
      console.error('NetworkDiscovery: Error parsing game info:', error);
      return null;
    }
  }

  private findGameIdByName(serviceName: string): string | null {
    for (const [gameId, game] of this.discoveredGames.entries()) {
      if (game.name === serviceName) {
        return gameId;
      }
    }
    return null;
  }

  // Start discovering games on the network
  public async startDiscovery(): Promise<void> {
    if (this.isSearching) {
      console.log('NetworkDiscovery: Already searching for games');
      return;
    }

    try {
      console.log('NetworkDiscovery: Starting discovery for _quadchess._tcp. services');
      
      // Start search with ServiceDiscovery first
      console.log('NetworkDiscovery: Starting ServiceDiscovery search...');
      await ServiceDiscovery.startSearch('quadchess');
      console.log('NetworkDiscovery: ServiceDiscovery search started');
      
      // Wait a bit for ServiceDiscovery to work
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Use only ONE zeroconf scan to avoid conflicts
      console.log('NetworkDiscovery: Starting single Zeroconf scan for _quadchess._tcp...');
      this.zeroconf.scan('_quadchess._tcp', 'tcp', 'local.');
      console.log('NetworkDiscovery: Zeroconf scan started');
      
      this.isSearching = true;
      console.log('NetworkDiscovery: Started searching for QuadChess games (both libraries)');
    } catch (error) {
      console.error('NetworkDiscovery: Failed to start search:', error);
      throw error;
    }
  }

  // Stop discovering games
  public async stopDiscovery(): Promise<void> {
    if (!this.isSearching) {
      console.log('NetworkDiscovery: Not currently searching');
      return;
    }

    try {
      // Stop search with ServiceDiscovery
      await ServiceDiscovery.stopSearch('quadchess');
      
      // Stop search with zeroconf
      this.zeroconf.stop();
      
      this.isSearching = false;
      this.discoveredGames.clear();
      console.log('NetworkDiscovery: Stopped searching for games (both libraries)');
    } catch (error) {
      console.error('NetworkDiscovery: Failed to stop search:', error);
      throw error;
    }
  }

  // Get all discovered games
  public getDiscoveredGames(): DiscoveredGame[] {
    // Clean up old games before returning
    this.cleanupOldGames();
    return Array.from(this.discoveredGames.values());
  }

  // Clean up games older than 5 minutes
  private cleanupOldGames(): void {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes in milliseconds
    
    for (const [gameId, game] of this.discoveredGames.entries()) {
      const gameAge = now - game.timestamp;
      if (gameAge > maxAge) {
        console.log('NetworkDiscovery: Removing old game from discovered list:', game.name, 'age:', Math.round(gameAge / 1000), 'seconds');
        this.discoveredGames.delete(gameId);
      }
    }
  }

  // Debug method to get all discovered services (not just games)
  public getAllDiscoveredServices(): any[] {
    // This would require storing all services, not just games
    // For now, let's just return the games
    return Array.from(this.discoveredGames.values());
  }

  // Test method to scan for our own test services
  public async testDiscovery(): Promise<void> {
    try {
      console.log('NetworkDiscovery: Testing discovery with HTTP services...');
      this.zeroconf.scan('_http._tcp', 'tcp', 'local.');
      
      // Wait and see if we find anything
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      console.log('NetworkDiscovery: Test discovery completed');
    } catch (error) {
      console.error('NetworkDiscovery: Test discovery failed:', error);
    }
  }

  // Add listener for when games are found
  public onGameFound(listener: (game: DiscoveredGame) => void): () => void {
    this.gameFoundListeners.push(listener);
    
    return () => {
      const index = this.gameFoundListeners.indexOf(listener);
      if (index > -1) {
        this.gameFoundListeners.splice(index, 1);
      }
    };
  }

  // Add listener for when games are lost
  public onGameLost(listener: (gameId: string) => void): () => void {
    this.gameLostListeners.push(listener);
    
    return () => {
      const index = this.gameLostListeners.indexOf(listener);
      if (index > -1) {
        this.gameLostListeners.splice(index, 1);
      }
    };
  }

  // Clean up
  public cleanup(): void {
    if (this.serviceFoundListener) {
      this.serviceFoundListener.remove();
    }
    if (this.serviceLostListener) {
      this.serviceLostListener.remove();
    }
    this.gameFoundListeners = [];
    this.gameLostListeners = [];
  }
}

export default NetworkDiscoveryService.getInstance();
