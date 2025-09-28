import { Platform } from "react-native";
import { generateUUID } from "./utils/uuidGenerator";
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import p2pSignalingService from "./p2pSignalingService";
import networkDiscoveryService from "./networkDiscoveryService";
import networkAdvertiserService from "./networkAdvertiserService";
import serverlessSignalingService from "./serverlessSignalingService";
import { store } from "../state/store";
import { syncP2PGameState, setIsConnected, setConnectionError, setIsLoading, setDiscoveredGames, setIsDiscovering, applyNetworkMove } from "../state/gameSlice";

export interface P2PGame {
  id: string;
  name: string; // ✅ Add name property
  hostName: string;
  hostId: string;
  hostIP?: string; // ✅ Add hostIP property for direct connections
  port?: number; // ✅ Add port property
  playerCount: number;
  maxPlayers: number;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  joinCode?: string; // Simple 4-6 digit code
  timestamp?: number; // ✅ Add timestamp property
  players?: P2PPlayer[]; // ✅ Add players array for state sync
}

export interface P2PPlayer {
  id: string;
  name: string;
  color: string; // ✅ Add color property
  isHost: boolean;
  isConnected: boolean;
  connectionState?: string; // ✅ Add this to track the WebRTC connection
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
    console.log("🚀 P2PService: createGame() method called with hostName:", hostName);
    
    // ✅ Call disconnect first to clean up any previous game session (without notifying UI)
    await this.disconnect(false);

    console.log("P2PService: Creating a new serverless P2P game...");

    this.isHost = true;
    this.gameId = generateUUID();
    const joinCode = this.generateJoinCode();
    
