import * as ServiceDiscovery from '@inthepocket/react-native-service-discovery';
import Zeroconf from 'react-native-zeroconf';
import { NetworkInterfaceService, NetworkInterface } from './networkInterfaceService';

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
  private networkInterfaceService: any;
  private activeScans: Set<string> = new Set();
  private networkChangeListener: (() => void) | null = null;

  private constructor() {
    this.zeroconf = new Zeroconf();
    this.networkInterfaceService = NetworkInterfaceService.getInstance();
    // Event listeners and network monitoring will be set up when needed
    // this.setupEventListeners();
    // this.setupNetworkMonitoring();
  }

  public static getInstance(): NetworkDiscoveryService {
    if (!NetworkDiscoveryService.instance) {
      NetworkDiscoveryService.instance = new NetworkDiscoveryService();
    }
    return NetworkDiscoveryService.instance;
  }

  // Initialize network monitoring when needed (lazy initialization)
  public async initializeIfNeeded(): Promise<void> {
    if (!this.serviceFoundListener) {
      await this.networkInterfaceService.initializeIfNeeded();
      this.setupEventListeners();
      this.setupNetworkMonitoring();
    }
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

  private setupNetworkMonitoring(): void {
    // Listen for network changes to restart discovery on new interfaces
    this.networkChangeListener = this.networkInterfaceService.onNetworkChange((networkInfo: any) => {
      console.log('NetworkDiscovery: Network changed, restarting discovery if active');
      if (this.isSearching) {
        this.restartDiscoveryOnNewInterfaces();
      }
    });
  }

  private async restartDiscoveryOnNewInterfaces(): Promise<void> {
    try {
      console.log('NetworkDiscovery: Restarting discovery on new network interfaces');
      
      // Stop current scans
      await this.stopCurrentScans();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start new scans on all available interfaces
      await this.startMultiInterfaceDiscovery();
    } catch (error) {
      console.error('NetworkDiscovery: Error restarting discovery:', error);
    }
  }

  private async stopCurrentScans(): Promise<void> {
    try {
      // Stop ServiceDiscovery
      await ServiceDiscovery.stopSearch('quadchess');
      
      // Stop zeroconf scans
      this.zeroconf.stop();
      
      // Clear active scans
      this.activeScans.clear();
      
      console.log('NetworkDiscovery: Stopped current scans');
    } catch (error) {
      console.error('NetworkDiscovery: Error stopping current scans:', error);
    }
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
      const maxAge = 10 * 60 * 1000; // 10 minutes in milliseconds (increased from 5 minutes)
      
      if (gameAge > maxAge) {
        console.log('NetworkDiscovery: Ignoring very old game:', service.name, 'age:', Math.round(gameAge / 1000), 'seconds');
        return null;
      }
      
      // Log if game is getting old but still show it
      if (gameAge > 5 * 60 * 1000) {
        console.log('NetworkDiscovery: Game is getting old but still showing:', service.name, 'age:', Math.round(gameAge / 1000), 'seconds');
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
    for (const [gameId, game] of Array.from(this.discoveredGames.entries())) {
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

    // Initialize network monitoring if not already done
    await this.initializeIfNeeded();

    try {
      console.log('NetworkDiscovery: Starting multi-interface discovery for _quadchess._tcp. services');
      
      // Get available network interfaces including hotspots
      const interfaces = await this.networkInterfaceService.getBestInterfaceForDiscovery();
      console.log('NetworkDiscovery: Found', interfaces.length, 'network interfaces for discovery');
      
      // Log interface summary
      const interfaceSummary = interfaces.map((iface: any) => `${iface.type}(${iface.address})`).join(', ');
      console.log(`🔍 DISCOVERY: Scanning on ${interfaces.length} interfaces: ${interfaceSummary}`);

      // Start multi-interface discovery
      await this.startMultiInterfaceDiscovery();
      
      this.isSearching = true;
      console.log('NetworkDiscovery: Started multi-interface discovery for QuadChess games');
    } catch (error) {
      console.error('NetworkDiscovery: Failed to start search:', error);
      throw error;
    }
  }

  private async startMultiInterfaceDiscovery(): Promise<void> {
    try {
      // Start search with ServiceDiscovery first
      console.log('NetworkDiscovery: Starting ServiceDiscovery search...');
      await ServiceDiscovery.startSearch('quadchess');
      console.log('NetworkDiscovery: ServiceDiscovery search started');
      
      // Wait a bit for ServiceDiscovery to work
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start zeroconf scans on all available interfaces
      const interfaces = await this.networkInterfaceService.getBestInterfaceForDiscovery();
      
      for (const iface of interfaces) {
        if (iface.isConnected && iface.family === 'IPv4') {
          const scanKey = `${iface.name}-${iface.address}`;
          
          if (!this.activeScans.has(scanKey)) {
            console.log(`NetworkDiscovery: Starting Zeroconf scan on ${iface.name} (${iface.address})`);
            
            try {
              // Scan on the specific interface
              this.zeroconf.scan('_quadchess._tcp', 'tcp', 'local.');
              this.activeScans.add(scanKey);
              
              console.log(`NetworkDiscovery: Zeroconf scan started on ${iface.name}`);
            } catch (scanError) {
              console.error(`NetworkDiscovery: Failed to start scan on ${iface.name}:`, scanError);
            }
          } else {
            console.log(`NetworkDiscovery: Scan already active on ${iface.name}`);
          }
        }
      }
      
      console.log('NetworkDiscovery: Multi-interface discovery started on', this.activeScans.size, 'interfaces');
    } catch (error) {
      console.error('NetworkDiscovery: Failed to start multi-interface discovery:', error);
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
      // Stop all current scans
      await this.stopCurrentScans();
      
      this.isSearching = false;
      this.discoveredGames.clear();
      console.log('NetworkDiscovery: Stopped multi-interface discovery for games');
    } catch (error) {
      console.error('NetworkDiscovery: Failed to stop search:', error);
      throw error;
    }
  }

  // Get all discovered games
  public getDiscoveredGames(): DiscoveredGame[] {
    console.log('NetworkDiscovery: getDiscoveredGames called, current games in map:', this.discoveredGames.size);
    
    // Clean up old games before returning
    this.cleanupOldGames();
    
    const games = Array.from(this.discoveredGames.values());
    console.log('NetworkDiscovery: Returning', games.length, 'games after cleanup');
    
    return games;
  }

  // Clean up games older than 10 minutes
  private cleanupOldGames(): void {
    const now = Date.now();
    const maxAge = 10 * 60 * 1000; // 10 minutes in milliseconds
    
    console.log('NetworkDiscovery: Cleaning up old games, current count:', this.discoveredGames.size);
    
    for (const [gameId, game] of Array.from(this.discoveredGames.entries())) {
      const gameAge = now - game.timestamp;
      console.log('NetworkDiscovery: Checking game:', game.name, 'age:', Math.round(gameAge / 1000), 'seconds');
      
      if (gameAge > maxAge) {
        console.log('NetworkDiscovery: Removing old game from discovered list:', game.name, 'age:', Math.round(gameAge / 1000), 'seconds');
        this.discoveredGames.delete(gameId);
      }
    }
    
    console.log('NetworkDiscovery: After cleanup, remaining games:', this.discoveredGames.size);
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
    if (this.networkChangeListener) {
      this.networkChangeListener();
    }
    this.gameFoundListeners = [];
    this.gameLostListeners = [];
    this.activeScans.clear();
  }
}

export default NetworkDiscoveryService.getInstance();
