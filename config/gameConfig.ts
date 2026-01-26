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
  PIECE_MOVE: 220, // Snappy move duration
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

// Bot configuration - different settings for single player vs other modes
// MOVE_DELAY: Cosmetic delay (ms) before bot starts thinking.
// Allows piece animations (250ms) to complete. In 4-player chess, lower is better
// to avoid excessive waiting between bot turns.
export const BOT_CONFIG = {
  // Single player mode - more moves calculated for better gameplay
  SINGLE_PLAYER: {
    MAX_MOVES_TO_CALCULATE: 12, // Base cap before difficulty overrides
    BRAIN_TIMEOUT: 1500, // Base time budget (ms) for local bots
    MOVE_DELAY: 250, // Base delay (ms) - just enough for animation
  },
  // Other modes (online, P2P, local) - faster moves
  OTHER_MODES: {
    MAX_MOVES_TO_CALCULATE: 8, // Base cap before difficulty overrides
    BRAIN_TIMEOUT: 1200,
    MOVE_DELAY: 250,
  },
  // Difficulty presets - overrides base values
  DIFFICULTY: {
    easy: {
      MAX_MOVES_TO_CALCULATE: 8,
      BRAIN_TIMEOUT: 800,
      MOVE_DELAY: 300, // Slightly slower - feels more deliberate
      MAX_DEPTH: 1,
      QUIESCENCE_DEPTH: 2,
      RANDOMNESS_SCORE_GAP: 6,
      RANDOMNESS_TOP: 3,
    },
    medium: {
      MAX_MOVES_TO_CALCULATE: 10, // Slightly reduced
      BRAIN_TIMEOUT: 1200,
      MOVE_DELAY: 200, // Animation time only
      MAX_DEPTH: 2,
      QUIESCENCE_DEPTH: 2, // Reduced from 3 for speed
      RANDOMNESS_SCORE_GAP: 3,
      RANDOMNESS_TOP: 3,
    },
    hard: {
      MAX_MOVES_TO_CALCULATE: 12, // Reduced from 16 - less branching
      BRAIN_TIMEOUT: 3000, // More time for depth 3 search
      MOVE_DELAY: 0, // Instant - serious competitive play
      MAX_DEPTH: 3, // Deeper search for stronger play
      QUIESCENCE_DEPTH: 3, // Reduced this for - major speedup
      RANDOMNESS_SCORE_GAP: 1,
      RANDOMNESS_TOP: 2,
    },
  },
  DEFAULT_DIFFICULTY: 'easy',
} as const;

// Helper function to get bot config based on game mode
export const getBotConfig = (
  gameMode: string,
  difficulty: keyof typeof BOT_CONFIG.DIFFICULTY = BOT_CONFIG.DEFAULT_DIFFICULTY
) => {
  const base = gameMode === 'single' ? BOT_CONFIG.SINGLE_PLAYER : BOT_CONFIG.OTHER_MODES;
  const difficultyConfig =
    BOT_CONFIG.DIFFICULTY[difficulty] ?? BOT_CONFIG.DIFFICULTY[BOT_CONFIG.DEFAULT_DIFFICULTY];
  return {
    ...base,
    ...difficultyConfig,
  };
};

// Type definitions for better type safety
export type PieceValue = keyof typeof PIECE_VALUES;
export type GameStatus = typeof GAME_STATUS[keyof typeof GAME_STATUS];
export type GameMode = typeof GAME_MODES[keyof typeof GAME_MODES];
export type PlayerColor = typeof PLAYER_COLORS[keyof typeof PLAYER_COLORS];
export type PieceType = typeof PIECE_TYPES[keyof typeof PIECE_TYPES];
export type SoundEffect = typeof SOUND_EFFECTS[keyof typeof SOUND_EFFECTS];
export type BotDifficulty = keyof typeof BOT_CONFIG.DIFFICULTY;