    const game: P2PGame = {
      id: this.gameId,
      name: `${hostName}'s Game`, // ✅ Add name property
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
      color: "r", // ✅ Host always gets red (first color)
      isHost: true,
      isConnected: true,
    });

    console.log('P2PService: Game state initialized:', this.gameState);
    console.log('P2PService: Players map size:', this.players.size);

    // ✅ Update Redux state directly
    console.log("🎮 P2PService: Updating Redux state with created game");
    console.log("🎮 P2PService: Game state being sent to Redux:", this.gameState);
    store.dispatch(syncP2PGameState({
      currentGame: this.gameState,
      players: Array.from(this.players.values()),
      isHost: true,
      canStartGame: false // Can't start until more players join
    }));

    // Truly serverless: Network advertising + HTTP signaling server
    try {
      // Start lightweight HTTP server for WebRTC signaling
      console.log("P2PService: Starting HTTP signaling server...");
      await serverlessSignalingService.startServer();
      console.log("P2PService: HTTP signaling server started successfully");

      // Verify server is actually running
      const serverPort = serverlessSignalingService.getPort();
      const serverIP = networkAdvertiserService.getLocalIPAddress();
      console.log(`P2PService: Server should be running on http://${serverIP}:${serverPort}`);

      // Advertise on local network using zeroconf
      console.log("P2PService: Testing zeroconf functionality...");
      await networkAdvertiserService.testAdvertise();
      
      // Wait a moment for test service to be published
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      await networkAdvertiserService.startAdvertising({
        gameId: this.gameId,
        gameName: `${hostName}'s Game`,
        hostName,
        hostId: this.peerId, // Add the host's unique ID
        hostIP: serverIP,
        port: serverPort, // Use HTTP server port
        joinCode,
        playerCount: 1,
        maxPlayers: 4,
        status: "waiting",
        timestamp: Date.now(), // Add current timestamp
      });
      console.log("P2PService: Game advertised on local network with zeroconf");
    } catch (error) {
      console.error("P2PService: Network setup failed:", error);
      console.log("P2PService: Continuing without network advertising - game can still be joined with code");
      // Don't throw error - allow game creation without advertising
      // The game can still be joined using the join code
    }

    console.log("P2PService: Serverless game created with join code:", joinCode);
    return game;
  }

  // Join a game using simple code (serverless discovery only)
  public async joinGameWithCode(joinCode: string, playerName: string): Promise<void> {
    // ✅ Call disconnect first to clean up any previous session (without notifying UI)
    await this.disconnect(false);

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
        await this.connectToPeerDirect(targetGame.hostIP, targetGame.hostId, playerName);
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
    store.dispatch(setIsDiscovering(true));
    store.dispatch(setConnectionError(null));
    
    try {
      // Start discovering games on the network
      await networkDiscoveryService.startDiscovery();
      console.log("P2PService: Started network discovery");
      
      // Wait longer for discovery to find games
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Get discovered games
      const discoveredGames = networkDiscoveryService.getDiscoveredGames();
      
      console.log("P2PService: Found", discoveredGames.length, "games on local network");
      console.log("P2PService: Discovered games:", discoveredGames);
      
      store.dispatch(setDiscoveredGames(discoveredGames));
      return discoveredGames;
    } catch (error) {
      console.error("P2PService: Error discovering games:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to discover games";
      store.dispatch(setConnectionError(errorMessage));
      throw error;
    } finally {
      store.dispatch(setIsDiscovering(false));
    }
  }

  // Join a discovered game directly (truly serverless)
  public async joinDiscoveredGame(gameId: string, playerName: string): Promise<void> {
    // ✅ Call disconnect first to clean up any previous session (without notifying UI)
    await this.disconnect(false);

    console.log("🚀 P2PService: joinDiscoveredGame called with gameId:", gameId, "playerName:", playerName);
    console.log("P2PService: Joining discovered game (serverless):", gameId);
    
    store.dispatch(setIsLoading(true));
    store.dispatch(setConnectionError(null));
    
    try {
      // Get discovered games
      const discoveredGames = networkDiscoveryService.getDiscoveredGames();
      const targetGame = discoveredGames.find(game => game.id === gameId);
      
      if (!targetGame) {
        console.error("P2PService: Game not found in discovered games:", gameId);
        throw new Error(`Game ${gameId} not found in discovered games`);
      }

      console.log("P2PService: Joining game:", targetGame);

      this.isHost = false;
      this.gameId = targetGame.id;

      // Truly serverless: Direct WebRTC connection using mDNS-discovered info
      await this.connectToPeerDirect(targetGame.hostIP, targetGame.hostId, playerName);
      console.log("P2PService: Connected directly to host via WebRTC");
      
      // Wait for game state to be received from host
      await this.waitForGameState();
      console.log("P2PService: Received game state from host");
    } catch (error) {
      console.error("P2PService: Failed to connect directly to host:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to join game";
      store.dispatch(setConnectionError(errorMessage));
      throw error;
    } finally {
      store.dispatch(setIsLoading(false));
    }
  }

  // Truly serverless P2P - join by direct IP address
  public async joinGameByIP(hostIP: string, playerName: string): Promise<void> {
    // ✅ Call disconnect first to clean up any previous session (without notifying UI)
    await this.disconnect(false);

    console.log("P2PService: Joining game by IP:", hostIP);

    this.isHost = false;
    this.gameId = "direct-ip-game";

    // Create direct WebRTC connection to host IP
    // For direct IP joins, we'll use the IP as the host ID (fallback)
    await this.connectToPeerDirect(hostIP, hostIP, playerName);
  }

  // Connect directly to a peer by IP (truly serverless)
  private async connectToPeerDirect(hostIP: string, hostId: string, playerName: string): Promise<void> {
    console.log(`🚀 P2PService: connectToPeerDirect called with hostIP: ${hostIP}, hostId: ${hostId}, playerName: ${playerName}`);
    
    const connection = new RTCPeerConnection({
      iceServers: this.stunServers,
      iceCandidatePoolSize: 10,
    });

    // Use the permanent hostId as the key, not the temporary IP
    this.connections.set(hostId, connection);

    // ✅ Add a state change listener
    connection.onconnectionstatechange = () => {
      console.log(`🔗 P2PService: Connection state changed to: ${connection.connectionState} for host ${hostId}`);
      // This logic is for the client's view of the host's connection
      const hostPlayer = this.players.get(hostId);
      if (hostPlayer) {
        // Create a new player object instead of modifying the existing one
        const updatedPlayer = {
          ...hostPlayer,
          connectionState: connection.connectionState,
          isConnected: (connection.connectionState === 'connected')
        };
        this.players.set(hostId, updatedPlayer);
        console.log(`🔗 P2PService: Updated host player connection state: ${connection.connectionState}`);
        this.notifyHandlers("players-updated", Array.from(this.players.values()));
      }
    };

    // ✅ 1. Create a buffer to store candidates locally
    const localCandidates: RTCIceCandidate[] = [];

    // 1. Create the data channel BEFORE creating the offer (initiator side)
    const dataChannel = connection.createDataChannel("game-data", { 
      ordered: true,
      reliable: true 
    });

    // Set up data channel listeners
    this.setupDataChannelListeners(dataChannel, hostId, playerName);

    // ✅ 2. Buffer ICE candidates instead of sending them immediately
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("P2PService: Buffering ICE candidate locally...");
        localCandidates.push(event.candidate);
      }
    };

    // Create offer
    console.log("P2PService: Creating WebRTC offer...");
    const offer = await connection.createOffer();
    console.log("P2PService: Offer created:", offer.type);
    await connection.setLocalDescription(offer);
    console.log("P2PService: Local description set");

    // Wait a moment for ICE candidates to be generated
    console.log("P2PService: Waiting for ICE candidates to be generated...");
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Send the offer with buffered candidates
    console.log("P2PService: About to send offer via HTTP with", localCandidates.length, "candidates...");
    await this.sendWebRTCOfferAndCandidatesViaHTTP(hostIP, hostId, offer, playerName, localCandidates);
    
    console.log("P2PService: Offer created and sent via HTTP to", hostIP);
    
    // Set up ICE candidate sending for any additional candidates discovered after the initial handshake
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("P2PService: Sending additional ICE candidate to host...");
        this.sendIceCandidateToHost(hostIP, event.candidate);
      }
    };
  }

  // Send WebRTC offer and buffered candidates via HTTP to host (truly serverless signaling)
  private async sendWebRTCOfferAndCandidatesViaHTTP(
    hostIP: string, 
    hostId: string, 
    offer: RTCSessionDescription, 
    playerName: string,
    candidates: RTCIceCandidate[] // Pass in the buffered candidates
  ): Promise<void> {
    const maxRetries = 3;
    const retryDelay = 1000;
    
    // First, test if the host server is reachable
    try {
      console.log(`🔍 P2PService: Testing host server connectivity to ${hostIP}:3001`);
      const healthResponse = await fetch(`http://${hostIP}:3001/health`, {
        method: 'GET',
        timeout: 5000,
      });
      if (healthResponse.ok) {
        const healthData = await healthResponse.json();
        console.log(`✅ P2PService: Host server is reachable:`, healthData);
      } else {
        console.warn(`⚠️ P2PService: Host server responded with status: ${healthResponse.status}`);
      }
    } catch (error) {
      console.error(`❌ P2PService: Host server is not reachable:`, error);
      throw new Error(`Host server at ${hostIP}:3001 is not reachable`);
    }
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 P2PService: Sending WebRTC offer via HTTP to ${hostIP} (attempt ${attempt}/${maxRetries})`);
        
        const offerPayload = {
          offer: offer,
          candidates: candidates, // ✅ Send candidates together with offer
          playerId: this.peerId,
          playerName: playerName,
          gameId: this.gameId,
        };
        
        console.log("P2PService: Offer payload:", offerPayload);
        console.log("P2PService: Sending to URL:", `http://${hostIP}:3001/api/webrtc/offer`);
        
        const response = await fetch(`http://${hostIP}:3001/api/webrtc/offer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(offerPayload),
          timeout: 10000, // 10 second timeout
        });

        console.log("P2PService: HTTP response status:", response.status);
        console.log("P2PService: HTTP response ok:", response.ok);
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error("P2PService: HTTP response error:", errorText);
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const answerData = await response.json();
        console.log("✅ P2PService: Received answer and candidates from host:", answerData);

        // Check if host returned an error
        if (answerData.error) {
          throw new Error(`Host error: ${answerData.error}`);
        }

        // Validate that we have a proper answer
        if (!answerData.answer || !answerData.answer.type || !answerData.answer.sdp) {
          throw new Error(`Invalid answer from host: ${JSON.stringify(answerData.answer)}`);
        }
        
        // Set the remote description
        const connection = this.connections.get(hostId);
        if (connection) {
          await connection.setRemoteDescription(new RTCSessionDescription(answerData.answer));
          console.log("✅ P2PService: Answer received and set.");

          // ✅ Process host's ICE candidates immediately
          if (answerData.candidates && Array.isArray(answerData.candidates)) {
            console.log(`P2PService: Processing ${answerData.candidates.length} ICE candidates from host...`);
            for (const candidate of answerData.candidates) {
              try {
                await connection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("P2PService: Added ICE candidate from host");
              } catch (error) {
                console.warn("P2PService: Failed to add ICE candidate from host:", error);
              }
            }
          }
          
          // ✅ Start polling for host's ICE candidates
          console.log("✅ P2PService: Starting to poll for host ICE candidates...");
          this.pollForHostCandidates(hostIP, hostId, connection);
        }
        
        // Success! Break out of retry loop
        return;
        
      } catch (error) {
        console.error(`❌ P2PService: Attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          console.error("❌ P2PService: All retry attempts failed");
          throw error;
        }
        
        console.log(`P2PService: Retrying in ${retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }
  }

  // Poll for host ICE candidates after receiving answer
  // ✅ Send ICE candidate to host via HTTP
  private async sendIceCandidateToHost(hostIP: string, candidate: RTCIceCandidate): Promise<void> {
    try {
      await fetch(`http://${hostIP}:3001/api/webrtc/ice-candidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate: candidate,
          playerId: this.peerId,
          gameId: this.gameId,
        }),
      });
      console.log("✅ P2PService: Sent ICE candidate to host");
    } catch (error) {
      console.error("❌ P2PService: Failed to send ICE candidate to host:", error);
    }
  }

  // ✅ Poll for host's ICE candidates
  private async pollForHostCandidates(hostIP: string, hostId: string, connection: any): Promise<void> {
    const maxPollAttempts = 10; // Poll for up to 20 seconds
    const pollInterval = 2000; // Poll every 2 seconds
    
    console.log("P2PService: Starting to poll for host ICE candidates from", hostIP);
    
    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      try {
        console.log(`P2PService: Polling for ICE candidates (attempt ${attempt}/${maxPollAttempts})`);
        
        const response = await fetch(`http://${hostIP}:3001/api/webrtc/get-candidates/${this.peerId}`, {
          method: 'GET',
        });
        
        if (response.ok) {
          const data = await response.json();
          const candidates = data.candidates || [];
          
          console.log(`P2PService: Received ${candidates.length} ICE candidates from host`);
          
          if (candidates.length > 0) {
            // Add each candidate to the connection
            for (const candidate of candidates) {
              try {
                await connection.addIceCandidate(new RTCIceCandidate(candidate));
                console.log("P2PService: Added host ICE candidate");
              } catch (error) {
                console.error("P2PService: Failed to add ICE candidate:", error);
              }
            }
            
            console.log(`✅ P2PService: Successfully added ${candidates.length} host ICE candidates`);
          }
        }
        
        // If no candidates yet, wait and try again
        if (attempt < maxPollAttempts) {
          console.log(`P2PService: Waiting ${pollInterval}ms before next poll...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (error) {
        console.error(`P2PService: Error polling for ICE candidates (attempt ${attempt}):`, error);
        
        if (attempt < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
    }
    
    console.log("✅ P2PService: Finished polling for ICE candidates");
  }

  // Set up data channel listeners (used by both peers) - public for signaling service
  public setupDataChannelListeners(dataChannel: RTCDataChannel, peerId: string, playerName: string): void {
    dataChannel.onopen = () => {
      console.log("✅ P2PService: Data channel is open! Let the game begin.");
      
      // Store the data channel for this peer
      const connection = this.connections.get(peerId);
      if (connection) {
        (connection as any).dataChannel = dataChannel;
      }

      // Send join request if we're joining (not hosting)
      if (!this.isHost) {
        console.log("P2PService: Sending join request to", peerId, "with playerId", this.peerId);
        // Add a small delay to ensure the connection is fully established
        setTimeout(() => {
          this.sendMessage(peerId, {
            type: "join-request",
            playerId: this.peerId,
            playerName,
            gameId: this.gameId,
          });
        }, 1000);
      }

      // Notify that connection is established
      this.notifyHandlers("connection-established", { peerId, playerName });
    };

    dataChannel.onclose = () => {
      console.log("❌ P2PService: Data channel has closed for", peerId);
      
      // Notify that connection is lost
      this.notifyHandlers("connection-lost", { peerId });
      
      // Clean up
      this.connections.delete(peerId);
      this.players.delete(peerId);
    };

    dataChannel.onerror = (error) => {
      console.error("❌ P2PService: Data channel error for", peerId, ":", error);
    };

    dataChannel.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("P2PService: Received message from", peerId, ":", message.type);
        this.handleMessage(peerId, message);
      } catch (error) {
        console.error("P2PService: Failed to parse message from", peerId, ":", error);
      }
    };
  }

  // Join by game ID (if you know it)
  public async joinGameById(gameId: string, playerName: string): Promise<void> {
    // ✅ Call disconnect first to clean up any previous session (without notifying UI)
    await this.disconnect(false);

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

  // Connect to a specific peer (host side - receives incoming connections)
  private async connectToPeer(peerId: string, playerName: string): Promise<void> {
    const connection = new RTCPeerConnection({
      iceServers: this.stunServers,
      iceCandidatePoolSize: 10,
    });

    this.connections.set(peerId, connection);

    // Host side: Listen for incoming data channel
    connection.ondatachannel = (event) => {
      const dataChannel = event.channel;
      console.log("P2PService: Received data channel from", peerId);
      
      // Set up data channel listeners
      this.setupDataChannelListeners(dataChannel, peerId, playerName);
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
    console.log("P2PService: Full message:", message);

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
        this.handleMove(message.payload);
        break;
      case "player-joined":
        this.handlePlayerJoined(message);
        break;
      case "game-started":
        this.handleGameStarted(message);
        break;
      case "lobby-state-sync":
        console.log("📥 P2PService: Client received lobby-state-sync message, calling handleLobbyStateSync");
        this.handleLobbyStateSync(message.payload);
        break;
      default:
        console.log("⚠️ P2PService: Unknown message type:", message.type);
        break;
    }
  }

  // Send message to peer
  private sendMessage(toPeerId: string, message: any): void {
    const connection = this.connections.get(toPeerId);

    console.log(`📤 P2PService: Attempting to send message to ${toPeerId}, connection state: ${connection?.connectionState}`);

    // ✅ AFTER (Correct) - Use connectionState for RTCPeerConnection
    if (connection && connection.connectionState === "connected") {
      
      const dataChannel = (connection as any).dataChannel;
      console.log(`📤 P2PService: Data channel ready state: ${dataChannel?.readyState}`);
      
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(message));
        console.log("✅ P2PService: Sent message to", toPeerId, ":", message.type);
      } else {
        console.warn("⚠️ P2PService: Data channel not ready for", toPeerId, `(readyState: ${dataChannel?.readyState})`);
      }
    } else {
      console.warn("⚠️ P2PService: Connection not ready for", toPeerId, `(state: ${connection?.connectionState})`);
    }
  }

  // Send chess move to all connected peers
  public sendChessMove(moveData: any): void {
    const message = {
      type: 'move',
      payload: moveData,
      timestamp: Date.now(),
    };

    this.connections.forEach((connection, peerId) => {
      this.sendMessage(peerId, message);
    });
  }

  // Send chat message to all connected peers
  public sendChatMessage(message: string, playerName: string): void {
    const chatMessage = {
      type: 'chat',
      payload: {
        message,
        playerName,
        timestamp: Date.now(),
      },
    };

    this.connections.forEach((connection, peerId) => {
      this.sendMessage(peerId, chatMessage);
    });
  }

  // Send game state update to all connected peers
  public sendGameStateUpdate(gameState: any): void {
    const message = {
      type: 'game-state',
      payload: gameState,
      timestamp: Date.now(),
    };

    this.connections.forEach((connection, peerId) => {
      this.sendMessage(peerId, message);
    });
  }

  // Send game started notification to all connected peers
  public sendGameStarted(gameId?: string): void {
    if (!this.isHost || !this.gameState) return;

    // Update the state (create new object to avoid mutation)
    this.gameState = { ...this.gameState, status: 'playing' };

    // Sync the new "playing" state to all clients
    this.syncLobbyStateToClients();
    
    // Also notify the host's own UI immediately
    console.log("🎮 P2PService: Notifying host UI of game started");
    this.notifyHandlers("game-state-update", this.gameState);
  }

  // Send current game state to a specific player
  public sendGameStateToPlayer(peerId: string): void {
    if (!this.gameState) {
      console.log("P2PService: No game state to send to player", peerId);
      return;
    }

    const message = {
      type: 'game-state',
      payload: this.gameState,
      timestamp: Date.now(),
    };

    console.log("P2PService: Sending game state to player", peerId);
    this.sendMessage(peerId, message);
  }

  // ✅ Simple lobby state sync - only essential info
  private syncLobbyStateToClients(): void {
    if (!this.isHost || !this.gameState) return;

    // Only sync essential lobby info, not the entire game state
    const lobbyState = {
      gameId: this.gameState.id,
      status: this.gameState.status,
      players: Array.from(this.players.values()),
      playerCount: this.players.size,
      currentPlayerTurn: this.gameState.currentPlayerTurn || "r", // Only current turn
    };

    const message = {
      type: 'lobby-state-sync',
      payload: lobbyState,
    };

    console.log("📢 HOST: Broadcasting lobby state sync to all clients.");
    console.log("📢 HOST: Players:", lobbyState.players.length);
    
    // ✅ Update Redux state for host as well
    store.dispatch(syncP2PGameState({
      currentGame: this.gameState,
      players: lobbyState.players,
      isHost: true,
      canStartGame: lobbyState.players.length >= 2 && lobbyState.status === 'waiting'
    }));
    
    this.broadcastMessage(message);
  }

  // ✅ Helper method for serverlessSignalingService to add a player
  public addPlayer(playerId: string, playerName: string): void {
    if (!this.isHost || !this.gameState) {
      console.error('P2PService: Cannot add player - not host or no game state');
      return;
    }

    // Assign a color to the new player
    const availableColors = ['r', 'b', 'y', 'g'];
    const usedColors = Array.from(this.players.values()).map(p => p.color);
    const availableColor = availableColors.find(color => !usedColors.includes(color)) || 'r';

    const newPlayer: P2PPlayer = {
      id: playerId,
      name: playerName,
      color: availableColor,
      isHost: false,
      isConnected: true,
      connectionState: 'connecting'
    };

    this.players.set(playerId, newPlayer);
    
    // Update game state with new player count (create new object to avoid mutation)
    if (this.gameState) {
      this.gameState = { ...this.gameState, playerCount: this.players.size };
    }
    
    // Don't call updatePlayerCount() as it tries to mutate the immutable gameState

    console.log(`P2PService: Added player ${playerName} with color ${availableColor}`);
  }

  // ✅ Helper method for serverlessSignalingService to create connection
  public createConnectionForPlayer(playerId: string): any {
    // Get the connection from serverlessSignalingService
    const connection = serverlessSignalingService.getConnection(playerId);
    if (connection) {
      // Store it in our own connections map for broadcasting
      this.connections.set(playerId, connection);
      console.log(`P2PService: Stored connection for player ${playerId} in P2P service connections map`);
    }
    return connection;
  }

  // ✅ Helper method for UI to get current peer ID
  public getPeerId(): string {
    return this.peerId;
  }

  // ✅ Helper method for serverlessSignalingService to get current game state
  public getGameState(): P2PGame | null {
    return this.gameState;
  }

  // ✅ Helper method to get current player info
  public getCurrentPlayer(): P2PPlayer | null {
    const currentPlayer = this.players.get(this.peerId);
    return currentPlayer || null;
  }

  // Handle join request (host only)
  private async handleJoinRequest(fromPeerId: string, message: any): Promise<void> {
    console.log("P2PService: handleJoinRequest called with fromPeerId:", fromPeerId, "message:", message);
    console.log("P2PService: isHost:", this.isHost, "gameState:", !!this.gameState);
    
    if (!this.isHost || !this.gameState) {
      console.log("P2PService: Not host or no game state, ignoring join request");
      return;
    }

    const { playerId, playerName } = message;

    // Assign color based on order of joining (same logic as online multiplayer)
    const colors = ["r", "b", "y", "g"];
    const usedColors = Array.from(this.players.values()).map((p) => p.color).filter(Boolean);
    const availableColor = colors.find((color) => !usedColors.includes(color)) || "g";

    // Add player to game with assigned color
    this.players.set(playerId, {
      id: playerId,
      name: playerName,
      color: availableColor, // ✅ Assign color
      isHost: false,
      isConnected: true,
    });

    // ✅ Get the connection from the ServerlessSignalingService and set up connection state tracking
    const connection = serverlessSignalingService.getConnection(playerId);
    if (connection) {
      console.log(`🔗 P2PService: Setting up connection state tracking for player ${playerName} (${playerId})`);
      connection.onconnectionstatechange = () => {
        console.log(`🔗 P2PService: Host-side connection state changed to: ${connection.connectionState} for player ${playerName}`);
        const player = this.players.get(playerId);
        if (player) {
          // Create a new player object instead of modifying the existing one
          const updatedPlayer = {
            ...player,
            connectionState: connection.connectionState,
            isConnected: (connection.connectionState === 'connected')
          };
          this.players.set(playerId, updatedPlayer);
          console.log(`🔗 P2PService: Updated player ${playerName} connection state: ${connection.connectionState}, isConnected: ${updatedPlayer.isConnected}`);
          // ✅ Connection state changes will be synced via syncGameStateToClients when needed
        }
      };
    } else {
      console.log(`🔗 P2PService: No connection found for player ${playerId} - connection state tracking not available`);
    }

    // ✅ Use helper method to ensure player count is synchronized
    this.updatePlayerCount();

    // ✅ Single source of truth: Only sync complete game state to everyone
    this.syncLobbyStateToClients();
    
    console.log(`P2PService: Player ${playerName} joined. Syncing state.`);
  }

  // Handle player joined message (for non-host players)
  private handlePlayerJoined(message: any): void {
    const { players, gameState } = message; // ✅ Destructure the gameState
    
    // Update local players map
    this.players.clear();
    players.forEach((player: any) => {
      this.players.set(player.id, player);
    });

    // Update the client's internal game state
    if (gameState) {
      this.gameState = gameState;
      // ✅ CRITICAL FIX: Update playerCount to match actual players (create new object to avoid mutation)
      this.gameState = { ...this.gameState, playerCount: players.length };
      // ✅ Notify the UI with the complete game state object
      this.notifyHandlers("game-state-update", this.gameState);
    } else {
      // ✅ Fallback: If no gameState received, update player count from local players map
      this.updatePlayerCount();
    }

    // Also notify the UI about the updated player list
    this.notifyHandlers("players-updated", players);

    console.log("P2PService: Updated player list:", players.length, "players");
    if (gameState) {
      console.log("P2PService: Updated game state for joining player, playerCount:", this.gameState.playerCount);
    }
  }

  // Handle game started message
  private handleGameStarted(message: any): void {
    console.log("P2PService: Game started notification received:", message);
    
    // Notify UI that the game has started
    this.notifyHandlers("game-started", {
      gameId: message.payload.gameId,
      timestamp: message.payload.timestamp,
    });
  }

  // ✅ Simple lobby state sync handler for clients
  private handleLobbyStateSync(lobbyState: any): void {
    // This is for clients only
    if (this.isHost) return;

    console.log("📥 CLIENT: Received lobby state sync from host:", lobbyState);
    console.log("📥 CLIENT: Current isHost status:", this.isHost);
    console.log("📥 CLIENT: Lobby state players:", lobbyState.players);

    // Update only essential lobby info (create new object to avoid mutation)
    if (this.gameState) {
      this.gameState = { 
        ...this.gameState, 
        status: lobbyState.status,
        currentPlayerTurn: lobbyState.currentPlayerTurn 
      };
    }

    // Update players list (with null safety)
    this.players.clear();
    if (lobbyState.players && Array.isArray(lobbyState.players)) {
      lobbyState.players.forEach((p: P2PPlayer) => {
        if (p && p.id) {
          this.players.set(p.id, p);
        }
      });
    }

    // ✅ Update only lobby-related Redux state
    console.log("🎮 P2PService: Updating Redux state with lobby info");
    console.log("🎮 P2PService: Dispatching syncP2PGameState with:", {
      currentGame: this.gameState,
      players: lobbyState.players,
      isHost: false,
      canStartGame: lobbyState.players.length >= 2 && lobbyState.status === 'waiting'
    });
    
    // Ensure we have a valid currentGame to pass to Redux
    const currentGameForRedux = this.gameState || {
      id: lobbyState.gameId,
      status: lobbyState.status,
      playerCount: lobbyState.playerCount,
      currentPlayerTurn: lobbyState.currentPlayerTurn
    };
    
    // Ensure players array is valid
    const playersArray = (lobbyState.players && Array.isArray(lobbyState.players)) ? lobbyState.players : [];
    
    store.dispatch(syncP2PGameState({
      currentGame: currentGameForRedux,
      players: playersArray,
      isHost: false,
      canStartGame: playersArray.length >= 2 && lobbyState.status === 'waiting'
    }));
    
    console.log("🎮 P2PService: Redux state updated, current state:", store.getState().game);
  }

  // Set up data channel listeners for host side (incoming connections)
  public setupHostDataChannelListeners(dataChannel: RTCDataChannel, peerId: string, playerName: string): void {
    dataChannel.onopen = () => {
      console.log("✅ P2PService: Host received data channel from", playerName);
      
      // Store the data channel for this peer
      const connection = this.connections.get(peerId);
      if (connection) {
        (connection as any).dataChannel = dataChannel;
      }

      // Set up message listener for incoming messages
      dataChannel.onmessage = (event: any) => {
        try {
          const message = JSON.parse(event.data);
          console.log("P2PService: Host received message from", playerName, ":", message.type);
          this.handleMessage(peerId, message);
        } catch (error) {
          console.error("P2PService: Error parsing message from", playerName, ":", error);
        }
      };

      // ✅ Immediately send the current game state to the newly connected player
      console.log("📤 P2PService: Sending current game state to newly connected player", playerName);
      this.sendGameStateToPlayer(peerId);

      // Notify that connection is established
      this.notifyHandlers("connection-established", { peerId, playerName });
    };

    dataChannel.onclose = () => {
      console.log("❌ P2PService: Host data channel closed for", playerName);
      this.notifyHandlers("connection-lost", { peerId });
      this.connections.delete(peerId);
      this.players.delete(peerId);
    };

    dataChannel.onerror = (error: any) => {
      console.error("❌ P2PService: Host data channel error for", playerName, ":", error);
    };
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
    console.log("📢 P2PService: Broadcasting to", this.connections.size, "connections");
    this.connections.forEach((connection, peerId) => {
      console.log("📢 P2PService: Sending to peer:", peerId);
      this.sendMessage(peerId, message);
    });
  }

  // Handle game state updates
  private handleGameStateUpdate(gameState: any): void {
    this.gameState = gameState;
    this.notifyHandlers("game-state-update", gameState);
  }

  // Handle move - simple and lightweight
  private handleMove(move: any): void {
    console.log("P2PService: Handling received move:", move);
    
    // Validate move data
    if (!move || !move.from || !move.to || !move.pieceCode || !move.playerColor) {
      console.error("P2PService: Invalid move data received:", move);
      return;
    }
    
    // ✅ Apply move directly to Redux - no heavy state sync needed
    console.log("🎮 P2PService: Applying received move to Redux");
    store.dispatch(applyNetworkMove(move));
    
    // Update current player turn in our local game state (create new object to avoid mutation)
    if (this.gameState) {
      this.gameState = { 
        ...this.gameState, 
        currentPlayerTurn: this.getNextPlayerTurn(move.playerColor) 
      };
      console.log("P2PService: Updated currentPlayerTurn to:", this.gameState.currentPlayerTurn);
    }
  }

  // Simple turn management
  private getNextPlayerTurn(currentColor: string): string {
    const colors = ['r', 'b', 'y', 'g'];
    const currentIndex = colors.indexOf(currentColor);
    return colors[(currentIndex + 1) % colors.length];
  }

  // Notify message handlers
  private notifyHandlers(event: string, data: any): void {
    console.log(`🔔 P2PService: notifyHandlers called with event: ${event}, data:`, data ? "present" : "null");
    const handlers = this.messageHandlers.get(event);
    console.log(`🔔 P2PService: Found ${handlers ? handlers.size : 0} handlers for event: ${event}`);
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

  // Alias for on method (for compatibility with p2pGameService)
  public onMessage(event: string, handler: (data: any) => void): () => void {
    return this.on(event, handler);
  }

  // Get current game state
  public getGameState(): P2PGame | null {
    return this.gameState;
  }

  // Get players
  public getPlayers(): P2PPlayer[] {
    return Array.from(this.players.values());
  }

  // Helper method to ensure player count is always synchronized
  private updatePlayerCount(): void {
    if (this.gameState) {
      // Create a new object to avoid mutating the immutable gameState
      this.gameState = { ...this.gameState, playerCount: this.players.size };
    }
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

  // Wait for game state to be received from host
  private async waitForGameState(): Promise<void> {
    return new Promise((resolve, reject) => {
      console.log("P2PService: Waiting for game state from host...");
      
      const timeout = setTimeout(() => {
        console.log("P2PService: Timeout waiting for game state from host");
        const currentState = store.getState().game;
        console.log("P2PService: Final Redux state at timeout:", {
          currentGame: currentState.currentGame,
          players: currentState.players,
          isHost: currentState.isHost,
          canStartGame: currentState.canStartGame
        });
        reject(new Error("Timeout waiting for game state from host"));
      }, 10000); // 10 second timeout

      // ✅ Listen for Redux state changes instead of P2P events
      const checkGameState = () => {
        const currentState = store.getState().game;
        console.log("P2PService: Checking Redux state for game state:", currentState.currentGame);
        console.log("P2PService: Checking Redux players:", currentState.players);
        console.log("P2PService: Checking Redux isHost:", currentState.isHost);
        // Check both currentGame and players array (Redux structure has players as separate field)
        if (currentState.currentGame && currentState.players && currentState.players.length > 0) {
          console.log("P2PService: Game state found in Redux with players, resolving...");
          clearTimeout(timeout);
          resolve();
        }
      };

      // Check immediately in case the state was already updated
      checkGameState();

      // Set up a polling mechanism to check Redux state
      const pollInterval = setInterval(checkGameState, 100); // Check every 100ms

      // Clean up on timeout
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 10000);
    });
  }

  // Disconnect
  public async disconnect(notifyUI: boolean = true): Promise<void> {
    console.log("P2PService: Disconnecting and cleaning up session... (notifyUI:", notifyUI, ")");

    // 1. Stop external services if the player was the host
    if (this.isHost) {
      try {
        console.log("P2PService: Stopping serverless signaling server...");
        await serverlessSignalingService.stopServer();
      } catch (error) {
        console.error("P2PService: Error stopping signaling server:", error);
      }

      try {
        console.log("P2PService: Stopping network advertising...");
        await networkAdvertiserService.stopAdvertising();
      } catch (error) {
        console.error("P2PService: Error stopping network advertising:", error);
      }
    }

    // 2. Close all active WebRTC connections
    console.log("P2PService: Closing", this.connections.size, "WebRTC connections...");
    this.connections.forEach((connection, peerId) => {
      try {
      connection.close();
        console.log("P2PService: Closed connection for peer", peerId);
      } catch (error) {
        console.error("P2PService: Error closing connection for peer", peerId, ":", error);
      }
    });

    // 3. Clear all internal state
    this.connections.clear();
    this.players.clear();
    this.gameState = null;
    this.gameId = null;
    this.isHost = false;

    // 4. Update Redux state about disconnection only if requested
    if (notifyUI) {
      console.log("🎮 P2PService: Updating Redux state for disconnection");
      store.dispatch(syncP2PGameState(null));
      store.dispatch(setIsConnected(false));
      store.dispatch(setConnectionError("Connection lost"));
    }

    console.log("P2PService: Cleanup complete.");
  }
}

export default P2PService.getInstance();
