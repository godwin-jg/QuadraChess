import { generateUUID } from '../utils/uuidGenerator';

export interface WebRTCConnectionConfig {
  iceServers: RTCIceServer[];
  iceCandidatePoolSize: number;
  iceTransportPolicy: RTCIceTransportPolicy;
  bundlePolicy: RTCBundlePolicy;
  rtcpMuxPolicy: RTCRtcpMuxPolicy;
}

export interface DataChannelMessage {
  type: string;
  [key: string]: any;
}

export interface WebRTCConnectionEvents {
  onConnectionStateChange: (state: string) => void;
  onDataChannelOpen: (dataChannel: RTCDataChannel, peerId: string) => void;
  onDataChannelMessage: (message: DataChannelMessage, peerId: string) => void;
  onIceCandidate: (candidate: RTCIceCandidate) => void;
  onConnectionFailed: (error: Error) => void;
}

export class WebRTCConnectionManager {
  private connections: Map<string, RTCPeerConnection> = new Map();
  private dataChannels: Map<string, RTCDataChannel> = new Map();
  private eventHandlers: WebRTCConnectionEvents;
  private config: WebRTCConnectionConfig;

  constructor(eventHandlers: WebRTCConnectionEvents, config: WebRTCConnectionConfig) {
    this.eventHandlers = eventHandlers;
    this.config = config;
  }

  /**
   * Create a new WebRTC connection for a peer
   */
  public createConnection(peerId: string): RTCPeerConnection {
    console.log(`🔗 WebRTCManager: Creating connection for peer ${peerId}`);
    
    const connection = new RTCPeerConnection({
      iceServers: this.config.iceServers,
      iceCandidatePoolSize: this.config.iceCandidatePoolSize,
      iceTransportPolicy: this.config.iceTransportPolicy,
      bundlePolicy: this.config.bundlePolicy,
      rtcpMuxPolicy: this.config.rtcpMuxPolicy,
    });

    this.setupConnectionEventListeners(connection, peerId);
    this.connections.set(peerId, connection);
    
    return connection;
  }

  /**
   * Create a data channel for the connection (client side)
   */
  public createDataChannel(peerId: string, channelName: string = "game-data"): RTCDataChannel {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    console.log(`🔗 WebRTCManager: Creating data channel for peer ${peerId}`);
    const dataChannel = connection.createDataChannel(channelName, { 
      ordered: true 
    });

    this.setupDataChannelEventListeners(dataChannel, peerId);
    this.dataChannels.set(peerId, dataChannel);
    
    return dataChannel;
  }

