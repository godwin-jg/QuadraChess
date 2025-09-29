import { Socket, Server, Net } from 'react-native-tcp-socket';

// Simple TCP signaling service for WebRTC handshake
class SimpleTCPSignaling {
  private static instance: SimpleTCPSignaling;
  private port: number = 3001;
  private server: Server | null = null;
  private isRunning: boolean = false;

  private constructor() {}

  public static getInstance(): SimpleTCPSignaling {
    if (!SimpleTCPSignaling.instance) {
      SimpleTCPSignaling.instance = new SimpleTCPSignaling();
    }
    return SimpleTCPSignaling.instance;
  }

  // Start TCP server (host)
  public async startServer(): Promise<void> {
    if (this.isRunning) {
      console.log('SimpleTCP: Server already running');
      return;
    }

    try {
      console.log('🚀 SimpleTCP: Starting TCP server on port', this.port);
      
      this.server = Net.createServer();
      
      this.server.on('connection', (socket: Socket) => {
        const clientId = `${socket.remoteAddress}:${socket.remotePort}`;
        console.log(`🔗 SimpleTCP: Client connected: ${clientId}`);
        
        socket.on('data', async (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            console.log(`📥 SimpleTCP: Received: ${message.type}`);
            
            if (message.type === 'webrtc-offer') {
              // Forward to P2P service
              const p2pService = require('./p2pService').default;
              const answer = await p2pService.handleSimpleOffer(message.offer, message.playerId, message.playerName);
              
              // Send answer back
              socket.write(JSON.stringify({
                type: 'webrtc-answer',
                answer: answer
              }));
            } else if (message.type === 'health-check') {
              socket.write(JSON.stringify({ type: 'health-response', status: 'ok' }));
            }
          } catch (error) {
            console.error(`❌ SimpleTCP: Error:`, error);
            socket.write(JSON.stringify({
              type: 'error',
              error: error.message
            }));
          }
        });
        
        socket.on('close', () => {
          console.log(`❌ SimpleTCP: Client disconnected: ${clientId}`);
        });
        
        socket.on('error', (error: any) => {
          console.error(`❌ SimpleTCP: Socket error:`, error);
        });
      });
      
      this.server.on('error', (error: any) => {
        console.error('❌ SimpleTCP: Server error:', error);
      });
      
      this.server.listen(this.port, '0.0.0.0', () => {
        console.log(`✅ SimpleTCP: Server listening on port ${this.port}`);
        this.isRunning = true;
      });
      
    } catch (error) {
      console.error('SimpleTCP: Failed to start server:', error);
      throw error;
    }
  }

  // Stop TCP server
  public async stopServer(): Promise<void> {
    if (!this.isRunning || !this.server) {
      return;
    }

    try {
      this.server.close(() => {
        console.log('✅ SimpleTCP: Server stopped');
      });
      this.isRunning = false;
      this.server = null;
    } catch (error) {
      console.error('SimpleTCP: Failed to stop server:', error);
      throw error;
    }
  }

  // Connect to host (client)
  public async connectToHost(hostIP: string, offerData: any): Promise<any> {
    console.log(`🔗 SimpleTCP: connectToHost called with hostIP: "${hostIP}", port: ${this.port}`);
    console.log(`🔗 SimpleTCP: hostIP type: ${typeof hostIP}, port type: ${typeof this.port}`);
    
    // Validate inputs
    if (!hostIP || hostIP === 'localhost' || hostIP === '127.0.0.1') {
      throw new Error(`Invalid host IP: ${hostIP}`);
    }
    
    if (!this.port || this.port === 0) {
      throw new Error(`Invalid port: ${this.port}`);
    }
    
    return new Promise((resolve, reject) => {
      // Try using Net.createConnection instead of Socket
      const socket = Net.createConnection(this.port, hostIP);
      
      socket.on('connect', () => {
        console.log(`✅ SimpleTCP: Connected to ${hostIP}:${this.port}`);
        
        // Send offer
        socket.write(JSON.stringify({
          type: 'webrtc-offer',
          ...offerData
        }));
      });
      
      socket.on('data', (data: Buffer) => {
        try {
          const message = JSON.parse(data.toString());
          console.log('📥 SimpleTCP: Received:', message.type);
          
          if (message.type === 'webrtc-answer') {
            resolve(message);
          } else if (message.type === 'error') {
            reject(new Error(message.error));
          }
        } catch (error) {
          reject(error);
        }
      });
      
      socket.on('error', (error: any) => {
        reject(error);
      });
      
      socket.on('close', () => {
        console.log('🔌 SimpleTCP: Connection closed');
      });
      
      // Connect
      console.log(`🔗 SimpleTCP: Attempting to connect to ${hostIP}:${this.port}`);
      // Net.createConnection handles the connection automatically
      
      // Timeout
      setTimeout(() => {
        socket.destroy();
        reject(new Error('Connection timeout'));
      }, 10000);
    });
  }

  public getPort(): number {
    return this.port;
  }

  public isServerRunning(): boolean {
    return this.isRunning;
  }
}

export default SimpleTCPSignaling.getInstance();
