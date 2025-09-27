import { Platform } from "react-native";

export interface NetworkConfig {
  signalingServerUrl: string;
  localServerUrl: string;
}

class NetworkConfigService {
  private static instance: NetworkConfigService;
  private config: NetworkConfig;

  private constructor() {
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
      // This is a simple way to detect the network IP
      // In a real app, you might want to use a more sophisticated method
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('Could not detect network IP:', error);
      return null;
    }
  }
}

export default NetworkConfigService.getInstance();