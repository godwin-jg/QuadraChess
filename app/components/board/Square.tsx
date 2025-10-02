import React from "react";
import { Pressable, View } from "react-native";
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
        
        return (
          <View
            style={{
              width: size,
              height: size,
              backgroundColor: "transparent",
              justifyContent: "center",
              alignItems: "center",
              paddingBottom: isTopCorner ? 8 : 0, // Add padding bottom for top corners
              paddingTop: isBottomCorner ? 8 : 0, // Add padding top for bottom corners
              paddingRight: isLeftCorner ? 8 : 0, // Add padding right for left corners
              paddingLeft: isRightCorner ? 8 : 0, // Add padding left for right corners
            }}
          >
            <MiniPlayerCircle
              player={player}
              isCurrentTurn={player.isCurrentTurn}
              isEliminated={player.isEliminated}
            />
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
          <Piece piece={piece} size={size} isEliminated={isEliminated} isSelected={isSelected} />
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
