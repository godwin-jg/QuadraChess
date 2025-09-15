import React from "react";
import { View, Text } from "react-native";

interface PieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
}

export default function Piece({
  piece,
  size,
  isEliminated = false,
}: PieceProps) {
  const getPieceColor = (piece: string) => {
    switch (piece[0]) {
      case "y":
        return "#EAB308"; // Yellow - yellow text
      case "r":
        return "#DC2626"; // Red - red text
      case "b":
        return "#2563EB"; // Blue - blue text
      case "g":
        return "#16A34A"; // Green - green text
      default:
        return "#000";
    }
  };

  const getPieceSymbol = (piece: string) => {
    const pieceType = piece[1];
    switch (pieceType) {
      case "R":
        return "♜"; // Rook
      case "N":
        return "♞"; // Knight
      case "B":
        return "♝"; // Bishop
      case "Q":
        return "♛"; // Queen
      case "K":
        return "♚"; // King
      case "P":
        return "♟"; // Pawn
      default:
        return piece;
    }
  };

  return (
    <View
      style={{
        width: size * 0.98,
        height: size * 0.98,
        justifyContent: "center",
        alignItems: "center",
        opacity: isEliminated ? 0.3 : 1.0, // Grey out eliminated pieces
      }}
    >
      <Text
        style={{
          fontSize: size * 0.8,
          fontWeight: "bold",
          color: isEliminated ? "#9CA3AF" : getPieceColor(piece), // Grey color for eliminated pieces
          textShadowColor: isEliminated ? "#6B7280" : "#000", // Lighter shadow for eliminated pieces
          textShadowOffset: { width: 0.4, height: 0.4 },
          textShadowRadius: 1,
        }}
      >
        {getPieceSymbol(piece)}
      </Text>
    </View>
  );
}
