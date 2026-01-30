import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef } from "react";
import { Text, View, useWindowDimensions } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Animated, {
  withTiming,
  withSpring,
  runOnUI
} from "react-native-reanimated";
import { GestureDetector } from "react-native-gesture-handler";
import { useSettings } from "../../../context/SettingsContext";
import {
  deselectPiece,
  selectDerivedBoardState,
  setPremove,
  clearPremove,
} from "../../../state/gameSlice";
import { RootState } from "../../../state/store";
import { getBoardTheme } from "./BoardThemeConfig";
import Square from "./Square";
import Piece from "./Piece";
import { useChessEngine } from "../../../hooks/useChessEngine";
import { getBoardSize } from "../../utils/responsive";
import { useGameFlowMachine } from "../../../hooks/useGameFlowMachine";
import {
  consumeSkipNextMoveAnimation,
  markSkipNextMoveAnimation,
} from "../../../services/gameFlowService";
import MoveAnimator from "./MoveAnimator";
import SkiaMoveAnimator from "./SkiaMoveAnimator";
import { getBoardPointFromLocal, getDragLiftOffset } from "./boardDragUtils";

// Set to true to use GPU-accelerated Skia animations
const USE_SKIA_ANIMATIONS = true;
import type { MoveInfo, Position } from "../../../types";

// Extracted components and hooks
import {
  DRAG_OFFSET_Y,
  SNAP_RING_RADIUS_RATIO,
  DEBOUNCE_DELAY,
} from "./boardConstants";
import BoardGlowSVG from "./BoardGlowSVG";
import BoardOverlayCanvas from "./BoardOverlayCanvas";
import DragHoverIndicator, { type DragTarget } from "./DragHoverIndicator";
import DraggedPiece from "./DraggedPiece";
import { useBoardSoundEffects } from "./useBoardSoundEffects";
import { useBoardGlowAnimation } from "./useBoardGlowAnimation";
import { useMoveExecution } from "./useMoveExecution";
import { useDragPerformance } from "./useDragPerformance";
import { useDragSharedValues } from "./useDragSharedValues";
import { useVisibilityMask } from "./useVisibilityMask";
import { useDragCallbacks } from "./useDragCallbacks";
import {
  getSelectedPieceColor,
  isPieceEliminated,
  findBestMoveNearTap,
} from "./boardHelpers";
import { useBoardAnimationOrchestration } from "./useBoardAnimationOrchestration";
import { useGameFlowReady } from "./useGameFlowReady";
import { useBoardGestures } from "./useBoardGestures";
import type { PremoveState } from "../../../state/types";

// 4-player chess piece codes:
// y = yellow, r = red, b = blue, g = green
// R = Rook, N = Knight, B = Bishop, Q = Queen, K = King, P = Pawn

interface BoardProps {
  onCapture?: (points: number, boardX: number, boardY: number, playerColor: string) => void;
  playerData?: Array<{
    name: string;
    color: string;
    score: number;
    capturedPieces: string[];
    isCurrentTurn: boolean;
    isEliminated: boolean;
    timeMs?: number;
    isTimerDisabled?: boolean;
  }>;
  // floatingPoints and onFloatingPointComplete removed for performance optimization
  boardRotation?: number;
  viewerColor?: string | null;
  displayTurn?: string;
  maxBoardSize?: number;
}



