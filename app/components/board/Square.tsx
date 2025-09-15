import React from "react";
import { View, Pressable } from "react-native";
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
  onPress?: () => void;
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
  onPress,
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
        return "bg-red-200";
      case "b":
        return "bg-blue-200";
      case "y":
        return "bg-yellow-200";
      case "g":
        return "bg-green-200";
      default:
        return color === "light" ? "bg-white" : "bg-gray-400";
    }
  };

  // Get background color based on selection, capture, and piece color
  const getBackgroundColor = () => {
    if (isSelected && piece) {
      const pieceColor = getPieceColor(piece);
      switch (pieceColor) {
        case "r":
          return "bg-red-200";
        case "b":
          return "bg-blue-200";
        case "y":
          return "bg-yellow-200";
        case "g":
          return "bg-green-200";
        default:
          return color === "light" ? "bg-white" : "bg-gray-400";
      }
    }
    if (moveType === "capture" && capturingPieceColor) {
      return getCaptureBackgroundColor(capturingPieceColor);
    }
    return color === "light" ? "bg-white" : "bg-gray-400";
  };

  return (
    <Pressable onPress={onPress}>
      <View
        style={{ width: size, height: size }}
        className={`
          ${getBackgroundColor()} 
          justify-center 
          items-center 
        `}
      >
        {/* Render indicators for valid moves */}
        {moveType === "move" && !piece && (
          <View className="w-1/3 h-1/3 bg-gray-500/50 rounded-full" />
        )}
        {piece && <Piece piece={piece} size={size} />}
        {/* Check overlay */}
        {isInCheck && (
          <View className="absolute top-0 left-0 w-full h-full bg-red-500/50" />
        )}
      </View>
    </Pressable>
  );
}
