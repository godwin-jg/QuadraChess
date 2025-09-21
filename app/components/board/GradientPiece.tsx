import React from "react";
import { View } from "react-native";
import Svg, { G, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { getPieceAsset } from "./PieceAssets";
import { PIECE_CONFIG } from "./PieceConfig";

interface GradientPieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  animationDelay?: number;
}

/**
 * Enhanced piece component with gradient styling instead of solid colors
 */
export default function GradientPiece({
  piece,
  size,
  isEliminated = false,
  isSelected = false,
  isHighlighted = false,
  animationDelay = 0,
}: GradientPieceProps) {
  const pieceAsset = getPieceAsset(piece);
  const pieceType = piece[1];
  const pieceColor = piece[0];

  // Get gradient colors based on piece color
  const getGradientColors = (color: string) => {
    switch (color) {
      case "r":
        return {
          start: "#DC2626", // Lighter red
          end: "#B91C1C", // Darker red
        };
      case "b":
        return {
          start: "#2563EB", // Lighter blue
          end: "#1E40AF", // Darker blue
        };
      case "y":
        return {
          start: "#8B5CF6", // Lighter purple
          end: "#7C3AED", // Darker purple
        };
      case "g":
        return {
          start: "#10B981", // Lighter green
          end: "#059669", // Darker green
        };
      default:
        return {
          start: "#6B7280",
          end: "#4B5563",
        };
    }
  };

  const gradientColors = getGradientColors(pieceColor);
  const gradientId = `${pieceColor}Gradient`;

  if (!pieceAsset) {
    // Fallback to Unicode if no SVG asset
    return null;
  }

  const svgSize = size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER;

  return (
    <View
      style={{
        width: size * 1.0,
        height: size * 1.0,
        justifyContent: "center",
        alignItems: "center",
        // Enhanced visual effects
        shadowColor: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.color,
        shadowOffset: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.offset,
        shadowOpacity: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur / 10,
        shadowRadius: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur,
        elevation: 8,
      }}
    >
      <Svg width={svgSize} height={svgSize} viewBox={PIECE_CONFIG.SVG.VIEW_BOX}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <Stop offset="0%" stopColor={gradientColors.start} />
            <Stop offset="100%" stopColor={gradientColors.end} />
          </LinearGradient>
        </Defs>
        <G
          fill={`url(#${gradientId})`}
          stroke={PIECE_CONFIG.SVG.STROKE.color}
          strokeWidth={PIECE_CONFIG.SVG.STROKE.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d={pieceAsset.path} />
        </G>
      </Svg>
    </View>
  );
}
