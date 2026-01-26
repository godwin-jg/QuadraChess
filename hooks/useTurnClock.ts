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
    if (teamMode && teamAssignments) {
      const teamId = teamAssignments[currentPlayerTurn as keyof TeamAssignments];
      const teamColors = (Object.keys(teamAssignments) as Array<keyof TeamAssignments>).filter(
        (color) => teamAssignments[color] === teamId
      ) as Array<keyof Clocks>;
      const baseRemaining = Math.min(
        ...teamColors.map((color) => safeClocks[color])
      );
      const now = Date.now();
      const elapsedMs = Math.max(0, now - turnStartedAt);
      const remaining = Math.max(0, baseRemaining - elapsedMs);
      const updated = { ...safeClocks } as Clocks;
      teamColors.forEach((color) => {
        updated[color] = remaining;
      });
      return updated;
    }
    const now = Date.now();
    const elapsedMs = Math.max(0, now - turnStartedAt);
    const remaining = Math.max(
      0,
      safeClocks[currentPlayerTurn as keyof Clocks] - elapsedMs
    );
    return {
      ...safeClocks,
      [currentPlayerTurn]: remaining,
    } as Clocks;
  }, [clocks, currentPlayerTurn, turnStartedAt, shouldRun, tick, teamAssignments, teamMode]);

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
