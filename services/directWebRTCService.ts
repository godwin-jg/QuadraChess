import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from 'react-native-webrtc';

// Direct WebRTC connection service - no HTTP server needed
class DirectWebRTCService {
  private static instance: DirectWebRTCService;
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();

  private constructor() {}

  public static getInstance(): DirectWebRTCService {
    if (!DirectWebRTCService.instance) {
      DirectWebRTCService.instance = new DirectWebRTCService();
    }
    return DirectWebRTCService.instance;
  }

  // Create WebRTC connection for client (joining player)
  public async createClientConnection(hostIP: string, hostId: string, playerName: string): Promise<RTCPeerConnection> {
    try {
      console.log(`🚀 DirectWebRTC: Creating client connection to ${hostIP}`);
      
      // Create WebRTC connection with STUN servers for NAT traversal
      const connection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      });

      // Store connection
      this.connections.set(hostId, connection);

      // Create data channel
      const dataChannel = connection.createDataChannel("game-data", { 
        ordered: true 
      });
      this.dataChannels.set(hostId, dataChannel);

      // Set up data channel listeners
      this.setupDataChannelListeners(dataChannel, hostId, playerName);

      // Set up connection state monitoring
      connection.onconnectionstatechange = () => {
        console.log(`🔗 DirectWebRTC: Connection state changed to: ${connection.connectionState}`);
      };

      // Set up ICE connection state monitoring
      connection.oniceconnectionstatechange = () => {
        console.log(`🧊 DirectWebRTC: ICE connection state changed to: ${connection.iceConnectionState}`);
      };

      console.log(`✅ DirectWebRTC: Client connection created for ${hostId}`);
      return connection;

    } catch (error) {
      console.error(`❌ DirectWebRTC: Failed to create client connection:`, error);
      throw error;
    }
  }

  // Create WebRTC connection for host (game creator)
  public async createHostConnection(playerId: string, playerName: string): Promise<RTCPeerConnection> {
    try {
      console.log(`🚀 DirectWebRTC: Creating host connection for ${playerId}`);
      
      // Create WebRTC connection with STUN servers
      const connection = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' },
          { urls: 'stun:stun4.l.google.com:19302' },
        ],
        iceCandidatePoolSize: 10,
      });

      // Store connection
      this.connections.set(playerId, connection);

      // Set up data channel listener (host receives incoming data channels)
      connection.ondatachannel = (event: any) => {
        console.log(`✅ DirectWebRTC: Host received data channel from ${playerName}`);
        const dataChannel = event.channel;
        this.dataChannels.set(playerId, dataChannel);
        this.setupDataChannelListeners(dataChannel, playerId, playerName);
      };

      // Set up connection state monitoring
      connection.onconnectionstatechange = () => {
        console.log(`🔗 DirectWebRTC: Host connection state changed to: ${connection.connectionState}`);
      };

      // Set up ICE connection state monitoring
      connection.oniceconnectionstatechange = () => {
        console.log(`🧊 DirectWebRTC: Host ICE connection state changed to: ${connection.iceConnectionState}`);
      };

      console.log(`✅ DirectWebRTC: Host connection created for ${playerId}`);
      return connection;

    } catch (error) {
      console.error(`❌ DirectWebRTC: Failed to create host connection:`, error);
      throw error;
    }
  }

  // Set up data channel listeners
  private setupDataChannelListeners(dataChannel: RTCDataChannel, peerId: string, playerName: string): void {
    dataChannel.onopen = () => {
      console.log(`✅ DirectWebRTC: Data channel opened with ${playerName}`);
    };

    dataChannel.onmessage = (event: any) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`📥 DirectWebRTC: Received message from ${playerName}:`, message.type);
        
        // Forward message to P2P service
        const p2pService = require('./p2pService').default;
        p2pService.handleDataChannelMessage(message, peerId);
      } catch (error) {
        console.error(`❌ DirectWebRTC: Error handling message from ${playerName}:`, error);
      }
    };

    dataChannel.onerror = (error: any) => {
      console.error(`❌ DirectWebRTC: Data channel error with ${playerName}:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`🔌 DirectWebRTC: Data channel closed with ${playerName}`);
    };
  }

  // Send message via data channel
  public sendMessage(peerId: string, message: any): void {
    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel && dataChannel.readyState === 'open') {
      dataChannel.send(JSON.stringify(message));
    } else {
      console.warn(`⚠️ DirectWebRTC: Cannot send message to ${peerId} - data channel not ready`);
    }
  }

  // Close connection
  public closeConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      connection.close();
      this.connections.delete(peerId);
      this.dataChannels.delete(peerId);
      console.log(`🔌 DirectWebRTC: Closed connection to ${peerId}`);
    }
  }

  // Get connection
  public getConnection(peerId: string): RTCPeerConnection | undefined {
    return this.connections.get(peerId);
  }

  // Get data channel
  public getDataChannel(peerId: string): RTCDataChannel | undefined {
    return this.dataChannels.get(peerId);
  }
}

export default DirectWebRTCService.getInstance();
