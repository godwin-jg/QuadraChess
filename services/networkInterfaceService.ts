import { Platform } from 'react-native';
import * as Network from 'expo-network';

export interface NetworkInterface {
  name: string;
  address: string;
  family: 'IPv4' | 'IPv6';
  internal: boolean;
  type: 'wifi' | 'cellular' | 'ethernet' | 'hotspot' | 'unknown';
  isConnected: boolean;
}

export interface NetworkInfo {
  isConnected: boolean;
  type: Network.NetworkStateType;
  isInternetReachable: boolean | null;
  interfaces: NetworkInterface[];
  primaryInterface: NetworkInterface | null;
  hotspotInterfaces: NetworkInterface[];
}

class NetworkInterfaceService {
  private static instance: NetworkInterfaceService;
  private networkInfo: NetworkInfo | null = null;
  private listeners: ((info: NetworkInfo) => void)[] = [];

  private constructor() {
    this.initializeNetworkMonitoring();
  }

  public static getInstance(): NetworkInterfaceService {
    if (!NetworkInterfaceService.instance) {
      NetworkInterfaceService.instance = new NetworkInterfaceService();
    }
    return NetworkInterfaceService.instance;
  }

  private async initializeNetworkMonitoring(): Promise<void> {
    try {
      // Get initial network state
      await this.updateNetworkInfo();
      
      // Listen for network changes
      Network.addNetworkStateListener((state) => {
        console.log('NetworkInterface: Network state changed:', state);
        this.updateNetworkInfo();
      });
    } catch (error) {
      console.error('NetworkInterface: Failed to initialize network monitoring:', error);
    }
  }

  private async updateNetworkInfo(): Promise<void> {
    try {
      const networkState = await Network.getNetworkStateAsync();
      const interfaces = await this.detectNetworkInterfaces();
      
      this.networkInfo = {
        isConnected: networkState.isConnected ?? false,
        type: networkState.type ?? Network.NetworkStateType.UNKNOWN,
        isInternetReachable: networkState.isInternetReachable ?? null,
        interfaces,
        primaryInterface: this.findPrimaryInterface(interfaces),
        hotspotInterfaces: this.findHotspotInterfaces(interfaces),
      };

      console.log('NetworkInterface: Updated network info:', {
        isConnected: this.networkInfo.isConnected,
        type: this.networkInfo.type,
        interfaceCount: this.networkInfo.interfaces.length,
        hotspotCount: this.networkInfo.hotspotInterfaces.length,
        primaryInterface: this.networkInfo.primaryInterface?.address,
      });

      // Notify listeners
      this.listeners.forEach(listener => {
        try {
          listener(this.networkInfo as NetworkInfo);
        } catch (error) {
          console.error('NetworkInterface: Error in listener:', error);
        }
      });
    } catch (error) {
      console.error('NetworkInterface: Failed to update network info:', error);
    }
  }

  private async detectNetworkInterfaces(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];

    try {
      // For React Native, we need to use platform-specific methods
      if (Platform.OS === 'android') {
        // Android-specific network interface detection
        const androidInterfaces = await this.detectAndroidInterfaces();
        interfaces.push(...androidInterfaces);
      } else if (Platform.OS === 'ios') {
        // iOS-specific network interface detection
        const iosInterfaces = await this.detectIOSInterfaces();
        interfaces.push(...iosInterfaces);
      } else if (Platform.OS === 'web') {
        // Web platform - limited interface detection
        const webInterfaces = await this.detectWebInterfaces();
        interfaces.push(...webInterfaces);
      }

      // Add common local network ranges for hotspot detection
      const hotspotRanges = this.getHotspotRanges();
      const detectedHotspots = await this.detectHotspotNetworks(hotspotRanges);
      interfaces.push(...detectedHotspots);

    } catch (error) {
      console.error('NetworkInterface: Error detecting interfaces:', error);
    }

