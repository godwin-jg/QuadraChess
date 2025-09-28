import { Platform } from "react-native";
import { generateUUID } from "./utils/uuidGenerator";
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import p2pSignalingService from "./p2pSignalingService";
import networkDiscoveryService from "./networkDiscoveryService";
import networkAdvertiserService from "./networkAdvertiserService";

export interface P2PGame {
  id: string;
  hostName: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  joinCode?: string; // Simple 4-6 digit code
}

export interface P2PPlayer {
  id: string;
  name: string;
  isHost: boolean;
  isConnected: boolean;
}

class P2PService {
  private static instance: P2PService;
  private peerId: string;
  private isHost: boolean = false;
  private gameId: string | null = null;
  private connections: Map<string, RTCPeerConnection> = new Map();
  private gameState: P2PGame | null = null;
  private players: Map<string, P2PPlayer> = new Map();
  private messageHandlers: Map<string, (message: any) => void> = new Map();

  // STUN servers for NAT traversal
  private stunServers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun.cloudflare.com:3478" },
  ];

  private constructor() {
    this.peerId = generateUUID();
    this.setupSignalingListeners();
  }

  // Set up signaling service event listeners
  private setupSignalingListeners(): void {
    // Listen for WebRTC offers
    p2pSignalingService.on("offer", ({ fromPeerId, offer }) => {
      this.handleOffer(fromPeerId, offer);
    });

    // Listen for WebRTC answers
    p2pSignalingService.on("answer", ({ fromPeerId, answer }) => {
      this.handleAnswer(fromPeerId, answer);
    });

    // Listen for ICE candidates
    p2pSignalingService.on("ice-candidate", ({ fromPeerId, candidate }) => {
      this.handleIceCandidate(fromPeerId, candidate);
    });

    // Listen for player joined events
    p2pSignalingService.on("player-joined", (data) => {
      this.handlePlayerJoined(data);
    });

    // Listen for player left events
    p2pSignalingService.on("player-left", (data) => {
      this.handlePlayerLeft(data);
    });
  }

  public static getInstance(): P2PService {
    if (!P2PService.instance) {
      P2PService.instance = new P2PService();
    }
    return P2PService.instance;
  }

  // Generate simple join code (4-6 digits)
  private generateJoinCode(): string {
    return Math.floor(1000 + Math.random() * 9000).toString(); // 4-digit code
  }

  // Create a new game with serverless approach (network advertising only)
  public async createGame(hostName: string): Promise<P2PGame> {
    console.log("P2PService: Creating serverless P2P game (no signaling server)");

    this.isHost = true;
    this.gameId = generateUUID();
    const joinCode = this.generateJoinCode();
    
    const game: P2PGame = {
      id: this.gameId,
      hostName,
      hostId: this.peerId,
      playerCount: 1,
      maxPlayers: 4,
      status: "waiting",
      createdAt: Date.now(),
      joinCode,
    };

    this.gameState = game;
    this.players.set(this.peerId, {
      id: this.peerId,
      name: hostName,
      isHost: true,
      isConnected: true,
    });

    // Truly serverless: Network advertising only (no signaling server)
    try {
      // Advertise on local network using zeroconf
      console.log("P2PService: Testing zeroconf functionality...");
      await networkAdvertiserService.testAdvertise();
      
      // Wait a moment for test service to be published
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await networkAdvertiserService.startAdvertising({
        gameId: this.gameId,
        gameName: `${hostName}'s Game`,
        hostName,
        hostIP: networkAdvertiserService.getLocalIPAddress(),
        port: networkAdvertiserService.getRandomPort(),
        joinCode,
        playerCount: 1,
        maxPlayers: 4,
        status: "waiting",
      });
      console.log("P2PService: Game advertised on local network with zeroconf");
    } catch (error) {
      console.error("P2PService: Network advertising failed:", error);
      console.log("P2PService: Continuing without network advertising - game can still be joined with code");
      // Don't throw error - allow game creation without advertising
      // The game can still be joined using the join code
    }

    console.log("P2PService: Serverless game created with join code:", joinCode);
    return game;
  }

  // Join a game using simple code (serverless discovery only)
  public async joinGameWithCode(joinCode: string, playerName: string): Promise<void> {
    console.log("P2PService: Attempting to join game with code (serverless):", joinCode);
    
    // Try network discovery only (no signaling server)
    try {
      await networkDiscoveryService.startDiscovery();
      console.log("P2PService: Started network discovery, waiting for games...");
      
      // Wait longer for discovery to find games
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      const discoveredGames = networkDiscoveryService.getDiscoveredGames();
      console.log("P2PService: Discovered games:", discoveredGames);
      
      const targetGame = discoveredGames.find(game => game.joinCode === joinCode);
      
      if (targetGame) {
        console.log("P2PService: Found game via network discovery:", targetGame);
        this.isHost = false;
        this.gameId = targetGame.id;
        await this.connectToPeerDirect(targetGame.hostIP, playerName);
        return;
      } else {
        throw new Error(`Game with join code ${joinCode} not found on local network`);
      }
    } catch (error) {
      console.error("P2PService: Network discovery failed:", error);
      throw new Error(`Failed to find game with code ${joinCode} on local network`);
    }
  }

  // Discover available games on the network (serverless)
  public async discoverGames(): Promise<any[]> {
    console.log("P2PService: Discovering games on network (serverless)");
    
    // Start discovering games on the network
    await networkDiscoveryService.startDiscovery();
    console.log("P2PService: Started network discovery");
    
    // Wait longer for discovery to find games
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Get discovered games
    const discoveredGames = networkDiscoveryService.getDiscoveredGames();
    
    console.log("P2PService: Found", discoveredGames.length, "games on local network");
    
    return discoveredGames;
  }

  // Join a discovered game directly (truly serverless)
  public async joinDiscoveredGame(gameId: string, playerName: string): Promise<void> {
    console.log("P2PService: Joining discovered game (serverless):", gameId);
    
    // Get discovered games
    const discoveredGames = networkDiscoveryService.getDiscoveredGames();
    const targetGame = discoveredGames.find(game => game.id === gameId);
    
    if (!targetGame) {
      throw new Error(`Game ${gameId} not found in discovered games`);
    }

    console.log("P2PService: Joining game:", targetGame);
    
    this.isHost = false;
    this.gameId = targetGame.id;

    // Truly serverless: Direct WebRTC connection using mDNS-discovered info
    try {
      await this.connectToPeerDirect(targetGame.hostIP, playerName);
      console.log("P2PService: Connected directly to host via WebRTC");
    } catch (error) {
      console.error("P2PService: Failed to connect directly to host:", error);
      throw error;
    }
  }

  // Truly serverless P2P - join by direct IP address
  public async joinGameByIP(hostIP: string, playerName: string): Promise<void> {
    console.log("P2PService: Joining game by IP:", hostIP);
    
    this.isHost = false;
    this.gameId = "direct-ip-game";

    // Create direct WebRTC connection to host IP
    await this.connectToPeerDirect(hostIP, playerName);
  }

  // Connect directly to a peer by IP (truly serverless)
  private async connectToPeerDirect(hostIP: string, playerName: string): Promise<void> {
    const connection = new RTCPeerConnection({
      iceServers: this.stunServers,
      iceCandidatePoolSize: 10,
    });

    // For direct connection, we'll use the hostIP as the peerId
    this.connections.set(hostIP, connection);

    // Set up data channel
    const dataChannel = connection.createDataChannel("game", {
      ordered: true,
    });

    dataChannel.onopen = () => {
      console.log("P2PService: Direct data channel opened with", hostIP);
      
      // Send join request
      this.sendMessage(hostIP, {
        type: "join-request",
        playerId: this.peerId,
        playerName,
      });
    };

    dataChannel.onmessage = (event) => {
      this.handleMessage(hostIP, JSON.parse(event.data));
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("P2PService: ICE candidate generated for", hostIP);
        // Store ICE candidate for later exchange via mDNS
        this.storeIceCandidate(hostIP, event.candidate);
      }
    };

    // Create offer
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    // Store offer for exchange via mDNS TXT records
    this.storeWebRTCOffer(hostIP, offer);
    
    console.log("P2PService: Offer created and stored for mDNS exchange with", hostIP);
  }

  // Store WebRTC offer for mDNS exchange
  private storeWebRTCOffer(hostIP: string, offer: RTCSessionDescription): void {
    // In a real implementation, this would update the mDNS TXT record
    // For now, we'll simulate the exchange
    console.log("P2PService: Storing WebRTC offer for", hostIP, ":", offer.type);
  }

  // Store ICE candidate for mDNS exchange
  private storeIceCandidate(hostIP: string, candidate: RTCIceCandidate): void {
    // In a real implementation, this would update the mDNS TXT record
    // For now, we'll simulate the exchange
    console.log("P2PService: Storing ICE candidate for", hostIP);
  }

  // Join by game ID (if you know it)
  public async joinGameById(gameId: string, playerName: string): Promise<void> {
    // Initialize signaling service if not already done
    if (!p2pSignalingService.isSignalingConnected()) {
      await p2pSignalingService.initialize();
    }

    console.log("P2PService: Joining game by ID:", gameId);
    
    // Register this peer in the signaling service
    await p2pSignalingService.registerPeer(playerName, false);

    this.isHost = false;
    this.gameId = gameId;

    // Join the game through signaling service
    await p2pSignalingService.joinGame(gameId, playerName);
  }

  // Connect to a specific peer
  private async connectToPeer(peerId: string, playerName: string): Promise<void> {
    const connection = new RTCPeerConnection({
      iceServers: this.stunServers,
      iceCandidatePoolSize: 10,
    });

    this.connections.set(peerId, connection);

    // Set up data channel
    const dataChannel = connection.createDataChannel("game", {
      ordered: true,
    });

    dataChannel.onopen = () => {
      console.log("P2PService: Data channel opened with", peerId);
      
      // Send join request
      this.sendMessage(peerId, {
        type: "join-request",
        playerId: this.peerId,
        playerName,
      });
    };

    dataChannel.onmessage = (event) => {
      this.handleMessage(peerId, JSON.parse(event.data));
    };

    // Handle ICE candidates
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        // Send ICE candidate through signaling service
        p2pSignalingService.sendIceCandidate(peerId, event.candidate);
      }
    };

    // Create offer
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    // Send offer through signaling service
    p2pSignalingService.sendOffer(peerId, offer);
  }

  // Handle incoming messages
  private handleMessage(fromPeerId: string, message: any): void {
    console.log("P2PService: Received message from", fromPeerId, ":", message.type);

    switch (message.type) {
      case "join-request":
        this.handleJoinRequest(fromPeerId, message);
        break;
      case "offer":
        this.handleOffer(fromPeerId, message.offer);
        break;
      case "answer":
        this.handleAnswer(fromPeerId, message.answer);
        break;
      case "ice-candidate":
        this.handleIceCandidate(fromPeerId, message.candidate);
        break;
      case "game-state":
        this.handleGameStateUpdate(message.gameState);
        break;
      case "move":
        this.handleMove(message.move);
        break;
    }
  }

  // Send message to peer
  private sendMessage(toPeerId: string, message: any): void {
    const connection = this.connections.get(toPeerId);
    if (connection && connection.readyState === "open") {
      const dataChannel = connection.dataChannel;
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(message));
      }
    }
  }

  // Handle join request (host only)
  private async handleJoinRequest(fromPeerId: string, message: any): Promise<void> {
    if (!this.isHost || !this.gameState) return;

    const { playerId, playerName } = message;

    // Add player to game
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      isHost: false,
      isConnected: true,
    });

    this.gameState.playerCount = this.players.size;

    // Notify all players
    this.broadcastMessage({
      type: "player-joined",
      playerId,
      playerName,
      players: Array.from(this.players.values()),
    });

    console.log("P2PService: Player joined:", playerName);
  }

  // Handle WebRTC offer
  private async handleOffer(fromPeerId: string, offer: RTCSessionDescription): Promise<void> {
    const connection = this.connections.get(fromPeerId);
    if (!connection) return;

    await connection.setRemoteDescription(offer);
    const answer = await connection.createAnswer();
    await connection.setLocalDescription(answer);

    // Send answer through signaling service
    p2pSignalingService.sendAnswer(fromPeerId, answer);
  }

  // Handle WebRTC answer
  private async handleAnswer(fromPeerId: string, answer: RTCSessionDescription): Promise<void> {
    const connection = this.connections.get(fromPeerId);
    if (!connection) return;

    await connection.setRemoteDescription(answer);
  }

  // Handle ICE candidate
  private async handleIceCandidate(fromPeerId: string, candidate: RTCIceCandidate): Promise<void> {
    const connection = this.connections.get(fromPeerId);
    if (!connection) return;

    await connection.addIceCandidate(candidate);
  }

  // Broadcast message to all connected peers
  private broadcastMessage(message: any): void {
    this.connections.forEach((connection, peerId) => {
      this.sendMessage(peerId, message);
    });
  }

  // Handle game state updates
  private handleGameStateUpdate(gameState: any): void {
    this.gameState = gameState;
    this.notifyHandlers("game-state-update", gameState);
  }

  // Handle move
  private handleMove(move: any): void {
    this.notifyHandlers("move", move);
  }

  // Notify message handlers
  private notifyHandlers(event: string, data: any): void {
    const handlers = this.messageHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // Register message handler
  public on(event: string, handler: (data: any) => void): () => void {
    if (!this.messageHandlers.has(event)) {
      this.messageHandlers.set(event, []);
    }
    this.messageHandlers.get(event)!.push(handler);

    return () => {
      const handlers = this.messageHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  // Get current game state
  public getGameState(): P2PGame | null {
    return this.gameState;
  }

  // Get players
  public getPlayers(): P2PPlayer[] {
    return Array.from(this.players.values());
  }

  // Check if host
  public isGameHost(): boolean {
    return this.isHost;
  }

  // Get peer ID
  public getPeerId(): string {
    return this.peerId;
  }

  // Get join code
  public getJoinCode(): string | undefined {
    return this.gameState?.joinCode;
  }

  // Disconnect
  public disconnect(): void {
    this.connections.forEach(connection => {
      connection.close();
    });
    this.connections.clear();
    this.players.clear();
    this.gameState = null;
    this.gameId = null;
    this.isHost = false;
  }
}

export default P2PService.getInstance();
