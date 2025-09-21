import React from "react";
import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { PIECE_CONFIG } from "./PieceConfig";

interface SVGPieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  svgPath: string; // The actual SVG path data
}

export default function SVGPiece({
  piece,
  size,
  isEliminated = false,
  svgPath,
}: SVGPieceProps) {
  const getPieceColor = (piece: string) => {
    switch (piece[0]) {
      case "y":
        return PIECE_CONFIG.COLORS.purple; // Changed from yellow to purple
      case "r":
        return PIECE_CONFIG.COLORS.red;
      case "b":
        return PIECE_CONFIG.COLORS.blue;
      case "g":
        return PIECE_CONFIG.COLORS.green;
      default:
        return "#000";
    }
  };

  const pieceColor = getPieceColor(piece);

  return (
    <View
      style={{
        width: size * 0.98,
        height: size * 0.98,
        justifyContent: "center",
        alignItems: "center",
        opacity: isEliminated ? 0.3 : 1.0,
      }}
    >
      <Svg width={size * 0.8} height={size * 0.8} viewBox="0 0 48 48">
        <G fill={isEliminated ? "#9CA3AF" : pieceColor}>
          <Path d={svgPath} />
        </G>
      </Svg>
    </View>
  );
}
