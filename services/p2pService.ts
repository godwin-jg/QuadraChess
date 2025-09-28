import { Platform } from "react-native";
import { generateUUID } from "./utils/uuidGenerator";
import { RTCPeerConnection, RTCIceCandidate, RTCSessionDescription } from "react-native-webrtc";
import p2pSignalingService from "./p2pSignalingService";
import networkDiscoveryService from "./networkDiscoveryService";
import networkAdvertiserService from "./networkAdvertiserService";
import serverlessSignalingService from "./serverlessSignalingService";

export interface P2PGame {
  id: string;
  name: string; // ✅ Add name property
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
  color: string; // ✅ Add color property
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
    // ✅ Call disconnect first to clean up any previous game session
    await this.disconnect();

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

    // Notify UI layer about game state changes
    this.notifyHandlers("players-updated", Array.from(this.players.values()));
    this.notifyHandlers("host-status-changed", { isHost: true, canStartGame: true });

    // Truly serverless: Network advertising + HTTP signaling server
    try {
      // Start lightweight HTTP server for WebRTC signaling
      await serverlessSignalingService.startServer();
      console.log("P2PService: HTTP signaling server started");

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
        hostIP: networkAdvertiserService.getLocalIPAddress(),
        port: serverlessSignalingService.getPort(), // Use HTTP server port
        joinCode,
        playerCount: 1,
        maxPlayers: 4,
        status: "waiting",
        timestamp: Date.now(), // Add current timestamp
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
    // ✅ Call disconnect first to clean up any previous session
    await this.disconnect();

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
    // ✅ Call disconnect first to clean up any previous session
    await this.disconnect();

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
      await this.connectToPeerDirect(targetGame.hostIP, targetGame.hostId, playerName);
      console.log("P2PService: Connected directly to host via WebRTC");
    } catch (error) {
      console.error("P2PService: Failed to connect directly to host:", error);
      throw error;
    }
  }

  // Truly serverless P2P - join by direct IP address
  public async joinGameByIP(hostIP: string, playerName: string): Promise<void> {
    // ✅ Call disconnect first to clean up any previous session
    await this.disconnect();

    console.log("P2PService: Joining game by IP:", hostIP);

    this.isHost = false;
    this.gameId = "direct-ip-game";

    // Create direct WebRTC connection to host IP
    // For direct IP joins, we'll use the IP as the host ID (fallback)
    await this.connectToPeerDirect(hostIP, hostIP, playerName);
  }

  // Connect directly to a peer by IP (truly serverless)
  private async connectToPeerDirect(hostIP: string, hostId: string, playerName: string): Promise<void> {
    const connection = new RTCPeerConnection({
      iceServers: this.stunServers,
      iceCandidatePoolSize: 10,
    });

    // Use the permanent hostId as the key, not the temporary IP
    this.connections.set(hostId, connection);

    // ✅ 1. Create a buffer to store candidates locally
    const localCandidates: RTCIceCandidate[] = [];

    // 1. Create the data channel BEFORE creating the offer (initiator side)
    const dataChannel = connection.createDataChannel("game-data", { 
      ordered: true,
      reliable: true 
    });

    // Set up data channel listeners
    this.setupDataChannelListeners(dataChannel, hostId, playerName);

    // ✅ 2. Have onicecandidate push to the local buffer instead of sending immediately
    connection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log("P2PService: Buffering local ICE candidate...");
        localCandidates.push(event.candidate);
      }
    };

    // Create offer
    const offer = await connection.createOffer();
    await connection.setLocalDescription(offer);

    // The 'sendWebRTCOfferAndCandidatesViaHTTP' function now needs to send the buffered candidates
    await this.sendWebRTCOfferAndCandidatesViaHTTP(hostIP, hostId, offer, playerName, localCandidates);
    
    console.log("P2PService: Offer created and sent via HTTP to", hostIP);
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
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 P2PService: Sending WebRTC offer via HTTP to ${hostIP} (attempt ${attempt}/${maxRetries})`);
        
        const offerPayload = {
          offer: offer,
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
        console.log("✅ P2PService: Received answer from host:", answerData);
        
        // Set the remote description
        const connection = this.connections.get(hostId);
        if (connection) {
          await connection.setRemoteDescription(new RTCSessionDescription(answerData.answer));
          console.log("✅ P2PService: Answer received and set.");

          // ✅ 3. Now that the handshake is done, send all buffered candidates
          console.log(`P2PService: Sending ${candidates.length} buffered ICE candidates to host...`);
          for (const candidate of candidates) {
            this.sendIceCandidateViaHTTP(hostIP, candidate);
          }
          
          // Start polling for host ICE candidates
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
  private async pollForHostCandidates(hostIP: string, hostId: string, connection: any): Promise<void> {
    const maxPollAttempts = 10; // Poll for up to 10 seconds
    const pollInterval = 1000; // Poll every 1 second
    
    console.log("P2PService: Starting to poll for host ICE candidates from", hostIP);
    
    for (let attempt = 1; attempt <= maxPollAttempts; attempt++) {
      try {
        console.log(`P2PService: Polling for ICE candidates (attempt ${attempt}/${maxPollAttempts})`);
        
        const response = await fetch(`http://${hostIP}:3001/api/webrtc/candidates/${this.peerId}`, {
          method: 'GET',
          timeout: 5000,
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
                console.log("P2PService: Added host ICE candidate:", candidate.candidate);
              } catch (error) {
                console.error("P2PService: Failed to add ICE candidate:", error);
              }
            }
            
            console.log(`✅ P2PService: Successfully added ${candidates.length} host ICE candidates (continuing to poll for more)`);
            // Continue polling to collect all possible network paths
          } else {
            console.log("P2PService: No new candidates from host this round");
          }
        }
        
        // If no candidates yet, wait and try again
        if (attempt < maxPollAttempts) {
          console.log(`P2PService: No candidates yet, waiting ${pollInterval}ms...`);
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        
      } catch (error) {
        console.error(`P2PService: Error polling for ICE candidates (attempt ${attempt}):`, error);
        
        if (attempt < maxPollAttempts) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
      }
    }
    
    console.log("✅ P2PService: Finished polling for ICE candidates - collected all available network paths");
  }

  // Send ICE candidate via HTTP to host
  private async sendIceCandidateViaHTTP(hostIP: string, candidate: RTCIceCandidate): Promise<void> {
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
    } catch (error) {
      console.error("P2PService: Failed to send ICE candidate via HTTP:", error);
    }
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
    // ✅ Call disconnect first to clean up any previous session
    await this.disconnect();

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
        this.handleMove(message.move);
        break;
      case "player-joined":
        this.handlePlayerJoined(message);
        break;
      case "game-started":
        this.handleGameStarted(message);
        break;
    }
  }

  // Send message to peer
  private sendMessage(toPeerId: string, message: any): void {
    const connection = this.connections.get(toPeerId);

    // ✅ AFTER (Correct) - Use connectionState for RTCPeerConnection
    if (connection && connection.connectionState === "connected") {
      
      const dataChannel = (connection as any).dataChannel;
      if (dataChannel && dataChannel.readyState === "open") {
        dataChannel.send(JSON.stringify(message));
        console.log("P2PService: Sent message to", toPeerId, ":", message.type);
      } else {
        console.warn("P2PService: Data channel not ready for", toPeerId);
      }
    } else {
      console.warn("P2PService: Connection not ready for", toPeerId, `(state: ${connection?.connectionState})`);
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
  public sendGameStarted(gameId: string): void {
    const message = {
      type: 'game-started',
      payload: {
        gameId: gameId,
        timestamp: Date.now(),
      },
    };

    console.log("P2PService: Broadcasting game started to all players");
    this.connections.forEach((connection, peerId) => {
      this.sendMessage(peerId, message);
    });
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

    this.gameState.playerCount = this.players.size;

    // Notify UI layer about player list update
    this.notifyHandlers("players-updated", Array.from(this.players.values()));

    // Notify ALL players with the updated player list AND the current game state
    this.broadcastMessage({
      type: "player-joined",
      playerId,
      playerName,
      players: Array.from(this.players.values()),
      gameState: this.gameState, // ✅ Include game state in the broadcast
    });

    console.log("P2PService: Player joined:", playerName, "with color:", availableColor, "Total players:", this.players.size);
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
      // ✅ Notify the UI with the complete game state object
      this.notifyHandlers("game-state-update", this.gameState);
    }

    // Also notify the UI about the updated player list
    this.notifyHandlers("players-updated", players);

    console.log("P2PService: Updated player list:", players.length, "players");
    if (gameState) {
      console.log("P2PService: Updated game state for joining player");
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
    console.log("P2PService: Handling received move:", move);
    
    // Notify UI layer about incoming move
    this.notifyHandlers("move-received", move);
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
  public async disconnect(): Promise<void> {
    console.log("P2PService: Disconnecting and cleaning up session...");

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

    // 4. Notify UI layer about disconnection
    this.notifyHandlers("disconnected", { reason: "manual" });

    console.log("P2PService: Cleanup complete.");
  }
}

export default P2PService.getInstance();
