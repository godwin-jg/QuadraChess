import type { Player } from "../app/services/networkService";
import type { GameState, SerializedGameState } from "../state/types";
import { store } from "../state/store";
import {
  applyOnlineSnapshot,
  setBotPlayers,
  setConnectionError,
  setIsConnected,
} from "../state/gameSlice";
import { onlineDataClient, OnlineGameSnapshot } from "./onlineDataClient";
import {
  createEmptyPieceBitboards,
  deserializeBitboardPieces,
  rebuildBitboardStateFromPieces,
} from "../src/logic/bitboardSerialization";
import { bitboardToArray } from "../src/logic/bitboardUtils";
import { getPinnedPiecesMask } from "../src/logic/bitboardLogic";
import { updateAllCheckStatus } from "../state/gameHelpers";
import { syncBitboardsFromArray } from "../state/gameSlice";
import { buildMoveKey, consumeSkipNextMoveAnimation, sendGameFlowEvent } from "./gameFlowService";

type OnlineSessionState =
  | "idle"
  | "authenticating"
  | "connecting"
  | "subscribed"
  | "syncing"
  | "active"
  | "awaitingPromotion"
  | "submittingMove"
  | "reconnecting"
  | "error"
  | "terminating";

type MoveRequest = {
  from: { row: number; col: number };
  to: { row: number; col: number };
  pieceCode: string;
  playerColor: string;
  isEnPassant?: boolean;
  enPassantTarget?: GameState["enPassantTargets"][number] | null;
};

class OnlineSessionMachine {
  public currentGameId: string | null = null;
  public currentPlayer: Player | null = null;
  public isConnected = false;

  private state: OnlineSessionState = "idle";
  private unsubscribeGame: (() => void) | null = null;
  private gameUpdateCallbacks: ((game: OnlineGameSnapshot | null) => void)[] = [];
  private moveUpdateCallbacks: ((move: OnlineGameSnapshot["lastMove"]) => void)[] = [];
  private lastVersion: number | null = null;
  private lastMoveKey: string | null = null;
  private botMoveInFlight = false;

  private transition(nextState: OnlineSessionState) {
    this.state = nextState;
  }

  private normalizeBoardState(boardState: any): (string | null)[][] {
    if (!Array.isArray(boardState)) {
      return [];
    }
    return boardState.map((row: any) =>
      Array.isArray(row)
        ? row.map((cell: any) => (cell === "" ? null : cell))
        : Array(14).fill(null)
    );
  }

  private getPlayersArray(players: { [playerId: string]: Player } | undefined): Player[] {
    if (!players) return [];
    return Object.entries(players).map(([playerId, player]) => ({
      id: player.id || playerId,
      name: player.name || `Player ${playerId.slice(0, 8)}`,
      color: player.color || "g",
      isHost: player.isHost || false,
      isOnline: player.isOnline || false,
      isBot: player.isBot || false,
      lastSeen: player.lastSeen || Date.now(),
    }));
  }

  private buildMoveKey(move: OnlineGameSnapshot["lastMove"]) {
    if (!move) return null;
    return `${move.playerColor}:${move.from.row},${move.from.col}->${move.to.row},${move.to.col}:${move.timestamp}`;
  }

  private handleSnapshot(game: OnlineGameSnapshot | null) {
    if (!game || !game.gameState) {
      this.gameUpdateCallbacks.forEach((cb) => cb(null));
      return;
    }

    const version = (game.gameState as any).version;
    if (version !== undefined && version !== null) {
      if (this.lastVersion !== null && version <= this.lastVersion) {
        return;
      }
      this.lastVersion = version;
    } else {
      this.lastVersion = null;
    }

    const rawState = game.gameState as SerializedGameState;
    let pieces = deserializeBitboardPieces(rawState.bitboardState?.pieces);
    if (
      (!rawState.bitboardState || !rawState.bitboardState.pieces) &&
      Array.isArray(rawState.boardState)
    ) {
      const normalizedBoard = this.normalizeBoardState(rawState.boardState);
      const fallbackBitboards = syncBitboardsFromArray(
        normalizedBoard,
        rawState.eliminatedPlayers || []
      );
      pieces = fallbackBitboards.pieces;
    }
    const eliminatedPieceBitboards = rawState.eliminatedPieceBitboards
      ? deserializeBitboardPieces(rawState.eliminatedPieceBitboards as any)
      : createEmptyPieceBitboards();
    const bitboardState = rebuildBitboardStateFromPieces(
      pieces,
      rawState.eliminatedPlayers || [],
      rawState.enPassantTargets || []
    );
    const boardState = bitboardToArray(bitboardState.pieces, eliminatedPieceBitboards);
    const playersArray = this.getPlayersArray(game.players);
    const botPlayers = playersArray
      .filter((player) => player.isBot)
      .map((player) => player.color);

    console.log(`[OnlineSession] Players from snapshot:`, playersArray.map(p => ({ color: p.color, isBot: p.isBot })));
    console.log(`[OnlineSession] Extracted botPlayers:`, botPlayers);
    store.dispatch(setBotPlayers(botPlayers));

    const user = onlineDataClient.getCurrentUser();
    if (user) {
      this.currentPlayer = game.players[user.uid] || null;
    }

    const isHost = user ? game.hostId === user.uid : false;
    const canStartGame = playersArray.length >= 2 && game.status === "waiting";

    const baseMs = rawState.timeControl?.baseMs ?? 5 * 60 * 1000;
    const teamAssignments = rawState.teamAssignments ?? { r: "A", y: "A", b: "B", g: "B" };
    const snapshotState: GameState = {
      ...(game.gameState as unknown as GameState),
      boardState,
      bitboardState,
      eliminatedPieceBitboards,
      eliminatedPlayers: rawState.eliminatedPlayers || [],
      players: playersArray,
      isHost,
      canStartGame,
      gameMode: "online",
      botPlayers,
      timeControl: rawState.timeControl ?? { baseMs, incrementMs: 0 },
      clocks: rawState.clocks ?? {
        r: baseMs,
        b: baseMs,
        y: baseMs,
        g: baseMs,
      },
      turnStartedAt: rawState.turnStartedAt ?? null,
      teamMode: !!rawState.teamMode,
      teamAssignments,
      winningTeam: rawState.winningTeam ?? null,
      premove: null, // Premove is local-only state, not synced from network
    };
    snapshotState.checkStatus = updateAllCheckStatus(snapshotState);
    snapshotState.bitboardState.pinnedMask = getPinnedPiecesMask(
      snapshotState,
      snapshotState.currentPlayerTurn
    );

    const resolvedVersion =
      typeof version === "number" ? version : store.getState().game.version ?? 0;

    store.dispatch(
      applyOnlineSnapshot({
        gameState: snapshotState,
        lastMove: game.lastMove || null,
        version: resolvedVersion,
      })
    );

    const moveKey = buildMoveKey(game.lastMove || null);
    if (moveKey) {
      sendGameFlowEvent({
        type: "MOVE_APPLIED",
        moveKey,
        shouldAnimate: !consumeSkipNextMoveAnimation(),
      });
    }

    this.transition(
      snapshotState.promotionState?.isAwaiting ? "awaitingPromotion" : "active"
    );

    const snapshotMoveKey = this.buildMoveKey(game.lastMove);
    if (snapshotMoveKey && snapshotMoveKey !== this.lastMoveKey) {
      this.lastMoveKey = snapshotMoveKey;
      this.moveUpdateCallbacks.forEach((cb) => cb(game.lastMove));
    }

    this.gameUpdateCallbacks.forEach((cb) => cb(game));

    this.maybeHandleBotTurn(store.getState().game);
  }

