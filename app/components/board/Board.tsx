import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
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
  Easing
} from "react-native-reanimated";
import Svg, { Defs, Filter, FeGaussianBlur, FeMerge, FeMergeNode, Path, LinearGradient, Stop } from "react-native-svg";
import { useSettings } from "../../../context/SettingsContext";

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

// 4-player chess piece codes:
// y = yellow, r = red, b = blue, g = green
// R = Rook, N = Knight, B = Bishop, Q = Queen, K = King, P = Pawn

export default function Board() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width * 0.98, 600); // Max 600px or 98% of screen width
  const squareSize = boardSize / 14;
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
  const eliminatedPlayers = useSelector((state: RootState) => state.game.eliminatedPlayers);
  
  // Memoize expensive calculations
  const displayBoardState = useMemo(() => {
    if (viewingHistoryIndex !== null && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex].boardState;
    }
    return boardState;
  }, [viewingHistoryIndex, history, boardState]);
  const currentPlayerTurn = useSelector((state: RootState) => state.game.currentPlayerTurn);
  const players = useSelector((state: RootState) => state.game.players);

  // Animation values for current player glow
  const glowOpacity = useSharedValue(0);
  const glowScale = useSharedValue(1);
  const glowColor = useSharedValue("#6B7280"); // Default gray
  
  // Use React state for gradient ID instead of shared value
  const [currentGradientId, setCurrentGradientId] = React.useState("defaultGradient");

  // Update glow animation when turn changes
  React.useEffect(() => {
    // Update glow color based on current player
    console.log("🎨 Board: Current player turn:", currentPlayerTurn);
    console.log("🎨 Board: Previous gradientId:", currentGradientId);
    
    switch (currentPlayerTurn) {
      case "r": 
        glowColor.value = "#EF4444"; // Red
        setCurrentGradientId("rGradient");
        console.log("🎨 Board: Set to red gradient");
        break;
      case "b": 
        glowColor.value = "#3B82F6"; // Blue
        setCurrentGradientId("bGradient");
        console.log("🎨 Board: Set to blue gradient");
        break;
      case "y": 
        glowColor.value = "#EAB308"; // Yellow
        setCurrentGradientId("yGradient");
        console.log("🎨 Board: Set to yellow gradient");
        break;
      case "g": 
        glowColor.value = "#10B981"; // Green
        setCurrentGradientId("gGradient");
        console.log("🎨 Board: Set to green gradient");
        break;
      default: 
        glowColor.value = "#6B7280"; // Gray
        setCurrentGradientId("defaultGradient");
        console.log("🎨 Board: Set to default gradient");
    }
    
    console.log("🎨 Board: New gradientId:", currentGradientId);

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
  }, [currentPlayerTurn]);

  // ✅ SVG border glow style
  const borderGlowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  // Get the current gradient URL
  const getCurrentGradientUrl = () => {
    console.log("🎨 Board: Getting gradient URL for:", currentGradientId);
    return `url(#${currentGradientId})`;
  };

  // Create displayed game state (either live or historical) - optimized
  const displayedGameState = useMemo(() => {
    // If we are in "review mode" and the index is valid...
    if (viewingHistoryIndex !== null && viewingHistoryIndex < history.length && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex]; // ...show the historical state.
    }
    // ...otherwise, show the live game state composed from individual selectors
    return {
      boardState: displayBoardState,
      selectedPiece,
      validMoves: displayValidMoves,
      checkStatus,
      eliminatedPlayers,
      currentPlayerTurn,
      players,
      history,
      viewingHistoryIndex
    };
  }, [history, viewingHistoryIndex, displayBoardState, selectedPiece, displayValidMoves, checkStatus, eliminatedPlayers, currentPlayerTurn, players]);

  // Get dispatch function
  const dispatch = useDispatch();

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

  // Handle square press
  const handleSquarePress = async (row: number, col: number) => {
    // If we're viewing history, don't allow any moves
    if (isViewingHistory) {
      console.log("Cannot make moves while viewing history");
      return;
    }

    const pieceCode = displayBoardState[row][col];
    
    // PIECE OWNERSHIP VALIDATION: Only allow players to interact with their own pieces
    if (pieceCode && effectiveMode === "online") {
      const pieceColor = pieceCode[0];
      const currentPlayerColor = onlineGameService.currentPlayer?.color;
      
      // If there's a piece and it doesn't belong to the current player, ignore the press
      if (currentPlayerColor && pieceColor !== currentPlayerColor) {
        console.log(`Cannot select opponent piece: ${pieceCode} (you are ${currentPlayerColor})`);
        return;
      }
    }
    
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

      const moveData = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col },
        pieceCode: pieceToMove!,
        playerColor: pieceColor!,
      };

      // Handle different game modes

      if (effectiveMode === "online") {
        console.log(
          "Board: Online mode - isConnected:",
          onlineGameService.isConnected,
          "currentGameId:",
          onlineGameService.currentGameId
        );
        if (onlineGameService.isConnected && onlineGameService.currentGameId) {
          // Online multiplayer mode
          try {
            console.log("Board: Sending move to online service:", moveData);
            await onlineGameService.makeMove(moveData);
          } catch (error) {
            console.error("Failed to make online move:", error);
            // Check if it's a "Not your turn" error
            if (error instanceof Error && error.message === "Not your turn") {
              // 🔊 Play illegal move sound
              try {
                const soundService = require('../../services/soundService').default;
                soundService.playIllegalMoveSound();
              } catch (soundError) {
                console.log('🔊 SoundService: Failed to play illegal move sound:', soundError);
              }
              Alert.alert("Not your turn", "Please wait for your turn to make a move.");
            } else {
              // 🔊 Play illegal move sound for failed moves
              try {
                const soundService = require('../../services/soundService').default;
                soundService.playIllegalMoveSound();
              } catch (soundError) {
                console.log('🔊 SoundService: Failed to play illegal move sound:', soundError);
              }
              // FIX: Inform the user about the failed move
              Alert.alert(
                "Move Failed",
                "Your move could not be sent to the server. Please check your connection and try again."
              );
            }
          }
        } else {
          console.log(
            "Board: Online service not connected, falling back to local move"
          );
          // Fallback to local move if online service is not connected
          dispatch(makeMove({ row, col }));
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
          try {
            console.log("Board: Sending move to P2P service:", moveData);
            await p2pGameService.makeMove(moveData);
          } catch (error) {
            console.error("Failed to make P2P move:", error);
            // Check if it's a "Not your turn" error
            if (error instanceof Error && error.message === "Not your turn") {
              Alert.alert("Not your turn", "Please wait for your turn to make a move.");
            } else {
              // FIX: Inform the user about the failed move
              Alert.alert(
                "Move Failed",
                "Your move could not be sent to the other player. Please check your connection and try again."
              );
            }
          }
        } else {
          console.log(
            "Board: P2P service not connected, falling back to local move"
          );
          // Fallback to local move if P2P service is not connected
          dispatch(makeMove({ row, col }));
        }
      } else if (networkService.connected && networkService.roomId) {
        // Local multiplayer mode
        dispatch(sendMoveToServer({ row, col }));
      } else {
        // Single player mode
        dispatch(makeMove({ row, col }));
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
            {/* Red Player Gradient
            <LinearGradient id="rGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FF6B6B" stopOpacity="1.0" />
              <Stop offset="50%" stopColor="#EF4444" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#DC2626" stopOpacity="0.7" />
            </LinearGradient>

            {/* Blue Player Gradient */}
            {/* <LinearGradient id="bGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#60A5FA" stopOpacity="1.0" />
              <Stop offset="50%" stopColor="#3B82F6" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#2563EB" stopOpacity="0.7" />
            </LinearGradient> */}

            {/* Yellow Player Gradient */}
            {/* <LinearGradient id="yGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#FDE047" stopOpacity="1.0" />
              <Stop offset="50%" stopColor="#EAB308" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#CA8A04" stopOpacity="0.7" />
            </LinearGradient> */}

            {/* Green Player Gradient */}
            {/* <LinearGradient id="gGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#4ADE80" stopOpacity="1.0" />
              <Stop offset="50%" stopColor="#10B981" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#059669" stopOpacity="0.7" />
            </LinearGradient> */}

            {/* Default Gradient */}
            {/* <LinearGradient id="defaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <Stop offset="0%" stopColor="#9CA3AF" stopOpacity="1.0" />
              <Stop offset="50%" stopColor="#6B7280" stopOpacity="0.9" />
              <Stop offset="100%" stopColor="#4B5563" stopOpacity="0.7" />
            </LinearGradient> */} 
            {/* Red Player Gradient */}
  <LinearGradient id="rGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    {/* Specular Highlight */}
    <Stop offset="0%" stopColor="##B91C1C" stopOpacity="0.9" />
    {/* Main Color */}
    <Stop offset="50%" stopColor="#FFC1C1" stopOpacity="1.0" />
    {/* Shadow */}
    <Stop offset="100%" stopColor="##B91C1C" stopOpacity="1.0" /> 
    {/*altenative option #EF4444*/}
  </LinearGradient>

  {/* Blue Player Gradient */}
  <LinearGradient id="bGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    <Stop offset="0%" stopColor="#A8C9FA" stopOpacity="0.9" />
    <Stop offset="50%" stopColor="#3B82F6" stopOpacity="1.0" />
    <Stop offset="100%" stopColor="#1E3A8A" stopOpacity="1.0" />
  </LinearGradient>

  {/* Yellow Player Gradient */}
  <LinearGradient id="yGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    <Stop offset="0%" stopColor="#FEF3C7" stopOpacity="0.9" />
    <Stop offset="50%" stopColor="#EAB308" stopOpacity="1.0" />
    <Stop offset="100%" stopColor="#92400E" stopOpacity="1.0" />
  </LinearGradient>

  {/* Green Player Gradient */}
  <LinearGradient id="gGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    <Stop offset="0%" stopColor="#A7F3D0" stopOpacity="0.9" />
    <Stop offset="50%" stopColor="#10B981" stopOpacity="1.0" />
    <Stop offset="100%" stopColor="#047857" stopOpacity="1.0" />
  </LinearGradient>

  {/* Default Gradient */}
  <LinearGradient id="defaultGradient" x1="0%" y1="0%" x2="100%" y2="100%">
    <Stop offset="0%" stopColor="#E5E7EB" stopOpacity="0.9" />
    <Stop offset="50%" stopColor="#6B7280" stopOpacity="1.0" />
    <Stop offset="100%" stopColor="#374151" stopOpacity="1.0" />
  </LinearGradient>
          </Defs>

           {/* Cross-shaped ambient glow path */}
           <Path
             d="M 30 0 L 110 0 L 110 30 L 140 30 L 140 110 L 110 110 L 110 140 L 30 140 L 30 110 L 0 110 L 0 30 L 30 30 Z"
             fill={getCurrentGradientUrl()}
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
          overflow: 'hidden',
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
                {Array.from({ length: 14 }, (_, colIndex) => (
                  <View
                    key={`${rowIndex}-${colIndex}`}
                    style={{
                      width: squareSize,
                      height: squareSize,
                      backgroundColor:
                        (rowIndex + colIndex) % 2 === 0
                          ? boardTheme.lightSquare
                          : boardTheme.darkSquare,
                    }}
                  />
                ))}
              </View>
            );
          }

          return (
            <View key={rowIndex} style={{ flexDirection: "row" }}>
              {row.map((piece, colIndex) => {
                const isLight = (rowIndex + colIndex) % 2 === 0;
                return (
                  <Square
                    key={`${rowIndex}-${colIndex}`}
                    piece={piece}
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
                    isInteractable={
                      !piece || 
                      effectiveMode !== "online" || 
                      !onlineGameService.currentPlayer?.color ||
                      piece[0] === onlineGameService.currentPlayer.color
                    }
                    boardTheme={boardTheme}
                  />
                );
              })}
            </View>
          );
        })}
      </View>
    </View>
  );
}
