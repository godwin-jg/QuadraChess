import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useRef } from "react";
import { Alert, Text, View, useWindowDimensions, StyleSheet } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  useAnimatedProps,
  withSpring, 
  withTiming,
  withRepeat,
  withSequence,
  interpolate,
  Easing,
  cancelAnimation
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode, Path, LinearGradient, Stop } from "react-native-svg";
import { useSettings } from "../../../context/SettingsContext";
import notificationService from "../../../services/notificationService";
import { ANIMATION_DURATIONS } from "../../../config/gameConfig";

import onlineGameService from "../../../services/onlineGameService";
import p2pGameService from "../../../services/p2pGameService";
import {
  deselectPiece,
  makeMove,
  selectPiece,
  sendMoveToServer,
} from "../../../state/gameSlice";
import { RootState } from "../../../state/store";
import networkService from "../../services/networkService";
import { getBoardTheme } from "./BoardThemeConfig";
import Square from "./Square";
import Piece from "./Piece";

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
  }>;
  // floatingPoints and onFloatingPointComplete removed for performance optimization
  boardRotation?: number;
}

export default function Board({ onCapture, playerData, boardRotation = 0 }: BoardProps) {
  const { width } = useWindowDimensions();
  // Memoized board dimensions - only recalculates when screen width changes
  const boardSize = React.useMemo(() => Math.min(width * 0.98, 600), [width]);
  const squareSize = React.useMemo(() => boardSize / 14, [boardSize]);
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { settings } = useSettings();
  const boardTheme = getBoardTheme(settings);
  
  // Use solo mode from settings if enabled, otherwise use the route mode
  const effectiveMode = settings.developer.soloMode ? "solo" : mode;

  // Optimized selectors - memoized to prevent unnecessary re-renders
  const history = useSelector((state: RootState) => state.game.history);
  const viewingHistoryIndex = useSelector((state: RootState) => state.game.viewingHistoryIndex);
  const boardState = useSelector((state: RootState) => state.game.boardState);
  const selectedPiece = useSelector((state: RootState) => state.game.selectedPiece);
  const validMoves = useSelector((state: RootState) => state.game.validMoves);
  
  // Memoize validMoves to use historical state when viewing history
  const displayValidMoves = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].validMoves || [];
    }
    return validMoves;
  }, [viewingHistoryIndex, history, validMoves]);
  const checkStatus = useSelector((state: RootState) => state.game.checkStatus);
  const gameStatus = useSelector((state: RootState) => state.game.gameStatus);
  const eliminatedPlayers = useSelector((state: RootState) => state.game.eliminatedPlayers);
  const enPassantTargets = useSelector((state: RootState) => state.game.enPassantTargets);
  
  // Memoize expensive calculations
  const displayBoardState = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].boardState;
    }
    return boardState;
  }, [viewingHistoryIndex, history, boardState]);
  // OPTIMIZATION: Use separate selectors to avoid creating new objects
  const currentPlayerTurn = useSelector((state: RootState) => state.game.currentPlayerTurn);
  const players = useSelector((state: RootState) => state.game.players);
  
  // Get last move for highlighting
  const lastMove = useSelector((state: RootState) => state.game.lastMove);
  const botPlayers = useSelector((state: RootState) => state.game.botPlayers);
  
  // Get current user from service
  const getCurrentUser = () => {
    try {
      const realtimeDatabaseService = require('../../services/realtimeDatabaseService').default;
      return realtimeDatabaseService.getCurrentUser();
    } catch (error) {
      return null;
    }
  };

  // Animation values for current player glow
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  
  // Animation state for piece movement
  const [animatedPiece, setAnimatedPiece] = React.useState<{
    code: string;
    row: number;
    col: number;
  } | null>(null);

  // Animation state for capturing pieces - DISABLED
  // const [capturingPieces, setCapturingPieces] = React.useState<Array<{
  //   key: string;
  //   code: string;
  //   row: number;
  //   col: number;
  // }>>([]);

  // Simple animation lock
  const [isAnimating, setIsAnimating] = React.useState(false);

  // Reanimated shared values for the piece's X and Y position
  const piecePositionX = useSharedValue(0);
  const piecePositionY = useSharedValue(0);
  
  // Static constants for optimal performance
  const GRADIENT_MAP = {
    "r": "rGradient",
    "b": "bGradient", 
    "y": "yGradient",
    "g": "gGradient"
  } as const;

  // Static SVG path data - never changes, so no need to recalculate
  const CROSS_SHAPE_PATH = "M 30 0 L 110 0 L 110 30 L 140 30 L 140 110 L 110 110 L 110 140 L 30 140 L 30 110 L 0 110 L 0 30 L 30 30 Z";

  // Memoized gradient URL calculation - only recalculates when currentPlayerTurn changes
  const currentGradientUrl = React.useMemo(() => {
    const gradientId = GRADIENT_MAP[currentPlayerTurn as keyof typeof GRADIENT_MAP] || "defaultGradient";
    return `url(#${gradientId})`;
  }, [currentPlayerTurn]);

  // ✅ Custom hook to track previous values for sound effects
  const usePrevious = (value: any) => {
    const ref = useRef<any>(undefined);
    React.useEffect(() => {
      ref.current = value;
    });
    return ref.current;
  };

  // Track the previous values for enhanced sound effects
  const prevCheckStatus = usePrevious(checkStatus);
  const prevGameStatus = usePrevious(gameStatus);

  // ✅ Ref to track the last animated move to prevent duplicate animations
  const lastAnimatedMoveRef = useRef<string | null>(null);

  // Update glow animation when turn changes
  React.useEffect(() => {
    if (currentPlayerTurn) {
      // Animate glow in
      glowOpacity.value = withTiming(1, { duration: 400 });
      
      // ✅ Add a subtle, repeating pulse
      glowScale.value = withRepeat(
        withSequence(
          withTiming(1.02, { duration: 2500, easing: Easing.inOut(Easing.ease) }),
          withTiming(1, { duration: 2500, easing: Easing.inOut(Easing.ease) })
        ),
        -1, // Loop forever
        true // Reverse the animation
      );
    } else {
      // Fade out glow
      glowOpacity.value = withTiming(0, { duration: 300 });
      glowScale.value = withTiming(1);
    }

    // ✅ Add cleanup function to prevent memory leaks
    return () => {
      cancelAnimation(glowScale);
    };
  }, [currentPlayerTurn, glowOpacity, glowScale]);

  // ✅ SINGLE SOURCE OF TRUTH: Watch lastMove for all animations
  // This effect runs whenever ANY move is made (local player, bot, or remote player)
  React.useEffect(() => {
    // Don't animate if there's no move
    if (!lastMove) {
      return;
    }

    // ✅ CRITICAL FIX: Prevent duplicate animations by checking if we've already animated this move
    // Use move details WITHOUT timestamp to prevent duplicates from timestamp changes
    const moveKey = `${lastMove.from.row}-${lastMove.from.col}-${lastMove.to.row}-${lastMove.to.col}-${lastMove.pieceCode}-${lastMove.playerColor}`;
    
    // Check if we've already animated this exact move
    if (lastAnimatedMoveRef.current === moveKey) {
      return; // Skip animation - we've already animated this move
    }
    
    // Mark this move as animated
    lastAnimatedMoveRef.current = moveKey;

    // Trigger the capture "poof" effect - DISABLED
    // if (lastMove.capturedPiece) {
    //   const captureKey = `${lastMove.to.row}-${lastMove.to.col}-${Date.now()}`;
    //   setCapturingPieces(prev => [...prev, {
    //     key: captureKey,
    //     code: lastMove.capturedPiece!,
    //     row: lastMove.to.row,
    //     col: lastMove.to.col
    //   }]);
    // }
    
    // Trigger the floating points animation - DISABLED
    // if (lastMove.capturedPiece && onCapture) {
    //   const capturedPieceType = lastMove.capturedPiece[1];
    //   let points = 0;
    //   switch (capturedPieceType) {
    //     case "P": // Pawn
    //       points = 1;
    //       break;
    //     case "N": // Knight
    //       points = 3;
    //       break;
    //     case "B": // Bishop
    //     case "R": // Rook
    //       points = 5;
    //       break;
    //     case "Q": // Queen
    //       points = 9;
    //       break;
    //     case "K": // King
    //       points = 0; // Kings cannot be captured - should be checkmated instead
    //       break;
    //     default:
    //       points = 0;
    //   }

    //   const boardX = (lastMove.to.col * squareSize) + (squareSize / 2);
    //   const boardY = (lastMove.to.row * squareSize) + (squareSize / 2);
    //   onCapture(points, boardX, boardY, lastMove.playerColor);
    // }

    // Movement animations disabled
    // if (effectiveMode !== "solo" && mode !== "single" && !isAnimating) {
    //   setIsAnimating(true);
    //   animatePieceMove(
    //     lastMove.from.row,
    //     lastMove.from.col,
    //     lastMove.to.row,
    //     lastMove.to.col,
    //     lastMove.pieceCode,
    //     () => {
    //       setIsAnimating(false); // Release the lock when animation completes
    //     }
    //   );
    // }

    // ✅ SINGLE SOURCE OF TRUTH: Board component handles ALL move sounds
    // This ensures consistent sound behavior across all game modes and player types
    
    // ✅ DEBUG: Log move details to track duplicate sounds
    console.log('🔊 Board: Processing move for sound:', {
      from: lastMove.from,
      to: lastMove.to,
      pieceCode: lastMove.pieceCode,
      playerColor: lastMove.playerColor,
      playerId: lastMove.playerId,
      timestamp: lastMove.timestamp,
      capturedPiece: lastMove.capturedPiece
    });
    
    try {
      const soundService = require('../../../services/soundService').default;
      const isCastling = require('../../../state/gameHelpers').isCastlingMove(
          lastMove.pieceCode,
          lastMove.from.row,
          lastMove.from.col,
          lastMove.to.row,
          lastMove.to.col
        );

      // ✅ CRITICAL FIX: Use unified playSound method to ensure sounds and haptics happen simultaneously
      if (isCastling) {
        soundService.playSound('castle');
      } else if (lastMove.capturedPiece) {
        soundService.playSound('capture');
      } else {
        soundService.playSound('move');
      }

      // ✅ Move sound effects only - check/checkmate sounds handled separately

    } catch (error) {
      console.log('🔊 SoundService: Failed to play sound from Board component:', error);
    }
  }, [lastMove]); // ✅ FIXED: Only depend on lastMove to prevent animation loops

  // ✅ Reset animation tracking when game resets or changes
  React.useEffect(() => {
    // Reset animation tracking when history is cleared (new game)
    if (history.length <= 1) {
      lastAnimatedMoveRef.current = null;
    }
  }, [history.length]);

  // ✅ SEPARATE EFFECT: Handle check/checkmate sound effects
  // This effect runs when checkStatus or gameStatus changes, but doesn't trigger animations
  React.useEffect(() => {
    try {
      const soundService = require('../../../services/soundService').default;
      
      // ✅ CRITICAL FIX: Use unified playSound method for check/checkmate sounds and haptics
      // Check for game-ending sounds
      if (prevGameStatus !== 'finished' && gameStatus === 'finished') {
        soundService.playSound('checkmate'); // Game over sound + haptics
      } else if (prevGameStatus !== 'checkmate' && gameStatus === 'checkmate') {
        soundService.playSound('checkmate');
      }

      // Check if a player just entered check
      const wasInCheck = prevCheckStatus && Object.values(prevCheckStatus).some(v => v);
      const isNowInCheck = Object.values(checkStatus).some(v => v);

      if (!wasInCheck && isNowInCheck) {
        soundService.playSound('check');
      }

    } catch (error) {
      console.log('🔊 SoundService: Failed to play check/checkmate sound from Board component:', error);
    }
  }, [checkStatus, gameStatus, prevCheckStatus, prevGameStatus]); // Safe to depend on these for sound effects

  // ✅ SVG border glow style
  const borderGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  // ✅ Animated piece style for smooth movement
  const animatedPieceStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute',
      transform: [
        { translateX: piecePositionX.value },
        { translateY: piecePositionY.value },
      ],
    };
  });


  // Get dispatch function
  const dispatch = useDispatch();

  // Helper function to handle capture animation completion - DISABLED
  // const handleCaptureAnimationComplete = (key: string) => {
  //   setCapturingPieces(prev => prev.filter(p => p.key !== key));
  // };

  // Helper function to animate piece movement
  const animatePieceMove = (
    fromRow: number, 
    fromCol: number, 
    toRow: number, 
    toCol: number, 
    pieceCode: string,
    onComplete: () => void
  ) => {
    // Calculate pixel positions
    const fromX = fromCol * squareSize;
    const fromY = fromRow * squareSize;
    const toX = toCol * squareSize;
    const toY = toRow * squareSize;

    // Set the initial position for our animated piece FIRST
    piecePositionX.value = fromX;
    piecePositionY.value = fromY;
    
    // Show the animated piece immediately
    setAnimatedPiece({ code: pieceCode, row: fromRow, col: fromCol });
    
    // Use requestAnimationFrame to ensure the piece renders before starting animation
    requestAnimationFrame(() => {
      // ✅ SYNCHRONIZED TIMING: Use centralized animation duration
      const moveDuration = ANIMATION_DURATIONS.PIECE_MOVE;
      
      // Start the animation after the animated piece is rendered
      piecePositionX.value = withTiming(toX, { duration: moveDuration, easing: Easing.out(Easing.quad) });
      piecePositionY.value = withTiming(toY, { duration: moveDuration, easing: Easing.out(Easing.quad) }, (isFinished) => {
        if (isFinished) {
          // Hide the animated piece using scheduleOnRN
          scheduleOnRN(setAnimatedPiece, null);
          // Call the completion callback using scheduleOnRN
          scheduleOnRN(onComplete);
        }
      });
    });
  };

  // Helper function to get move type for a square
  const getMoveType = (row: number, col: number): "move" | "capture" | null => {
    const move = displayValidMoves.find(
      (move) => move.row === row && move.col === col
    );
    if (!move) return null;
    return move.isCapture ? "capture" : "move";
  };

  // Get the selected piece color for capture highlighting
  const getSelectedPieceColor = () => {
    if (!selectedPiece) return null;
    const piece = displayBoardState[selectedPiece.row][selectedPiece.col];
    return piece ? piece[0] : null;
  };

  // Check if a piece belongs to an eliminated player
  const isPieceEliminated = (piece: string | null) => {
    if (!piece) return false;
    const pieceColor = piece[0];
    return eliminatedPlayers.includes(pieceColor);
  };

  // Check if we're viewing history (not at the live game state)
  const isViewingHistory = viewingHistoryIndex !== null && viewingHistoryIndex < history.length - 1;

  // Debouncing for piece selection to prevent rapid clicking
  const lastClickTime = useRef<number>(0);
  const DEBOUNCE_DELAY = 150; // 150ms debounce

  // OPTIMIZATION: Memoize current player color to avoid repeated service lookups
  const currentPlayerColor = useMemo(() => {
    return effectiveMode === "online" ? onlineGameService.currentPlayer?.color : null;
  }, [effectiveMode, onlineGameService.currentPlayer?.color]);

  // Handle square press
  const handleSquarePress = async (row: number, col: number) => {
    // Animation lock disabled
    // if (isAnimating) {
    //   return;
    // }

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
      dispatch(selectPiece({ row, col })); // This will deselect since it's the same piece
      return;
    }

    // If a piece is selected AND the pressed square is a valid move
    if (selectedPiece && isAValidMove) {
      const pieceToMove = displayBoardState[selectedPiece.row][selectedPiece.col];
      const pieceColor = pieceToMove?.charAt(0);
      
      // OPTIMIZATION: Validate turn before attempting move
      if (effectiveMode === "online" && pieceColor !== currentPlayerTurn) {
        return; // Not player's turn - ignore move
      }
      
      // OPTIMIZATION: Validate game status
      if (gameStatus !== "active") {
        return; // Game not active - ignore move
      }
      
      // Find the specific move from the already calculated validMoves
      const moveInfo = displayValidMoves.find(
        (move) => move.row === row && move.col === col
      );

      // ✅ Check for en passant capture
      const enPassantTarget = enPassantTargets.find(
        (target: any) =>
          target.position.row === row &&
          target.position.col === col &&
          pieceToMove![1] === "P" &&
          pieceToMove !== target.createdBy
      );

      const moveData = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col },
        pieceCode: pieceToMove!,
        playerColor: pieceColor!,
        isEnPassant: !!enPassantTarget,
        enPassantTarget: enPassantTarget,
      };

      // ✅ SIMPLIFIED: Just dispatch the move. The useEffect will handle the animation.
      if (effectiveMode === "online") {
        if (onlineGameService.isConnected && onlineGameService.currentGameId) {
          // Online multiplayer mode
          onlineGameService.makeMove(moveData).catch((error) => {
            console.error("Failed to make online move:", error);
            // Check if it's a "Not your turn" error
            if (error instanceof Error && error.message === "Not your turn") {
              // ✅ CRITICAL FIX: Use unified playSound method for illegal move sound + haptics
              try {
                const soundService = require('../../../services/soundService').default;
                soundService.playSound('illegal');
              } catch (soundError) {
                console.log('🔊 SoundService: Failed to play illegal move sound:', soundError);
              }
              notificationService.show("Not your turn", "warning", 1500);
            } else {
              // ✅ CRITICAL FIX: Use unified playSound method for failed move sound + haptics
              try {
                const soundService = require('../../../services/soundService').default;
                soundService.playSound('illegal');
              } catch (soundError) {
                console.log('🔊 SoundService: Failed to play illegal move sound:', soundError);
              }
              // FIX: Inform the user about the failed move
              notificationService.show("Move failed - check connection", "error", 2000);
            }
          });
        } else {
          console.log(
            "Board: Online service not connected, falling back to local move"
          );
              // Fallback to local move if online service is not connected
              dispatch(makeMove({ 
                from: selectedPiece, 
                to: { row, col },
                isPromotion: moveInfo?.isPromotion 
              }));
        }
      } else if (effectiveMode === "p2p") {
        console.log(
          "Board: P2P mode - isConnected:",
          p2pGameService.isConnected,
          "currentGameId:",
          p2pGameService.currentGameId
        );
        if (p2pGameService.isConnected && p2pGameService.currentGameId) {
          // P2P multiplayer mode
          p2pGameService.makeMove(moveData).catch((error) => {
            console.error("Failed to make P2P move:", error);
            // Check if it's a "Not your turn" error
            if (error instanceof Error && error.message === "Not your turn") {
              notificationService.show("Not your turn", "warning", 1500);
            } else {
              // FIX: Inform the user about the failed move
              notificationService.show("Move failed - check connection", "error", 2000);
            }
          });
        } else {
          console.log(
            "Board: P2P service not connected, falling back to local move"
          );
              // Fallback to local move if P2P service is not connected
              dispatch(makeMove({ 
                from: selectedPiece, 
                to: { row, col },
                isPromotion: moveInfo?.isPromotion 
              }));
        }
      } else if (networkService.connected && networkService.roomId) {
        // Local multiplayer mode
        dispatch(sendMoveToServer({ row, col }));
      } else {
        // Single player mode
        dispatch(makeMove({ 
          from: selectedPiece, 
          to: { row, col },
          isPromotion: moveInfo?.isPromotion 
        }));
      }
    } else {
      // If clicking on empty square and a piece is selected, deselect it
      if (!pieceCode && selectedPiece) {
        dispatch(deselectPiece());
        return;
      }

      // Otherwise, just try to select the piece on the pressed square
      dispatch(selectPiece({ row, col }));
    }
  };

  // Safety check for null boardState
  if (!boardState || !Array.isArray(boardState)) {
    return (
      <View
        style={{
          width: boardSize,
          height: boardSize,
          alignSelf: "center",
          marginTop: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text className="text-white text-lg">Loading game...</Text>
      </View>
    );
  }

  return (
    <View style={{ width: boardSize, height: boardSize, alignSelf: "center", marginTop: 20 }}>
      
      {/* SVG Border Glow Layer */}
      <Animated.View style={[StyleSheet.absoluteFill, borderGlowStyle]}>
        <Svg width={boardSize} height={boardSize} viewBox="0 0 140 140">
          <Defs>
             {/* Enhanced ambient glow filter */}
             <Filter id="softGlow">
               <FeGaussianBlur stdDeviation="12" result="coloredBlur" />
               <FeMerge>
                 <FeMergeNode in="coloredBlur" />
                 <FeMergeNode in="SourceGraphic" />
               </FeMerge>
             </Filter>

            {/* Player gradient definitions */}
            <LinearGradient id="rGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#B91C1C" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#FFC1C1" stopOpacity="1.0" />
              <Stop offset="100%" stopColor="#B91C1C" stopOpacity="1.0" />
            </LinearGradient>

            <LinearGradient id="bGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#A8C9FA" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#3B82F6" stopOpacity="1.0" />
              <Stop offset="100%" stopColor="#1E3A8A" stopOpacity="1.0" />
            </LinearGradient>

            <LinearGradient id="yGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#C4B5FD" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#7C3AED" stopOpacity="1.0" />
              <Stop offset="100%" stopColor="#4C1D95" stopOpacity="1.0" />
            </LinearGradient>

            <LinearGradient id="gGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#10B981" stopOpacity="1.0" />
              <Stop offset="100%" stopColor="#047857" stopOpacity="1.0" />
            </LinearGradient>

            <LinearGradient id="defaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#E5E7EB" stopOpacity="0.9" />
              <Stop offset="50%" stopColor="#6B7280" stopOpacity="1.0" />
              <Stop offset="100%" stopColor="#374151" stopOpacity="1.0" />
            </LinearGradient>
          </Defs>

           {/* Cross-shaped ambient glow path */}
           <Path
             d={CROSS_SHAPE_PATH}
             fill={currentGradientUrl}
             filter="url(#softGlow)"
           />
        </Svg>
      </Animated.View>

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
                // Animation disabled - pieces always visible
                // const isMovingFrom = animatedPiece?.row === rowIndex && animatedPiece?.col === colIndex;
                // const isMovingTo = lastMove && 
                //   lastMove.to.row === rowIndex && 
                //   lastMove.to.col === colIndex && 
                //   animatedPiece && 
                //   animatedPiece.row === lastMove.from.row && 
                //   animatedPiece.col === lastMove.from.col;
                // const isMoving = isMovingFrom || isMovingTo;
                const isMoving = false; // Never hide pieces
                const isLight = (rowIndex + colIndex) % 2 === 0;
                return (
                  <Square
                    key={`${rowIndex}-${colIndex}`}
                    piece={isMoving ? null : piece}
                    color={isLight ? "light" : "dark"}
                    size={squareSize}
                    row={rowIndex}
                    col={colIndex}
                    onPress={() => handleSquarePress(rowIndex, colIndex)}
                    isSelected={
                      selectedPiece?.row === rowIndex &&
                      selectedPiece?.col === colIndex
                    }
                    moveType={getMoveType(rowIndex, colIndex)}
                    capturingPieceColor={getSelectedPieceColor() || undefined}
                    isInCheck={
                      !!(
                        piece &&
                        piece[1] === "K" &&
                        checkStatus[piece[0] as keyof typeof checkStatus]
                      )
                    }
                    isEliminated={isPieceEliminated(piece)}
                    isInteractable={true}
                    boardTheme={boardTheme}
                    playerData={playerData}
                    isLastMoveFrom={lastMove?.from.row === rowIndex && lastMove?.from.col === colIndex}
                    isLastMoveTo={lastMove?.to.row === rowIndex && lastMove?.to.col === colIndex}
                    boardRotation={boardRotation}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
      
      {/* Movement animations disabled */}
      {/* {animatedPiece && (
        <Animated.View style={[animatedPieceStyle, { zIndex: 2 }]}>
          <Animated.View style={{ transform: [{ rotate: `${-boardRotation}deg` }] }}>
            <Piece piece={animatedPiece.code} size={squareSize} />
          </Animated.View>
        </Animated.View>
      )} */}

      {/* 🎯 Capture Animation Layer - DISABLED */}
      {/* AnimatedCapture and FloatingPointsText components removed for performance */}
      
      {/* 💰 Floating Points Layer - DISABLED */}
      {/* Components removed for performance optimization */}
    </View>
  );
}
