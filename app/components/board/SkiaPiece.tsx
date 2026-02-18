import React, { useMemo } from "react";
import {
  Canvas,
  Path,
  Skia,
  Group,
  Shadow,
} from "@shopify/react-native-skia";
import { pieceAssets } from "./PieceAssets";
import { PIECE_CONFIG } from "./PieceConfig";
import { useSettings } from "../../../context/SettingsContext";
import { getPieceStyle, getPieceSize } from "./PieceStyleConfig";

interface SkiaPieceProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  isSelected?: boolean;
  previewStyle?: string;
  styleKey?: string;
}

// Cache for parsed Skia paths - avoids re-parsing on every render
const pathCache = new Map<string, ReturnType<typeof Skia.Path.MakeFromSVGString>>();

const getOrCreatePath = (pathData: string, scale: number): ReturnType<typeof Skia.Path.MakeFromSVGString> => {
  const cacheKey = `${pathData}-${scale.toFixed(3)}`;
  
  if (pathCache.has(cacheKey)) {
    return pathCache.get(cacheKey)!;
  }
  
  const skPath = Skia.Path.MakeFromSVGString(pathData);
  if (skPath) {
    const matrix = Skia.Matrix();
    matrix.scale(scale, scale);
    skPath.transform(matrix);
    pathCache.set(cacheKey, skPath);
  }
  
  return skPath;
};

/**
 * GPU-accelerated piece renderer using React Native Skia.
 * Replaces the SVG-based Piece component for better performance.
 */
const SkiaPiece = React.memo(function SkiaPiece({
  piece,
  size,
  isEliminated = false,
  isSelected = false,
  previewStyle,
  styleKey: _styleKey,
}: SkiaPieceProps) {
  const { settings } = useSettings();
  
  // Get piece configuration
  const pieceColorCode = piece[0]; // r, b, y, g
  const pieceType = piece[1]; // K, Q, R, B, N, P
  
  // Use preview style if provided, otherwise use settings
  const currentStyle = previewStyle || settings.pieces.style;
  const pieceStyle = previewStyle 
    ? getPieceStyle({ ...settings, pieces: { ...settings.pieces, style: previewStyle as any } }, pieceColorCode)
    : getPieceStyle(settings, pieceColorCode);
  const sizeMultiplier = getPieceSize(settings);
  
  // Get the piece asset (SVG path data)
  const pieceAsset = useMemo(() => {
    const typeMap: Record<string, string> = {
      K: "king",
      Q: "queen",
      R: "rook",
      B: "bishop",
      N: "knight",
      P: "pawn",
    };
    
    const type = typeMap[pieceType];
    if (!type) return null;
    
    const folder = ["r", "b"].includes(pieceColorCode) ? "dark" : "light";
    const key = `${folder}-${type}`;
    return pieceAssets[key] || null;
  }, [pieceType, pieceColorCode]);
  
  // Calculate dimensions
  const canvasSize = size * PIECE_CONFIG.SVG.SIZE_MULTIPLIER * sizeMultiplier;
  const scale = canvasSize / 48; // Original viewBox is 0 0 48 48
  
  // Get or create cached path
  const path = useMemo(() => {
    if (!pieceAsset) return null;
    return getOrCreatePath(pieceAsset.path, scale);
  }, [pieceAsset, scale]);
  
  // Determine colors
  const fillColor = useMemo(() => {
    if (isEliminated) {
      return PIECE_CONFIG.COLORS.eliminated;
    }
    // Handle wooden style gradient - fall back to solid color
    if (currentStyle === "wooden") {
      return "#8B4513"; // Wood brown as fallback
    }
    return pieceStyle.fill;
  }, [isEliminated, currentStyle, pieceStyle.fill]);
  
  const strokeColor = pieceStyle.stroke !== "none" ? pieceStyle.stroke : undefined;
  const strokeWidth = pieceStyle.strokeWidth * scale;
  
  if (!path || !pieceAsset) {
    return null;
  }
  
  return (
    <Canvas
      style={{
        width: canvasSize,
        height: canvasSize,
        opacity: isEliminated ? 0.3 : 1.0,
      }}
    >
      <Group>
        {/* Main piece path */}
        <Path
          path={path}
          color={fillColor}
          style="fill"
        >
          {/* Drop shadow for 3D effect */}
          {PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.enabled && (
            <Shadow
              dx={PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.offset.width * scale}
              dy={PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.offset.height * scale}
              blur={PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.blur * scale}
              color="rgba(0, 0, 0, 0.4)"
            />
          )}
          {/* Selection glow */}
          {isSelected && PIECE_CONFIG.SVG.EFFECTS.GLOW.enabled && (
            <Shadow
              dx={0}
              dy={0}
              blur={PIECE_CONFIG.SVG.EFFECTS.GLOW.radius * scale}
              color={PIECE_CONFIG.SVG.EFFECTS.GLOW.color}
            />
          )}
        </Path>
        
        {/* Stroke outline */}
        {strokeColor && strokeWidth > 0 && (
          <Path
            path={path}
            color={strokeColor}
            style="stroke"
            strokeWidth={strokeWidth}
            strokeCap="round"
            strokeJoin="round"
          />
        )}
      </Group>
    </Canvas>
  );
});

export default SkiaPiece;
