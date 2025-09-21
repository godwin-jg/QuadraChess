import React from "react";
import { View, Text } from "react-native";
import Svg, { G, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import { getPieceAsset, getPieceColor } from "./PieceAssets";
import { PIECE_CONFIG } from "./PieceConfig";
import { useSettings } from "../../../hooks/useSettings";
import { getPieceStyle, getPieceSize } from "./PieceStyleConfig";

interface PieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  useSVG?: boolean; // Enable SVG mode
  isSelected?: boolean; // For selection effects
  isHighlighted?: boolean; // For move highlights
  animationDelay?: number; // For staggered animations
}

export default function Piece({
  piece,
  size,
  isEliminated = false,
  useSVG = PIECE_CONFIG.USE_SVG_PIECES,
  isSelected = false,
  isHighlighted = false,
  animationDelay = 0,
}: PieceProps) {
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

  const getPieceType = (piece: string) => {
    const pieceType = piece[1];
    switch (pieceType) {
      case "R":
        return "rook";
      case "N":
        return "knight";
      case "B":
        return "bishop";
      case "Q":
        return "queen";
      case "K":
        return "king";
      case "P":
        return "pawn";
      default:
        return "pawn";
    }
  };

  const pieceColorCode = piece[0]; // Get the color code (r, b, g, y)
  const pieceColor = getPieceColor(piece);
  const pieceType = getPieceType(piece);
  const pieceAsset = getPieceAsset(piece);
  const { settings } = useSettings();
  const pieceStyle = getPieceStyle(settings, pieceColorCode);
  const sizeMultiplier = getPieceSize(settings);

  // Enhanced visual effects
  const getContainerStyle = () => {
    const baseStyle = {
      width: size * sizeMultiplier,
      height: size * sizeMultiplier,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      opacity: isEliminated ? 0.3 : 1.0,
    };

    // Add selection glow effect
    if (isSelected && PIECE_CONFIG.SVG.EFFECTS.GLOW.enabled) {
      return {
        ...baseStyle,
        shadowColor: PIECE_CONFIG.SVG.EFFECTS.GLOW.color,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.8,
        shadowRadius: PIECE_CONFIG.SVG.EFFECTS.GLOW.radius,
        elevation: 8,
      };
    }

    // Add drop shadow effect
    if (PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.enabled) {
      return {
        ...baseStyle,
        shadowColor: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.color,
        shadowOffset: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.offset,
        shadowOpacity: 0.4,
        shadowRadius: PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur,
        elevation: 6,
      };
    }

    return baseStyle;
  };

  const getTextStyle = () => {
    const baseStyle = {
      fontSize:
        size * PIECE_CONFIG.UNICODE.FONT_SIZE_MULTIPLIER * sizeMultiplier,
      fontWeight: PIECE_CONFIG.UNICODE.FONT_WEIGHT as any,
      color: pieceStyle.fill,
    };

    // Add text stroke for Unicode pieces
    return {
      ...baseStyle,
      textShadowColor:
        pieceStyle.stroke !== "none" ? pieceStyle.stroke : "transparent",
      textShadowOffset: { width: 0.5, height: 0.5 },
      textShadowRadius: pieceStyle.strokeWidth,
    };
  };

  // Render SVG piece with user-selected styling
  if (useSVG && pieceAsset) {
    if (
      settings.pieces.style === "wooden" &&
      (pieceColorCode === "b" || pieceColorCode === "g")
    ) {
      // Wooden style for Blue and Green pieces
      return (
        <View style={getContainerStyle()}>
          <Svg
            width={size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER * sizeMultiplier}
            height={size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER * sizeMultiplier}
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
              stroke={pieceStyle.stroke}
              strokeWidth={pieceStyle.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <Path d={pieceAsset.path} />
            </G>

            {/* Colored band around base */}
            <G fill={(pieceStyle as any).bandColor || "#06B6D4"}>
              <Path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,35 C 32.5,35 27,37.5 22.5,37.5 C 18,37.5 12.5,35 12.5,35 L 12.5,37" />
            </G>
          </Svg>
        </View>
      );
    }

    // All other styles (solid, white-bordered, black-bordered, accent-bordered)
    return (
      <View style={getContainerStyle()}>
        <Svg
          width={size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER * sizeMultiplier}
          height={size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER * sizeMultiplier}
          viewBox={PIECE_CONFIG.SVG.VIEW_BOX}
        >
          <G
            fill={pieceStyle.fill}
            stroke={pieceStyle.stroke}
            strokeWidth={pieceStyle.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={pieceAsset.path} />
          </G>
        </Svg>
      </View>
    );
  }

  // Render Unicode piece with user-selected styling
  return (
    <View style={getContainerStyle()}>
      <Text style={getTextStyle()}>{getPieceSymbol(piece)}</Text>
    </View>
  );
}
