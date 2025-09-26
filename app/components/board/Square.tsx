import React from "react";
import { Pressable, View } from "react-native";
import { BoardTheme } from "./BoardThemeConfig";
import Piece from "./Piece";

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
  onPress?: () => void;
  boardTheme?: BoardTheme;
}

export default function Square({
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
  onPress,
  boardTheme,
}: SquareProps) {
  // Check if this is a corner square that should not be playable
  const isCornerSquare =
    (row < 3 && col < 3) ||
    (row < 3 && col > 10) ||
    (row > 10 && col < 3) ||
    (row > 10 && col > 10);

  // If it's a corner square, render nothing or a simple background view
  if (isCornerSquare) {
    return (
      <Pressable onPress={onPress}>
        <View
          style={{
            width: size,
            height: size,
            backgroundColor: "#000000", // App background color for corners
          }}
        />
      </Pressable>
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

  // Get background color based on selection, capture, and piece color
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
    // Use the board theme colors
    return color === "light"
      ? boardTheme?.lightSquare || "#f0d9b5"
      : boardTheme?.darkSquare || "#b58863";
  };

  const handlePress = () => {
    console.log("Square: Pressed at", row, col, "piece:", piece);
    if (onPress) {
      onPress();
    }
  };

  return (
    <Pressable onPress={handlePress}>
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
          <Piece piece={piece} size={size} isEliminated={isEliminated} />
        )}
        {/* Check overlay */}
        {isInCheck && (
          <View className="absolute top-0 left-0 w-full h-full bg-red-500/50" />
        )}
      </View>
    </Pressable>
  );
}
