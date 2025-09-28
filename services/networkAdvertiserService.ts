import { Platform } from 'react-native';
import Zeroconf from 'react-native-zeroconf';

export interface GameAdvertisement {
  gameId: string;
  gameName: string;
  hostName: string;
  hostId: string;
  hostIP: string;
  port: number;
  joinCode?: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
  timestamp: number; // Unix timestamp when the game was created
}

class NetworkAdvertiserService {
  private static instance: NetworkAdvertiserService;
  private isAdvertising: boolean = false;
  private currentAdvertisement: GameAdvertisement | null = null;
  private zeroconf: Zeroconf;

  private constructor() {
    try {
      console.log('NetworkAdvertiser: Initializing Zeroconf...');
      this.zeroconf = new Zeroconf();
      console.log('NetworkAdvertiser: Zeroconf initialized successfully');
    } catch (error) {
      console.error('NetworkAdvertiser: Failed to initialize Zeroconf:', error);
      throw error;
    }
  }

  public static getInstance(): NetworkAdvertiserService {
    if (!NetworkAdvertiserService.instance) {
      NetworkAdvertiserService.instance = new NetworkAdvertiserService();
    }
    return NetworkAdvertiserService.instance;
  }

  // Start advertising a game on the network
  public async startAdvertising(gameInfo: GameAdvertisement): Promise<void> {
    if (this.isAdvertising) {
      console.log('NetworkAdvertiser: Already advertising a game, stopping previous one first');
      await this.stopAdvertising();
    }

    try {
      this.currentAdvertisement = gameInfo;
      this.isAdvertising = true;

      console.log('NetworkAdvertiser: Started advertising game:', gameInfo.gameName);
      console.log('NetworkAdvertiser: Game details:', {
        id: gameInfo.gameId,
        name: gameInfo.gameName,
        host: gameInfo.hostName,
        ip: gameInfo.hostIP,
        port: gameInfo.port,
        joinCode: gameInfo.joinCode,
        players: `${gameInfo.playerCount}/${gameInfo.maxPlayers}`,
        status: gameInfo.status,
      });

      // Use real zeroconf to advertise the service
      await this.registerMDNSService(gameInfo);

    } catch (error) {
      console.error('NetworkAdvertiser: Failed to start advertising:', error);
      throw error;
    }
  }

  // Stop advertising the current game
  public async stopAdvertising(): Promise<void> {
    if (!this.isAdvertising) {
      console.log('NetworkAdvertiser: Not currently advertising');
      return;
    }

    try {
      // In real implementation, this would unregister the mDNS service
      await this.unregisterMDNSService();

      this.isAdvertising = false;
      this.currentAdvertisement = null;

      console.log('NetworkAdvertiser: Stopped advertising game');
    } catch (error) {
      console.error('NetworkAdvertiser: Failed to stop advertising:', error);
      throw error;
    }
  }

  // Update the current advertisement (e.g., player count changes)
  public async updateAdvertisement(updates: Partial<GameAdvertisement>): Promise<void> {
    if (!this.isAdvertising || !this.currentAdvertisement) {
      console.log('NetworkAdvertiser: No active advertisement to update');
      return;
    }

    try {
      // Update the advertisement
      this.currentAdvertisement = {
        ...this.currentAdvertisement,
        ...updates,
      };

      console.log('NetworkAdvertiser: Updated advertisement:', updates);

      // Re-register the service with updated info
      await this.registerMDNSService(this.currentAdvertisement);

    } catch (error) {
      console.error('NetworkAdvertiser: Failed to update advertisement:', error);
      throw error;
    }
  }

  // Get current advertisement info
  public getCurrentAdvertisement(): GameAdvertisement | null {
    return this.currentAdvertisement;
  }

  // Check if currently advertising
  public isCurrentlyAdvertising(): boolean {
    return this.isAdvertising;
  }

  // Register mDNS service using zeroconf
  private async registerMDNSService(gameInfo: GameAdvertisement): Promise<void> {
    try {
      console.log('NetworkAdvertiser: Registering mDNS service with zeroconf');
      console.log('NetworkAdvertiser: Service type: _quadchess._tcp.');
      console.log('NetworkAdvertiser: Service name:', gameInfo.gameName);
      console.log('NetworkAdvertiser: Port:', gameInfo.port);
      console.log('NetworkAdvertiser: Domain: local.');
      
      const txtRecord = {
        gameId: gameInfo.gameId,
        hostName: gameInfo.hostName,
        hostId: gameInfo.hostId,
        joinCode: gameInfo.joinCode || '',
        playerCount: gameInfo.playerCount.toString(),
        maxPlayers: gameInfo.maxPlayers.toString(),
        status: gameInfo.status,
        timestamp: gameInfo.timestamp.toString(),
      };
      
      console.log('NetworkAdvertiser: TXT record:', txtRecord);

      // Use zeroconf to publish the service (correct API format)
      console.log('NetworkAdvertiser: Calling zeroconf.publishService...');
      console.log('NetworkAdvertiser: Zeroconf instance:', this.zeroconf);
      
      try {
        // Use the correct API format - individual parameters, not object
        this.zeroconf.publishService(
          '_quadchess._tcp',  // type
          'tcp',              // protocol
          'local.',           // domain
          gameInfo.gameName,  // name
          gameInfo.port,      // port
          txtRecord           // txt record
        );
        console.log('NetworkAdvertiser: publishService call completed');
      } catch (publishError) {
        console.error('NetworkAdvertiser: publishService failed:', publishError);
        throw publishError;
      }

      console.log('NetworkAdvertiser: mDNS service published successfully');
      console.log('NetworkAdvertiser: Service should now be discoverable on local network');

    } catch (error) {
      console.error('NetworkAdvertiser: Failed to register mDNS service:', error);
      throw error;
    }
  }

  // Unregister mDNS service using zeroconf
  private async unregisterMDNSService(): Promise<void> {
    if (!this.currentAdvertisement) {
      console.log('NetworkAdvertiser: No service to unregister');
      return;
    }

    try {
      console.log('NetworkAdvertiser: Unregistering mDNS service:', this.currentAdvertisement.gameName);
      
      // Use zeroconf to unpublish the service (correct API format)
      this.zeroconf.unpublishService(this.currentAdvertisement.gameName);
      
      console.log('NetworkAdvertiser: mDNS service unregistered successfully');
      
    } catch (error) {
      console.error('NetworkAdvertiser: Failed to unregister mDNS service:', error);
      throw error;
    }
  }

  // Get the local IP address
  public getLocalIPAddress(): string {
    // In a real implementation, you would get the actual local IP
    // For now, we'll return a placeholder
    return '192.168.1.100'; // This would be dynamically determined
  }

  // Get a random port for the game
  public getRandomPort(): number {
    return Math.floor(3000 + Math.random() * 1000);
  }

  // Test method to advertise a simple HTTP service
  public async testAdvertise(): Promise<void> {
    try {
      console.log('NetworkAdvertiser: Testing with simple HTTP service...');
      this.zeroconf.publishService(
        '_http._tcp',     // type
        'tcp',           // protocol
        'local.',        // domain
        'TestService',   // name
        8080,           // port
        { test: 'true' } // txt record
      );
      console.log('NetworkAdvertiser: Test HTTP service published');
    } catch (error) {
      console.error('NetworkAdvertiser: Test publish failed:', error);
    }
  }
}

export default NetworkAdvertiserService.getInstance();
