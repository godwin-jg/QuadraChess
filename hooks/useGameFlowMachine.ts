import { useSyncExternalStore, useCallback } from "react";
import {
  gameFlowActor,
  startGameFlowMachine,
} from "../services/gameFlowService";

// Start the machine eagerly (outside of component lifecycle)
// This ensures it's running before any component renders
startGameFlowMachine();

// Subscribe function for useSyncExternalStore
const subscribe = (onStoreChange: () => void) => {
  const subscription = gameFlowActor.subscribe(onStoreChange);
  return () => subscription.unsubscribe();
};

// Get snapshot function
const getSnapshot = () => gameFlowActor.getSnapshot();

export const useGameFlowMachine = () => {
  // Use React 18's useSyncExternalStore for proper subscription
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const send = useCallback((event: Parameters<typeof gameFlowActor.send>[0]) => {
    gameFlowActor.send(event);
  }, []);

  return [snapshot, send] as const;
};
