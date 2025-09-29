import { WebRTCConnectionManager } from './WebRTCConnectionManager';
import { GameStateManager } from './GameStateManager';

export interface ConnectionStrategyEvents {
  onWebRTCConnectionEstablished: (peerId: string) => void;
  onWebRTCConnectionFailed: (error: Error) => void;
  onHTTPFallbackActivated: (hostIP: string) => void;
  onGameStateReceived: (gameState: any) => void;
  onConnectionError: (error: Error) => void;
}

export interface ConnectionConfig {
  hostIP: string;
  hostId: string;
  playerName: string;
  gameId: string;
}

export class ConnectionStrategyManager {
  private webRTCManager: WebRTCConnectionManager;
  private gameStateManager: GameStateManager;
  private eventHandlers: ConnectionStrategyEvents;
  private isWebRTCConnected: boolean = false;
  private isHTTPFallbackActive: boolean = false;
  private httpPollingInterval: NodeJS.Timeout | null = null;

  constructor(
    webRTCManager: WebRTCConnectionManager,
    gameStateManager: GameStateManager,
    eventHandlers: ConnectionStrategyEvents
  ) {
    this.webRTCManager = webRTCManager;
    this.gameStateManager = gameStateManager;
    this.eventHandlers = eventHandlers;
  }

  /**
   * Attempt to connect using WebRTC first, then fallback to HTTP
   */
  public async connectToHost(config: ConnectionConfig): Promise<void> {
    console.log(`🔗 ConnectionStrategy: Attempting connection to ${config.hostIP}`);
    
    try {
      // Try WebRTC connection first
      await this.attemptWebRTCConnection(config);
      
      // Wait for WebRTC connection to establish
      await this.waitForWebRTCConnection(config.hostId);
      
      this.isWebRTCConnected = true;
      this.eventHandlers.onWebRTCConnectionEstablished(config.hostId);
      
    } catch (webRTCError) {
      console.log(`🔗 ConnectionStrategy: WebRTC failed, trying HTTP fallback:`, webRTCError);
      
      // Fallback to HTTP polling
      await this.activateHTTPFallback(config);
    }
  }

  /**
   * Attempt WebRTC connection
   */
  private async attemptWebRTCConnection(config: ConnectionConfig): Promise<void> {
    console.log(`🔗 ConnectionStrategy: Attempting WebRTC connection to ${config.hostIP}`);
    
    // Create WebRTC connection
    const connection = this.webRTCManager.createConnection(config.hostId);
    
    // Create data channel
    const dataChannel = this.webRTCManager.createDataChannel(config.hostId);
    
    // Create offer
    const offer = await this.webRTCManager.createOffer(config.hostId);
    
    // Send offer via HTTP signaling
    const response = await this.sendOfferViaHTTP(config, offer);
    
    if (!response.success) {
      throw new Error('Failed to exchange WebRTC offer/answer');
    }
    
    // Set remote description (answer)
    await this.webRTCManager.setRemoteDescription(config.hostId, response.answer);
    
    // Add ICE candidates
    for (const candidate of response.candidates) {
      await this.webRTCManager.addIceCandidate(config.hostId, candidate);
    }
    
    console.log(`🔗 ConnectionStrategy: WebRTC offer/answer exchange completed`);
  }

