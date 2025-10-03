// Import shared types
import { Player } from "../app/services/networkService";
import { MoveInfo, Position } from "../types/index";

// Define the turn order for 4-player chess
export const turnOrder = ["r", "b", "y", "g"] as const;

// Re-export shared types
export { MoveInfo, Position };

// ✅ Enhanced type safety for en passant targets
export interface EnPassantTarget {
  position: Position;
  createdBy: string;
  createdByTurn: string;
}

export interface GameState {
  boardState: (string | null)[][];
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