export default function Board({
  onCapture,
  playerData,
  boardRotation = 0,
  viewerColor = null,
  displayTurn,
  maxBoardSize,
}: BoardProps) {
  const { width, height } = useWindowDimensions();
  // Board dimensions - use provided size to avoid extra gaps
  const boardSize = React.useMemo(() => {
    if (typeof maxBoardSize === "number" && Number.isFinite(maxBoardSize) && maxBoardSize > 0) {
      return maxBoardSize;
    }
    return getBoardSize(width, height);
  }, [width, height, maxBoardSize]);
  const squareSize = React.useMemo(() => boardSize / 14, [boardSize]);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { settings } = useSettings();
  const tapToMoveEnabled = settings.game.tapToMoveEnabled ?? true;
  const dragToMoveEnabled = settings.game.dragToMoveEnabled ?? true;
  const animationsEnabled = settings.game.animationsEnabled ?? true;
  const showMoveHints = settings.game.showMoveHints ?? true;
  const tapGesturesEnabled = tapToMoveEnabled || dragToMoveEnabled;
  const boardTheme = useMemo(() => getBoardTheme(settings), [settings]);
  const { handleSquarePress: handleSquareSelection, getMovesForSquare, isValidMove } =
    useChessEngine();

  // Use solo mode from settings if enabled, otherwise use the route mode
  const effectiveMode = settings.developer.soloMode ? "solo" : mode;

  // Optimized selectors - memoized to prevent unnecessary re-renders
  const history = useSelector((state: RootState) => state.game.history);
  const viewingHistoryIndex = useSelector((state: RootState) => state.game.viewingHistoryIndex);
  // Check if we're viewing history (not at the live game state)
  const isViewingHistory = viewingHistoryIndex !== null && viewingHistoryIndex < history.length - 1;
  // ✅ BITBOARD ONLY: Use selector that derives board from bitboards
  const boardState = useSelector(selectDerivedBoardState);
  const selectedPiece = useSelector((state: RootState) => state.game.selectedPiece);

  // Memoize validMoves to use historical state when viewing history
  const displayValidMoves = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].validMoves || [];
    }
    if (!selectedPiece) return [];
    return getMovesForSquare(selectedPiece);
  }, [viewingHistoryIndex, history, selectedPiece, getMovesForSquare]);
  const checkStatus = useSelector((state: RootState) => state.game.checkStatus);
  const gameStatus = useSelector((state: RootState) => state.game.gameStatus);
  const eliminatedPlayers = useSelector((state: RootState) => state.game.eliminatedPlayers);
  const enPassantTargets = useSelector((state: RootState) => state.game.enPassantTargets);

  // ✅ BITBOARD ONLY: Display board derives from bitboards, with history fallback
  const displayBoardState = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].boardState;
    }
    return boardState;
  }, [viewingHistoryIndex, history, boardState]);
  const displayEliminatedPlayers = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].eliminatedPlayers ?? [];
    }
    return eliminatedPlayers;
  }, [viewingHistoryIndex, history, eliminatedPlayers]);
  // OPTIMIZATION: Use separate selectors to avoid creating new objects
  const currentPlayerTurn = useSelector((state: RootState) => state.game.currentPlayerTurn);
  const players = useSelector((state: RootState) => state.game.players);

  // Get last move for highlighting
  const lastMove = useSelector((state: RootState) => state.game.lastMove);
  const displayLastMove = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].lastMove ?? null;
    }
    return lastMove;
  }, [viewingHistoryIndex, history, lastMove]);
  const botPlayers = useSelector((state: RootState) => state.game.botPlayers);
  const premove = useSelector((state: RootState) => state.game.premove);
  const gameMode = useSelector((state: RootState) => state.game.gameMode);
  const [gameFlowState, gameFlowSend] = useGameFlowMachine();

  const glowTurn = displayTurn ?? currentPlayerTurn;
  // Animation values for current player glow (extracted hook)
  const { glowOpacity, glowScale } = useBoardGlowAnimation(glowTurn, animationsEnabled);

  // Drag state
  const [dragState, setDragState] = React.useState<{
    piece: string;
    from: { row: number; col: number };
  } | null>(null);

  // Drag shared values (extracted hook)
  const dragSharedValues = useDragSharedValues();
  const {
    dragX, dragY, dragScale, dragOffsetX, dragOffsetY,
    dragSnapActive, dragSnapTargets,
    validMoveMap, dragStartPos, lastSnappedKey, lastCursorKey,
    ghostOpacity, uiState,
  } = dragSharedValues;

  // Visibility mask for zero-flicker piece hiding (extracted hook)
  const { visibilityMask, animationRunning, setMaskIndices, clearMask } = useVisibilityMask();

  // Drag refs
  const dragHoverRef = useRef<DragTarget | null>(null);
  const pendingDropRef = useRef<{ from: Position; to: Position; piece: string } | null>(null);
  const [dragHover, setDragHover] = React.useState<DragTarget | null>(null);
  const dragValidMovesRef = useRef<MoveInfo[]>([]);
  const [dragValidMoves, setDragValidMoves] = React.useState<MoveInfo[]>([]);
  const panStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragPreviouslySelectedRef = useRef(false);
  const dragKeyHasChangedRef = useRef(false);
  const dragEndedRef = useRef(false);
  const suppressTapRef = useRef(false);
  const suppressTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentPlayerColorRef = useRef<string | null>(null);
  const premovePendingRef = useRef<PremoveState | null>(null);
  const tapToMoveEnabledRef = useRef(tapToMoveEnabled);
  const dragToMoveEnabledRef = useRef(dragToMoveEnabled);
  const animationsEnabledRef = useRef(animationsEnabled);
  const handleTapAtRef = useRef<((x: number, y: number) => void) | null>(null);

  // Keep refs in sync with settings - use useLayoutEffect for synchronous update
  React.useLayoutEffect(() => {
    const prevTap = tapToMoveEnabledRef.current;
    const prevDrag = dragToMoveEnabledRef.current;
    const prevAnim = animationsEnabledRef.current;
    
    tapToMoveEnabledRef.current = tapToMoveEnabled;
    dragToMoveEnabledRef.current = dragToMoveEnabled;
    animationsEnabledRef.current = animationsEnabled;
    
    // Log when settings actually change
    if (prevTap !== tapToMoveEnabled || prevDrag !== dragToMoveEnabled || prevAnim !== animationsEnabled) {
      console.log(`[Settings] Board settings refs updated:`);
      console.log(`  - Tap to Move: ${prevTap} → ${tapToMoveEnabled}`);
      console.log(`  - Drag to Move: ${prevDrag} → ${dragToMoveEnabled}`);
      console.log(`  - Animations: ${prevAnim} → ${animationsEnabled}`);
    }
  }, [tapToMoveEnabled, dragToMoveEnabled, animationsEnabled]);

  // Drag performance logging (dev mode only)
  const ENABLE_DRAG_PERF_LOG = __DEV__;
  const { perfRef, logDragPerf, nowMs } = useDragPerformance(ENABLE_DRAG_PERF_LOG);

  // Sound effects hook - handles all move/check/checkmate sounds
  useBoardSoundEffects({ lastMove, checkStatus, gameStatus });

  // Helper callbacks
  const setPanStart = React.useCallback((x: number, y: number) => {
    panStartRef.current = { x, y };
  }, []);

  const clearPanStart = React.useCallback(() => {
    panStartRef.current = null;
  }, []);

  const clearDragStart = React.useCallback(() => {
    dragStartRef.current = null;
  }, []);

  // Drag callbacks for cursor and snap changes (extracted hook)
  const { onCursorChange, onSnapKeyChange } = useDragCallbacks({
    enablePerfLog: ENABLE_DRAG_PERF_LOG,
    perfRef,
    dragValidMovesRef,
    dragHoverRef,
    setDragHover,
    dragKeyHasChangedRef,
  });

  // Get dispatch function
  const dispatch = useDispatch();

  // Game flow ready state (extracted hook)
  const { isFlowReady, isFlowAnimating } = useGameFlowReady(gameFlowState);

  const selectedPieceColor = useMemo(
    () => getSelectedPieceColor(selectedPiece, displayBoardState),
    [selectedPiece, displayBoardState]
  );

  const visibleValidMoves = useMemo(
    () => (showMoveHints ? displayValidMoves : []),
    [displayValidMoves, showMoveHints]
  );

  const moveTypeMap = useMemo(() => {
    const map = new Array(196).fill(null) as Array<"move" | "capture" | null>;
    for (let i = 0; i < visibleValidMoves.length; i++) {
      const move = visibleValidMoves[i];
      map[move.row * 14 + move.col] = move.isCapture ? "capture" : "move";
    }
    return map;
  }, [visibleValidMoves]);

  // Animation orchestration (extracted hook)
  const {
    effectivePlan,
    animationPiecesMap,
    animationKey,
    movePieceOverrides,
    handleAnimationComplete,
    handleAnimationCompleteUI,
    clearActiveAnimationPlan,
    skipNextAnimationRef,
  } = useBoardAnimationOrchestration({
    displayBoardState,
    lastMove,
    isViewingHistory,
    animationsEnabled,
    dragState,
    isFlowAnimating,
    gameFlowSend,
    visibilityMask,
    animationRunning,
  });

  const dragValidMoveMap = useMemo(() => {
    const map = new Map<number, "move" | "capture">();
    dragValidMoves.forEach((move) => {
      map.set(move.row * 14 + move.col, move.isCapture ? "capture" : "move");
    });
    return map;
  }, [dragValidMoves]);

  // Calculate check squares for GPU-accelerated overlay
  const checkSquares = useMemo(() => {
    const squares: Array<{ row: number; col: number }> = [];
    if (!displayBoardState) return squares;

    // Find all kings that are in check
    for (let row = 0; row < 14; row++) {
      const rowData = displayBoardState[row];
      if (!rowData) continue;
      for (let col = 0; col < 14; col++) {
        const piece = rowData[col];
        if (piece && piece[1] === "K") {
          const playerColor = piece[0] as keyof typeof checkStatus;
          if (checkStatus[playerColor]) {
            squares.push({ row, col });
          }
        }
      }
    }
    return squares;
  }, [displayBoardState, checkStatus]);

  const resolveBoardPoint = React.useCallback(
    (localX: number, localY: number) => getBoardPointFromLocal(localX, localY, boardSize),
    [boardSize]
  );

  const startDrag = React.useCallback(
    (localX: number, localY: number) => {
      const t0 = nowMs();
      // Helper to reset uiState on early return (gesture may have set it to 1)
      const resetUiState = () => {
        runOnUI(() => {
          'worklet';
          uiState.value = 0;
        })();
      };

      // Use ref to get current setting value (avoids stale closure issues)
      if (!dragToMoveEnabledRef.current) {
        resetUiState();
        return;
      }
      const localPlayerColor = currentPlayerColorRef.current;
      const allowPremoveDuringAnimation =
        (effectiveMode === "online" || effectiveMode === "p2p") &&
        localPlayerColor &&
        currentPlayerTurn !== localPlayerColor;
      const canBypassFlowBlock =
        allowPremoveDuringAnimation && (isFlowAnimating || animationRunning.value === 1);

      if ((!isFlowReady || animationRunning.value === 1) && !canBypassFlowBlock) {
        resetUiState();
        return;
      }
      if (isViewingHistory) {
        resetUiState();
        return;
      }
      // Note: We don't check dragState here because:
      // 1. The gesture handler already guards with uiState check in onStart
      // 2. dragState is React state that may be stale when cancelDrag is pending
      // 3. If we got here, onStart already confirmed no active drag (uiState was 0)
      if (gameStatus !== "active") {
        resetUiState();
        return;
      }
      const point = resolveBoardPoint(localX, localY);
      if (!point || !point.inside) {
        resetUiState();
        return;
      }
      const piece = displayBoardState?.[point.row]?.[point.col];
      if (!piece) {
        resetUiState();
        return;
      }
      if (eliminatedPlayers.includes(piece[0])) {
        resetUiState();
        return;
      }
      // In online/p2p mode, allow dragging your pieces even when not your turn
      // localPlayerColor is the local player's assigned color from the service
      if ((effectiveMode === "online" || effectiveMode === "p2p") && localPlayerColor) {
        // Only allow dragging pieces that belong to the local player
        if (piece[0] !== localPlayerColor) {
          resetUiState();
          return;
        }
      } else if (piece[0] !== currentPlayerTurn) {
        // In other modes, only allow dragging current turn's pieces
        resetUiState();
        return;
      }
      // If a pending animation plan exists, clear it before starting a drag.
      clearActiveAnimationPlan();
      try {
        const haptics = require('../../../services/hapticsService').hapticsService;
        haptics.light();
      } catch (error) {
      }
      dragPreviouslySelectedRef.current =
        !!selectedPiece &&
        selectedPiece.row === point.row &&
        selectedPiece.col === point.col;
      dragKeyHasChangedRef.current = false;
      dragEndedRef.current = false;
      if (
        !selectedPiece ||
        selectedPiece.row !== point.row ||
        selectedPiece.col !== point.col
      ) {
        handleSquareSelection({ row: point.row, col: point.col });
      }
      dragSnapActive.value = 0;
      lastSnappedKey.value = -1;
      lastCursorKey.value = point.row * 14 + point.col;
      const hiddenIndex = point.row * 14 + point.col;
      runOnUI(setMaskIndices)([hiddenIndex], true);
      dragStartRef.current = { x: point.x, y: point.y };
      dragStartPos.value = { row: point.row, col: point.col };

      // Note: uiState.value = 1 is set by the gesture's onStart on UI thread

      dragValidMovesRef.current = getMovesForSquare({ row: point.row, col: point.col });
      // Build UI-thread rulebook: keys array and O(1) map
      const moveKeys = dragValidMovesRef.current.map((move) => move.row * 14 + move.col);
      dragSnapTargets.value = moveKeys;
      // Build 196-element map for O(1) legality check in worklet
      const map = new Array(196).fill(0);
      for (let i = 0; i < moveKeys.length; i++) {
        map[moveKeys[i]] = 1;
      }
      validMoveMap.value = map;
      setDragValidMoves(dragValidMovesRef.current);
      dragHoverRef.current = null;
      setDragHover(null);
      // Scale/offset animation is now handled in useBoardGestures applyDragVisuals
      // We just ensure the values are set correctly if not already animating
      // Use threshold check because cancelDrag animates scale back, might not be exactly 1
      const liftOffset = getDragLiftOffset(squareSize * DRAG_OFFSET_Y, boardRotation);
      if (dragScale.value < 1.1) {
        dragScale.value = withSpring(1.45, { damping: 18, stiffness: 280 });
        dragOffsetX.value = withTiming(liftOffset.x, { duration: 80 });
        dragOffsetY.value = withTiming(liftOffset.y, { duration: 80 });
      }
      ghostOpacity.value = withTiming(0, { duration: 80 });
      suppressTapRef.current = true;
      if (suppressTapTimeoutRef.current) {
        clearTimeout(suppressTapTimeoutRef.current);
        suppressTapTimeoutRef.current = null;
      }
      setDragState({ piece, from: { row: point.row, col: point.col } });
      logDragPerf("start", nowMs() - t0);
    },
    [
      clearActiveAnimationPlan,
      effectiveMode,
      currentPlayerTurn,
      displayBoardState,
      animationRunning,
      boardRotation,
      eliminatedPlayers,
      gameStatus,
      getMovesForSquare,
      handleSquareSelection,
      isFlowAnimating,
      isFlowReady,
      isViewingHistory,
      resolveBoardPoint,
      selectedPiece,
      squareSize,
      dragScale,
      dragOffsetX,
      dragOffsetY,
      dragSnapActive,
      dragSnapTargets,
      validMoveMap,
      dragStartPos,
      lastSnappedKey,
      lastCursorKey,
      setMaskIndices,
      ghostOpacity,
      logDragPerf,
      nowMs,
    ]
  );

  const startDragFromPan = React.useCallback(
    (x: number, y: number) => {
      const origin = panStartRef.current ?? { x, y };
      startDrag(origin.x, origin.y);
    },
    [startDrag]
  );

  const cancelDrag = React.useCallback(() => {
    // Skip if endDrag already handled cleanup
    if (dragEndedRef.current) {
      dragEndedRef.current = false;
      return;
    }
    // If a new drag has already started (uiState === 1), only clear dragState
    // but skip the rest of the cleanup to avoid interfering with the new drag
    if (uiState.value === 1) {
      // Clear the old dragState so the new drag can proceed
      if (dragState) {
        setDragState(null);
      }
      return;
    }
    if (ENABLE_DRAG_PERF_LOG) {
      perfRef.current.cancelCount += 1;
    }
    if (dragState) {
      setDragState(null);
    }
    clearPanStart();
    clearDragStart();
    uiState.value = 0;
    runOnUI(clearMask)();
    dragSnapActive.value = 0;
    // Animate scale/offset back smoothly when cancelling
    dragScale.value = withTiming(1, { duration: 100 });
    dragOffsetX.value = withTiming(0, { duration: 100 });
    dragOffsetY.value = withTiming(0, { duration: 100 });
    ghostOpacity.value = 0;
    dragHoverRef.current = null;
    setDragHover(null);
    setDragValidMoves([]);
    dragSnapTargets.value = [];
    validMoveMap.value = new Array(196).fill(0);
    dragStartPos.value = null;
    lastSnappedKey.value = -1;
    lastCursorKey.value = -1;
    dragPreviouslySelectedRef.current = false;
    dragKeyHasChangedRef.current = false;
    if (suppressTapTimeoutRef.current) {
      clearTimeout(suppressTapTimeoutRef.current);
    }
    suppressTapTimeoutRef.current = setTimeout(() => {
      suppressTapRef.current = false;
    }, 150);
    // Ensure any stale animation plan is cleared after a cancelled drag
    clearActiveAnimationPlan();
  }, [
    dragState,
    dragScale,
    dragOffsetX,
    dragOffsetY,
    ghostOpacity,
    clearPanStart,
    clearDragStart,
    dragSnapActive,
    dragSnapTargets,
    validMoveMap,
    dragStartPos,
    lastSnappedKey,
    lastCursorKey,
    uiState,
    clearMask,
    clearActiveAnimationPlan,
  ]);

  const abortPendingDrop = React.useCallback(() => {
    if (!pendingDropRef.current) return;
    pendingDropRef.current = null;
    uiState.value = 0;
    consumeSkipNextMoveAnimation();
    skipNextAnimationRef.current = false;
    cancelDrag();
  }, [cancelDrag, uiState]);

  // Clear drag state once the committed move is reflected in Redux
  React.useEffect(() => {
    const pending = pendingDropRef.current;
    if (!pending) return;

    const matchesLastMove =
      lastMove &&
      lastMove.from.row === pending.from.row &&
      lastMove.from.col === pending.from.col &&
      lastMove.to.row === pending.to.row &&
      lastMove.to.col === pending.to.col;

    const pieceAtTarget = boardState?.[pending.to.row]?.[pending.to.col];
    const matchesBoardState = pieceAtTarget === pending.piece;

    if (matchesLastMove || matchesBoardState) {
      pendingDropRef.current = null;
      uiState.value = 0;
      cancelDrag();
    }
  }, [lastMove, boardState, cancelDrag, uiState]);

  // Helper functions are imported from boardHelpers.ts

  // Debouncing for piece selection to prevent rapid clicking
  const lastClickTime = useRef<number>(0);

  // Move execution hook - handles online, P2P, and local moves
  const { executeMoveFrom, currentPlayerColor } = useMoveExecution({
    effectiveMode,
    currentPlayerTurn,
    gameStatus,
    displayBoardState,
    enPassantTargets,
    abortPendingDrop,
    botPlayers,
  });
  React.useEffect(() => {
    currentPlayerColorRef.current = currentPlayerColor;
  }, [currentPlayerColor]);

  // Premove execution - when it becomes your turn, execute pending premove
  React.useEffect(() => {
    if (!premove) {
      premovePendingRef.current = null;
      return;
    }

    const isSamePremove = (a: PremoveState, b: PremoveState) =>
      a.from.row === b.from.row &&
      a.from.col === b.from.col &&
      a.to.row === b.to.row &&
      a.to.col === b.to.col &&
      a.pieceCode === b.pieceCode;

    const isPremoveApplied = () => {
      const matchesLastMove =
        lastMove &&
        lastMove.from.row === premove.from.row &&
        lastMove.from.col === premove.from.col &&
        lastMove.to.row === premove.to.row &&
        lastMove.to.col === premove.to.col;
      if (matchesLastMove) {
        return true;
      }
      const pieceAtTarget = displayBoardState?.[premove.to.row]?.[premove.to.col];
      return pieceAtTarget === premove.pieceCode;
    };

    const pending = premovePendingRef.current;
    if (pending && isSamePremove(pending, premove)) {
      if (isPremoveApplied()) {
        premovePendingRef.current = null;
        dispatch(clearPremove());
      }
      return;
    }

    if (
      (effectiveMode !== "online" && effectiveMode !== "p2p") ||
      !currentPlayerColor ||
      currentPlayerTurn !== currentPlayerColor ||
      gameStatus !== "active"
    ) {
      return;
    }

    // Validate the premove is still legal
    const pieceAtFrom = displayBoardState?.[premove.from.row]?.[premove.from.col];
    if (!pieceAtFrom || pieceAtFrom !== premove.pieceCode) {
      // Piece moved or captured, clear premove
      premovePendingRef.current = null;
      dispatch(clearPremove());
      return;
    }

    // Check if move is still valid
    const isStillValid = isValidMove(premove.from, premove.to, premove.pieceCode);
    if (!isStillValid) {
      premovePendingRef.current = null;
      dispatch(clearPremove());
      try {
        const notificationService = require('../../../services/notificationService').default;
        notificationService.show("Premove cancelled - no longer valid", "warning", 1500);
      } catch {}
      return;
    }

    // Execute the premove
    const moveInfo = getMovesForSquare(premove.from).find(
      (m) => m.row === premove.to.row && m.col === premove.to.col
    );
    
    premovePendingRef.current = premove;
    executeMoveFrom(premove.from, premove.to, moveInfo);
  }, [
    effectiveMode,
    premove,
    currentPlayerColor,
    currentPlayerTurn,
    gameStatus,
    displayBoardState,
    lastMove,
    isValidMove,
    getMovesForSquare,
    executeMoveFrom,
    dispatch,
  ]);


  // Handle square press
  const handleSquarePress = async (row: number, col: number) => {
    const allowPremoveDuringAnimation =
      (effectiveMode === "online" || effectiveMode === "p2p") &&
      currentPlayerColor &&
      currentPlayerTurn !== currentPlayerColor;
    const canBypassFlowBlock =
      allowPremoveDuringAnimation && (isFlowAnimating || animationRunning.value === 1);

    if ((!isFlowReady || animationRunning.value === 1) && !canBypassFlowBlock) {
      return;
    }
    if (dragState || suppressTapRef.current) {
      return;
    }

    // Toggle off premove by tapping its destination square again
    if (
      premove &&
      premove.to.row === row &&
      premove.to.col === col
    ) {
      dispatch(clearPremove());
      return;
    }

    // Debounce rapid clicks
    const now = Date.now();
    if (now - lastClickTime.current < DEBOUNCE_DELAY) {
      return;
    }
    lastClickTime.current = now;
    // If we're viewing history, don't allow any moves
    if (isViewingHistory) {
      return;
    }



    const pieceCode = displayBoardState[row][col];

    // OPTIMIZATION: Use cached valid moves instead of recalculating
    const isAValidMove = displayValidMoves.some(
      (move) => move.row === row && move.col === col
    );

    // Check if the pressed square is the currently selected piece
    const isSelectedPiece =
      selectedPiece && selectedPiece.row === row && selectedPiece.col === col;

    // If pressing the same selected piece again, deselect it (handled in Redux reducer)
    if (isSelectedPiece) {
      handleSquareSelection({ row, col }); // This will deselect since it's the same piece
      return;
    }

    // If a piece is selected AND the pressed square is a valid move
    if (selectedPiece && isAValidMove) {
      // Use ref to get current setting value (avoids stale closure issues)
      if (!tapToMoveEnabledRef.current) {
        return;
      }
      // Find the specific move from the already calculated validMoves
      const moveInfo = displayValidMoves.find(
        (move) => move.row === row && move.col === col
      );

      executeMoveFrom(

        { row: selectedPiece.row, col: selectedPiece.col },
        { row, col },
        moveInfo
      );
    } else {
      // If clicking on empty square and a piece is selected, deselect it
      if (!pieceCode && selectedPiece) {
        dispatch(deselectPiece());
        return;
      }

      // Otherwise, just try to select the piece on the pressed square

      handleSquareSelection({ row, col });
    }
  };

  const handleTapAt = React.useCallback(
    (x: number, y: number) => {
      if (x < 0 || y < 0 || x > boardSize || y > boardSize) return;

      let targetRow = Math.floor(y / squareSize);
      let targetCol = Math.floor(x / squareSize);
      if (targetRow < 0 || targetRow > 13 || targetCol < 0 || targetCol > 13) {
        return;
      }

      // Snap to nearest valid move only when tap-to-move is enabled (use ref for current value)
      if (tapToMoveEnabledRef.current && selectedPiece && displayValidMoves.length > 0) {
        const snapThreshold = squareSize * SNAP_RING_RADIUS_RATIO;
        const bestMove = findBestMoveNearTap(x, y, displayValidMoves, squareSize, snapThreshold);
        if (bestMove) {
          targetRow = bestMove.row;
          targetCol = bestMove.col;
        }
      }

      handleSquarePress(targetRow, targetCol);
    },
    [
      boardSize,
      squareSize,
      selectedPiece,
      displayValidMoves,
      handleSquarePress,
      SNAP_RING_RADIUS_RATIO,
    ]
  );

  // Keep handleTapAtRef in sync so gesture handlers always have the latest callback
  // Use useLayoutEffect for synchronous update before any interactions
  React.useLayoutEffect(() => {
    handleTapAtRef.current = handleTapAt;
  }, [handleTapAt]);

  // Stable wrapper that always calls the latest handleTapAt via ref
  const stableHandleTapAt = React.useCallback((x: number, y: number) => {
    handleTapAtRef.current?.(x, y);
  }, []);

  const commitMove = React.useCallback(
    (fromRow: number, fromCol: number, toRow: number, toCol: number) => {
      const from = { row: fromRow, col: fromCol };
      const to = { row: toRow, col: toCol };

      const pieceAtFrom = displayBoardState?.[fromRow]?.[fromCol];
      if (pieceAtFrom) {
        pendingDropRef.current = { from, to, piece: pieceAtFrom };
      }

      // Find move info
      const moveInfo = dragValidMovesRef.current.find(
        (m) => m.row === toRow && m.col === toCol
      );

      // Skip animation for drag moves (set BEFORE dispatch)
      if (pieceAtFrom) {
        markSkipNextMoveAnimation();
        skipNextAnimationRef.current = true;
      }

      // Execute move (Redux dispatch)
      executeMoveFrom(from, to, moveInfo);

      // Note: We do NOT clear dragState here. We wait for the board update.
      // This keeps the "Drag View" visible at the target position until the real piece appears.
      // Sound is handled by the lastMove effect (single source of truth)
    },
    [displayBoardState, executeMoveFrom]
  );


  const { boardGesture } = useBoardGestures({
    boardSize,
    squareSize,
    boardRotation,
    sharedValues: dragSharedValues,
    enableTapGestures: tapGesturesEnabled,
    enableDragToMove: dragToMoveEnabled,
    onCursorChange,
    onSnapKeyChange,
    visibilityMask,
    clearMask,
    setPanStart,
    startDragFromPan,
    handleTapAt: stableHandleTapAt,
    commitMove,
    cancelDrag,
  });

  // Safety check for null boardState
  if (!boardState || !Array.isArray(boardState)) {
    return (
      <View
        style={{
          width: boardSize,
          height: boardSize,
          alignSelf: "center",
          // marginTop: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text className="text-white text-lg">Loading game...</Text>
      </View>
    );
  }

  // Key to force GestureDetector remount when gesture config changes
  const gestureKey = `gesture-tap${tapToMoveEnabled}-drag${dragToMoveEnabled}-anim${animationsEnabled}`;

  return (
    <GestureDetector key={gestureKey} gesture={boardGesture}>
      <View
        style={{
          width: boardSize,
          height: boardSize,
          alignSelf: "center",
          transform: [{ rotate: `${boardRotation}deg` }],
        }}
      >
        {/* SVG Border Glow Layer */}
        <BoardGlowSVG
          boardSize={boardSize}
          currentPlayerTurn={glowTurn}
          glowOpacity={glowOpacity}
          glowScale={glowScale}
        />

        {/* Board Layer */}
        <View
          style={{
            width: boardSize,
            height: boardSize,
            borderRadius: 8,
            overflow: 'visible',
            zIndex: 1,
          }}
        >
          {displayBoardState.map((row, rowIndex) => {
            // Skip null rows (buffer rows in 4-player chess)
            if (!row || !Array.isArray(row)) {
              return (
                <View
                  key={rowIndex}
                  style={{ flexDirection: "row", height: squareSize }}
                >
                  {Array.from({ length: 14 }, (_, colIndex) => {
                    const isCornerSquare = (rowIndex < 3 && colIndex < 3) ||
                      (rowIndex < 3 && colIndex > 10) ||
                      (rowIndex > 10 && colIndex < 3) ||
                      (rowIndex > 10 && colIndex > 10);

                    return (
                      <View
                        key={`${rowIndex}-${colIndex}`}
                        style={{
                          width: squareSize,
                          height: squareSize,
                          backgroundColor: isCornerSquare ? "transparent" :
                            (rowIndex + colIndex) % 2 === 0
                              ? boardTheme.lightSquare
                              : boardTheme.darkSquare,
                        }}
                      />
                    );
                  })}
                </View>
              );
            }

            return (
              <View key={rowIndex} style={{ flexDirection: "row" }}>
                {row.map((piece, colIndex) => {
                  const boardKey = rowIndex * 14 + colIndex;
                  const isLight = (rowIndex + colIndex) % 2 === 0;
                  const isCornerCenter =
                    (rowIndex === 1 && colIndex === 1) ||
                    (rowIndex === 1 && colIndex === 12) ||
                    (rowIndex === 12 && colIndex === 1) ||
                    (rowIndex === 12 && colIndex === 12);
                  const moveType = moveTypeMap[boardKey];
                  const captureColor =
                    moveType === "capture" ? selectedPieceColor ?? undefined : undefined;
                  return (
                    <Square
                      key={`${rowIndex}-${colIndex}`}
                      piece={piece}
                      color={isLight ? "light" : "dark"}
                      size={squareSize}
                      row={rowIndex}
                      col={colIndex}
                      onPress={undefined}
                      pressEnabled={false}
                      isSelected={
                        selectedPiece?.row === rowIndex &&
                        selectedPiece?.col === colIndex
                      }
                      moveType={moveType}
                      capturingPieceColor={captureColor}
                      isInCheck={
                        !!(
                          piece &&
                          piece[1] === "K" &&
                          checkStatus[piece[0] as keyof typeof checkStatus]
                        )
                      }
                      isEliminated={isPieceEliminated(piece, displayEliminatedPlayers)}
                      isInteractable={true}
                      boardTheme={boardTheme}
                      playerData={isCornerCenter ? playerData : undefined}
                      boardRotation={boardRotation}
                      viewerColor={viewerColor}
                      visibilityMask={visibilityMask}
                    />
                  );
                })}
              </View>
            );
          })}
        </View>

        {/* GPU-accelerated overlay canvas for valid moves, check indicators, highlights */}
        <BoardOverlayCanvas
          boardSize={boardSize}
          squareSize={squareSize}
          validMoves={visibleValidMoves}
          selectedPiece={selectedPiece}
          selectedPieceColor={selectedPieceColor}
          checkSquares={checkSquares}
          lastMove={displayLastMove}
          premove={premove}
        />



        {dragHover && (
          <DragHoverIndicator
            dragHover={dragHover}
            squareSize={squareSize}
            pieceColor={dragState?.piece?.[0]}
          />
        )}

        {dragState && (
          <DraggedPiece
            piece={dragState.piece}
            size={squareSize}
            viewerColor={viewerColor}
            dragX={dragX}
            dragY={dragY}
            dragScale={dragScale}
            dragOffsetX={dragOffsetX}
            dragOffsetY={dragOffsetY}
          />
        )}

        {/* Optimistic UI: show piece at target immediately after drop */}
        {/* REMOVED LENS VIEW */}

        {effectivePlan && !dragState && (
          USE_SKIA_ANIMATIONS ? (
            <SkiaMoveAnimator
              key={animationKey ?? "skia-move-animator"}
              plan={effectivePlan}
              piecesMap={animationPiecesMap}
              movePieceOverrides={movePieceOverrides}
              squareSize={squareSize}
              viewerColor={viewerColor}
              onComplete={handleAnimationComplete}
              onCompleteUI={handleAnimationCompleteUI}
              animationRunning={animationRunning}
            />
          ) : (
            <MoveAnimator
              key={animationKey ?? "move-animator"}
              plan={effectivePlan}
              piecesMap={animationPiecesMap}
              movePieceOverrides={movePieceOverrides}
              squareSize={squareSize}
              viewerColor={viewerColor}
              onComplete={handleAnimationComplete}
              onCompleteUI={handleAnimationCompleteUI}
              animationRunning={animationRunning}
            />
          )
        )}

        {/* 🎯 Capture Animation Layer - DISABLED */}
        {/* AnimatedCapture and FloatingPointsText components removed for performance */}

        {/* 💰 Floating Points Layer - DISABLED */}
        {/* Components removed for performance optimization */}
      </View>
    </GestureDetector>
  );
}
