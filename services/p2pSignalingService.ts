import io, { Socket } from "socket.io-client";
import networkConfigService from "./networkConfigService";

// Simple UUID generation without crypto dependency
function generateUUID(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface SignalingMessage {
  type: "offer" | "answer" | "ice-candidate" | "join-game" | "discover-games";
  data: any;
}

export interface GameInfo {
  id: string;
  hostName: string;
  playerCount: number;
  maxPlayers: number;
  status: string;
}

class P2PSignalingService {
  private socket: Socket | null = null;
  private isConnected: boolean = false;
  private peerId: string = "";
  private signalingServerUrl: string = "";

  // Initialize signaling service
  async initialize(serverUrl?: string): Promise<void> {
    const defaultUrl = serverUrl || networkConfigService.getSignalingServerUrl();
    this.signalingServerUrl = defaultUrl;
    this.peerId = generateUUID();

    return new Promise((resolve, reject) => {
      this.socket = io(defaultUrl, {
        transports: ["websocket", "polling"],
        timeout: 15000,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        maxReconnectionAttempts: 5,
        forceNew: true,
      });

      this.socket.on("connect", () => {
        console.log("P2PSignalingService: Connected to signaling server at", defaultUrl);
        this.isConnected = true;
        resolve();
      });

      this.socket.on("connect_error", (error) => {
        console.error("P2PSignalingService: Connection error:", error);
        console.error("P2PSignalingService: Attempting to connect to:", defaultUrl);
        // Don't reject immediately, let reconnection attempts work
      });

      this.socket.on("reconnect", (attemptNumber) => {
        console.log("P2PSignalingService: Reconnected after", attemptNumber, "attempts");
        this.isConnected = true;
        if (!this.isConnected) {
          resolve(); // Resolve the promise on successful reconnection
        }
      });

      this.socket.on("reconnect_error", (error) => {
        console.error("P2PSignalingService: Reconnection error:", error);
      });

      this.socket.on("reconnect_failed", () => {
        console.error("P2PSignalingService: Reconnection failed after all attempts");
        reject(new Error("Failed to connect to signaling server after multiple attempts"));
      });

      this.socket.on("disconnect", (reason) => {
        console.log("P2PSignalingService: Disconnected from signaling server:", reason);
        this.isConnected = false;
      });

      // Set up message handlers
      this.setupMessageHandlers();

      // Timeout after 15 seconds
      setTimeout(() => {
        if (!this.isConnected) {
          reject(new Error("Connection timeout after 15 seconds"));
        }
      }, 15000);
    });
  }

  // Register peer with signaling server
  registerPeer(gameId: string, isHost: boolean, hostName?: string): void {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected to signaling server");
    }

    this.socket.emit("register-peer", {
      peerId: this.peerId,
      gameId,
      isHost,
      hostName,
    });

    console.log("P2PSignalingService: Peer registered:", {
      peerId: this.peerId,
      gameId,
      isHost,
    });
  }

  // Discover available games
  async discoverGames(): Promise<GameInfo[]> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected to signaling server");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Game discovery timeout"));
      }, 5000);

      this.socket!.once("games-list", (games: GameInfo[]) => {
        clearTimeout(timeout);
        resolve(games);
      });

      this.socket!.emit("discover-games");
    });
  }

  // Join a game
  async joinGame(gameId: string, playerName: string): Promise<void> {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected to signaling server");
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Join game timeout"));
      }, 5000);

      this.socket!.once("join-error", (error: { message: string }) => {
        clearTimeout(timeout);
        reject(new Error(error.message));
      });

      this.socket!.once("player-joined", () => {
        clearTimeout(timeout);
        resolve();
      });

      this.socket!.emit("join-game", { gameId, playerName });
    });
  }

  // Send offer to peer
  sendOffer(targetPeerId: string, offer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected to signaling server");
    }

    this.socket.emit("offer", {
      targetPeerId,
      offer,
    });
  }

  // Send answer to peer
  sendAnswer(targetPeerId: string, answer: RTCSessionDescriptionInit): void {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected to signaling server");
    }

    this.socket.emit("answer", {
      targetPeerId,
      answer,
    });
  }

  // Send ICE candidate to peer
  sendIceCandidate(targetPeerId: string, candidate: RTCIceCandidateInit): void {
    if (!this.socket || !this.isConnected) {
      throw new Error("Not connected to signaling server");
    }

    this.socket.emit("ice-candidate", {
      targetPeerId,
      candidate,
    });
  }

  // Set up message handlers
  private setupMessageHandlers(): void {
    if (!this.socket) return;

    this.socket.on(
      "offer",
      (data: { fromPeerId: string; offer: RTCSessionDescriptionInit }) => {
        this.handleOffer(data.fromPeerId, data.offer);
      }
    );

    this.socket.on(
      "answer",
      (data: { fromPeerId: string; answer: RTCSessionDescriptionInit }) => {
        this.handleAnswer(data.fromPeerId, data.answer);
      }
    );

    this.socket.on(
      "ice-candidate",
      (data: { fromPeerId: string; candidate: RTCIceCandidateInit }) => {
        this.handleIceCandidate(data.fromPeerId, data.candidate);
      }
    );

    this.socket.on(
      "player-joined",
      (data: { playerId: string; playerName: string; players: any[] }) => {
        this.handlePlayerJoined(data);
      }
    );

    this.socket.on(
      "player-left",
      (data: { playerId: string; players: any[] }) => {
        this.handlePlayerLeft(data);
      }
    );
  }

  // Handle incoming offer
  private handleOffer(
    fromPeerId: string,
    offer: RTCSessionDescriptionInit
  ): void {
    console.log("P2PSignalingService: Received offer from:", fromPeerId);
    // This would be handled by the P2P service
    this.emit("offer", { fromPeerId, offer });
  }

  // Handle incoming answer
  private handleAnswer(
    fromPeerId: string,
    answer: RTCSessionDescriptionInit
  ): void {
    console.log("P2PSignalingService: Received answer from:", fromPeerId);
    // This would be handled by the P2P service
    this.emit("answer", { fromPeerId, answer });
  }

  // Handle incoming ICE candidate
  private handleIceCandidate(
    fromPeerId: string,
    candidate: RTCIceCandidateInit
  ): void {
    console.log(
      "P2PSignalingService: Received ICE candidate from:",
      fromPeerId
    );
    // This would be handled by the P2P service
    this.emit("ice-candidate", { fromPeerId, candidate });
  }

  // Handle player joined
  private handlePlayerJoined(data: {
    playerId: string;
    playerName: string;
    players: any[];
  }): void {
    console.log("P2PSignalingService: Player joined:", data);
    this.emit("player-joined", data);
  }

  // Handle player left
  private handlePlayerLeft(data: { playerId: string; players: any[] }): void {
    console.log("P2PSignalingService: Player left:", data);
    this.emit("player-left", data);
  }

  // Event emitter functionality
  private eventHandlers: Map<string, ((data: any) => void)[]> = new Map();

  private emit(event: string, data: any): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error("P2PSignalingService: Error in event handler:", error);
        }
      });
    }
  }

  public on(event: string, handler: (data: any) => void): () => void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(event);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index > -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  public off(event: string, handler: (data: any) => void): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  // Get peer ID
  public getPeerId(): string {
    return this.peerId;
  }

  // Check if connected
  public isSignalingConnected(): boolean {
    return this.isConnected;
  }

  // Disconnect
  public disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.isConnected = false;
    this.eventHandlers.clear();
  }
}

export default new P2PSignalingService();
