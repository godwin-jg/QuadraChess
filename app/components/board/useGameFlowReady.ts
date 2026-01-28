import { useMemo } from "react";
import { getGameFlowSnapshot } from "../../../services/gameFlowService";

interface GameFlowReadyReturn {
  isFlowReady: boolean;
  isFlowAnimating: boolean;
}

/**
 * Hook to check game flow ready state.
 * Extracted to break circular dependencies.
 */
export function useGameFlowReady(gameFlowState: unknown): GameFlowReadyReturn {
  return useMemo(() => {
    const flowSnapshot = gameFlowState ?? getGameFlowSnapshot();
    
    // Handle case where snapshot might be undefined/null
    if (!flowSnapshot) {
      console.log("[useGameFlowReady] No snapshot, defaulting to ready");
      return { isFlowReady: true, isFlowAnimating: false };
    }
    
    const stateValue = (flowSnapshot as { value?: string })?.value;
    const hasMatches = typeof (flowSnapshot as { matches?: (s: string) => boolean })?.matches === "function";
    
    // Allow interactions in "ready" OR "boot" state
    // boot = machine just started, game hasn't begun yet - user can still make the first move
    // ready = normal state where moves can be made
    const isFlowReady = hasMatches
      ? (flowSnapshot as { matches: (s: string) => boolean }).matches("ready") ||
        (flowSnapshot as { matches: (s: string) => boolean }).matches("boot")
      : stateValue === "ready" || stateValue === "boot";
    
    const isFlowAnimating = hasMatches
      ? (flowSnapshot as { matches: (s: string) => boolean }).matches("animating")
      : stateValue === "animating";

    return { isFlowReady, isFlowAnimating };
  }, [gameFlowState]);
}

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
