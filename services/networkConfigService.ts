// Network configuration service for local multiplayer
import { Platform } from "react-native";
import * as Network from "expo-network";

export interface ServerConfig {
  host: string;
  port: number;
  protocol: "http" | "https";
}

class NetworkConfigService {
  private defaultPort = 3001;
  private defaultProtocol: "http" | "https" = "http";

  // Get the device's local IP address
  async getLocalIP(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        // For web, we can't get the local IP, so we'll use localhost
        return "localhost";
      }

      const ipAddress = await Network.getIpAddressAsync();
      return ipAddress;
    } catch (error) {
      console.error("Error getting local IP:", error);
      return null;
    }
  }

  // Get network configuration for local multiplayer
  async getServerConfig(): Promise<ServerConfig> {
    try {
      // Try to get the local IP first
      const localIP = await this.getLocalIP();

      if (localIP && localIP !== "127.0.0.1" && localIP !== "localhost") {
        return {
          host: localIP,
          port: this.defaultPort,
          protocol: this.defaultProtocol,
        };
      }

      // Fallback to localhost for development
      return {
        host: "localhost",
        port: this.defaultPort,
        protocol: this.defaultProtocol,
      };
    } catch (error) {
      console.error("Error getting server config:", error);
      // Ultimate fallback
      return {
        host: "localhost",
        port: this.defaultPort,
        protocol: this.defaultProtocol,
      };
    }
  }

  // Build server URL
  buildServerURL(config: ServerConfig): string {
    return `${config.protocol}://${config.host}:${config.port}`;
  }

  // Test server connectivity
  async testServerConnection(config: ServerConfig): Promise<boolean> {
    try {
      const url = `${this.buildServerURL(config)}/api/health`;
      const response = await fetch(url, {
        method: "GET",
        timeout: 5000, // 5 second timeout
      });

      return response.ok;
    } catch (error) {
      console.error("Server connection test failed:", error);
      return false;
    }
  }

  // Auto-discover available servers on the network
  async discoverServers(): Promise<ServerConfig[]> {
    const discoveredServers: ServerConfig[] = [];

    try {
      // Get local IP and try common network ranges
      const localIP = await this.getLocalIP();

      if (localIP && localIP !== "127.0.0.1" && localIP !== "localhost") {
        // Extract network prefix (e.g., 192.168.1 from 192.168.1.100)
        const ipParts = localIP.split(".");
        if (ipParts.length === 4) {
          const networkPrefix = ipParts.slice(0, 3).join(".");

          // Test common IPs in the network range
          const commonIPs = [
            `${networkPrefix}.1`, // Router
            `${networkPrefix}.2`, // Common server IP
            `${networkPrefix}.100`, // Common server IP
            `${networkPrefix}.101`, // Common server IP
            localIP, // This device
          ];

          // Test each IP
          for (const ip of commonIPs) {
            const config: ServerConfig = {
              host: ip,
              port: this.defaultPort,
              protocol: this.defaultProtocol,
            };

            const isReachable = await this.testServerConnection(config);
            if (isReachable) {
              discoveredServers.push(config);
            }
          }
        }
      }

      // Always add localhost as fallback
      const localhostConfig: ServerConfig = {
        host: "localhost",
        port: this.defaultPort,
        protocol: this.defaultProtocol,
      };

      const isLocalhostReachable =
        await this.testServerConnection(localhostConfig);
      if (isLocalhostReachable) {
        discoveredServers.push(localhostConfig);
      }
    } catch (error) {
      console.error("Error discovering servers:", error);
    }

    return discoveredServers;
  }

  // Get user-friendly server display name
  getServerDisplayName(config: ServerConfig): string {
    if (config.host === "localhost" || config.host === "127.0.0.1") {
      return "Local Server (This Device)";
    }
    return `Server at ${config.host}`;
  }
}

export default new NetworkConfigService();
