import { useRef, useCallback } from "react";

interface PerfStats {
  lastLog: number;
  // Start/end JS calls (once per drag)
  startCount: number;
  startTotal: number;
  startMax: number;
  endCount: number;
  endTotal: number;
  endMax: number;
  cancelCount: number;
  // Track snap-change callbacks (should be minimal, only when snap target changes)
  snapChangeCount: number;
  // Track cursor-change callbacks (only when crossing square boundaries)
  cursorChangeCount: number;
}

interface UseDragPerformanceReturn {
  perfRef: React.MutableRefObject<PerfStats>;
  logDragPerf: (label: "start" | "end", durationMs: number) => void;
  nowMs: () => number;
}

/**
 * Hook for tracking drag performance metrics in development mode.
 * Provides timing utilities and aggregated stats logging.
 */
export function useDragPerformance(enabled: boolean): UseDragPerformanceReturn {
  const perfRef = useRef<PerfStats>({
    lastLog: 0,
    startCount: 0,
    startTotal: 0,
    startMax: 0,
    endCount: 0,
    endTotal: 0,
    endMax: 0,
    cancelCount: 0,
    snapChangeCount: 0,
    cursorChangeCount: 0,
  });

  const nowMs = useCallback(() => {
    return typeof globalThis !== "undefined" && globalThis.performance?.now
      ? globalThis.performance.now()
      : Date.now();
  }, []);

  const logDragPerf = useCallback(
    (label: "start" | "end", durationMs: number) => {
      if (!enabled) return;

      const perf = perfRef.current;
      if (label === "start") {
        perf.startCount += 1;
        perf.startTotal += durationMs;
        perf.startMax = Math.max(perf.startMax, durationMs);
      } else {
        perf.endCount += 1;
        perf.endTotal += durationMs;
        perf.endMax = Math.max(perf.endMax, durationMs);
      }

      if (durationMs < 2) return;

      const now = nowMs();
      if (now - perf.lastLog < 1000) return;
      perf.lastLog = now;

      const startAvg = perf.startCount ? perf.startTotal / perf.startCount : 0;
      const endAvg = perf.endCount ? perf.endTotal / perf.endCount : 0;

      console.debug(
        `[drag-perf] start avg=${startAvg.toFixed(2)}ms max=${perf.startMax.toFixed(2)}ms count=${perf.startCount} | ` +
          `end avg=${endAvg.toFixed(2)}ms max=${perf.endMax.toFixed(2)}ms count=${perf.endCount} | ` +
          `snapChange=${perf.snapChangeCount} cursorChange=${perf.cursorChangeCount} | ` +
          `cancel=${perf.cancelCount}`
      );

      // Reset stats after logging
      perf.startCount = 0;
      perf.startTotal = 0;
      perf.startMax = 0;
      perf.endCount = 0;
      perf.endTotal = 0;
      perf.endMax = 0;
      perf.cancelCount = 0;
      perf.snapChangeCount = 0;
      perf.cursorChangeCount = 0;
    },
    [enabled, nowMs]
  );

  return { perfRef, logDragPerf, nowMs };
}
