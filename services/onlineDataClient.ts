import { getAuth, signInAnonymously } from "@react-native-firebase/auth";
import { getDatabase, onValue, ref } from "@react-native-firebase/database";
import type { Player } from "../app/services/networkService";
import type { EnPassantTarget, SerializedGameState } from "../state/types";
import { ensureFirebaseApp } from "./firebaseInit";
import realtimeDatabaseService from "./realtimeDatabaseService";

ensureFirebaseApp();
const authInstance = getAuth();
const db = getDatabase();

export interface OnlineGameSnapshot {
  id: string;
  hostId: string;
  hostName: string;
  players: { [playerId: string]: Player };
  gameState: SerializedGameState;
  status: "waiting" | "playing" | "finished";
  createdAt: number;
  maxPlayers: number;
  currentPlayerTurn: string;
  winner: string | null;
  joinCode?: string;
  lastMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
    playerId: string;
    timestamp: number;
    moveNumber?: number;
  } | null;
  lastActivity?: number;
}

export interface OnlineMoveRequest {
  from: { row: number; col: number };
  to: { row: number; col: number };
  pieceCode: string;
  playerColor: string;
  playerId: string;
  timestamp: number;
  isEnPassant?: boolean;
  enPassantTarget?: EnPassantTarget | null;
}

export interface OnlinePromotionRequest {
  position: { row: number; col: number };
  pieceType: string;
  playerColor: string;
  playerId: string;
  timestamp: number;
}

class OnlineDataClient {
  async signInAnonymously(): Promise<string> {
    const currentUser = authInstance.currentUser;
    if (currentUser) {
      return currentUser.uid;
    }
    const userCredential = await signInAnonymously(authInstance);
    return userCredential.user.uid;
  }

  getCurrentUser() {
    return authInstance.currentUser;
  }

  subscribeToGame(
    gameId: string,
    onUpdate: (game: OnlineGameSnapshot | null) => void
  ): () => void {
    const gameRef = ref(db, `games/${gameId}`);
    const unsubscribe = onValue(gameRef, (snapshot) => {
      if (!snapshot.exists()) {
        onUpdate(null);
        return;
      }
      const gameData = { id: gameId, ...snapshot.val() } as OnlineGameSnapshot;
      onUpdate(gameData);
    });

    return () => unsubscribe();
  }

  async submitMove(gameId: string, moveData: Omit<OnlineMoveRequest, "playerId" | "timestamp">): Promise<void> {
    await realtimeDatabaseService.makeMove(gameId, moveData);
  }

  async submitPromotion(gameId: string, promotion: Omit<OnlinePromotionRequest, "playerId" | "timestamp">): Promise<void> {
    await realtimeDatabaseService.makePromotion(gameId, promotion);
  }

  async updatePlayerPresence(gameId: string, isOnline: boolean): Promise<void> {
    await realtimeDatabaseService.updatePlayerPresence(gameId, isOnline);
  }

  async leaveGame(gameId: string): Promise<void> {
    await realtimeDatabaseService.leaveGame(gameId);
  }

  async resignGame(gameId: string, playerColor: string): Promise<void> {
    await realtimeDatabaseService.resignGame(gameId);
  }

  async timeoutPlayer(gameId: string, playerColor: string): Promise<void> {
    await realtimeDatabaseService.timeoutPlayer(gameId, playerColor);
  }

  async resolveNoLegalMoves(
    gameId: string,
    playerColor: string,
    status: "checkmate" | "stalemate"
  ): Promise<void> {
    await realtimeDatabaseService.resolveNoLegalMoves(gameId, playerColor, status);
  }
}

export const onlineDataClient = new OnlineDataClient();
