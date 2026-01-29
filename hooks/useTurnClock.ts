import { useEffect, useMemo, useRef, useState } from "react";

type Clocks = { r: number; b: number; y: number; g: number };
type TeamAssignments = { r: "A" | "B"; b: "A" | "B"; y: "A" | "B"; g: "A" | "B" };

interface UseTurnClockOptions {
  clocks: Clocks | undefined;
  currentPlayerTurn: string;
  turnStartedAt: number | null;
  gameStatus: string;
  eliminatedPlayers: string[];
  teamMode?: boolean;
  teamAssignments?: TeamAssignments;
  isPaused?: boolean;
  onTimeout?: (playerColor: string) => void;
}

interface UseTurnClockResult {
  displayClocks: Clocks;
}

const ZERO_CLOCKS: Clocks = { r: 0, b: 0, y: 0, g: 0 };

/**
 * Lichess-style clock synchronization:
 * 
 * The server sends: { clocks: {...}, turnStartedAt: serverTimestamp }
 * We track WHEN we received this data locally using performance.now() (monotonic).
 * 
 * To display remaining time:
 *   elapsed = performance.now() - clientSyncAt  (pure local delta, no server time mixing)
 *   displayTime = clocks[activePlayer] - elapsed
 * 
 * This ensures all clients show the same countdown because they all:
 * 1. Start from the same server-provided "remaining" value
 * 2. Measure elapsed time locally from when they received the data
 * 3. Never mix server timestamps with local Date.now()
 */
export const useTurnClock = ({
  clocks,
  currentPlayerTurn,
  turnStartedAt,
  gameStatus,
  eliminatedPlayers,
  teamMode = false,
  teamAssignments,
  isPaused = false,
  onTimeout,
}: UseTurnClockOptions): UseTurnClockResult => {
  const [tick, setTick] = useState(0);
  const timeoutSentRef = useRef<string | null>(null);
  
  // ✅ LICHESS-STYLE SYNC: Track when we received the clock data locally
  // This uses performance.now() which is monotonic (not affected by system clock changes)
  const clientSyncAtRef = useRef<number>(performance.now());
  const syncedClocksRef = useRef<Clocks>(ZERO_CLOCKS);
  const syncedPlayerRef = useRef<string>("");

  // ✅ Reset sync point when server sends new clock data
  // This happens on: turn change, move made, game start, reconnect
  useEffect(() => {
    if (clocks && turnStartedAt !== null) {
      clientSyncAtRef.current = performance.now();
      syncedClocksRef.current = { ...clocks };
      syncedPlayerRef.current = currentPlayerTurn;
    }
  }, [clocks, turnStartedAt, currentPlayerTurn]);

  const shouldRun =
    !isPaused &&
    (gameStatus === "active" || gameStatus === "promotion") &&
    !!turnStartedAt;

  useEffect(() => {
    if (!shouldRun) return;
    const intervalId = setInterval(() => {
      setTick((prev) => prev + 1);
    }, 200);
    return () => clearInterval(intervalId);
  }, [shouldRun]);

  useEffect(() => {
    timeoutSentRef.current = null;
  }, [currentPlayerTurn, turnStartedAt]);

  const displayClocks = useMemo(() => {
    const safeClocks = clocks ?? ZERO_CLOCKS;
    if (
      !shouldRun ||
      !turnStartedAt ||
      !safeClocks[currentPlayerTurn as keyof Clocks]
    ) {
      return { ...safeClocks };
    }
    
    // ✅ LICHESS-STYLE: Calculate elapsed using LOCAL monotonic time only
    // We measure how much time has passed since we received the clock data,
    // NOT by comparing server timestamp to local Date.now()
    const elapsedMs = Math.max(0, performance.now() - clientSyncAtRef.current);
    
    // Use the synced clock value as the base (snapshot from server)
    const baseClock = syncedClocksRef.current[currentPlayerTurn as keyof Clocks] 
      ?? safeClocks[currentPlayerTurn as keyof Clocks];
    
    const remaining = Math.max(0, baseClock - elapsedMs);
    
    return {
      ...safeClocks,
      [currentPlayerTurn]: remaining,
    } as Clocks;
  }, [clocks, currentPlayerTurn, turnStartedAt, shouldRun, tick]);

  useEffect(() => {
    if (!onTimeout) return;
    if (!shouldRun) return;
    if (eliminatedPlayers.includes(currentPlayerTurn)) return;
    const remaining = displayClocks[currentPlayerTurn as keyof Clocks];
    if (remaining > 0) return;
    if (timeoutSentRef.current === currentPlayerTurn) return;
    timeoutSentRef.current = currentPlayerTurn;
    onTimeout(currentPlayerTurn);
  }, [
    onTimeout,
    shouldRun,
    currentPlayerTurn,
    eliminatedPlayers,
    displayClocks,
  ]);

  return { displayClocks };
};
