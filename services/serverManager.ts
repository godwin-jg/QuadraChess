// Server management service for automatic server handling
import { Platform } from "react-native";
import * as Network from "expo-network";

export interface ServerProcess {
  pid?: number;
  port: number;
  host: string;
  isRunning: boolean;
}

class ServerManager {
  private serverProcess: ServerProcess | null = null;
  private defaultPort = 3001;

  // Check if a server is already running on the network
  async findExistingServer(): Promise<{ host: string; port: number } | null> {
    try {
      const localIP = await this.getLocalIP();
      if (!localIP) return null;

      // Test common ports and IPs
      const commonPorts = [3001, 3000, 8080, 8000];
      const commonIPs = [localIP, "localhost", "127.0.0.1"];

      for (const ip of commonIPs) {
        for (const port of commonPorts) {
          const isRunning = await this.testServerConnection(ip, port);
          if (isRunning) {
            return { host: ip, port };
          }
        }
      }

      return null;
    } catch (error) {
      console.error("Error finding existing server:", error);
      return null;
    }
  }

  // Test if a server is running at a specific host:port
  private async testServerConnection(
    host: string,
    port: number
  ): Promise<boolean> {
    try {
      const url = `http://${host}:${port}/api/health`;
      const response = await fetch(url, {
        method: "GET",
        timeout: 2000, // 2 second timeout
      });
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  // Get local IP address
  private async getLocalIP(): Promise<string | null> {
    try {
      if (Platform.OS === "web") {
        return "localhost";
      }
      const ipAddress = await Network.getIpAddressAsync();
      return ipAddress;
    } catch (error) {
      console.error("Error getting local IP:", error);
      return null;
    }
  }

  // Start a new server process
  async startServer(): Promise<{ host: string; port: number }> {
    try {
      // First, try to find an existing server
      const existingServer = await this.findExistingServer();
      if (existingServer) {
        console.log("Found existing server:", existingServer);
        return existingServer;
      }

      // If no existing server, we need to start one
      // Note: In React Native, we can't directly start Node.js processes
      // This would need to be handled differently in a real app

      // For now, return localhost as a fallback
      // In a real implementation, you might:
      // 1. Use a native module to start a server
      // 2. Use a cloud service
      // 3. Use WebRTC for peer-to-peer

      console.log("No existing server found, using localhost fallback");
      return {
        host: "localhost",
        port: this.defaultPort,
      };
    } catch (error) {
      console.error("Error starting server:", error);
      throw new Error("Failed to start server");
    }
  }

  // Stop the server (if we started it)
  async stopServer(): Promise<void> {
    if (this.serverProcess && this.serverProcess.pid) {
      try {
        // In a real implementation, you would kill the process here
        console.log("Stopping server process:", this.serverProcess.pid);
        this.serverProcess.isRunning = false;
        this.serverProcess = null;
      } catch (error) {
        console.error("Error stopping server:", error);
      }
    }
  }

  // Get server status
  getServerStatus(): ServerProcess | null {
    return this.serverProcess;
  }

  // Check if we're currently managing a server
  isManagingServer(): boolean {
    return this.serverProcess !== null && this.serverProcess.isRunning;
  }
}

export default new ServerManager();

