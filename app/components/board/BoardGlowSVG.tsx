import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import {
  Canvas,
  Path,
  Skia,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";
import type { PlayerColor } from "./boardConstants";

// Cross-shaped path for the board glow (matches original SVG exactly)
const CROSS_PATH_DATA =
  "M 30 0 L 110 0 L 110 30 L 140 30 L 140 110 L 110 110 L 110 140 L 30 140 L 30 110 L 0 110 L 0 30 L 30 30 Z";

// Player gradient colors - exact match to original SVG gradients
const GRADIENT_COLORS: Record<PlayerColor, [string, string, string]> = {
  r: ["#B91C1CE6", "#FFC1C1", "#B91C1C"], // Red: 0.9 opacity start
  b: ["#A8C9FAE6", "#3B82F6", "#1E3A8A"], // Blue: 0.9 opacity start
  y: ["#C4B5FDE6", "#7C3AED", "#4C1D95"], // Yellow/Purple: 0.9 opacity start
  g: ["#A7F3D0E6", "#10B981", "#047857"], // Green: 0.9 opacity start
};

const DEFAULT_GRADIENT: [string, string, string] = ["#E5E7EBE6", "#6B7280", "#374151"];

interface BoardGlowSVGProps {
  boardSize: number;
  currentPlayerTurn: string;
  glowOpacity: SharedValue<number>;
  glowScale: SharedValue<number>;
}

/**
 * GPU-accelerated glow component using React Native Skia.
 * Sharp gradient line glow only - no blur effect.
 */
const BoardGlowSVG = React.memo(function BoardGlowSVG({
  boardSize,
  currentPlayerTurn,
  glowOpacity,
  glowScale,
}: BoardGlowSVGProps) {
  // Create scaled path based on board size
  const path = useMemo(() => {
    const scale = boardSize / 140;
    const skPath = Skia.Path.MakeFromSVGString(CROSS_PATH_DATA);
    if (skPath) {
      const matrix = Skia.Matrix();
      matrix.scale(scale, scale);
      skPath.transform(matrix);
    }
    return skPath;
  }, [boardSize]);

  // Get gradient colors for current player
  const gradientColors = useMemo(() => {
    const colors = GRADIENT_COLORS[currentPlayerTurn as PlayerColor] || DEFAULT_GRADIENT;
    return colors.map((c) => Skia.Color(c));
  }, [currentPlayerTurn]);

  // Animated container style for opacity and scale
  const animatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
    transform: [{ scale: glowScale.value }],
  }));

  if (!path) {
    return null;
  }

  return (
    <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
      <Canvas style={{ width: boardSize, height: boardSize }}>
        {/* Sharp gradient line only - no blur */}
        <Path path={path}>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(boardSize, boardSize)}
            colors={gradientColors}
          />
        </Path>
      </Canvas>
    </Animated.View>
  );
});

export default BoardGlowSVG;
