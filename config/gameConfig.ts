/**
 * Centralized game configuration and constants
 * This file contains all the game rules, point values, and other constants
 * used throughout the QuadChess application.
 */

// Point values for captured pieces
export const PIECE_VALUES = {
  P: 1,  // Pawn
  N: 3,  // Knight
  B: 5,  // Bishop
  R: 5,  // Rook
  Q: 9,  // Queen
  K: 0,  // King (cannot be captured - should be checkmated instead)
} as const;

// Special bonuses for game-ending moves
export const GAME_BONUSES = {
  CHECKMATE: 20,        // Bonus points for checkmating an opponent
  STALEMATE_PER_PLAYER: 10, // Points per remaining player when stalemating
} as const;

// Turn order for the game
export const TURN_ORDER = ['r', 'b', 'y', 'g'] as const;

// Game status types
export const GAME_STATUS = {
  WAITING: 'waiting',
  ACTIVE: 'active',
  PROMOTION: 'promotion',
  CHECKMATE: 'checkmate',
  STALEMATE: 'stalemate',
  FINISHED: 'finished',
} as const;

// Game modes
export const GAME_MODES = {
  SOLO: 'solo',
  P2P: 'p2p',
  ONLINE: 'online',
} as const;

// Player colors
export const PLAYER_COLORS = {
  RED: 'r',
  BLUE: 'b',
  YELLOW: 'y',
  GREEN: 'g',
} as const;

// Piece types
export const PIECE_TYPES = {
  PAWN: 'P',
  KNIGHT: 'N',
  BISHOP: 'B',
  ROOK: 'R',
  QUEEN: 'Q',
  KING: 'K',
} as const;

// Board dimensions
export const BOARD_CONFIG = {
  ROWS: 14,
  COLS: 14,
  SQUARE_SIZE: 40, // Default square size in pixels
} as const;

// Animation durations (in milliseconds)
export const ANIMATION_DURATIONS = {
  PIECE_MOVE: 250, // ✅ Actual duration from Board.tsx
  CAPTURE_EFFECT: 200,
  GLOW_PULSE: 2500,
  FADE_IN: 400,
  FADE_OUT: 300,
} as const;

// Sound effect names (for consistency)
export const SOUND_EFFECTS = {
  MOVE: 'move',
  CAPTURE: 'capture',
  CASTLE: 'castle',
  CHECK: 'check',
  CHECKMATE: 'checkmate',
  ILLEGAL_MOVE: 'illegal',
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_DELAY: 1000,
  HEARTBEAT_INTERVAL: 30000,
  MOVE_TIMEOUT: 10000,
} as const;

// Bot configuration
export const BOT_CONFIG = {
  MAX_MOVES_TO_CALCULATE: 20,
  BRAIN_TIMEOUT: 3000, // 3 seconds - smart timeout with fallback
  DEFAULT_DIFFICULTY: 'medium',
  MOVE_DELAY: 800, // 0.8 seconds - faster bot moves for better responsiveness
} as const;

// Type definitions for better type safety
export type PieceValue = keyof typeof PIECE_VALUES;
export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];
export type GameMode = typeof GAME_MODES[keyof typeof GAME_MODES];
export type PlayerColor = typeof PLAYER_COLORS[keyof typeof PLAYER_COLORS];
export type PieceType = typeof PIECE_TYPES[keyof typeof PIECE_TYPES];
export type SoundEffect = typeof SOUND_EFFECTS[keyof typeof SOUND_EFFECTS];
