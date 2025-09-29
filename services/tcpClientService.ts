import { Socket } from 'react-native-tcp-socket';

// TCP client for WebRTC signaling (client only)
class TCPClientService {
  private static instance: TCPClientService;
  private socket: Socket | null = null;

  private constructor() {}

  public static getInstance(): TCPClientService {
    if (!TCPClientService.instance) {
      TCPClientService.instance = new TCPClientService();
    }
    return TCPClientService.instance;
  }

  // Connect to host and exchange WebRTC signaling
  public async connectToHost(hostIP: string, port: number, offerData: any): Promise<any> {
    return new Promise((resolve, reject) => {
      try {
        console.log(`🔗 TCPClient: Connecting to host ${hostIP}:${port}`);
        
        // Create TCP socket
        this.socket = new Socket();
        
        // Handle connection
        this.socket.on('connect', () => {
          console.log(`✅ TCPClient: Connected to host ${hostIP}:${port}`);
          
          // Send WebRTC offer
          const message = JSON.stringify({
            type: 'webrtc-offer',
            ...offerData
          });
          
          console.log('📤 TCPClient: Sending WebRTC offer');
          this.socket!.write(message);
        });
        
        // Handle incoming data
        this.socket.on('data', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            console.log('📥 TCPClient: Received message:', message.type);
            
            if (message.type === 'webrtc-answer') {
              console.log('✅ TCPClient: Received WebRTC answer');
              resolve(message);
            } else if (message.type === 'ice-candidate') {
              console.log('🧊 TCPClient: Received ICE candidate');
              // Handle ICE candidate
              // This would be forwarded to the P2P service
            } else if (message.type === 'error') {
              console.error('❌ TCPClient: Host returned error:', message.error);
              reject(new Error(message.error));
            } else if (message.type === 'health-response') {
              console.log('✅ TCPClient: Health check successful');
            } else {
              console.log('⚠️ TCPClient: Unknown message type:', message.type);
            }
          } catch (error) {
            console.error('❌ TCPClient: Error parsing message:', error);
            reject(error);
          }
        });
        
        // Handle connection errors
        this.socket.on('error', (error: any) => {
          console.error('❌ TCPClient: Connection error:', error);
          reject(error);
        });
        
        // Handle connection close
        this.socket.on('close', () => {
          console.log('🔌 TCPClient: Connection closed');
        });
        
        // Connect to host
        this.socket.connect(port, hostIP);
        
        // Set timeout
        setTimeout(() => {
          if (this.socket && !this.socket.destroyed) {
            console.log('⏰ TCPClient: Connection timeout');
            this.disconnect();
            reject(new Error('Connection timeout'));
          }
        }, 10000); // 10 second timeout
        
      } catch (error) {
        console.error('❌ TCPClient: Failed to connect:', error);
        reject(error);
      }
    });
  }

  // Send ICE candidate to host
  public sendIceCandidate(candidate: any): void {
    if (this.socket && !this.socket.destroyed) {
      const message = JSON.stringify({
        type: 'ice-candidate',
        candidate: candidate
      });
      
      console.log('📤 TCPClient: Sending ICE candidate');
      this.socket.write(message);
    }
  }

  // Disconnect from host
  public disconnect(): void {
    if (this.socket) {
      console.log('🔌 TCPClient: Disconnecting from host');
      this.socket.destroy();
      this.socket = null;
    }
  }

  // Check if connected
  public isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }
}

export default TCPClientService.getInstance();
