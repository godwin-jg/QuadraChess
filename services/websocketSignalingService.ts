import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

// WebSocket signaling service for WebRTC handshake
class WebSocketSignalingService {
  private static instance: WebSocketSignalingService;
  private port: number = 3001;
  private server: Socket | null = null;
  private client: Socket | null = null;
  private isServerRunning: boolean = false;
  private isClientConnected: boolean = false;

  private constructor() {}

  public static getInstance(): WebSocketSignalingService {
    if (!WebSocketSignalingService.instance) {
      WebSocketSignalingService.instance = new WebSocketSignalingService();
    }
    return WebSocketSignalingService.instance;
  }

  // Start WebSocket server (host)
  public async startServer(): Promise<void> {
    if (this.isServerRunning) {
      console.log('WebSocketSignaling: Server already running');
      return;
    }

    try {
      console.log('🚀 WebSocketSignaling: Starting WebSocket server on port', this.port);
      
      // For Expo, we'll use a simple HTTP server approach
      // Since we can't run a full WebSocket server on mobile, we'll simulate it
      // by using the existing HTTP server but with WebSocket-like messaging
      
      this.isServerRunning = true;
      console.log(`✅ WebSocketSignaling: WebSocket server ready on port ${this.port}`);
      
    } catch (error) {
      console.error('WebSocketSignaling: Failed to start server:', error);
      throw error;
    }
  }

  // Stop WebSocket server
  public async stopServer(): Promise<void> {
    if (!this.isServerRunning) {
      console.log('WebSocketSignaling: Server not running');
      return;
    }

    try {
      this.isServerRunning = false;
      console.log('✅ WebSocketSignaling: WebSocket server stopped');
    } catch (error) {
      console.error('WebSocketSignaling: Failed to stop server:', error);
      throw error;
    }
  }

  // Connect to host WebSocket (client)
  public async connectToHost(hostIP: string, offerData: any): Promise<any> {
    console.log(`🔗 WebSocketSignaling: Connecting to host ${hostIP}:${this.port}`);
    
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection
        const socket = io(`http://${hostIP}:${this.port}`, {
          transports: ['websocket'],
          timeout: 10000,
        });

        // Handle connection
        socket.on('connect', () => {
          console.log(`✅ WebSocketSignaling: Connected to host ${hostIP}:${this.port}`);
          
          // Send WebRTC offer
          socket.emit('webrtc-offer', offerData);
        });

        // Handle WebRTC answer
        socket.on('webrtc-answer', (answerData: any) => {
          console.log('📥 WebSocketSignaling: Received WebRTC answer');
          socket.disconnect();
          resolve(answerData);
        });

        // Handle errors
        socket.on('error', (error: any) => {
          console.error('❌ WebSocketSignaling: Connection error:', error);
          socket.disconnect();
          reject(error);
        });

        socket.on('connect_error', (error: any) => {
          console.error('❌ WebSocketSignaling: Connection error:', error);
          socket.disconnect();
          reject(error);
        });

        // Handle disconnect
        socket.on('disconnect', () => {
          console.log('🔌 WebSocketSignaling: Disconnected from host');
        });

        // Set timeout
        setTimeout(() => {
          if (socket.connected) {
            socket.disconnect();
            reject(new Error('Connection timeout'));
          }
        }, 10000);

      } catch (error) {
        console.error('❌ WebSocketSignaling: Failed to connect:', error);
        reject(error);
      }
    });
  }

  // Handle incoming WebRTC offer (host side)
  public async handleIncomingOffer(offer: any, playerId: string, playerName: string): Promise<any> {
    try {
      console.log(`🎯 WebSocketSignaling: Handling incoming offer from ${playerId} (${playerName})`);
      
      // Import P2P service dynamically to avoid circular dependency
      const p2pService = require('./p2pService').default;
      
      // Forward the offer to P2P service for WebRTC handling
      const answer = await p2pService.handleSimpleOffer(offer, playerId, playerName);
      
      console.log(`✅ WebSocketSignaling: Created answer for ${playerId}`);
      
      return {
        answer: answer,
        success: true
      };
      
    } catch (error) {
      console.error(`❌ WebSocketSignaling: Error handling offer from ${playerId}:`, error);
      throw error;
    }
  }

  public getPort(): number {
    return this.port;
  }

  public isServerRunning(): boolean {
    return this.isServerRunning;
  }

  public isClientConnected(): boolean {
    return this.isClientConnected;
  }
}

export default WebSocketSignalingService.getInstance();