  /**
   * Wait for WebRTC connection to establish
   */
  private async waitForWebRTCConnection(hostId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('WebRTC connection timeout'));
      }, 10000); // 10 second timeout

      const checkConnection = () => {
        const state = this.webRTCManager.getConnectionState(hostId);
        const isDataChannelOpen = this.webRTCManager.isDataChannelOpen(hostId);
        
        if (state === 'connected' && isDataChannelOpen) {
          clearTimeout(timeout);
          resolve();
        } else if (state === 'failed') {
          clearTimeout(timeout);
          reject(new Error('WebRTC connection failed'));
        } else {
          setTimeout(checkConnection, 100);
        }
      };
      
      checkConnection();
    });
  }

  /**
   * Activate HTTP fallback when WebRTC fails
   */
  private async activateHTTPFallback(config: ConnectionConfig): Promise<void> {
    console.log(`🔄 ConnectionStrategy: Activating HTTP fallback for ${config.hostIP}`);
    
    this.isHTTPFallbackActive = true;
    this.eventHandlers.onHTTPFallbackActivated(config.hostIP);
    
    // Start HTTP polling for game state
    await this.startHTTPPolling(config.hostIP);
  }

  /**
   * Start HTTP polling for game state
   */
  private async startHTTPPolling(hostIP: string): Promise<void> {
    console.log(`🔄 ConnectionStrategy: Starting HTTP polling to ${hostIP}`);
    
    const maxAttempts = 20; // 20 attempts over 10 seconds
    const pollInterval = 500; // 500ms between attempts
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const response = await fetch(`http://${hostIP}:3001/api/game-state`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const gameState = await response.json();
          console.log(`🔄 ConnectionStrategy: Received game state via HTTP:`, gameState);
          
          this.gameStateManager.updateGameState(gameState);
          this.eventHandlers.onGameStateReceived(gameState);
          
          // Start continuous polling
          this.startContinuousHTTPPolling(hostIP);
          return;
        }
      } catch (fetchError) {
        console.log(`🔄 ConnectionStrategy: HTTP polling attempt ${attempt}/${maxAttempts} failed:`, fetchError);
      }
      
      // Wait before next attempt
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
      }
    }
    
    throw new Error('HTTP fallback failed - could not get game state from host');
  }

  /**
   * Start continuous HTTP polling
   */
  private startContinuousHTTPPolling(hostIP: string): void {
    console.log(`🔄 ConnectionStrategy: Starting continuous HTTP polling`);
    
    this.httpPollingInterval = setInterval(async () => {
      try {
        const response = await fetch(`http://${hostIP}:3001/api/game-state`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const gameState = await response.json();
          this.gameStateManager.updateGameState(gameState);
          this.eventHandlers.onGameStateReceived(gameState);
        }
      } catch (error) {
        console.warn(`🔄 ConnectionStrategy: HTTP polling error:`, error);
      }
    }, 2000); // Poll every 2 seconds
  }

  /**
   * Send WebRTC offer via HTTP signaling
   */
  private async sendOfferViaHTTP(config: ConnectionConfig, offer: RTCSessionDescriptionInit): Promise<any> {
    console.log(`🔗 ConnectionStrategy: Sending offer via HTTP to ${config.hostIP}`);
    
    // Collect ICE candidates
    const candidates: RTCIceCandidateInit[] = [];
    
    // Note: In a real implementation, you'd collect ICE candidates here
    // For now, we'll send an empty array
    
    const offerPayload = {
      offer: offer,
      candidates: candidates,
      playerId: config.hostId, // This should be the client's player ID
      playerName: config.playerName,
      gameId: config.gameId,
    };
    
    const response = await fetch(`http://${config.hostIP}:3001/api/webrtc/offer`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(offerPayload),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP signaling failed: ${response.status}`);
    }
    
    return await response.json();
  }

  /**
   * Send message to host
   */
  public sendMessage(hostId: string, message: any): void {
    if (this.isWebRTCConnected) {
      this.webRTCManager.sendMessage(hostId, message);
    } else {
      console.warn('🔗 ConnectionStrategy: Cannot send message - no active connection');
    }
  }

  /**
   * Check if WebRTC is connected
   */
  public isWebRTCActive(): boolean {
    return this.isWebRTCConnected;
  }

  /**
   * Check if HTTP fallback is active
   */
  public isHTTPActive(): boolean {
    return this.isHTTPFallbackActive;
  }

  /**
   * Disconnect from host
   */
  public disconnect(): void {
    console.log(`🔗 ConnectionStrategy: Disconnecting from host`);
    
    if (this.httpPollingInterval) {
      clearInterval(this.httpPollingInterval);
      this.httpPollingInterval = null;
    }
    
    this.webRTCManager.closeAllConnections();
    this.isWebRTCConnected = false;
    this.isHTTPFallbackActive = false;
  }

  /**
   * Get connection status
   */
  public getConnectionStatus(): {
    isWebRTCConnected: boolean;
    isHTTPActive: boolean;
    connectionType: 'webrtc' | 'http' | 'none';
  } {
    return {
      isWebRTCConnected: this.isWebRTCConnected,
      isHTTPActive: this.isHTTPFallbackActive,
      connectionType: this.isWebRTCConnected ? 'webrtc' : 
                     this.isHTTPActive() ? 'http' : 'none'
    };
  }
}