  private async maybeHandleBotTurn(state: GameState) {
    if (this.botMoveInFlight) return;
    if (!state.botPlayers.includes(state.currentPlayerTurn)) return;
    if (!state.isHost) return;
    if (state.promotionState.isAwaiting) return;
    if (state.gameStatus !== "active") return;
    if (!this.currentGameId) return;

    // Delegate to the centralized online bot service
    // This service handles timeouts, retries, and atomic transactions
    const { onlineBotService } = require("./onlineBotService");
    onlineBotService.scheduleBotMove(this.currentGameId, state.currentPlayerTurn, state);
  }

  async connectToGame(gameId: string): Promise<void> {
    if (this.currentGameId === gameId && this.isConnected) {
      return;
    }
    if (this.isConnected) {
      await this.disconnect();
    }

    this.transition("authenticating");
    await onlineDataClient.signInAnonymously();

    this.currentGameId = gameId;
    this.isConnected = true;
    store.dispatch(setIsConnected(true));
    store.dispatch(setConnectionError(null));

    this.transition("connecting");
    this.unsubscribeGame = onlineDataClient.subscribeToGame(gameId, (game) =>
      this.handleSnapshot(game)
    );

    await onlineDataClient.updatePlayerPresence(gameId, true);
    this.transition("subscribed");
  }

  async disconnect(): Promise<void> {
    if (this.unsubscribeGame) {
      this.unsubscribeGame();
      this.unsubscribeGame = null;
    }

    if (this.currentGameId) {
      try {
        await onlineDataClient.updatePlayerPresence(this.currentGameId, false);
      } catch {
        // ignore presence failures during disconnect
      }
    }

    this.currentGameId = null;
    this.currentPlayer = null;
    this.isConnected = false;
    this.lastVersion = null;
    this.lastMoveKey = null;
    this.transition("idle");
    store.dispatch(setIsConnected(false));
  }

  async makeMove(moveData: MoveRequest): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }
    this.transition("submittingMove");
    await onlineDataClient.submitMove(this.currentGameId, moveData);
    this.transition("active");
  }

  async makePromotion(pieceType: string): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }
    const state = store.getState().game;
    if (!state.promotionState.isAwaiting || !state.promotionState.position) {
      throw new Error("No pending promotion");
    }
    await onlineDataClient.submitPromotion(this.currentGameId, {
      position: state.promotionState.position,
      pieceType,
      playerColor: state.promotionState.color!,
    });
  }

  async resignGame(): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }
    if (!this.currentPlayer?.color) {
      throw new Error("Player color not available for resignation");
    }
    await onlineDataClient.resignGame(this.currentGameId, this.currentPlayer.color);
    await this.disconnect();
  }

  async timeoutPlayer(playerColor: string): Promise<void> {
    if (!this.currentGameId || !this.isConnected) {
      throw new Error("Not connected to a game");
    }
    await onlineDataClient.timeoutPlayer(this.currentGameId, playerColor);
  }

  onGameUpdate(callback: (game: OnlineGameSnapshot | null) => void): () => void {
    this.gameUpdateCallbacks.push(callback);
    return () => {
      const index = this.gameUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.gameUpdateCallbacks.splice(index, 1);
      }
    };
  }

  onMoveUpdate(callback: (move: OnlineGameSnapshot["lastMove"]) => void): () => void {
    this.moveUpdateCallbacks.push(callback);
    return () => {
      const index = this.moveUpdateCallbacks.indexOf(callback);
      if (index > -1) {
        this.moveUpdateCallbacks.splice(index, 1);
      }
    };
  }
}

export const onlineSessionMachine = new OnlineSessionMachine();
