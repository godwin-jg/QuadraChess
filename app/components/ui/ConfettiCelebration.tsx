import React, { useEffect, useMemo, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
} from "react-native-reanimated";

const CONFETTI_COUNT = 30; // Reduced for better performance

// Color palette for confetti - celebration colors
const CONFETTI_COLORS = [
  "#FFD700", // Gold
  "#FF6B6B", // Red
  "#4ECDC4", // Teal
  "#9B59B6", // Purple
  "#3498DB", // Blue
  "#2ECC71", // Green
  "#F39C12", // Orange
  "#E91E63", // Pink
  "#00BCD4", // Cyan
  "#8BC34A", // Light green
];

// Winner-specific accent colors
const WINNER_COLORS: Record<string, string[]> = {
  r: ["#FF6B6B", "#FF4757", "#FF6B6B", "#FFD700", "#FFA502"],
  b: ["#3498DB", "#2980B9", "#00D2D3", "#FFD700", "#74B9FF"],
  y: ["#9B59B6", "#8E44AD", "#A29BFE", "#FFD700", "#D63384"],
  g: ["#2ECC71", "#27AE60", "#00B894", "#FFD700", "#55EFC4"],
};

type ConfettiShape = "rect" | "circle" | "star";

interface ConfettiPieceProps {
  index: number;
  width: number;
  height: number;
  color: string;
  shape: ConfettiShape;
  size: number;
  startX: number;
  delay: number;
  visible: boolean;
}

const ConfettiPiece = React.memo(({
  index,
  width,
  height,
  color,
  shape,
  size,
  startX,
  delay,
  visible,
}: ConfettiPieceProps) => {
  const opacity = useSharedValue(0);
  const translateX = useSharedValue(startX);
  const translateY = useSharedValue(-50);
  const rotateZ = useSharedValue(0);
  const scale = useSharedValue(1);
  const hasStartedRef = useRef(false);

  useEffect(() => {
    if (!visible) {
      // Reset when not visible
      hasStartedRef.current = false;
      cancelAnimation(opacity);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(rotateZ);
      cancelAnimation(scale);
      opacity.value = 0;
      translateY.value = -50;
      return;
    }

    if (hasStartedRef.current) return;
    hasStartedRef.current = true;

    const fallDuration = 3000 + Math.random() * 2000;
    const swayAmount = 30 + Math.random() * 60;
    const swayDuration = 400 + Math.random() * 400;
    const initialRotation = Math.random() * 360;
    const initialScale = 0.8 + Math.random() * 0.4;
    const xOffset = startX + (Math.random() - 0.5) * 100;

    // Set initial values
    translateX.value = xOffset;
    rotateZ.value = initialRotation;
    scale.value = initialScale;

    // Fade in
    opacity.value = withDelay(delay, withTiming(1, { duration: 200 }));

    // Fall down
    translateY.value = withDelay(
      delay,
      withTiming(height + 100, {
        duration: fallDuration,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      })
    );

    // Horizontal sway
    translateX.value = withDelay(
      delay,
      withRepeat(
        withSequence(
          withTiming(xOffset + swayAmount, {
            duration: swayDuration,
            easing: Easing.inOut(Easing.ease),
          }),
          withTiming(xOffset - swayAmount, {
            duration: swayDuration,
            easing: Easing.inOut(Easing.ease),
          })
        ),
        -1,
        true
      )
    );

    // Rotation
    rotateZ.value = withDelay(
      delay,
      withRepeat(
        withTiming(initialRotation + (index % 2 === 0 ? 360 : -360), {
          duration: 2000 + Math.random() * 1500,
          easing: Easing.linear,
        }),
        -1,
        false
      )
    );

    return () => {
      cancelAnimation(opacity);
      cancelAnimation(translateX);
      cancelAnimation(translateY);
      cancelAnimation(rotateZ);
      cancelAnimation(scale);
    };
  }, [visible, delay, height, index, startX]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotateZ: `${rotateZ.value}deg` },
      { scale: scale.value },
    ],
  }));

  const shapeStyle = useMemo(() => {
    switch (shape) {
      case "circle":
        return {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        };
      case "star":
        return {
          width: size,
          height: size * 0.4,
          backgroundColor: color,
          borderRadius: 2,
        };
      case "rect":
      default:
        return {
          width: size * 0.5,
          height: size,
          backgroundColor: color,
          borderRadius: 2,
        };
    }
  }, [shape, size, color]);

  return (
    <Animated.View style={[styles.confettiPiece, { left: 0 }, animatedStyle]}>
      <View style={shapeStyle} />
      {shape === "star" && (
        <View
          style={[
            shapeStyle,
            {
              position: "absolute",
              transform: [{ rotateZ: "90deg" }],
            },
          ]}
        />
      )}
    </Animated.View>
  );
});

interface ConfettiCelebrationProps {
  visible: boolean;
  winnerColor?: string;
  duration?: number;
  onComplete?: () => void;
}

export default function ConfettiCelebration({
  visible,
  winnerColor,
  duration = 6000,
  onComplete,
}: ConfettiCelebrationProps) {
  const { width, height } = useWindowDimensions();
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Generate confetti pieces data - memoized based on visibility and dimensions
  const confettiData = useMemo(() => {
    if (!visible) return [];
    
    const colors = winnerColor && WINNER_COLORS[winnerColor]
      ? [...WINNER_COLORS[winnerColor], ...CONFETTI_COLORS]
      : CONFETTI_COLORS;

    return Array.from({ length: CONFETTI_COUNT }, (_, i) => ({
      id: i,
      shape: (["rect", "circle", "star"][Math.floor(Math.random() * 3)]) as ConfettiShape,
      color: colors[Math.floor(Math.random() * colors.length)],
      size: 8 + Math.random() * 12,
      startX: Math.random() * width,
      delay: Math.random() * 1500,
    }));
  }, [visible, width, winnerColor]);

  // Handle completion timeout
  useEffect(() => {
    if (visible) {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        onComplete?.();
      }, duration);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [visible, duration, onComplete]);

  if (!visible || confettiData.length === 0) return null;

  return (
    <View pointerEvents="none" style={styles.container}>
      {confettiData.map((piece) => (
        <ConfettiPiece
          key={piece.id}
          index={piece.id}
          width={width}
          height={height}
          color={piece.color}
          shape={piece.shape}
          size={piece.size}
          startX={piece.startX}
          delay={piece.delay}
          visible={visible}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 100,
  },
  confettiPiece: {
    position: "absolute",
    top: 0,
  },
});
