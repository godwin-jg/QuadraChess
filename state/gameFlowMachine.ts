import { assign, createMachine } from "xstate";

export interface GameFlowContext {
  lastMoveKey: string | null;
  activeMoveKey: string | null;
  promotionPending: boolean;
  isViewingHistory: boolean;
  syncCounter: number;
}

export type GameFlowEvent =
  | { type: "GAME_READY" }
  | { type: "MOVE_APPLIED"; moveKey: string; shouldAnimate: boolean }
  | { type: "ANIMATION_DONE" }
  | { type: "PROMOTION_REQUIRED" }
  | { type: "PROMOTION_COMPLETE" }
  | { type: "GAME_ENDED" }
  | { type: "RESET" }
  | { type: "VIEW_HISTORY"; enabled: boolean }
  | { type: "SYNC_STATE" };

// Type-safe action creators cast to any to satisfy XState v5's strict typing
const incrementSync = assign(({ context }: { context: GameFlowContext }) => ({
  syncCounter: context.syncCounter + 1,
})) as any;

const assignMove = assign(({ context, event }: { context: GameFlowContext; event: GameFlowEvent }) => {
  if (event.type !== "MOVE_APPLIED") return {};
  const shouldAnimate = event.shouldAnimate && !context.isViewingHistory;
  return {
    lastMoveKey: event.moveKey,
    activeMoveKey: shouldAnimate ? event.moveKey : null,
  };
}) as any;

const assignLastMoveKey = assign(({ event }: { event: GameFlowEvent }) => {
  if (event.type !== "MOVE_APPLIED") return {};
  return {
    lastMoveKey: event.moveKey,
  };
}) as any;

const clearActiveMove = assign(() => ({
  activeMoveKey: null as string | null,
})) as any;

const setPromotionPending = assign(() => ({
  promotionPending: true,
})) as any;

const clearPromotionPending = assign(() => ({
  promotionPending: false,
})) as any;

const setViewingHistory = assign(({ event }: { event: GameFlowEvent }) => {
  if (event.type !== "VIEW_HISTORY") return {};
  return {
    isViewingHistory: event.enabled,
  };
}) as any;

const resetContext = assign(() => ({
  lastMoveKey: null as string | null,
  activeMoveKey: null as string | null,
  promotionPending: false,
  isViewingHistory: false,
  syncCounter: 0,
})) as any;

const isNewMove = ({ context, event }: { context: GameFlowContext; event: GameFlowEvent }) =>
  event.type === "MOVE_APPLIED" && event.moveKey !== context.lastMoveKey;

const shouldAnimateMove = ({
  context,
  event,
}: {
  context: GameFlowContext;
  event: GameFlowEvent;
}) =>
  event.type === "MOVE_APPLIED" &&
  event.shouldAnimate &&
  !context.isViewingHistory;

export const gameFlowMachine = createMachine(
  {
    types: {} as {
      context: GameFlowContext;
      events: GameFlowEvent;
    },
    context: {
      lastMoveKey: null,
      activeMoveKey: null,
      promotionPending: false,
      isViewingHistory: false,
      syncCounter: 0,
    },
    id: "gameFlow",
    initial: "boot",
    on: {
      GAME_ENDED: {
        target: ".gameOver",
        actions: clearActiveMove,
      },
      RESET: {
        target: ".ready",
        actions: [resetContext, incrementSync],
      },
      VIEW_HISTORY: {
        actions: [setViewingHistory, incrementSync],
      },
      SYNC_STATE: {
        actions: incrementSync,
      },
    },
    states: {
      boot: {
        on: {
          GAME_READY: {
            target: "ready",
          },
        },
      },
      ready: {
        on: {
          MOVE_APPLIED: [
            {
              guard: ({ context, event }) => isNewMove({ context, event }) && shouldAnimateMove({ context, event }),
              target: "animating",
              actions: assignMove,
            },
            {
              guard: isNewMove,
              actions: [assignMove, incrementSync],
            },
          ],
          PROMOTION_REQUIRED: {
            target: "awaitingPromotion",
            actions: setPromotionPending,
          },
        },
      },
      animating: {
        on: {
          MOVE_APPLIED: [
            {
              guard: isNewMove,
              actions: assignLastMoveKey,
            },
          ],
          PROMOTION_REQUIRED: {
            actions: setPromotionPending,
          },
          ANIMATION_DONE: [
            {
              guard: ({ context }) => context.promotionPending,
              target: "awaitingPromotion",
              actions: [clearActiveMove],
            },
            {
              target: "ready",
              actions: [clearActiveMove],
            },
          ],
        },
      },
      awaitingPromotion: {
        on: {
          PROMOTION_COMPLETE: {
            target: "ready",
            actions: [clearPromotionPending, incrementSync],
          },
        },
      },
      syncing: {
        on: {
          SYNC_STATE: {
            target: "ready",
            actions: incrementSync,
          },
        },
      },
      gameOver: {
        on: {
          RESET: {
            target: "ready",
            actions: [resetContext, incrementSync],
          },
        },
      },
    },
  }
);
