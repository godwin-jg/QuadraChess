import { Platform } from "react-native";
import { NetworkInterfaceService, NetworkInterface } from './networkInterfaceService';

export interface NetworkConfig {
  signalingServerUrl: string;
  localServerUrl: string;
}

class NetworkConfigService {
  private static instance: NetworkConfigService;
  private config: NetworkConfig;
  private networkInterfaceService: any;

  private constructor() {
    this.networkInterfaceService = NetworkInterfaceService.getInstance();
    this.config = this.detectNetworkConfig();
  }

  public static getInstance(): NetworkConfigService {
    if (!NetworkConfigService.instance) {
      NetworkConfigService.instance = new NetworkConfigService();
    }
    return NetworkConfigService.instance;
  }

  private detectNetworkConfig(): NetworkConfig {
    // For development, try to detect the local network IP
    // In production, you would use your actual server URLs
    
    if (Platform.OS === 'web') {
      // Web platform - use localhost
      return {
        signalingServerUrl: "http://localhost:3002",
        localServerUrl: "http://localhost:3001",
      };
    } else {
      // Mobile platforms - use network IP
      // You can update this IP to match your development machine
      return {
        signalingServerUrl: "http://192.168.1.9:3002",
        localServerUrl: "http://192.168.1.9:3001",
      };
    }
  }

  // Dynamic network configuration based on current network interfaces
  public async getDynamicNetworkConfig(): Promise<NetworkConfig> {
    try {
      const primaryInterface = await this.networkInterfaceService.getPrimaryInterface();
      
      if (primaryInterface) {
        const baseUrl = `http://${primaryInterface.address}`;
        console.log('NetworkConfig: Using dynamic config with primary interface:', primaryInterface.address);
        
        return {
          signalingServerUrl: `${baseUrl}:3002`,
          localServerUrl: `${baseUrl}:3001`,
        };
      }
      
      // Fallback to hotspot interface
      const hotspotInterfaces = await this.networkInterfaceService.getHotspotInterfaces();
      if (hotspotInterfaces.length > 0) {
        const baseUrl = `http://${hotspotInterfaces[0].address}`;
        console.log('NetworkConfig: Using dynamic config with hotspot interface:', hotspotInterfaces[0].address);
        
        return {
          signalingServerUrl: `${baseUrl}:3002`,
          localServerUrl: `${baseUrl}:3001`,
        };
      }
      
      // Final fallback to static config
      console.log('NetworkConfig: No suitable interface found, using static config');
      return this.config;
      
    } catch (error) {
      console.error('NetworkConfig: Error getting dynamic network config:', error);
      return this.config;
    }
  }

  public getSignalingServerUrl(): string {
    return this.config.signalingServerUrl;
  }

  public getLocalServerUrl(): string {
    return this.config.localServerUrl;
  }

  public updateSignalingServerUrl(url: string): void {
    this.config.signalingServerUrl = url;
  }

  public updateLocalServerUrl(url: string): void {
    this.config.localServerUrl = url;
  }

  public getConfig(): NetworkConfig {
    return { ...this.config };
  }

  // Helper method to get current network IP (for development)
  public async getCurrentNetworkIP(): Promise<string | null> {
    try {
      // First try to get local network IP from interfaces
      const primaryInterface = await this.networkInterfaceService.getPrimaryInterface();
      if (primaryInterface) {
        console.log('NetworkConfig: Using primary interface IP:', primaryInterface.address);
        return primaryInterface.address;
      }
      
      // Fallback to external service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Could not detect network IP:', error);
      return null;
    }
  }

  // Get all available network interfaces
  public async getAvailableInterfaces(): Promise<NetworkInterface[]> {
    try {
      return await this.networkInterfaceService.getAvailableInterfaces();
    } catch (error) {
      console.error('NetworkConfig: Error getting available interfaces:', error);
      return [];
    }
  }

  // Check if connected to hotspot
  public async isConnectedToHotspot(): Promise<boolean> {
    try {
      return await this.networkInterfaceService.isConnectedToHotspot();
    } catch (error) {
      console.error('NetworkConfig: Error checking hotspot connection:', error);
      return false;
    }
  }

  // Get hotspot interfaces
  public async getHotspotInterfaces(): Promise<NetworkInterface[]> {
    try {
      return await this.networkInterfaceService.getHotspotInterfaces();
    } catch (error) {
      console.error('NetworkConfig: Error getting hotspot interfaces:', error);
      return [];
    }
  }

  // Refresh network configuration
  public async refreshNetworkConfig(): Promise<void> {
    try {
      await this.networkInterfaceService.refresh();
      this.config = await this.getDynamicNetworkConfig();
      console.log('NetworkConfig: Network configuration refreshed');
    } catch (error) {
      console.error('NetworkConfig: Error refreshing network config:', error);
    }
  }
}

export default NetworkConfigService.getInstance();