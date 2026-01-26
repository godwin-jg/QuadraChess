import { createActor } from "xstate";
import type { GameState } from "../state/types";
import { gameFlowMachine, GameFlowEvent } from "../state/gameFlowMachine";

export const gameFlowActor = createActor(gameFlowMachine);

let started = false;

export const startGameFlowMachine = () => {
  if (started) return;
  gameFlowActor.start();
  started = true;
};

export const stopGameFlowMachine = () => {
  if (!started) return;
  gameFlowActor.stop();
  started = false;
};

let skipNextMoveAnimation = false;

export const markSkipNextMoveAnimation = () => {
  skipNextMoveAnimation = true;
};

export const consumeSkipNextMoveAnimation = () => {
  const value = skipNextMoveAnimation;
  skipNextMoveAnimation = false;
  return value;
};

export const peekSkipNextMoveAnimation = () => skipNextMoveAnimation;

export const sendGameFlowEvent = (event: GameFlowEvent) => {
  if (!started) {
    startGameFlowMachine();
  }
  gameFlowActor.send(event);
};

export const getGameFlowSnapshot = () => gameFlowActor.getSnapshot();

export const subscribeGameFlow = (listener: () => void) => {
  const subscription = gameFlowActor.subscribe(listener);
  return () => subscription.unsubscribe();
};

export const isGameFlowReady = (): boolean => {
  const snapshot = gameFlowActor.getSnapshot();
  if (!snapshot) return false;
  const value = snapshot.value;
  const valueReady = value === "ready" || value === "boot";
  if (typeof snapshot.matches === "function") {
    // Allow both "ready" and "boot" states (boot = initial state before first move)
    // Fallback to value check if matches behaves unexpectedly.
    return snapshot.matches("ready") || snapshot.matches("boot") || valueReady;
  }
  return valueReady;
};

export const buildMoveKey = (move: GameState["lastMove"] | null): string | null => {
  if (!move) return null;
  return `${move.from.row}-${move.from.col}-${move.to.row}-${move.to.col}-${move.pieceCode}-${move.playerColor}`;
};
