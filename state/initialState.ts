/**
 * Initial game state configuration.
 */
import { initialBoardState } from "./boardState";
import { BOT_CONFIG } from "../config/gameConfig";
import { getPinnedPiecesMask } from "../src/logic/bitboardLogic";
import { updateAllCheckStatus } from "./gameHelpers";
import {
  syncBitboardsFromArray,
  createEmptyPieceBitboards,
  refreshAllAttackMaps,
} from "./bitboardOperations";
import type { GameState } from "./types";

const initialBitboardState = syncBitboardsFromArray(initialBoardState);

const BASE_TIME_MS = 5 * 60 * 1000;

/**
 * Base initial state with all game properties
 */
export const baseInitialState: GameState = {
  boardState: initialBoardState,
  bitboardState: initialBitboardState,
  eliminatedPieceBitboards: createEmptyPieceBitboards(initialBitboardState.pieces),
  currentPlayerTurn: "r", // Red starts first
  gameStatus: "active",
  version: 0,
  selectedPiece: null,
  validMoves: [],
  capturedPieces: { r: [], b: [], y: [], g: [] },
  checkStatus: { r: false, b: false, y: false, g: false },
  winner: null,
  eliminatedPlayers: [],
  justEliminated: null,
  scores: { r: 0, b: 0, y: 0, g: 0 },
  timeControl: { baseMs: BASE_TIME_MS, incrementMs: 0 },
  clocks: { r: BASE_TIME_MS, b: BASE_TIME_MS, y: BASE_TIME_MS, g: BASE_TIME_MS },
  turnStartedAt: null,
  teamMode: false,
  teamAssignments: { r: "A", y: "A", b: "B", g: "B" },
  winningTeam: null,
  promotionState: { isAwaiting: false, position: null, color: null },
  hasMoved: {
    rK: false, rR1: false, rR2: false,
    bK: false, bR1: false, bR2: false,
    yK: false, yR1: false, yR2: false,
    gK: false, gR1: false, gR2: false,
  },
  enPassantTargets: [],
  gameOverState: {
    isGameOver: false,
    status: null,
    eliminatedPlayer: null,
  },
  history: [],
  historyIndex: 0,
  viewingHistoryIndex: null,
  lastMove: null,
  // Multiplayer state
  players: [],
  isHost: false,
  canStartGame: false,
  // Game mode
  gameMode: "single",
  // Bot players tracking
  botPlayers: [],
  botDifficulty: BOT_CONFIG.DEFAULT_DIFFICULTY,
  botTeamMode: false,
  // P2P Lobby state
  currentGame: null as any,
  discoveredGames: [],
  isDiscovering: false,
  isLoading: false,
  isConnected: false,
  connectionError: null as string | null,
  isEditingName: false,
  tempName: "",
};

// Initialize attack maps and check status for base state
refreshAllAttackMaps(baseInitialState);
baseInitialState.checkStatus = updateAllCheckStatus(baseInitialState);
baseInitialState.bitboardState.pinnedMask = getPinnedPiecesMask(
  baseInitialState,
  baseInitialState.currentPlayerTurn
);

/**
 * Create the fully initialized initial state
 */
export const createInitialState = (): GameState => {
  const state: GameState = {
    ...baseInitialState,
    bitboardState: syncBitboardsFromArray(initialBoardState),
    eliminatedPieceBitboards: createEmptyPieceBitboards(initialBitboardState.pieces),
    history: [],
    historyIndex: 0,
    viewingHistoryIndex: null,
    lastMove: null,
    moveCache: {},
    players: baseInitialState.players,
    isHost: baseInitialState.isHost,
    canStartGame: baseInitialState.canStartGame,
    timeControl: { ...baseInitialState.timeControl },
    clocks: { ...baseInitialState.clocks },
    turnStartedAt: Date.now(),
    teamMode: baseInitialState.teamMode,
    teamAssignments: { ...baseInitialState.teamAssignments },
    winningTeam: baseInitialState.winningTeam,
  };

  refreshAllAttackMaps(state);
  state.checkStatus = updateAllCheckStatus(state);
  state.bitboardState.pinnedMask = getPinnedPiecesMask(
    state,
    state.currentPlayerTurn
  );

  return state;
};

export const initialState = createInitialState();
