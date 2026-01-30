// services/botStateMachine.ts
// Centralized bot move state machine (decoupled from UI)

import type { Unsubscribe } from "redux";
import { store } from "../state/store";
import type { GameState } from "../state/types";
import { getBotConfig } from "../config/gameConfig";
import { botService } from "./botService";
import {
  getGameFlowSnapshot,
  isGameFlowReady,
  subscribeGameFlow,
  sendGameFlowEvent,
} from "./gameFlowService";

export type BotMachineState = "idle" | "scheduled" | "thinking" | "promotion";

export type BotMachineSnapshot = {
  state: BotMachineState;
  scheduledTurn: string | null;
  idleReason: string | null;
  currentTurn: string;
  gameStatus: GameState["gameStatus"];
  botPlayers: string[];
};

let machineState: BotMachineState = "idle";
let scheduledTimer: ReturnType<typeof setTimeout> | null = null;
let promotionTimer: ReturnType<typeof setTimeout> | null = null;
let scheduledTurn: string | null = null;
let idleReason: string | null = null;
let unsubscribe: Unsubscribe | null = null;
let flowUnsubscribe: (() => void) | null = null;
let started = false;
let lastRelevantKey: string | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach((listener) => listener());
};

const setMachineState = (nextState: BotMachineState) => {
  if (machineState !== nextState) {
    machineState = nextState;
    notify();
  }
};

const setScheduledTurn = (nextTurn: string | null) => {
  if (scheduledTurn !== nextTurn) {
    scheduledTurn = nextTurn;
    notify();
  }
};

const setIdleReason = (nextReason: string | null) => {
  if (idleReason !== nextReason) {
    idleReason = nextReason;
    notify();
  }
};

const clearScheduled = () => {
  if (scheduledTimer) {
    clearTimeout(scheduledTimer);
    scheduledTimer = null;
  }
  setScheduledTurn(null);
};

const clearPromotion = () => {
  if (promotionTimer) {
    clearTimeout(promotionTimer);
    promotionTimer = null;
  }
};

const isGameReady = (state: GameState): boolean =>
  !!state.bitboardState?.pieces && state.bitboardState.occupancy !== undefined;

const buildRelevantKey = (state: GameState): string => {
  const flowSnapshot = getGameFlowSnapshot();
  const flowValue =
    typeof flowSnapshot?.value === "string"
      ? flowSnapshot.value
      : flowSnapshot?.value
        ? JSON.stringify(flowSnapshot.value)
        : "unknown";
  const ready = isGameReady(state) ? "1" : "0";
  const promoAwaiting = state.promotionState.isAwaiting ? "1" : "0";
  const promoColor = state.promotionState.color ?? "";
  const botPlayers = state.botPlayers.join(",");
  const eliminated = state.eliminatedPlayers.join(",");
  return [
    ready,
    flowValue,
    state.gameStatus,
    state.currentPlayerTurn,
    promoAwaiting,
    promoColor,
    botPlayers,
    eliminated,
    state.gameMode,
    state.botDifficulty,
  ].join("|");
};

const canBotAct = (state: GameState): boolean => {
  if (!isGameReady(state)) return false;
  if (!isGameFlowReady()) return false;
  // For online mode, bots are handled server-side
  if (state.gameMode === "online") return false;

  // ✅ FIX: In P2P mode, only the host handles bot moves
  if (state.gameMode === "p2p" && !state.isHost) return false;

  if (state.gameStatus !== "active" && state.gameStatus !== "promotion") return false;
  if (!state.botPlayers.includes(state.currentPlayerTurn)) return false;
  if (state.eliminatedPlayers.includes(state.currentPlayerTurn)) return false;
  if (state.promotionState.isAwaiting) return false;
  return true;
};

const getIdleReason = (state: GameState): string | null => {
  if (!isGameReady(state)) return "notReady";
  if (!isGameFlowReady()) {
    const flowSnapshot = getGameFlowSnapshot();
    const flowValue =
      typeof flowSnapshot?.value === "string"
        ? flowSnapshot.value
        : flowSnapshot?.value
          ? JSON.stringify(flowSnapshot.value)
          : "unknown";
    return `flow:${flowValue}`;
  }
  if (state.gameStatus !== "active" && state.gameStatus !== "promotion") {
    return `status:${state.gameStatus}`;
  }
  if (state.promotionState.isAwaiting) return "promotionAwaiting";
  if (!state.botPlayers.includes(state.currentPlayerTurn)) return "notBotTurn";
  if (state.eliminatedPlayers.includes(state.currentPlayerTurn)) {
    return "botEliminated";
  }
  return null;
};

