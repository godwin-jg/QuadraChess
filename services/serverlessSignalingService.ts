import { Platform } from 'react-native';
import { BridgeServer } from 'react-native-http-bridge-refurbished';
import p2pService from './p2pService';

// Lightweight HTTP server for WebRTC signaling (host only)
class ServerlessSignalingService {
  private static instance: ServerlessSignalingService;
  private port: number = 3001;
  private isRunning: boolean = false;
  private connections: Map<string, any> = new Map();
  private hostCandidates: Map<string, any[]> = new Map(); // Store ICE candidates for each player
  private server: BridgeServer | null = null;

  private constructor() {}

  public static getInstance(): ServerlessSignalingService {
    if (!ServerlessSignalingService.instance) {
      ServerlessSignalingService.instance = new ServerlessSignalingService();
    }
    return ServerlessSignalingService.instance;
  }

  // Start the HTTP server (host only)
  public async startServer(): Promise<void> {
    if (this.isRunning) {
      console.log('ServerlessSignaling: Server already running');
      return;
    }

    try {
      console.log('ServerlessSignaling: Starting HTTP server on port', this.port);
      
      // Create the bridge server
      this.server = new BridgeServer('webrtc_signaling', true);
      
      // Test endpoint to debug request format
      this.server.get('/test', async (req: any, res: any) => {
        console.log('ServerlessSignaling: Test endpoint hit');
        console.log('ServerlessSignaling: Request object:', req);
        return { message: 'Test endpoint working', request: req };
      });
      
      // Handle WebRTC offer endpoint
      this.server.post('/api/webrtc/offer', async (req: any, res: any) => {
        try {
          console.log('🚀 ServerlessSignaling: Received WebRTC offer request');
          console.log('ServerlessSignaling: Request body:', req.body);
          console.log('ServerlessSignaling: Request data:', req.data);
          console.log('ServerlessSignaling: Request post:', req.post);
          console.log('ServerlessSignaling: Full request object:', req);
          
          // Try different ways to get the request data
          const offerData = req.body || req.data || req.post || req;
          console.log('ServerlessSignaling: Parsed offer data:', offerData);
          
          const response = await this.handleWebRTCOffer(offerData);
          console.log('✅ ServerlessSignaling: Offer handled successfully, returning response:', response);
          return response;
        } catch (error: any) {
          console.error('❌ ServerlessSignaling: Error handling offer:', error);
          return { error: error.message };
        }
      });
      
      // Handle ICE candidate endpoint
      this.server.post('/api/webrtc/ice-candidate', async (req: any, res: any) => {
        try {
          console.log('ServerlessSignaling: Received ICE candidate request');
          console.log('ServerlessSignaling: Request body:', req.body);
          console.log('ServerlessSignaling: Request data:', req.data);
          console.log('ServerlessSignaling: Request post:', req.post);
          
          // Try different ways to get the request data
          const candidateData = req.body || req.data || req.post || req;
          console.log('ServerlessSignaling: Parsed candidate data:', candidateData);
          
          await this.handleIceCandidate(candidateData);
          return { success: true };
        } catch (error: any) {
          console.error('ServerlessSignaling: Error handling ICE candidate:', error);
          return { error: error.message };
        }
      });
      
      // Handle ICE candidates retrieval endpoint
      this.server.get('/api/webrtc/candidates/:playerId', async (req: any, res: any) => {
        try {
          const playerId = req.params.playerId;
          console.log('ServerlessSignaling: Retrieving ICE candidates for player', playerId);
          
          const candidates = this.hostCandidates.get(playerId) || [];
          console.log('ServerlessSignaling: Returning', candidates.length, 'candidates for', playerId);
          
          // Clear the candidates after sending them (but keep the key for future candidates)
          this.hostCandidates.set(playerId, []);
          
          return { candidates };
        } catch (error: any) {
          console.error('ServerlessSignaling: Error retrieving ICE candidates:', error);
          return { error: error.message };
        }
      });
      
      // Start listening on the port
      this.server.listen(this.port);
      
      this.isRunning = true;
      console.log('ServerlessSignaling: HTTP server started successfully on port', this.port);
      
    } catch (error) {
      console.error('ServerlessSignaling: Failed to start server:', error);
      throw error;
    }
  }

