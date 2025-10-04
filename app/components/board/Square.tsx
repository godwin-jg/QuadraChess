import React from "react";
import { Pressable, View } from "react-native";
import Animated from "react-native-reanimated";
import { BoardTheme } from "./BoardThemeConfig";
import Piece from "./Piece";
import MiniPlayerCircle from "../ui/MiniPlayerCircle";

interface SquareProps {
  piece: string | null;
  color: "light" | "dark";
  size: number;
  row: number;
  col: number;
  isSelected?: boolean;
  moveType?: "move" | "capture" | null;
  isInCheck?: boolean;
  capturingPieceColor?: string;
  isEliminated?: boolean;
  isInteractable?: boolean;
  isLastMoveFrom?: boolean;
  isLastMoveTo?: boolean;
  onPress?: () => void;
  onHover?: () => void;
  onHoverOut?: () => void;
  boardTheme?: BoardTheme;
  playerData?: Array<{
    name: string;
    color: string;
    score: number;
    capturedPieces: string[];
    isCurrentTurn: boolean;
    isEliminated: boolean;
  }>;
  boardRotation?: number;
}

const Square = React.memo(function Square({
  piece,
  color,
  size,
  row,
  col,
  isSelected = false,
  moveType = null,
  isInCheck = false,
  capturingPieceColor,
  isEliminated = false,
  isInteractable = true,
  isLastMoveFrom = false,
  isLastMoveTo = false,
  onPress,
  onHover,
  onHoverOut,
  boardTheme,
  playerData,
  boardRotation = 0,
}: SquareProps) {
  // Check if this is a corner square that should not be playable - memoized for performance
  const isCornerSquare = React.useMemo(() => 
    (row < 3 && col < 3) ||
    (row < 3 && col > 10) ||
    (row > 10 && col < 3) ||
    (row > 10 && col > 10), [row, col]
  );

  // If it's a corner square, render a transparent spacer or player info
  if (isCornerSquare) {
    // Check if this is the center square of a corner (where we'll place the player info)
    const isCornerCenter = (row === 1 && col === 1) || // Top-left center
      (row === 1 && col === 12) || // Top-right center
      (row === 12 && col === 1) || // Bottom-left center
      (row === 12 && col === 12); // Bottom-right center
    
    if (isCornerCenter && playerData) {
      // Get player for this corner
      let player = null;
      if (row === 1 && col === 1) {
        player = playerData.find(p => p.color === "y"); // Top-left = Yellow
      } else if (row === 1 && col === 12) {
        player = playerData.find(p => p.color === "g"); // Top-right = Green
      } else if (row === 12 && col === 1) {
        player = playerData.find(p => p.color === "b"); // Bottom-left = Blue
      } else if (row === 12 && col === 12) {
        player = playerData.find(p => p.color === "r"); // Bottom-right = Red
      }
      
        if (player) {
          // Determine corner position
          const isTopCorner = row === 1;
          const isBottomCorner = row === 12;
          const isLeftCorner = col === 1;
          const isRightCorner = col === 12;
          
          // Smart positioning using transforms - separate configs for each rotation!
          const getPlayerPosition = () => {
            // Different offsets for each board rotation - maximum customization!
            const rotationConfigs: Record<number, any> = {
              0: { // Red player - no rotation
                topLeft: { x: -5, y: -10 },
                topRight: { x: 3, y: -8 },
                bottomLeft: { x: -5, y: 0 },
                bottomRight: { x: 3, y: 0 }
              },
              [-90]: { // Blue player - 90° clockwise
                topLeft: { x: 5, y: 0 },
                topRight: { x: 3, y: 8 },
                bottomLeft: { x: -5, y: 0 },
                bottomRight: { x: -5, y: 12 }
              },
              [-180]: { // Yellow player - 180°
                topLeft: { x: 5, y: 0},
                topRight: { x: -3, y: 0 },
                bottomLeft: { x: 8, y: -12 },
                bottomRight: { x: -3, y: -9 }
              },
              [-270]: { // Green player - 270° clockwise
                topLeft: { x: -3, y: 8 },
                topRight: { x: -3, y: 3 },
                bottomLeft: { x: 3, y: 8 },
                bottomRight: { x: 3, y: 3 }
              }
            };
            
            // Get offsets for current rotation
            const offsets = rotationConfigs[boardRotation] || rotationConfigs[0];
            
            // Determine which corner this is
            let cornerOffset;
            if (isTopCorner && isLeftCorner) cornerOffset = offsets.topLeft;
            else if (isTopCorner && isRightCorner) cornerOffset = offsets.topRight;
            else if (isBottomCorner && isLeftCorner) cornerOffset = offsets.bottomLeft;
            else if (isBottomCorner && isRightCorner) cornerOffset = offsets.bottomRight;
            else cornerOffset = { x: 0, y: 0 };
            
            // Apply rotation to the offset
            const radians = (boardRotation * Math.PI) / 180;
            const cos = Math.cos(radians);
            const sin = Math.sin(radians);
            
            return {
              transform: [
                { translateX: cornerOffset.x * cos - cornerOffset.y * sin },
                { translateY: cornerOffset.x * sin + cornerOffset.y * cos }
              ]
            };
          };
          
          const playerPosition = getPlayerPosition();
          
          return (
            <View
              style={{
                width: size,
                height: size,
                backgroundColor: "transparent",
                justifyContent: "center",
                alignItems: "center",
                alignSelf: "center",
              }}
            >
              <Animated.View 
                style={[
                  playerPosition,
                  { transform: [...playerPosition.transform, { rotate: `${-boardRotation}deg` }] }
                ]}
              >
                <MiniPlayerCircle
                  player={player}
                  isCurrentTurn={player.isCurrentTurn}
                  isEliminated={player.isEliminated}
                  boardRotation={boardRotation}
                />
              </Animated.View>
            </View>
          );
        }
    }
    
    // Render a transparent view that occupies space but is invisible,
    // allowing the glow from behind to show through.
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: "transparent",
        }}
      />
    );
  }

  // Get piece color for selected piece background
  const getPieceColor = (piece: string | null) => {
    if (!piece) return null;
    return piece[0]; // r, b, y, g
  };

  // Get capture background color
  const getCaptureBackgroundColor = (capturingColor: string) => {
    switch (capturingColor) {
      case "r":
        return "#fecaca"; // red-200 equivalent
      case "b":
        return "#bfdbfe"; // blue-200 equivalent
      case "y":
        return "#fef3c7"; // yellow-200 equivalent
      case "g":
        return "#bbf7d0"; // green-200 equivalent
      default:
        return color === "light"
          ? boardTheme?.lightSquare || "#f0d9b5"
          : boardTheme?.darkSquare || "#b58863";
    }
  };

  // Get background color based on selection, capture, last move, and piece color
  const getBackgroundColor = () => {
    if (isSelected && piece) {
      const pieceColor = getPieceColor(piece);
      switch (pieceColor) {
        case "r":
          return "#fecaca"; // red-200 equivalent
        case "b":
          return "#bfdbfe"; // blue-200 equivalent
        case "y":
          return "#fef3c7"; // yellow-200 equivalent
        case "g":
          return "#bbf7d0"; // green-200 equivalent
        default:
          // Use the board theme colors
          return color === "light"
            ? boardTheme?.lightSquare || "#f0d9b5"
            : boardTheme?.darkSquare || "#b58863";
      }
    }
    if (moveType === "capture" && capturingPieceColor) {
      return getCaptureBackgroundColor(capturingPieceColor);
    }
    // Highlight last move squares with subtle, modern colors
    if (isLastMoveFrom) {
      return "#e0e7ff"; // indigo-100 - subtle blue tint for "from" square
    }
    if (isLastMoveTo) {
      return "#c7d2fe"; // indigo-200 - slightly more visible blue for "to" square
    }
    // Use the board theme colors
    return color === "light"
      ? boardTheme?.lightSquare || "#f0d9b5"
      : boardTheme?.darkSquare || "#b58863";
  };

  const handlePress = () => {
    if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable
      onPress={isInteractable ? handlePress : undefined}
      onHoverIn={isInteractable ? onHover : undefined}
      onHoverOut={isInteractable ? onHoverOut : undefined}
      style={({ pressed }) => ({
        opacity: !isInteractable ? 0.6 : pressed ? 0.8 : 1,
        transform: [{ scale: !isInteractable ? 1 : 1 }],
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: getBackgroundColor(),
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Render indicators for valid moves */}
        {moveType === "move" && !piece && (
          <View className="w-1/3 h-1/3 bg-gray-500/50 rounded-full" />
        )}
        {piece && (
          <Animated.View style={{ transform: [{ rotate: `${-boardRotation}deg` }] }}>
            <Piece piece={piece} size={size} isEliminated={isEliminated} isSelected={isSelected} />
          </Animated.View>
        )}
        {/* Check overlay */}
        {isInCheck && (
          <View className="absolute top-0 left-0 w-full h-full bg-red-500/50" />
        )}
      </View>
    </Pressable>
  );
});

export default Square;
