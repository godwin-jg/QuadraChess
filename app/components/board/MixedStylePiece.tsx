import React from "react";
import { View } from "react-native";
import Svg, { G, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { getPieceAsset } from "./PieceAssets";
import { PIECE_CONFIG } from "./PieceConfig";

interface MixedStylePieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  isSelected?: boolean;
  isHighlighted?: boolean;
  animationDelay?: number;
}

/**
 * Mixed style piece component:
 * - Red & Purple: White outline on dark base
 * - Blue & Green: Classic wood with colored bands
 */
export default function MixedStylePiece({
  piece,
  size,
  isEliminated = false,
  isSelected = false,
  isHighlighted = false,
  animationDelay = 0,
}: MixedStylePieceProps) {
  const pieceAsset = getPieceAsset(piece);
  const pieceType = piece[1];
  const pieceColor = piece[0];

  if (!pieceAsset) {
    return null;
  }

  const svgSize = size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER;

  // Determine styling based on piece color
  const isOutlineStyle = pieceColor === "r" || pieceColor === "y"; // Red or Purple
  const isWoodStyle = pieceColor === "b" || pieceColor === "g"; // Blue or Green

  if (isOutlineStyle) {
    // White outline style for Red and Purple pieces
    const fillColor = pieceColor === "r" ? "#B91C1C" : "#7C3AED";

    return (
      <View
        style={{
          width: size * 1.0,
          height: size * 1.0,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.color,
          shadowOffset: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.offset,
          shadowOpacity: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur / 10,
          shadowRadius: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur,
          elevation: 8,
        }}
      >
        <Svg
          width={svgSize}
          height={svgSize}
          viewBox={PIECE_CONFIG.SVG.VIEW_BOX}
        >
          {/* Colored piece with white outline */}
          <G
            fill={fillColor}
            stroke="#ffffff"
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={pieceAsset.path} />
          </G>
        </Svg>
      </View>
    );
  }

  if (isWoodStyle) {
    // Classic wood style for Blue and Green pieces - lighter colors for wood
    const bandColor = pieceColor === "b" ? "#06B6D4" : "#10B981"; // Cyan and green

    return (
      <View
        style={{
          width: size * 1.0,
          height: size * 1.0,
          justifyContent: "center",
          alignItems: "center",
          shadowColor: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.color,
          shadowOffset: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.offset,
          shadowOpacity: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur / 10,
          shadowRadius: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur,
          elevation: 8,
        }}
      >
        <Svg
          width={svgSize}
          height={svgSize}
          viewBox={PIECE_CONFIG.SVG.VIEW_BOX}
        >
          <Defs>
            <LinearGradient
              id="woodGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#D2B48C" />
              <Stop offset="30%" stopColor="#CD853F" />
              <Stop offset="70%" stopColor="#8B4513" />
              <Stop offset="100%" stopColor="#654321" />
            </LinearGradient>
          </Defs>

          {/* Wood base piece */}
          <G
            fill="url(#woodGradient)"
            stroke="#8B4513"
            strokeWidth={1}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={pieceAsset.path} />
          </G>

          {/* Colored band around base */}
          <G fill={bandColor}>
            <Path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,35 C 32.5,35 27,37.5 22.5,37.5 C 18,37.5 12.5,35 12.5,35 L 12.5,37" />
          </G>
        </Svg>
      </View>
    );
  }

  // Fallback to default styling
  return null;
}
