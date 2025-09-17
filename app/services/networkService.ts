const io = require("socket.io-client");

export interface Player {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
}

export interface RoomInfo {
  id: string;
  host: string;
  players: Player[];
  gameState: any;
  isGameStarted: boolean;
}

export interface MoveData {
  from: { row: number; col: number };
  to: { row: number; col: number };
  pieceCode: string;
  playerColor: string;
}

class NetworkService {
  private socket: any = null;
  private isConnected = false;
  private currentRoomId: string | null = null;
  private currentPlayerId: string | null = null;
  private pendingListeners: Map<string, (data: any) => void> | null = null;

  get connected(): boolean {
    return this.isConnected;
  }

  get roomId(): string | null {
    return this.currentRoomId;
  }

  get playerId(): string | null {
    return this.currentPlayerId;
  }

  connect(serverIp: string, port: number = 3001): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = io(`http://${serverIp}:${port}`, {
          timeout: 10000,
          forceNew: true,
          transports: ["polling", "websocket"],
          upgrade: true,
          rememberUpgrade: false,
        });

        this.socket.on("connect", () => {
          this.isConnected = true;
          if (this.pendingListeners) {
            this.pendingListeners.forEach((callback, eventName) => {
              this.socket!.on(eventName, callback);
            });
            this.pendingListeners.clear();
          }
          resolve();
        });

        this.socket.on("connect_error", (error) => {
          console.error("Connection failed:", error.message);
          reject(error);
        });

        this.socket.on("disconnect", () => {
          this.isConnected = false;
        });

        setTimeout(() => {
          if (!this.isConnected) {
            reject(new Error("Connection timeout"));
          }
        }, 15000);
      } catch (error) {
        reject(error);
      }
    });
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
      this.currentRoomId = null;
      this.currentPlayerId = null;
      if (this.pendingListeners) {
        this.pendingListeners.clear();
      }
    }
  }

  createRoom(playerData: {
    name: string;
  }): Promise<{ roomId: string; playerId: string; color: string }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error("Not connected to server"));
        return;
      }

      this.socket.emit("create-room", playerData);

      this.socket.once("room-created", (data) => {
        this.currentRoomId = data.roomId;
        this.currentPlayerId = data.playerId;
        resolve(data);
      });

      this.socket.once("room-error", (error) => {
        reject(new Error(error.message));
      });
    });
  }

  joinRoom(
    roomId: string,
    playerData: { name: string }
  ): Promise<{
    roomId: string;
    playerId: string;
    color: string;
    players: Player[];
  }> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error("Not connected to server"));
        return;
      }

      this.socket.emit("join-room", { roomId, playerData });

      this.socket.once("room-joined", (data) => {
        this.currentRoomId = data.roomId;
        this.currentPlayerId = data.playerId;
        resolve(data);
      });

      this.socket.once("room-error", (error) => {
        reject(new Error(error.message));
      });
    });
  }

  startGame(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.isConnected) {
        reject(new Error("Not connected to server"));
        return;
      }

      this.socket.emit("start-game");

      this.socket.once("game-started", () => {
        resolve();
      });

      this.socket.once("error", (error) => {
        reject(new Error(error.message));
      });
    });
  }

  sendMove(moveData: MoveData): void {
    if (!this.socket || !this.isConnected) {
      console.error("Cannot send move: not connected to server");
      return;
    }
    this.socket.emit("make-move", moveData);
  }

  sendGameState(gameState: any): void {
    if (!this.socket || !this.isConnected) {
      console.error("Cannot send game state: not connected to server");
      return;
    }
    this.socket.emit("update-game-state", gameState);
  }

  on(eventName: string, callback: (data: any) => void): void {
    if (!this.socket) {
      if (!this.pendingListeners) {
        this.pendingListeners = new Map();
      }
      this.pendingListeners.set(eventName, callback);
      return;
    }
    this.socket.on(eventName, callback);
  }

  off(eventName: string, callback?: (data: any) => void): void {
    if (!this.socket) return;
    if (callback) {
      this.socket.off(eventName, callback);
    } else {
      this.socket.off(eventName);
    }
  }
}

export const networkService = new NetworkService();
export default networkService;