  /**
   * Setup data channel listeners for incoming connections (host side)
   */
  public setupIncomingDataChannelListener(connection: RTCPeerConnection, peerId: string): void {
    connection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      console.log(`🔗 WebRTCManager: Received data channel from peer ${peerId}`);
      
      this.setupDataChannelEventListeners(dataChannel, peerId);
      this.dataChannels.set(peerId, dataChannel);
      
      this.eventHandlers.onDataChannelOpen(dataChannel, peerId);
    };
  }

  /**
   * Create and set local description (offer/answer)
   */
  public async createOffer(peerId: string): Promise<RTCSessionDescriptionInit> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    console.log(`🔗 WebRTCManager: Creating offer for peer ${peerId}`);
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);
    
    return offer;
  }

  /**
   * Create and set local description (answer)
   */
  public async createAnswer(peerId: string, offer: RTCSessionDescriptionInit): Promise<RTCSessionDescriptionInit> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    console.log(`🔗 WebRTCManager: Creating answer for peer ${peerId}`);
    await connection.setRemoteDescription(offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);
    
    return answer;
  }

  /**
   * Set remote description
   */
  public async setRemoteDescription(peerId: string, description: RTCSessionDescriptionInit): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    console.log(`🔗 WebRTCManager: Setting remote description for peer ${peerId}`);
    await connection.setRemoteDescription(description);
  }

  /**
   * Add ICE candidate
   */
  public async addIceCandidate(peerId: string, candidate: RTCIceCandidateInit): Promise<void> {
    const connection = this.connections.get(peerId);
    if (!connection) {
      throw new Error(`No connection found for peer ${peerId}`);
    }

    await connection.addIceCandidate(candidate);
  }

  /**
   * Send message through data channel
   */
  public sendMessage(peerId: string, message: DataChannelMessage): void {
    const dataChannel = this.dataChannels.get(peerId);
    if (!dataChannel || dataChannel.readyState !== 'open') {
      console.warn(`🔗 WebRTCManager: Cannot send message to peer ${peerId} - data channel not open`);
      return;
    }

    console.log(`📤 WebRTCManager: Sending message to peer ${peerId}:`, message.type);
    dataChannel.send(JSON.stringify(message));
  }

  /**
   * Get connection state
   */
  public getConnectionState(peerId: string): string | null {
    const connection = this.connections.get(peerId);
    return connection ? connection.connectionState : null;
  }

  /**
   * Check if data channel is open
   */
  public isDataChannelOpen(peerId: string): boolean {
    const dataChannel = this.dataChannels.get(peerId);
    return dataChannel ? dataChannel.readyState === 'open' : false;
  }

  /**
   * Close connection for a peer
   */
  public closeConnection(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (connection) {
      console.log(`🔗 WebRTCManager: Closing connection for peer ${peerId}`);
      connection.close();
      this.connections.delete(peerId);
    }

    const dataChannel = this.dataChannels.get(peerId);
    if (dataChannel) {
      dataChannel.close();
      this.dataChannels.delete(peerId);
    }
  }

  /**
   * Close all connections
   */
  public closeAllConnections(): void {
    console.log(`🔗 WebRTCManager: Closing all connections`);
    
    this.connections.forEach((connection, peerId) => {
      connection.close();
    });
    
    this.dataChannels.forEach((dataChannel, peerId) => {
      dataChannel.close();
    });
    
    this.connections.clear();
    this.dataChannels.clear();
  }

  /**
   * Get all active peer IDs
   */
  public getActivePeerIds(): string[] {
    return Array.from(this.connections.keys());
  }

  /**
   * Setup connection event listeners
   */
  private setupConnectionEventListeners(connection: RTCPeerConnection, peerId: string): void {
    connection.onconnectionstatechange = () => {
      const state = connection.connectionState;
      console.log(`🔗 WebRTCManager: Connection state changed to: ${state} for peer ${peerId}`);
      this.eventHandlers.onConnectionStateChange(state);
      
      if (state === 'failed') {
        this.eventHandlers.onConnectionFailed(new Error(`WebRTC connection failed for peer ${peerId}`));
      }
    };

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🔗 WebRTCManager: ICE candidate generated for peer ${peerId}`);
        this.eventHandlers.onIceCandidate(event.candidate);
      }
    };
  }

  /**
   * Setup data channel event listeners
   */
  private setupDataChannelEventListeners(dataChannel: RTCDataChannel, peerId: string): void {
    dataChannel.onopen = () => {
      console.log(`✅ WebRTCManager: Data channel opened for peer ${peerId}`);
      this.eventHandlers.onDataChannelOpen(dataChannel, peerId);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: DataChannelMessage = JSON.parse(event.data);
        console.log(`📥 WebRTCManager: Received message from peer ${peerId}:`, message.type);
        this.eventHandlers.onDataChannelMessage(message, peerId);
      } catch (error) {
        console.error(`❌ WebRTCManager: Failed to parse message from peer ${peerId}:`, error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`❌ WebRTCManager: Data channel error for peer ${peerId}:`, error);
    };

    dataChannel.onclose = () => {
      console.log(`🔗 WebRTCManager: Data channel closed for peer ${peerId}`);
    };
  }

  /**
   * Setup data channel listeners with custom handlers
   */
  public setupDataChannelListeners(
    dataChannel: RTCDataChannel,
    peerId: string,
    playerName: string,
    onMessage: (message: any) => void,
    onOpen: () => void,
    onClose: () => void,
    onError: (error: any) => void
  ): void {
    console.log(`🔗 WebRTCManager: Setting up data channel listeners for ${playerName} (${peerId})`);
    
    dataChannel.onopen = () => {
      console.log(`✅ WebRTCManager: Data channel opened with ${playerName}`);
      onOpen();
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log(`📥 WebRTCManager: Received message from ${playerName}:`, message.type);
        onMessage(message);
      } catch (error) {
        console.error(`❌ WebRTCManager: Failed to parse message from ${playerName}:`, error);
        onError(error);
      }
    };

    dataChannel.onerror = (error) => {
      console.error(`❌ WebRTCManager: Data channel error with ${playerName}:`, error);
      onError(error);
    };

    dataChannel.onclose = () => {
      console.log(`🔗 WebRTCManager: Data channel closed with ${playerName}`);
      onClose();
    };
  }
}

