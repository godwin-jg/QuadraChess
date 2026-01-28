import { useEffect, useRef } from "react";
import type { LastMove, CheckStatus, GameStatus } from "../../../state/types";

/**
 * Custom hook to track previous value of any state
 */
function usePrevious<T>(value: T): T | undefined {
  const ref = useRef<T | undefined>(undefined);
  useEffect(() => {
    ref.current = value;
  });
  return ref.current;
}

interface UseBoardSoundEffectsOptions {
  lastMove: LastMove | null;
  checkStatus: CheckStatus;
  gameStatus: GameStatus;
}

/**
 * Hook that handles all sound effects for the board:
 * - Move sounds (regular move, capture, castle)
 * - Check/checkmate sounds
 * 
 * This is the SINGLE SOURCE OF TRUTH for move sounds to ensure
 * consistent sound behavior across all game modes and player types.
 */
export function useBoardSoundEffects({
  lastMove,
  checkStatus,
  gameStatus,
}: UseBoardSoundEffectsOptions): void {
  const prevCheckStatus = usePrevious(checkStatus);
  const prevGameStatus = usePrevious(gameStatus);

  // Handle move sounds
  useEffect(() => {
    if (!lastMove) {
      return;
    }

    try {
      const soundService = require("../../../services/soundService").default;
      const { isCastlingMove } = require("../../../state/gameHelpers");
      
      const isCastling = isCastlingMove(
        lastMove.pieceCode,
        lastMove.from.row,
        lastMove.from.col,
        lastMove.to.row,
        lastMove.to.col
      );

      if (isCastling) {
        soundService.playSound("castle");
      } else if (lastMove.capturedPiece) {
        soundService.playSound("capture");
      } else {
        soundService.playSound("move");
      }
    } catch (error) {
      // Sound service not available
    }
  }, [lastMove]);

  // Handle check/checkmate sounds
  useEffect(() => {
    try {
      const soundService = require("../../../services/soundService").default;

      // Check for game-ending sounds
      if (prevGameStatus !== "finished" && gameStatus === "finished") {
        soundService.playSound("checkmate");
      } else if (prevGameStatus !== "checkmate" && gameStatus === "checkmate") {
        soundService.playSound("checkmate");
      }

      // Check if a player just entered check
      const wasInCheck =
        prevCheckStatus && Object.values(prevCheckStatus).some((v) => v);
      const isNowInCheck = Object.values(checkStatus).some((v) => v);

      if (!wasInCheck && isNowInCheck) {
        soundService.playSound("check");
      }
    } catch (error) {
      // Sound service not available
    }
  }, [checkStatus, gameStatus, prevCheckStatus, prevGameStatus]);
}

export { usePrevious };

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
