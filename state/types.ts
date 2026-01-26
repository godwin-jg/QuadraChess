// Import shared types
import { Player } from "../app/services/networkService";
import { MoveInfo, Position } from "../types/index";
import type { BotDifficulty } from "../config/gameConfig";
import type { Bitboard } from "../src/logic/bitboardUtils";

// Define the turn order for 4-player chess
export const turnOrder = ["r", "b", "y", "g"] as const;

// Re-export shared types
export { MoveInfo, Position };

// Type aliases used by hooks
export type LastMove = {
  from: { row: number; col: number };
  to: { row: number; col: number };
  pieceCode: string;
  playerColor: string;
  playerId?: string;
  timestamp: number;
  capturedPiece?: string | null;
} | null;

export type CheckStatus = { r: boolean; b: boolean; y: boolean; g: boolean };

export type GameStatus =
  | "waiting"
  | "active"
  | "checkmate"
  | "stalemate"
  | "finished"
  | "promotion";

// ✅ Enhanced type safety for en passant targets
export interface EnPassantTarget {
  position: Position;
  createdBy: string;
  createdByTurn: string;
}

export interface BitboardState {
  white: Bitboard;
  black: Bitboard;
  red: Bitboard;
  yellow: Bitboard;
  blue: Bitboard;
  green: Bitboard;
  r: Bitboard;
  b: Bitboard;
  y: Bitboard;
  g: Bitboard;
  allPieces: Bitboard;
  occupancy: Bitboard;
  pieces: Record<string, Bitboard>;
  enPassantTarget: Bitboard;
  pinnedMask: Bitboard;
  // Attack maps are regenerated every move
  attackMaps: {
    r: Bitboard;
    b: Bitboard;
    y: Bitboard;
    g: Bitboard;
  };
}

export type SerializedBitboardPieces = Record<string, string>;

export interface SerializedBitboardState {
  pieces: SerializedBitboardPieces;
}

export type SerializedGameState = Omit<
  GameState,
  "bitboardState" | "boardState" | "eliminatedPieceBitboards" | "history" | "moveCache"
> & {
  bitboardState: SerializedBitboardState;
  boardState?: (string | null)[][];
  eliminatedPieceBitboards?: SerializedBitboardPieces;
  history?: GameState[];
  moveCache?: { [key: string]: MoveInfo[] };
};

export interface GameState {
  boardState: (string | null)[][];
  bitboardState: BitboardState;
  version?: number;
  // Visual-only pieces for eliminated players (rendered but not in logic)
  eliminatedPieceBitboards: Record<string, Bitboard>;
  currentPlayerTurn: string;
  gameStatus:
    | "waiting"
    | "active"
    | "checkmate"
    | "stalemate"
    | "finished"
    | "promotion";
  selectedPiece: Position | null;
  validMoves: MoveInfo[];
  moveCache?: { [key: string]: MoveInfo[] }; // Cache for valid moves to improve performance
  capturedPieces: { r: string[]; b: string[]; y: string[]; g: string[] };
  checkStatus: { r: boolean; b: boolean; y: boolean; g: boolean };
  winner: string | null;
  eliminatedPlayers: string[];
  justEliminated: string | null; // Will be 'r', 'b', 'y', or 'g'
  scores: { r: number; b: number; y: number; g: number };
  timeControl: {
    baseMs: number;
    incrementMs: number;
  };
  clocks: { r: number; b: number; y: number; g: number };
  turnStartedAt: number | null;
  teamMode: boolean;
  teamAssignments: { r: "A" | "B"; b: "A" | "B"; y: "A" | "B"; g: "A" | "B" };
  winningTeam?: "A" | "B" | null;
  promotionState: {
    isAwaiting: boolean;
    position: Position | null;
    color: string | null;
  };
  hasMoved: {
    rK: boolean;
    rR1: boolean;
    rR2: boolean; // Red King, Rook on a-file, Rook on h-file
    bK: boolean;
    bR1: boolean;
    bR2: boolean; // Blue King, Rook on rank 1, Rook on rank 8
    yK: boolean;
    yR1: boolean;
    yR2: boolean; // Yellow
    gK: boolean;
    gR1: boolean;
    gR2: boolean; // Green
  };
  enPassantTargets: EnPassantTarget[]; // Will store multiple skipped squares and which pawns created them
  gameOverState: {
    isGameOver: boolean;
    status: "checkmate" | "stalemate" | "finished" | null;
    eliminatedPlayer: string | null;
  };
  history: GameState[];
  historyIndex: number;
  viewingHistoryIndex: number | null; // null = viewing live, number = viewing history
  // Last move tracking for highlighting
  lastMove: {
    from: { row: number; col: number };
    to: { row: number; col: number };
    pieceCode: string;
    playerColor: string;
    playerId?: string;
    timestamp: number;
    capturedPiece?: string | null; // The piece that was captured (if any)
  } | null;
  // Multiplayer state
  players: Player[];
  isHost: boolean;
  canStartGame: boolean;
  // Game mode
  gameMode: "solo" | "local" | "online" | "p2p" | "single";
  // Bot players tracking
  botPlayers: string[]; // e.g., ['b', 'y', 'g']
  botDifficulty: BotDifficulty;
  botTeamMode: boolean; // If true, all bots cooperate against human player(s)
  // P2P Lobby state
  currentGame: any | null; // P2PGame | null
  discoveredGames: any[];
  isDiscovering: boolean;
  isLoading: boolean;
  isConnected: boolean;
  connectionError: string | null;
  isEditingName: boolean;
  tempName: string;
}