  // Stop the HTTP server
  public async stopServer(): Promise<void> {
    if (!this.isRunning || !this.server) {
      console.log('ServerlessSignaling: Server not running');
      return;
    }

    try {
      console.log('ServerlessSignaling: Stopping HTTP server');
      this.server.stop();
      this.server = null;
      this.isRunning = false;
      this.connections.clear();
      this.hostCandidates.clear();
      console.log('ServerlessSignaling: HTTP server stopped');
    } catch (error) {
      console.error('ServerlessSignaling: Failed to stop server:', error);
    }
  }

  // Clean up candidates for a specific player (when they disconnect)
  public cleanupPlayerCandidates(playerId: string): void {
    this.hostCandidates.delete(playerId);
    console.log('ServerlessSignaling: Cleaned up candidates for player', playerId);
  }

  // Handle WebRTC offer from joining player
  public async handleWebRTCOffer(offerData: any): Promise<any> {
    try {
      console.log('ServerlessSignaling: Handling WebRTC offer from', offerData?.playerName || 'unknown');
      console.log('ServerlessSignaling: Full offer data:', offerData);
      console.log('ServerlessSignaling: Current connections:', this.connections.size);
      
      if (!offerData) {
        throw new Error('No offer data received');
      }
      
      const { offer, playerId, playerName, gameId } = offerData;
      
      // Import WebRTC types
      const { RTCPeerConnection, RTCSessionDescription } = require('react-native-webrtc');
      
      // Create WebRTC connection for the joining player
      const connection = new RTCPeerConnection({
        iceServers: [
          { urls: "stun:stun.l.google.com:19302" },
          { urls: "stun:stun1.l.google.com:19302" },
        ],
      });

      // Store connection for this player
      this.connections.set(playerId, connection);
      console.log('ServerlessSignaling: Stored connection for player', playerId, 'Total connections:', this.connections.size);

      // Set up data channel listener (host side)
      connection.ondatachannel = (event: any) => {
        const dataChannel = event.channel;
        console.log('ServerlessSignaling: Received data channel from', playerName);
        
        // Set up data channel listeners for host side
        p2pService.setupHostDataChannelListeners(dataChannel, playerId, playerName);
      };

      // Handle ICE candidates
      connection.onicecandidate = (event: any) => {
        if (event.candidate) {
          console.log('ServerlessSignaling: ICE candidate generated for', playerName);
          // Store ICE candidate for later exchange
          if (!this.hostCandidates.has(playerId)) {
            this.hostCandidates.set(playerId, []);
          }
          this.hostCandidates.get(playerId)!.push(event.candidate);
          console.log('ServerlessSignaling: Stored ICE candidate for', playerId, 'Total candidates:', this.hostCandidates.get(playerId)!.length);
        }
      };

      // Set remote description (the offer from the client)
      await connection.setRemoteDescription(new RTCSessionDescription(offer));

      // Create answer
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);

      console.log('ServerlessSignaling: Created answer for', playerName);

      // Return the answer to the client
      return {
        answer: answer,
        success: true,
      };

    } catch (error) {
      console.error('ServerlessSignaling: Failed to handle offer:', error);
      throw error;
    }
  }

  // Handle ICE candidate from joining player
  public async handleIceCandidate(candidateData: any): Promise<void> {
    try {
      console.log('ServerlessSignaling: Handling ICE candidate from', candidateData?.playerId || 'unknown');
      console.log('ServerlessSignaling: Full candidate data:', candidateData);
      
      if (!candidateData) {
        throw new Error('No candidate data received');
      }
      
      const { candidate, playerId } = candidateData;
      
      // Get the connection for this player
      const connection = this.connections.get(playerId);
      if (connection) {
        // Add the ICE candidate to the connection
        const { RTCIceCandidate } = require('react-native-webrtc');
        await connection.addIceCandidate(new RTCIceCandidate(candidate));
        console.log('ServerlessSignaling: Added ICE candidate for', playerId);
      } else {
        console.warn('ServerlessSignaling: No connection found for player', playerId);
      }
      
    } catch (error) {
      console.error('ServerlessSignaling: Failed to handle ICE candidate:', error);
    }
  }

  // Check if server is running
  public isServerRunning(): boolean {
    return this.isRunning;
  }

  // Get server port
  public getPort(): number {
    return this.port;
  }
}

export default ServerlessSignalingService.getInstance();
