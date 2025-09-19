// Game hosting service - manages the hosting experience
import networkConfigService from "./networkConfigService";

export interface HostingOptions {
  autoStartServer: boolean;
  serverPort: number;
  serverHost: string;
}

class GameHostService {
  private isHosting = false;
  private hostingOptions: HostingOptions | null = null;

  // Check if we can host a game (server available)
  async canHostGame(): Promise<{
    canHost: boolean;
    reason?: string;
    serverInfo?: { host: string; port: number };
  }> {
    try {
      // Try to find existing servers first
      const servers = await networkConfigService.discoverServers();

      if (servers.length > 0) {
        return {
          canHost: true,
          serverInfo: servers[0],
          reason: "Found existing server",
        };
      }

      // Check if we can start a server
      const localIP = await networkConfigService.getLocalIP();
      if (localIP && localIP !== "127.0.0.1" && localIP !== "localhost") {
        return {
          canHost: true,
          serverInfo: { host: localIP, port: 3001 },
          reason: "Can host on local network",
        };
      }

      return {
        canHost: true,
        serverInfo: { host: "localhost", port: 3001 },
        reason: "Can host locally",
      };
    } catch (error) {
      console.error("Error checking hosting capability:", error);
      return {
        canHost: false,
        reason: "Error checking hosting capability",
      };
    }
  }

  // Start hosting a game
  async startHosting(): Promise<{
    success: boolean;
    serverInfo?: { host: string; port: number };
    instructions?: string;
  }> {
    try {
      const hostingCheck = await this.canHostGame();

      if (!hostingCheck.canHost) {
        return {
          success: false,
          instructions:
            "Cannot host game. Please ensure you have a server running or are on a local network.",
        };
      }

      this.isHosting = true;
      this.hostingOptions = {
        autoStartServer: false, // We're using existing server
        serverPort: hostingCheck.serverInfo!.port,
        serverHost: hostingCheck.serverInfo!.host,
      };

      return {
        success: true,
        serverInfo: hostingCheck.serverInfo,
        instructions: this.getHostingInstructions(hostingCheck.serverInfo!),
      };
    } catch (error) {
      console.error("Error starting hosting:", error);
      return {
        success: false,
        instructions: "Failed to start hosting. Please try again.",
      };
    }
  }

  // Get hosting instructions for the user
  private getHostingInstructions(serverInfo: {
    host: string;
    port: number;
  }): string {
    if (serverInfo.host === "localhost" || serverInfo.host === "127.0.0.1") {
      return "To host a game, run: node server.js in the project directory";
    } else {
      return `Server running at ${serverInfo.host}:${serverInfo.port}. Other players can join using this address.`;
    }
  }

  // Stop hosting
  stopHosting(): void {
    this.isHosting = false;
    this.hostingOptions = null;
  }

  // Get current hosting status
  getHostingStatus(): { isHosting: boolean; options: HostingOptions | null } {
    return {
      isHosting: this.isHosting,
      options: this.hostingOptions,
    };
  }

  // Get server connection info for other players
  getServerConnectionInfo(): {
    host: string;
    port: number;
    instructions: string;
  } | null {
    if (!this.isHosting || !this.hostingOptions) {
      return null;
    }

    return {
      host: this.hostingOptions.serverHost,
      port: this.hostingOptions.serverPort,
      instructions: this.getHostingInstructions({
        host: this.hostingOptions.serverHost,
        port: this.hostingOptions.serverPort,
      }),
    };
  }
}

export default new GameHostService();

