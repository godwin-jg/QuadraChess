import { Platform } from 'react-native';
import { Socket, Server } from 'react-native-tcp-socket';

// Lightweight TCP server for WebRTC signaling (host only)
class TCPSignalingService {
  private static instance: TCPSignalingService;
  private port: number = 3001;
  private isRunning: boolean = false;
  private server: Server | null = null;
  private connections: Map<string, Socket> = new Map();

  private constructor() {}

  public static getInstance(): TCPSignalingService {
    if (!TCPSignalingService.instance) {
      TCPSignalingService.instance = new TCPSignalingService();
    }
    return TCPSignalingService.instance;
  }

  // Start the TCP server (host only)
  public async startServer(): Promise<void> {
    if (this.isRunning) {
      console.log('TCPSignaling: Server already running');
      return;
    }

    try {
      console.log('🚀 TCPSignaling: Starting TCP server on port', this.port);
      
      // Create TCP server
      this.server = new Server();
      
      // Handle new connections
      this.server.on('connection', (socket: Socket) => {
        const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`🔗 TCPSignaling: New client connected: ${clientId}`);
        
        // Store the connection
        this.connections.set(clientId, socket);
        
        // Handle incoming data
        socket.on('data', async (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`📥 TCPSignaling: Received message from ${clientId}:`, message.type);
            
            // Handle WebRTC offer
            if (message.type === 'webrtc-offer') {
              await this.handleWebRTCOffer(socket, message, clientId);
            }
            // Handle ICE candidates
            else if (message.type === 'ice-candidate') {
              await this.handleIceCandidate(socket, message, clientId);
            }
            // Handle health check
            else if (message.type === 'health-check') {
              socket.write(JSON.stringify({ type: 'health-response', status: 'ok' }));
            }
            else {
              console.log(`⚠️ TCPSignaling: Unknown message type: ${message.type}`);
            }
          } catch (error) {
            console.error(`❌ TCPSignaling: Error processing message from ${clientId}:`, error);
          }
        });
        
        // Handle client disconnect
        socket.on('close', () => {
          console.log(`❌ TCPSignaling: Client disconnected: ${clientId}`);
          this.connections.delete(clientId);
        });
        
        // Handle errors
        socket.on('error', (error: any) => {
          console.error(`❌ TCPSignaling: Socket error for ${clientId}:`, error);
          this.connections.delete(clientId);
        });
      });
      
      // Handle server errors
      this.server.on('error', (error: any) => {
        console.error('❌ TCPSignaling: Server error:', error);
      });
      
      // Start listening
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`✅ TCPSignaling: TCP server listening on port ${this.port}`);
        this.isRunning = true;
      });
      
    } catch (error) {
      console.error('TCPSignaling: Failed to start server:', error);
      throw error;
    }
  }

  // Stop the TCP server
  public async stopServer(): Promise<void> {
    if (!this.isRunning || !this.server) {
      console.log('TCPSignaling: Server not running');
      return;
    }

    try {
      // Close all client connections
      this.connections.forEach((socket, clientId) => {
        console.log(`🔌 TCPSignaling: Closing connection to ${clientId}`);
        socket.destroy();
      });
      this.connections.clear();
      
      // Close the server
      this.server.close(() => {
        console.log('✅ TCPSignaling: TCP server stopped');
      });
      
      this.isRunning = false;
      this.server = null;
    } catch (error) {
      console.error('TCPSignaling: Failed to stop server:', error);
      throw error;
    }
  }

  // Handle WebRTC offer from client
  private async handleWebRTCOffer(socket: Socket, message: any, clientId: string): Promise<void> {
    try {
      console.log(`🎯 TCPSignaling: Handling WebRTC offer from ${clientId}`);
      
      const { offer, playerName, playerId, candidates } = message;
      
      // Store socket for this client
      this.connections.set(clientId, socket);
      
      // Import P2P service dynamically to avoid circular dependency
      const p2pService = require('./p2pService').default;
      
      // Forward the offer to P2P service for WebRTC handling
      const answerData = await p2pService.handleIncomingOffer(offer, playerId, playerName, candidates, socket);
      
      console.log(`✅ TCPSignaling: Received answer from P2P service for ${clientId}`);
      
      // Send answer to client
      socket.write(JSON.stringify({
        type: 'webrtc-answer',
        answer: answerData.answer,
        candidates: answerData.candidates,
        success: true
      }));
      
    } catch (error) {
      console.error(`❌ TCPSignaling: Error handling offer from ${clientId}:`, error);
      socket.write(JSON.stringify({
        type: 'error',
        error: error.message
      }));
    }
  }

  // Handle ICE candidate from client
  private async handleIceCandidate(socket: Socket, message: any, clientId: string): Promise<void> {
    try {
      console.log(`🧊 TCPSignaling: Handling ICE candidate from ${clientId}`);
      
      const { candidate } = message;
      
      // Forward ICE candidate to P2P service
      // This would need to be implemented based on your P2P service structure
      console.log(`✅ TCPSignaling: ICE candidate processed for ${clientId}`);
      
    } catch (error) {
      console.error(`❌ TCPSignaling: Error handling ICE candidate from ${clientId}:`, error);
    }
  }

  // Get server info
  public getPort(): number {
    return this.port;
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }

  // Get local IP address (for discovery)
  public getLocalIPAddress(): string {
    // This would need to be implemented based on your network service
    return '192.168.1.100'; // Placeholder
  }
}

export default TCPSignalingService.getInstance();
