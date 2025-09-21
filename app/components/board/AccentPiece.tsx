import React from "react";
import { View } from "react-native";
import Svg, { G, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { getPieceAsset } from "./PieceAssets";
import { PIECE_CONFIG } from "./PieceConfig";

interface AccentPieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  animationDelay?: number;
}

/**
 * Enhanced piece component with colored accents instead of full coloring
 */
export default function AccentPiece({
  piece,
  size,
  isEliminated = false,
  isSelected = false,
  isHighlighted = false,
  animationDelay = 0,
}: AccentPieceProps) {
  const pieceAsset = getPieceAsset(piece);
  const pieceType = piece[1];
  const pieceColor = piece[0];

  // Get accent color based on piece color
  const getAccentColor = (color: string) => {
    switch (color) {
      case "r":
        return "#B91C1C"; // Red
      case "b":
        return "#1E40AF"; // Blue
      case "y":
        return "#7C3AED"; // Purple
      case "g":
        return "#059669"; // Green
      default:
        return "#6B7280";
    }
  };

  const accentColor = getAccentColor(pieceColor);

  if (!pieceAsset) {
    // Fallback to Unicode if no SVG asset
    return null;
  }

  const svgSize = size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER;

  // Define accent paths for different piece types
  const getAccentPaths = (type: string, fullPath: string) => {
    // This is a simplified approach - in practice, you'd need to define
    // specific path segments for each piece type's accent areas
    switch (type) {
      case "K": // King - crown accent
        return {
          accent: "M 20,8 L 25,8 M 22.5,11.63 L 22.5,6", // Crown details
          main: fullPath.replace("M 20,8 L 25,8 M 22.5,11.63 L 22.5,6", ""), // Rest of piece
        };
      case "Q": // Queen - crown accent
        return {
          accent:
            "M 4,12 A 2,2 0 1,1 8,12 A 2,2 0 1,1 4,12 M 12,9 A 2,2 0 1,1 16,9 A 2,2 0 1,1 12,9 M 20.5,8 A 2,2 0 1,1 24.5,8 A 2,2 0 1,1 20.5,8 M 29,9 A 2,2 0 1,1 33,9 A 2,2 0 1,1 29,9 M 37,12 A 2,2 0 1,1 41,12 A 2,2 0 1,1 37,12", // Crown jewels
          main: fullPath, // Full piece as base
        };
      case "R": // Rook - top accent
        return {
          accent:
            "M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14", // Top crenellations
          main: fullPath, // Full piece as base
        };
      case "B": // Bishop - top accent
        return {
          accent: "M 25 8 A 2.5 2.5 0 1 1  20,8 A 2.5 2.5 0 1 1  25 8", // Top ball
          main: fullPath, // Full piece as base
        };
      case "N": // Knight - mane accent
        return {
          accent:
            "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18", // Main body
          main: fullPath, // Full piece as base
        };
      case "P": // Pawn - top accent
        return {
          accent: "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38", // Top head
          main: fullPath, // Full piece as base
        };
      default:
        return {
          accent: "",
          main: fullPath,
        };
    }
  };

  const accentPaths = getAccentPaths(pieceType, pieceAsset.path);

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
        {/* Base piece in dark color */}
        <G
          fill="#1f2937"
          stroke={PIECE_CONFIG.SVG.STROKE.color}
          strokeWidth={PIECE_CONFIG.SVG.STROKE.width}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <Path d={pieceAsset.path} />
        </G>

        {/* Colored accent */}
        {accentPaths.accent && (
          <G
            fill={accentColor}
            stroke={accentColor}
            strokeWidth={PIECE_CONFIG.SVG.STROKE.width * 0.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={accentPaths.accent} />
          </G>
        )}
      </Svg>
    </View>
  );
}
