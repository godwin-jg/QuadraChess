import { RTCDataChannel, RTCPeerConnection } from "react-native-webrtc";
import p2pSignalingService from "./p2pSignalingService";

// Simple UUID generation without crypto dependency
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface P2PPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isConnected: boolean;
  lastSeen: number;
}

export interface P2PGameState {
  gameId: string;
  hostId: string;
  players: Map<string, P2PPlayer>;
  currentPlayerTurn: string;
  boardState: any[][];
  gameStatus: "waiting" | "active" | "finished";
  history: any[];
  historyIndex: number;
}

export interface P2PMessage {
  type: "join" | "leave" | "move" | "gameState" | "ping" | "pong" | "error";
  from: string;
  to?: string;
  data: any;
  timestamp: number;
  messageId: string;
}

export interface P2PConnection {
  peerId: string;
  connection: RTCPeerConnection;
  dataChannel: RTCDataChannel | null;
  isConnected: boolean;
  lastPing: number;
}

class P2PService {
  private peerId: string;
  private isHost: boolean = false;
  private gameId: string | null = null;
  private connections: Map<string, P2PConnection> = new Map();
  private gameState: P2PGameState | null = null;
  private messageHandlers: Map<string, (message: P2PMessage) => void> =
    new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private stunServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ];

  constructor() {
    this.peerId = generateUUID();
    this.setupPingInterval();
  }

  // Initialize P2P service
  async initialize(signalingServerUrl?: string): Promise<void> {
    console.log("P2PService: Initializing P2P service with ID:", this.peerId);

    // Initialize signaling service
    await p2pSignalingService.initialize(signalingServerUrl);

    // Set up signaling event handlers
    this.setupSignalingHandlers();
  }

  // Create a new game (host)
  async createGame(
    playerName: string
  ): Promise<{ gameId: string; playerId: string }> {
    this.isHost = true;
    this.gameId = uuidv4();

    const hostPlayer: P2PPlayer = {
      id: this.peerId,
      name: playerName,
      color: "r", // Host gets red
      isHost: true,
      isConnected: true,
      lastSeen: Date.now(),
    };

    this.gameState = {
      gameId: this.gameId,
      hostId: this.peerId,
      players: new Map([[this.peerId, hostPlayer]]),
      currentPlayerTurn: "r",
      boardState: [],
      gameStatus: "waiting",
      history: [],
      historyIndex: 0,
    };

    // Register with signaling server
    p2pSignalingService.registerPeer(this.gameId, true, playerName);

    console.log("P2PService: Game created:", this.gameId);
    return { gameId: this.gameId, playerId: this.peerId };
  }

  // Join an existing game
  async joinGame(
    gameId: string,
    playerName: string
  ): Promise<{ gameId: string; playerId: string }> {
    this.isHost = false;
    this.gameId = gameId;

    console.log("P2PService: Attempting to join game:", gameId);

    // Register with signaling server
    p2pSignalingService.registerPeer(gameId, false, playerName);

    // Join the game through signaling server
    await p2pSignalingService.joinGame(gameId, playerName);

    return { gameId, playerId: this.peerId };
  }

  // Create peer connection
  private async createPeerConnection(
    peerId: string
  ): Promise<RTCPeerConnection> {
    const configuration = {
      iceServers: this.stunServers,
      iceCandidatePoolSize: 10,
    };

    const connection = new RTCPeerConnection(configuration);

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        this.sendSignalingMessage(peerId, {
          type: "ice-candidate",
          candidate: event.candidate,
        });
      }
    };

    // Handle connection state changes
    connection.onconnectionstatechange = () => {
      console.log(
        "P2PService: Connection state changed:",
        connection.connectionState
      );

      const p2pConnection = this.connections.get(peerId);
      if (p2pConnection) {
        p2pConnection.isConnected = connection.connectionState === "connected";
      }

      if (connection.connectionState === "connected") {
        this.setupDataChannel(peerId, connection);
      } else if (
        connection.connectionState === "disconnected" ||
        connection.connectionState === "failed"
      ) {
        this.handlePeerDisconnection(peerId);
      }
    };

    return connection;
  }

  // Setup data channel for game communication
  private setupDataChannel(
    peerId: string,
    connection: RTCPeerConnection
  ): void {
    const dataChannel = connection.createDataChannel("gameData", {
      ordered: true,
    });

    dataChannel.onopen = () => {
      console.log("P2PService: Data channel opened for peer:", peerId);

      const p2pConnection = this.connections.get(peerId);
      if (p2pConnection) {
        p2pConnection.dataChannel = dataChannel;
        p2pConnection.isConnected = true;
      }

      // Send initial game state if we're the host
      if (this.isHost && this.gameState) {
        this.sendGameState(peerId);
      }
    };

    dataChannel.onmessage = (event) => {
      try {
        const message: P2PMessage = JSON.parse(event.data);
        this.handleMessage(peerId, message);
      } catch (error) {
        console.error("P2PService: Error parsing message:", error);
      }
    };

    dataChannel.onclose = () => {
      console.log("P2PService: Data channel closed for peer:", peerId);
      this.handlePeerDisconnection(peerId);
    };
  }

  // Handle incoming data channel
  private handleIncomingDataChannel(
    peerId: string,
    connection: RTCPeerConnection
  ): void {
    connection.ondatachannel = (event) => {
      const dataChannel = event.channel;

      dataChannel.onopen = () => {
        console.log(
          "P2PService: Incoming data channel opened for peer:",
          peerId
        );

        const p2pConnection = this.connections.get(peerId);
        if (p2pConnection) {
          p2pConnection.dataChannel = dataChannel;
          p2pConnection.isConnected = true;
        }
      };

      dataChannel.onmessage = (event) => {
        try {
          const message: P2PMessage = JSON.parse(event.data);
          this.handleMessage(peerId, message);
        } catch (error) {
          console.error("P2PService: Error parsing message:", error);
        }
      };

      dataChannel.onclose = () => {
        console.log(
          "P2PService: Incoming data channel closed for peer:",
          peerId
        );
        this.handlePeerDisconnection(peerId);
      };
    };
  }

  // Setup signaling handlers
  private setupSignalingHandlers(): void {
    // Handle incoming offers
    p2pSignalingService.on(
      "offer",
      async (data: {
        fromPeerId: string;
        offer: RTCSessionDescriptionInit;
      }) => {
        await this.handleIncomingOffer(data.fromPeerId, data.offer);
      }
    );

    // Handle incoming answers
    p2pSignalingService.on(
      "answer",
      async (data: {
        fromPeerId: string;
        answer: RTCSessionDescriptionInit;
      }) => {
        await this.handleIncomingAnswer(data.fromPeerId, data.answer);
      }
    );

    // Handle incoming ICE candidates
    p2pSignalingService.on(
      "ice-candidate",
      async (data: { fromPeerId: string; candidate: RTCIceCandidateInit }) => {
        await this.handleIncomingIceCandidate(data.fromPeerId, data.candidate);
      }
    );

    // Handle player joined
    p2pSignalingService.on(
      "player-joined",
      (data: { playerId: string; playerName: string; players: any[] }) => {
        this.handlePlayerJoined(data);
      }
    );

    // Handle player left
    p2pSignalingService.on(
      "player-left",
      (data: { playerId: string; players: any[] }) => {
        this.handlePlayerLeft(data);
      }
    );
  }

  // Handle incoming offer
  private async handleIncomingOffer(
    fromPeerId: string,
    offer: RTCSessionDescriptionInit
  ): Promise<void> {
    console.log("P2PService: Handling incoming offer from:", fromPeerId);

    const connection = await this.createPeerConnection(fromPeerId);
    this.connections.set(fromPeerId, {
      peerId: fromPeerId,
      connection,
      dataChannel: null,
      isConnected: false,
      lastPing: Date.now(),
    });

    await connection.setRemoteDescription(offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    p2pSignalingService.sendAnswer(fromPeerId, answer);
  }

  // Handle incoming answer
  private async handleIncomingAnswer(
    fromPeerId: string,
    answer: RTCSessionDescriptionInit
  ): Promise<void> {
    console.log("P2PService: Handling incoming answer from:", fromPeerId);

    const connection = this.connections.get(fromPeerId);
    if (connection) {
      await connection.setRemoteDescription(answer);
    }
  }

  // Handle incoming ICE candidate
  private async handleIncomingIceCandidate(
    fromPeerId: string,
    candidate: RTCIceCandidateInit
  ): Promise<void> {
    console.log(
      "P2PService: Handling incoming ICE candidate from:",
      fromPeerId
    );

    const connection = this.connections.get(fromPeerId);
    if (connection) {
      await connection.addIceCandidate(candidate);
    }
  }

  // Handle player joined
  private handlePlayerJoined(data: {
    playerId: string;
    playerName: string;
    players: any[];
  }): void {
    console.log("P2PService: Player joined:", data);

    if (this.isHost && this.gameState) {
      // Update game state with new player
      const colors = ["r", "b", "y", "g"];
      const usedColors = Array.from(this.gameState.players.values()).map(
        (p) => p.color
      );
      const availableColor = colors.find((c) => !usedColors.includes(c));

      if (availableColor) {
        const newPlayer: P2PPlayer = {
          id: data.playerId,
          name: data.playerName,
          color: availableColor,
          isHost: false,
          isConnected: false, // Will be true when WebRTC connection is established
          lastSeen: Date.now(),
        };

        this.gameState.players.set(data.playerId, newPlayer);

        // Notify all players about the update
        this.broadcastMessage({
          type: "gameState",
          from: this.peerId,
          data: { players: Array.from(this.gameState.players.values()) },
          timestamp: Date.now(),
          messageId: uuidv4(),
        });
      }
    }
  }

  // Handle player left
  private handlePlayerLeft(data: { playerId: string; players: any[] }): void {
    console.log("P2PService: Player left:", data);

    if (this.gameState) {
      this.gameState.players.delete(data.playerId);

      if (this.isHost) {
        this.broadcastMessage({
          type: "gameState",
          from: this.peerId,
          data: { players: Array.from(this.gameState.players.values()) },
          timestamp: Date.now(),
          messageId: uuidv4(),
        });
      }
    }
  }

  // Handle incoming message
  private handleMessage(fromPeerId: string, message: P2PMessage): void {
    console.log("P2PService: Received message from:", fromPeerId, message);

    // Update last seen
    if (this.gameState) {
      const player = this.gameState.players.get(fromPeerId);
      if (player) {
        player.lastSeen = Date.now();
      }
    }

    // Handle different message types
    switch (message.type) {
      case "join":
        this.handleJoinMessage(fromPeerId, message);
        break;
      case "leave":
        this.handleLeaveMessage(fromPeerId, message);
        break;
      case "move":
        this.handleMoveMessage(fromPeerId, message);
        break;
      case "gameState":
        this.handleGameStateMessage(fromPeerId, message);
        break;
      case "ping":
        this.handlePingMessage(fromPeerId, message);
        break;
      case "pong":
        this.handlePongMessage(fromPeerId, message);
        break;
      case "error":
        this.handleErrorMessage(fromPeerId, message);
        break;
    }

    // Notify message handlers
    this.messageHandlers.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error("P2PService: Error in message handler:", error);
      }
    });
  }

  // Send message to specific peer
  private sendMessage(toPeerId: string, message: P2PMessage): void {
    const connection = this.connections.get(toPeerId);
    if (connection?.dataChannel && connection.isConnected) {
      try {
        connection.dataChannel.send(JSON.stringify(message));
      } catch (error) {
        console.error("P2PService: Error sending message:", error);
      }
    }
  }

  // Broadcast message to all peers
  private broadcastMessage(message: P2PMessage): void {
    this.connections.forEach((connection, peerId) => {
      if (connection.isConnected) {
        this.sendMessage(peerId, message);
      }
    });
  }

  // Handle join message
  private handleJoinMessage(fromPeerId: string, message: P2PMessage): void {
    if (!this.isHost || !this.gameState) return;

    const { playerName } = message.data;
    const colors = ["r", "b", "y", "g"];
    const usedColors = Array.from(this.gameState.players.values()).map(
      (p) => p.color
    );
    const availableColor = colors.find((c) => !usedColors.includes(c));

    if (!availableColor) {
      this.sendMessage(fromPeerId, {
        type: "error",
        from: this.peerId,
        data: { message: "No available colors" },
        timestamp: Date.now(),
        messageId: uuidv4(),
      });
      return;
    }

    const newPlayer: P2PPlayer = {
      id: fromPeerId,
      name: playerName,
      color: availableColor,
      isHost: false,
      isConnected: true,
      lastSeen: Date.now(),
    };

    this.gameState.players.set(fromPeerId, newPlayer);

    // Send updated player list to all players
    this.broadcastMessage({
      type: "gameState",
      from: this.peerId,
      data: { players: Array.from(this.gameState.players.values()) },
      timestamp: Date.now(),
      messageId: uuidv4(),
    });
  }

  // Handle leave message
  private handleLeaveMessage(fromPeerId: string, message: P2PMessage): void {
    if (this.gameState) {
      this.gameState.players.delete(fromPeerId);

      if (this.isHost) {
        this.broadcastMessage({
          type: "gameState",
          from: this.peerId,
          data: { players: Array.from(this.gameState.players.values()) },
          timestamp: Date.now(),
          messageId: uuidv4(),
        });
      }
    }
  }

  // Handle move message
  private handleMoveMessage(fromPeerId: string, message: P2PMessage): void {
    if (!this.gameState) return;

    const { moveData } = message.data;

    // Validate move (basic validation)
    const player = this.gameState.players.get(fromPeerId);
    if (!player || player.color !== this.gameState.currentPlayerTurn) {
      this.sendMessage(fromPeerId, {
        type: "error",
        from: this.peerId,
        data: { message: "Not your turn" },
        timestamp: Date.now(),
        messageId: uuidv4(),
      });
      return;
    }

    // Process move and update game state
    // This would integrate with your existing game logic
    this.processMove(moveData);

    // Broadcast updated game state
    this.broadcastMessage({
      type: "gameState",
      from: this.peerId,
      data: {
        gameState: this.gameState,
        move: moveData,
      },
      timestamp: Date.now(),
      messageId: uuidv4(),
    });
  }

  // Handle game state message
  private handleGameStateMessage(
    fromPeerId: string,
    message: P2PMessage
  ): void {
    if (this.isHost) return; // Host doesn't accept game state from others

    const { gameState } = message.data;
    if (gameState) {
      this.gameState = gameState;
    }
  }

  // Handle ping message
  private handlePingMessage(fromPeerId: string, message: P2PMessage): void {
    this.sendMessage(fromPeerId, {
      type: "pong",
      from: this.peerId,
      data: { originalTimestamp: message.data.timestamp },
      timestamp: Date.now(),
      messageId: uuidv4(),
    });
  }

  // Handle pong message
  private handlePongMessage(fromPeerId: string, message: P2PMessage): void {
    const connection = this.connections.get(fromPeerId);
    if (connection) {
      connection.lastPing = Date.now();
    }
  }

  // Handle error message
  private handleErrorMessage(fromPeerId: string, message: P2PMessage): void {
    console.error("P2PService: Error from peer:", fromPeerId, message.data);
  }

  // Process move (placeholder - integrate with existing game logic)
  private processMove(moveData: any): void {
    // This would integrate with your existing game logic
    console.log("P2PService: Processing move:", moveData);
  }

  // Send game state to specific peer
  private sendGameState(peerId: string): void {
    if (!this.gameState) return;

    this.sendMessage(peerId, {
      type: "gameState",
      from: this.peerId,
      data: { gameState: this.gameState },
      timestamp: Date.now(),
      messageId: uuidv4(),
    });
  }

  // Handle peer disconnection
  private handlePeerDisconnection(peerId: string): void {
    console.log("P2PService: Peer disconnected:", peerId);

    this.connections.delete(peerId);

    if (this.gameState) {
      this.gameState.players.delete(peerId);

      if (this.isHost) {
        this.broadcastMessage({
          type: "gameState",
          from: this.peerId,
          data: { players: Array.from(this.gameState.players.values()) },
          timestamp: Date.now(),
          messageId: uuidv4(),
        });
      }
    }
  }

  // Setup ping interval for connection monitoring
  private setupPingInterval(): void {
    this.pingInterval = setInterval(() => {
      this.connections.forEach((connection, peerId) => {
        if (connection.isConnected) {
          this.sendMessage(peerId, {
            type: "ping",
            from: this.peerId,
            data: { timestamp: Date.now() },
            timestamp: Date.now(),
            messageId: uuidv4(),
          });
        }
      });
    }, 10000); // Ping every 10 seconds
  }

  // Public API methods
  public getPeerId(): string {
    return this.peerId;
  }

  public isGameHost(): boolean {
    return this.isHost;
  }

  public getGameId(): string | null {
    return this.gameId;
  }

  public getGameState(): P2PGameState | null {
    return this.gameState;
  }

  public getConnectedPeers(): string[] {
    return Array.from(this.connections.keys());
  }

  public onMessage(handler: (message: P2PMessage) => void): () => void {
    const handlerId = uuidv4();
    this.messageHandlers.set(handlerId, handler);

    return () => {
      this.messageHandlers.delete(handlerId);
    };
  }

  public makeMove(moveData: any): void {
    if (!this.gameState) return;

    this.broadcastMessage({
      type: "move",
      from: this.peerId,
      data: { moveData },
      timestamp: Date.now(),
      messageId: uuidv4(),
    });
  }

  public leaveGame(): void {
    if (this.gameId) {
      this.broadcastMessage({
        type: "leave",
        from: this.peerId,
        data: {},
        timestamp: Date.now(),
        messageId: uuidv4(),
      });
    }

    // Close all connections
    this.connections.forEach((connection) => {
      connection.connection.close();
    });
    this.connections.clear();

    // Reset state
    this.isHost = false;
    this.gameId = null;
    this.gameState = null;
  }

  // Discover available games
  public async discoverGames(): Promise<any[]> {
    return await p2pSignalingService.discoverGames();
  }

  // Connect to a specific peer (for host to initiate connection)
  public async connectToPeer(peerId: string): Promise<void> {
    if (this.connections.has(peerId)) {
      console.log("P2PService: Already connected to peer:", peerId);
      return;
    }

    const connection = await this.createPeerConnection(peerId);
    this.connections.set(peerId, {
      peerId,
      connection,
      dataChannel: null,
      isConnected: false,
      lastPing: Date.now(),
    });

    // Create offer
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    // Send offer through signaling server
    p2pSignalingService.sendOffer(peerId, offer);
  }

  // Start game (host only)
  public startGame(): void {
    if (!this.isHost || !this.gameState) return;

    this.gameState.gameStatus = "active";

    this.broadcastMessage({
      type: "gameState",
      from: this.peerId,
      data: { gameState: this.gameState },
      timestamp: Date.now(),
      messageId: uuidv4(),
    });
  }

  // Get available games
  public async getAvailableGames(): Promise<any[]> {
    return await this.discoverGames();
  }

  public disconnect(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }

    this.leaveGame();
    p2pSignalingService.disconnect();
  }
}

export default new P2PService();