    return interfaces;
  }

  private async detectAndroidInterfaces(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    
    try {
      // For Android, we can use the NetworkInfo API
      // This is a simplified implementation - in a real app you'd use native modules
      const networkState = await Network.getNetworkStateAsync();
      
      if (networkState.isConnected) {
        // Add common Android network interfaces
        interfaces.push({
          name: 'wlan0',
          address: '192.168.1.100', // This would be dynamically detected
          family: 'IPv4',
          internal: false,
          type: 'wifi',
          isConnected: true,
        });

        // Add hotspot interface if available
        interfaces.push({
          name: 'ap0',
          address: '192.168.43.1', // Common hotspot gateway
          family: 'IPv4',
          internal: false,
          type: 'hotspot',
          isConnected: true,
        });
      }
    } catch (error) {
      console.error('NetworkInterface: Error detecting Android interfaces:', error);
    }

    return interfaces;
  }

  private async detectIOSInterfaces(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    
    try {
      const networkState = await Network.getNetworkStateAsync();
      
      if (networkState.isConnected) {
        // Add common iOS network interfaces
        interfaces.push({
          name: 'en0',
          address: '192.168.1.100', // This would be dynamically detected
          family: 'IPv4',
          internal: false,
          type: 'wifi',
          isConnected: true,
        });

        // Add hotspot interface if available
        interfaces.push({
          name: 'bridge0',
          address: '172.20.10.1', // Common iOS hotspot gateway
          family: 'IPv4',
          internal: false,
          type: 'hotspot',
          isConnected: true,
        });
      }
    } catch (error) {
      console.error('NetworkInterface: Error detecting iOS interfaces:', error);
    }

    return interfaces;
  }

  private async detectWebInterfaces(): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    
    try {
      // Web platform has limited network interface access
      // We can only detect localhost and make educated guesses
      interfaces.push({
        name: 'localhost',
        address: '127.0.0.1',
        family: 'IPv4',
        internal: true,
        type: 'unknown',
        isConnected: true,
      });

      // Try to detect local network IP via WebRTC
      const localIP = await this.detectWebRTCLocalIP();
      if (localIP) {
        interfaces.push({
          name: 'local-network',
          address: localIP,
          family: 'IPv4',
          internal: false,
          type: 'wifi',
          isConnected: true,
        });
      }
    } catch (error) {
      console.error('NetworkInterface: Error detecting web interfaces:', error);
    }

    return interfaces;
  }

  private async detectWebRTCLocalIP(): Promise<string | null> {
    try {
      // Use WebRTC to detect local IP
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });

      return new Promise((resolve) => {
        pc.createDataChannel('');
        pc.createOffer().then(offer => pc.setLocalDescription(offer));
        
        pc.onicecandidate = (event) => {
          if (event.candidate) {
            const candidate = event.candidate.candidate;
            const ipMatch = candidate.match(/([0-9]{1,3}(\.[0-9]{1,3}){3})/);
            if (ipMatch && !ipMatch[1].startsWith('127.')) {
              pc.close();
              resolve(ipMatch[1]);
            }
          }
        };

        // Timeout after 3 seconds
        setTimeout(() => {
          pc.close();
          resolve(null);
        }, 3000);
      });
    } catch (error) {
      console.error('NetworkInterface: Error detecting WebRTC local IP:', error);
      return null;
    }
  }

  private getHotspotRanges(): string[] {
    return [
      '192.168.43.0/24',    // Android hotspot
      '192.168.137.0/24',   // Windows hotspot
      '172.20.10.0/24',     // iOS hotspot
      '192.168.4.0/24',     // Common hotspot range
      '10.0.0.0/24',        // Another common hotspot range
    ];
  }

  private async detectHotspotNetworks(ranges: string[]): Promise<NetworkInterface[]> {
    const interfaces: NetworkInterface[] = [];
    
    try {
      // For each hotspot range, try to detect if we're connected to it
      for (const range of ranges) {
        const [network, cidr] = range.split('/');
        const subnet = this.getSubnetMask(parseInt(cidr));
        
        // Check if current IP is in this range
        const currentIP = await this.getCurrentIP();
        if (currentIP && this.isIPInRange(currentIP, network, subnet)) {
          const gateway = this.getGatewayForRange(network);
          
          interfaces.push({
            name: `hotspot-${network}`,
            address: currentIP,
            family: 'IPv4',
            internal: false,
            type: 'hotspot',
            isConnected: true,
          });

          // Also add the gateway
          interfaces.push({
            name: `hotspot-gateway-${network}`,
            address: gateway,
            family: 'IPv4',
            internal: false,
            type: 'hotspot',
            isConnected: true,
          });
        }
      }
    } catch (error) {
      console.error('NetworkInterface: Error detecting hotspot networks:', error);
    }

    return interfaces;
  }

  private async getCurrentIP(): Promise<string | null> {
    try {
      // Try to get current IP via external service
      const response = await fetch('https://api.ipify.org?format=json');
      const data = await response.json();
      return data.ip;
    } catch (error) {
      console.warn('NetworkInterface: Could not get current IP:', error);
      return null;
    }
  }

  private getSubnetMask(cidr: number): string {
    const mask = (0xffffffff << (32 - cidr)) >>> 0;
    return [
      (mask >>> 24) & 0xff,
      (mask >>> 16) & 0xff,
      (mask >>> 8) & 0xff,
      mask & 0xff
    ].join('.');
  }

  private isIPInRange(ip: string, network: string, subnet: string): boolean {
    const ipParts = ip.split('.').map(Number);
    const networkParts = network.split('.').map(Number);
    const subnetParts = subnet.split('.').map(Number);

    for (let i = 0; i < 4; i++) {
      if ((ipParts[i] & subnetParts[i]) !== (networkParts[i] & subnetParts[i])) {
        return false;
      }
    }
    return true;
  }

  private getGatewayForRange(network: string): string {
    const parts = network.split('.');
    parts[3] = '1'; // Common gateway IP
    return parts.join('.');
  }

  private findPrimaryInterface(interfaces: NetworkInterface[]): NetworkInterface | null {
    // Prefer WiFi over cellular, and connected over disconnected
    const connectedInterfaces = interfaces.filter(iface => iface.isConnected);
    
    if (connectedInterfaces.length === 0) {
      return null;
    }

    // Priority order: WiFi > Hotspot > Ethernet > Cellular > Unknown
    const priority = ['wifi', 'hotspot', 'ethernet', 'cellular', 'unknown'];
    
    for (const type of priority) {
      const networkInterface = connectedInterfaces.find(iface => iface.type === type);
      if (networkInterface) {
        return networkInterface;
      }
    }

    return connectedInterfaces[0];
  }

  private findHotspotInterfaces(interfaces: NetworkInterface[]): NetworkInterface[] {
    return interfaces.filter(iface => iface.type === 'hotspot' && iface.isConnected);
  }

  // Public API methods
  public async getNetworkInfo(): Promise<NetworkInfo> {
    if (!this.networkInfo) {
      await this.updateNetworkInfo();
    }
    return this.networkInfo as NetworkInfo;
  }

  public async getAvailableInterfaces(): Promise<NetworkInterface[]> {
    const info = await this.getNetworkInfo();
    return info.interfaces;
  }

  public async getHotspotInterfaces(): Promise<NetworkInterface[]> {
    const info = await this.getNetworkInfo();
    return info.hotspotInterfaces;
  }

  public async getPrimaryInterface(): Promise<NetworkInterface | null> {
    const info = await this.getNetworkInfo();
    return info.primaryInterface;
  }

  public async isConnectedToHotspot(): Promise<boolean> {
    const hotspots = await this.getHotspotInterfaces();
    return hotspots.length > 0;
  }

  public async getBestInterfaceForDiscovery(): Promise<NetworkInterface[]> {
    const info = await this.getNetworkInfo();
    const interfaces: NetworkInterface[] = [];

    // Add primary interface
    if (info.primaryInterface) {
      interfaces.push(info.primaryInterface);
    }

    // Add hotspot interfaces
    interfaces.push(...info.hotspotInterfaces);

    // Add other connected interfaces
    const otherInterfaces = info.interfaces.filter(iface => 
      iface.isConnected && 
      iface !== info.primaryInterface && 
      !info.hotspotInterfaces.includes(iface)
    );
    interfaces.push(...otherInterfaces);

    return interfaces;
  }

  public onNetworkChange(listener: (info: NetworkInfo) => void): () => void {
    this.listeners.push(listener);
    
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  public async refresh(): Promise<void> {
    await this.updateNetworkInfo();
  }
}

// Export both the class and an instance
export { NetworkInterfaceService };
export default NetworkInterfaceService.getInstance();
