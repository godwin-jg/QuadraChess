import { Platform } from 'react-native';
import Zeroconf from 'react-native-zeroconf';
import { NetworkInterfaceService, NetworkInterface } from './networkInterfaceService';

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
  private networkInterfaceService: any;
  private activeAdvertisements: Map<string, string> = new Map(); // interface -> service name
  private networkChangeListener: (() => void) | null = null;

  private constructor() {
    try {
      console.log('NetworkAdvertiser: Initializing Zeroconf...');
      this.zeroconf = new Zeroconf();
      this.networkInterfaceService = NetworkInterfaceService.getInstance();
      this.setupNetworkMonitoring();
      console.log('NetworkAdvertiser: Zeroconf initialized successfully');
    } catch (error) {
      console.error('NetworkAdvertiser: Failed to initialize Zeroconf:', error);
      throw error;
    }
  }

  private setupNetworkMonitoring(): void {
    // Listen for network changes to restart advertising on new interfaces
    this.networkChangeListener = this.networkInterfaceService.onNetworkChange((networkInfo: any) => {
      console.log('NetworkAdvertiser: Network changed, restarting advertising if active');
      if (this.isAdvertising && this.currentAdvertisement) {
        this.restartAdvertisingOnNewInterfaces();
      }
    });
  }

  private async restartAdvertisingOnNewInterfaces(): Promise<void> {
    try {
      console.log('NetworkAdvertiser: Restarting advertising on new network interfaces');
      
      // Stop current advertisements
      await this.stopAllAdvertisements();
      
      // Wait a bit for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Start new advertisements on all available interfaces
      if (this.currentAdvertisement) {
        await this.startMultiInterfaceAdvertising(this.currentAdvertisement);
      }
    } catch (error) {
      console.error('NetworkAdvertiser: Error restarting advertising:', error);
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

      console.log('NetworkAdvertiser: Started multi-interface advertising for game:', gameInfo.gameName);
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

      // Start advertising on all available network interfaces
      await this.startMultiInterfaceAdvertising(gameInfo);

    } catch (error) {
      console.error('NetworkAdvertiser: Failed to start advertising:', error);
      throw error;
    }
  }

  private async startMultiInterfaceAdvertising(gameInfo: GameAdvertisement): Promise<void> {
    try {
      // Get available network interfaces including hotspots
      const interfaces = await this.networkInterfaceService.getBestInterfaceForDiscovery();
      console.log('NetworkAdvertiser: Found', interfaces.length, 'network interfaces for advertising');
      
      // Log interface summary
      const interfaceSummary = interfaces.map((iface: any) => `${iface.type}(${iface.address})`).join(', ');
      console.log(`📡 ADVERTISING: Found ${interfaces.length} interfaces: ${interfaceSummary}`);

      // ✅ Smart advertising: Prioritize hotspot interface for hotspot scenarios
      const hotspotInterfaces = interfaces.filter((iface: any) => iface.type === 'hotspot' && iface.isConnected);
      const wifiInterfaces = interfaces.filter((iface: any) => iface.type === 'wifi' && iface.isConnected);
      
      // If we have both hotspot and WiFi, prioritize hotspot for advertising
      const interfacesToAdvertise = hotspotInterfaces.length > 0 ? hotspotInterfaces : interfaces;

      // Advertise on selected interfaces
      for (const iface of interfacesToAdvertise) {
        if (iface.isConnected && iface.family === 'IPv4') {
          const interfaceKey = `${iface.name}-${iface.address}`;
          
          if (!this.activeAdvertisements.has(interfaceKey)) {
            try {
              // Create interface-specific game info
              const interfaceGameInfo = {
                ...gameInfo,
                hostIP: iface.address, // Use interface-specific IP
              };
              
              // Register mDNS service on this interface
              await this.registerMDNSServiceOnInterface(interfaceGameInfo, iface);
              this.activeAdvertisements.set(interfaceKey, gameInfo.gameName);
              
              console.log(`📡 ADVERTISING: ${iface.type.toUpperCase()}(${iface.address}) -> ${gameInfo.gameName}`);
            } catch (advertiseError) {
              console.error(`❌ ADVERTISING FAILED: ${iface.name}`, advertiseError);
            }
          }
        }
      }
      
      console.log('NetworkAdvertiser: Multi-interface advertising started on', this.activeAdvertisements.size, 'interfaces');
    } catch (error) {
      console.error('NetworkAdvertiser: Failed to start multi-interface advertising:', error);
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
      // Stop all advertisements on all interfaces
      await this.stopAllAdvertisements();

      this.isAdvertising = false;
      this.currentAdvertisement = null;

      console.log('NetworkAdvertiser: Stopped multi-interface advertising');
    } catch (error) {
      console.error('NetworkAdvertiser: Failed to stop advertising:', error);
      throw error;
    }
  }

  private async stopAllAdvertisements(): Promise<void> {
    try {
      console.log('NetworkAdvertiser: Stopping all advertisements on', this.activeAdvertisements.size, 'interfaces');
      
      // Stop all active advertisements
      for (const [interfaceKey, serviceName] of Array.from(this.activeAdvertisements.entries())) {
        try {
          console.log(`NetworkAdvertiser: Stopping advertisement on ${interfaceKey}`);
          this.zeroconf.unpublishService(serviceName);
        } catch (error) {
          console.error(`NetworkAdvertiser: Error stopping advertisement on ${interfaceKey}:`, error);
        }
      }
      
      // Clear active advertisements
      this.activeAdvertisements.clear();
      
      console.log('NetworkAdvertiser: All advertisements stopped');
    } catch (error) {
      console.error('NetworkAdvertiser: Error stopping all advertisements:', error);
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

      // Restart advertising with updated info on all interfaces
      await this.startMultiInterfaceAdvertising(this.currentAdvertisement);

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

  // Register mDNS service on a specific interface using zeroconf
  private async registerMDNSServiceOnInterface(gameInfo: GameAdvertisement, iface: NetworkInterface): Promise<void> {
    try {
      console.log(`NetworkAdvertiser: Registering mDNS service on ${iface.name} (${iface.address})`);
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
        interfaceType: iface.type, // Add interface type for debugging
        interfaceName: iface.name,  // Add interface name for debugging
      };
      
      console.log(`NetworkAdvertiser: TXT record for ${iface.name}:`, txtRecord);

      // Use zeroconf to publish the service (correct API format)
      console.log(`NetworkAdvertiser: Calling zeroconf.publishService on ${iface.name}...`);
      
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
        console.log(`NetworkAdvertiser: publishService call completed on ${iface.name}`);
      } catch (publishError) {
        console.error(`NetworkAdvertiser: publishService failed on ${iface.name}:`, publishError);
        throw publishError;
      }

      console.log(`NetworkAdvertiser: mDNS service published successfully on ${iface.name}`);
      console.log(`NetworkAdvertiser: Service should now be discoverable on ${iface.type} network`);

    } catch (error) {
      console.error(`NetworkAdvertiser: Failed to register mDNS service on ${iface.name}:`, error);
      throw error;
    }
  }

  // Legacy method for backward compatibility
  private async registerMDNSService(gameInfo: GameAdvertisement): Promise<void> {
    try {
      // Get the primary interface
      const primaryInterface = await this.networkInterfaceService.getPrimaryInterface();
      
      if (primaryInterface) {
        await this.registerMDNSServiceOnInterface(gameInfo, primaryInterface);
      } else {
        console.warn('NetworkAdvertiser: No primary interface found, using default registration');
        // Fallback to default registration
        await this.registerMDNSServiceOnInterface(gameInfo, {
          name: 'default',
          address: gameInfo.hostIP,
          family: 'IPv4',
          internal: false,
          type: 'unknown',
          isConnected: true,
        });
      }
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

  // Get the local IP address with smart selection for hotspot scenarios
  public async getLocalIPAddress(): Promise<string> {
    try {
      const allInterfaces = await this.networkInterfaceService.getAvailableInterfaces();
      
      // Priority order: Hotspot > WiFi > Ethernet > Cellular > Others
      const priorityOrder = ['hotspot', 'wifi', 'ethernet', 'cellular', 'unknown'];
      
      for (const type of priorityOrder) {
        const interfaces = allInterfaces.filter((iface: any) => iface.type === type && iface.isConnected);
        if (interfaces.length > 0) {
          const selectedIP = interfaces[0].address;
          console.log(`🎯 IP SELECTION: ${type.toUpperCase()} -> ${selectedIP}`);
          return selectedIP;
        }
      }
      
      // Fallback to primary interface
      const primaryInterface = await this.networkInterfaceService.getPrimaryInterface();
      if (primaryInterface) {
        console.log(`🎯 IP SELECTION: PRIMARY -> ${primaryInterface.address}`);
        return primaryInterface.address;
      }
      
      // Final fallback
      console.warn('🎯 IP SELECTION: FALLBACK -> 192.168.1.100');
      return '192.168.1.100';
    } catch (error) {
      console.error('🎯 IP SELECTION: ERROR -> 192.168.1.100', error);
      return '192.168.1.100'; // Fallback
    }
  }

  // Get a random port for the game
  public getRandomPort(): number {
    return Math.floor(3000 + Math.random() * 1000);
  }

  // Check if we're in a hotspot scenario (host sharing hotspot)
  public async isHotspotScenario(): Promise<{ isHotspot: boolean; hotspotIP?: string; wifiIP?: string }> {
    try {
      const allInterfaces = await this.networkInterfaceService.getAvailableInterfaces();
      const hotspotInterfaces = allInterfaces.filter((iface: any) => iface.type === 'hotspot' && iface.isConnected);
      const wifiInterfaces = allInterfaces.filter((iface: any) => iface.type === 'wifi' && iface.isConnected);
      
      const isHotspot = hotspotInterfaces.length > 0 && wifiInterfaces.length > 0;
      
      return {
        isHotspot,
        hotspotIP: hotspotInterfaces[0]?.address,
        wifiIP: wifiInterfaces[0]?.address
      };
    } catch (error) {
      console.error('NetworkAdvertiser: Error checking hotspot scenario:', error);
      return { isHotspot: false };
    }
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