const scheduleBotMove = (state: GameState) => {
  const botColor = state.currentPlayerTurn;
  const botConfig = getBotConfig(state.gameMode, state.botDifficulty);
  const botThinkTime = botConfig.MOVE_DELAY;
  const maxRetries = 20;
  const retryDelay = 50;
  let retryCount = 0;

  setScheduledTurn(botColor);
  setMachineState("scheduled");

  const attemptMove = (delay: number) => {
    scheduledTimer = setTimeout(() => {
      const latest = store.getState().game;
      if (latest.currentPlayerTurn !== botColor) {
        clearScheduled();
        setMachineState("idle");
        setIdleReason(getIdleReason(latest));
        return;
      }

      if (!canBotAct(latest)) {
        retryCount += 1;
        if (retryCount > maxRetries) {
          clearScheduled();
          setMachineState("idle");
          setIdleReason(getIdleReason(latest));
          return;
        }
        attemptMove(retryDelay);
        return;
      }

      setMachineState("thinking");

      botService.makeBotMove(botColor);

      clearScheduled();
      setMachineState("idle");
      setIdleReason(getIdleReason(store.getState().game));
      handleStateChange(true);
    }, delay);
  };

  attemptMove(botThinkTime);
};

const scheduleBotPromotion = (state: GameState) => {
  if (!state.promotionState.isAwaiting || !state.promotionState.color) return;
  const color = state.promotionState.color;
  if (!state.botPlayers.includes(color)) return;
  if (promotionTimer) return;

  setMachineState("promotion");
  const delay = 300 + Math.random() * 300;
  promotionTimer = setTimeout(() => {
    const latest = store.getState().game;
    if (
      latest.promotionState.isAwaiting &&
      latest.promotionState.color === color
    ) {
      botService.handleBotPromotion(color);
    }
    clearPromotion();
    setMachineState("idle");
    setIdleReason(getIdleReason(store.getState().game));
    handleStateChange(true);
  }, delay);
};

const handleStateChange = (force = false) => {
  const state = store.getState().game;
  const relevantKey = buildRelevantKey(state);
  if (!force && relevantKey === lastRelevantKey) {
    return;
  }
  if (__DEV__) {
    console.log(`[BotStateMachine] State change: turn=${state.currentPlayerTurn}, machineState=${machineState}, canAct=${canBotAct(state)}, idle=${getIdleReason(state)}`);
  }
  lastRelevantKey = relevantKey;

  // Game end cleanup
  if (state.gameStatus === "finished" || state.gameStatus === "checkmate") {
    clearScheduled();
    clearPromotion();
    setMachineState("idle");
    setIdleReason(`status:${state.gameStatus}`);
    return;
  }

  // Promotion takes priority
  if (state.promotionState.isAwaiting) {
    scheduleBotPromotion(state);
    setIdleReason("promotionAwaiting");
    return;
  }

  // ✅ FIX: Detect when promotion completed but game flow is stuck
  // This can happen when GameScreen's useEffect doesn't fire in time
  if (!state.promotionState.isAwaiting) {
    const flowSnapshot = getGameFlowSnapshot();
    const flowState = flowSnapshot?.value;
    const flowContext = flowSnapshot?.context;
    
    // If flow is in animating with promotionPending, or in awaitingPromotion,
    // but game state says promotion is done, send the event to unstick
    if ((flowState === "animating" && flowContext?.promotionPending) ||
        flowState === "awaitingPromotion") {
      if (__DEV__) {
        console.log(`[BotStateMachine] Sending PROMOTION_COMPLETE to unstick flow (was ${flowState})`);
      }
      sendGameFlowEvent({ type: "PROMOTION_COMPLETE" });
    }
  }

  if (machineState === "promotion") {
    clearPromotion();
    setMachineState("idle");
    setIdleReason(getIdleReason(state));
  }

  if (machineState === "scheduled") {
    if (state.currentPlayerTurn !== scheduledTurn || !canBotAct(state)) {
      clearScheduled();
      setMachineState("idle");
      setIdleReason(getIdleReason(state));
    }
    return;
  }

  if (machineState === "thinking") {
    return;
  }

  if (machineState === "idle" && canBotAct(state)) {
    setIdleReason(null);
    scheduleBotMove(state);
  } else if (machineState === "idle") {
    setIdleReason(getIdleReason(state));
  }
};

export const getBotStateMachineSnapshot = (): BotMachineSnapshot => ({
  state: machineState,
  scheduledTurn,
  idleReason,
  currentTurn: store.getState().game.currentPlayerTurn,
  gameStatus: store.getState().game.gameStatus,
  botPlayers: store.getState().game.botPlayers,
});

export const subscribeBotStateMachine = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const startBotStateMachine = () => {
  if (started) return;
  started = true;
  unsubscribe = store.subscribe(handleStateChange);
  flowUnsubscribe = subscribeGameFlow(handleStateChange);
  handleStateChange();
};

export const stopBotStateMachine = () => {
  if (unsubscribe) {
    unsubscribe();
    unsubscribe = null;
  }
  if (flowUnsubscribe) {
    flowUnsubscribe();
    flowUnsubscribe = null;
  }
  clearScheduled();
  clearPromotion();
  setMachineState("idle");
  lastRelevantKey = null;
  started = false;
};
