// Shared types used across the application
export interface Position {
  row: number;
  col: number;
}

// Interface for move information including capture status and promotion
export interface MoveInfo {
  row: number;
  col: number;
  isCapture?: boolean;
  isPromotion?: boolean;
  isEnPassant?: boolean;
  isCastling?: boolean;
  promotionPiece?: string;
}

// P2P Game types
export interface P2PGame {
  id: string;
  name: string;
  hostName: string;
  hostId: string;
  hostIP?: string;
  port?: number;
  playerCount: number;
  maxPlayers: number;
  status: 'waiting' | 'playing' | 'finished' | 'ended';
  createdAt: number;
  startedAt?: number;
  endedAt?: number;
  currentPlayerTurn?: string;
  players?: P2PPlayer[];
  gameData?: any;
}

export interface P2PPlayer {
  id: string;
  name: string;
  color: string;
  isHost: boolean;
  isConnected: boolean;
  joinedAt: number;
}
