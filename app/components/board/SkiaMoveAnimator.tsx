import React, { useEffect, useMemo } from "react";
import {
  Canvas,
  Path,
  Skia,
  Group,
  type SkPath,
} from "@shopify/react-native-skia";
import {
  useSharedValue,
  withTiming,
  useDerivedValue,
  runOnJS,
  runOnUI,
  cancelAnimation,
  type SharedValue,
  Easing,
  useAnimatedStyle,
} from "react-native-reanimated";
import Animated from "react-native-reanimated";
import { ANIMATION_DURATIONS } from "../../../config/gameConfig";
import { getSkiaPath } from "./PieceAssets";
import { PIECE_CONFIG, getAnimationPieceRotation } from "./PieceConfig";
import { AnimPlan, keyToRowCol } from "./chessgroundAnimations";
import { useSettings } from "../../../context/SettingsContext";
import { getPieceStyle, getPieceSize } from "./PieceStyleConfig";

// ✅ SINGLETON GUARD: Ensure only one SkiaMoveAnimator instance runs animations
// This prevents duplicate animations when multiple Board components are mounted
// (e.g., during tab navigation transitions)
let globalActiveAnimatorId: string | null = null;
let globalAnimatorCounter = 0;

// Reset global animator state - call when switching game modes
export function resetAnimatorState(): void {
  globalActiveAnimatorId = null;
  globalAnimatorCounter = 0;
  if (__DEV__) console.log('[SkiaAnim] Global animator state reset');
}

interface SkiaMoveAnimatorProps {
  plan: AnimPlan | null;
  piecesMap: Map<number, string>;
  movePieceOverrides?: Map<number, string> | null;
  squareSize: number;
  viewerColor?: string | null;
  onComplete: () => void;
  onCompleteUI?: () => void;
  animationRunning?: SharedValue<number>;
}

type AnimatedPiece = {
  key: number;
  piece: string;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  path: SkPath;
  fillColor: string;
  strokeColor: string | null;
  strokeWidth: number;
};

type FadingPiece = {
  key: number;
  piece: string;
  x: number;
  y: number;
  path: SkPath;
  fillColor: string;
  strokeColor: string | null;
  strokeWidth: number;
};

// Smooth ease-in-out glide with a subtle lift feel
const moveEasing = Easing.inOut(Easing.cubic);

/**
 * GPU-accelerated move animator using React Native Skia.
 * Renders all moving/fading pieces in a single Canvas draw call.
 * Uses Reanimated shared values for smooth UI thread animations.
 */
export default function SkiaMoveAnimator({
  plan,
  piecesMap,
  movePieceOverrides,
  squareSize,
  viewerColor = null,
  onComplete,
  onCompleteUI,
  animationRunning,
}: SkiaMoveAnimatorProps) {
  const onCompleteRef = React.useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  // ✅ SINGLETON GUARD: Generate unique ID for this animator instance
  const animatorIdRef = React.useRef<string | null>(null);
  if (animatorIdRef.current === null) {
    globalAnimatorCounter += 1;
    animatorIdRef.current = `animator-${globalAnimatorCounter}`;
  }
  const animatorId = animatorIdRef.current;

  // Register this animator as active on mount, unregister on unmount
  useEffect(() => {
    // Become the active animator (last mounted wins)
    globalActiveAnimatorId = animatorId;
    if (__DEV__) console.log('[SkiaAnim] Registered as active animator:', animatorId);
    
    return () => {
      // Only clear if we're still the active animator
      if (globalActiveAnimatorId === animatorId) {
        globalActiveAnimatorId = null;
        if (__DEV__) console.log('[SkiaAnim] Unregistered animator:', animatorId);
      }
    };
  }, [animatorId]);

  const { settings } = useSettings();
  const sizeMultiplier = getPieceSize(settings);
  const pieceSize = squareSize * PIECE_CONFIG.SVG.SIZE_MULTIPLIER * sizeMultiplier;
  const scale = pieceSize / 48; // Original viewBox is 0 0 48 48

  // Animation progress (0 = start position, 1 = end position)
  const progress = useSharedValue(0);
  const completedRef = React.useRef(false);

  // Counter to ensure each plan gets a unique key
  const planCounterRef = React.useRef(0);
  const prevPlanRef = React.useRef<AnimPlan | null>(null);

  // Create a unique key for each new plan
  const planKey = useMemo(() => {
    if (!plan) return null;
    // If this is a different plan object, increment the counter
    if (plan !== prevPlanRef.current) {
      planCounterRef.current += 1;
      prevPlanRef.current = plan;
    }
    return `plan-${planCounterRef.current}`;
  }, [plan]);

  // Track which plan we've already animated
  const lastAnimatedPlanKeyRef = React.useRef<string | null>(null);

  // Pre-calculate animated pieces with their paths
  const animatedPieces = useMemo<AnimatedPiece[]>(() => {
    if (!plan) return [];

    return Array.from(plan.anims.entries())
      .map(([key, vector]) => {
        const piece = movePieceOverrides?.get(key) ?? piecesMap.get(key);
        if (!piece) return null;

        const { row, col } = keyToRowCol(key);
        const pieceColorCode = piece[0];
        const pieceType = piece[1];

        // Get piece asset
        const typeMap: Record<string, string> = {
          K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn",
        };
        const type = typeMap[pieceType];
        if (!type) return null;

        const folder = ["r", "b"].includes(pieceColorCode) ? "dark" : "light";
        const assetKey = `${folder}-${type}`;
        const basePath = getSkiaPath(assetKey);
        if (!basePath) return null;

        // Copy and scale path
        const skPath = basePath.copy();

        const matrix = Skia.Matrix();
        matrix.scale(scale, scale);
        skPath.transform(matrix);

        // Get style
        const pieceStyle = getPieceStyle(settings, pieceColorCode);
        const fillColor = settings.pieces.style === "wooden" ? "#8B4513" : pieceStyle.fill;

        // Calculate positions
        const endX = col * squareSize + (squareSize - pieceSize) / 2;
        const endY = row * squareSize + (squareSize - pieceSize) / 2;
        const startX = endX + vector[0] * squareSize;
        const startY = endY + vector[1] * squareSize;

        return {
          key,
          piece,
          startX,
          startY,
          endX,
          endY,
          path: skPath,
          fillColor,
          strokeColor: pieceStyle.stroke !== "none" ? pieceStyle.stroke : null,
          strokeWidth: pieceStyle.strokeWidth * scale,
        };
      })
      .filter((entry): entry is AnimatedPiece => !!entry);
  }, [plan, piecesMap, movePieceOverrides, squareSize, scale, pieceSize, settings]);

  // Pre-calculate fading pieces
  const fadingPieces = useMemo<FadingPiece[]>(() => {
    if (!plan) return [];

    return Array.from(plan.fadings.entries())
      .map(([key, piece]) => {
        const { row, col } = keyToRowCol(key);
        const pieceColorCode = piece[0];
        const pieceType = piece[1];

        const typeMap: Record<string, string> = {
          K: "king", Q: "queen", R: "rook", B: "bishop", N: "knight", P: "pawn",
        };
        const type = typeMap[pieceType];
        if (!type) return null;

        const folder = ["r", "b"].includes(pieceColorCode) ? "dark" : "light";
        const assetKey = `${folder}-${type}`;
        const basePath = getSkiaPath(assetKey);
        if (!basePath) return null;

        const skPath = basePath.copy();

        const matrix = Skia.Matrix();
        matrix.scale(scale, scale);
        skPath.transform(matrix);

        const pieceStyle = getPieceStyle(settings, pieceColorCode);
        const fillColor = settings.pieces.style === "wooden" ? "#8B4513" : pieceStyle.fill;

        return {
          key,
          piece,
          x: col * squareSize + (squareSize - pieceSize) / 2,
          y: row * squareSize + (squareSize - pieceSize) / 2,
          path: skPath,
          fillColor,
          strokeColor: pieceStyle.stroke !== "none" ? pieceStyle.stroke : null,
          strokeWidth: pieceStyle.strokeWidth * scale,
        };
      })
      .filter((entry): entry is FadingPiece => !!entry);
  }, [plan, squareSize, scale, pieceSize, settings]);

  // Derived opacity for fading pieces (inverted progress)
  const fadeOpacity = useDerivedValue(() => 1 - progress.value);

  // Run animation
  useEffect(() => {
    if (__DEV__) console.log('[SkiaAnim] useEffect plan=', !!plan, 'planKey=', planKey, 'animator=', animatorId);
    if (!plan || !planKey) return;

    // ✅ SINGLETON GUARD: Only animate if we're the active animator
    if (globalActiveAnimatorId !== animatorId) {
      if (__DEV__) console.log('[SkiaAnim] Skip: not the active animator (active=', globalActiveAnimatorId, ')');
      return;
    }

    // Skip if we already animated this plan
    if (planKey === lastAnimatedPlanKeyRef.current) {
      if (__DEV__) console.log('[SkiaAnim] Skip: already animated planKey');
      return;
    }

    // Mark this plan as being animated
    lastAnimatedPlanKeyRef.current = planKey;
    if (__DEV__) console.log('[SkiaAnim] Starting animation for planKey:', planKey);

    // Cancel any ongoing animation before starting new one
    cancelAnimation(progress);

    completedRef.current = false;
    const hasAnimations = plan.anims.size > 0 || plan.fadings.size > 0;

    const completeOnce = () => {
      if (completedRef.current) return;
      completedRef.current = true;
      onCompleteRef.current();
    };

    if (!hasAnimations) {
      if (animationRunning) {
        animationRunning.value = 0;
      }
      completeOnce();
      return;
    }

    if (animationRunning) {
      animationRunning.value = 1;
    }

    // Reset progress immediately, then animate to 1 on next frame
    progress.value = 0;
    let frameId: number | null = null;
    frameId = requestAnimationFrame(() => {
      progress.value = withTiming(1, {
        duration: ANIMATION_DURATIONS.PIECE_MOVE,
        easing: moveEasing,
      }, (finished) => {
        if (finished) {
          if (animationRunning) {
            animationRunning.value = 0;
          }
          if (onCompleteUI) {
            onCompleteUI();
          }
          runOnJS(completeOnce)();
        }
      });
    });

    return () => {
      // Cancel animation on cleanup (but don't call completeOnce - let the animation finish naturally)
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      cancelAnimation(progress);
      if (!completedRef.current) {
        if (onCompleteUI) {
          runOnUI(onCompleteUI)();
        }
        runOnJS(completeOnce)();
      }
    };
  }, [plan, planKey, progress, animationRunning, onCompleteUI, animatorId]);

  // Note: We intentionally do NOT reset lastAnimatedPlanKeyRef when plan goes null.
  // The counter-based planKey system handles new animations, and resetting here
  // would cause cached plans to re-animate when the same plan object is returned
  // from useMemo after a drag cancel or other re-render.

  // Opacity animation based on running state to prevent double-piece artifacts
  const containerStyle = useAnimatedStyle(() => {
    return {
      opacity: animationRunning ? animationRunning.value : 1,
    };
  }, [animationRunning]);

  if (!plan || (animatedPieces.length === 0 && fadingPieces.length === 0)) {
    return null;
  }

  const boardSize = squareSize * 14;

  return (
    <Animated.View
      style={[
        {
          position: "absolute",
          width: boardSize,
          height: boardSize,
          zIndex: 2,
        },
        containerStyle,
      ]}
      pointerEvents="none"
    >
      <Canvas
        key={planKey} // Force remount when plan changes to avoid stale state
        style={{ flex: 1 }}
      >
        {/* Fading pieces (captured pieces fading out) */}
        {fadingPieces.map((pieceData) => {
          const bounds = pieceData.path.getBounds();
          const pieceCenterX = bounds.x + bounds.width / 2;
          const pieceCenterY = bounds.y + bounds.height / 2;
          const rotationDegrees = getAnimationPieceRotation(pieceData.piece[0], viewerColor);
          const counterRotationRad = rotationDegrees * (Math.PI / 180);
          
          return (
            <Group
              key={`fade-${pieceData.key}`}
              transform={[
                { translateX: pieceData.x },
                { translateY: pieceData.y },
              ]}
              opacity={fadeOpacity}
            >
              {/* Apply counter-rotation around piece center to keep it upright */}
              <Group
                transform={[
                  { translateX: pieceCenterX },
                  { translateY: pieceCenterY },
                  { rotate: counterRotationRad },
                  { translateX: -pieceCenterX },
                  { translateY: -pieceCenterY },
                ]}
              >
                <Path path={pieceData.path} color={pieceData.fillColor} style="fill" />
                {pieceData.strokeColor && (
                  <Path
                    path={pieceData.path}
                    color={pieceData.strokeColor}
                    style="stroke"
                    strokeWidth={pieceData.strokeWidth}
                    strokeCap="round"
                    strokeJoin="round"
                  />
                )}
              </Group>
            </Group>
          );
        })}

        {/* Moving pieces - each uses derived values for position */}
        {animatedPieces.map((pieceData) => (
          <MovingPieceGroup
            key={`move-${pieceData.key}`}
            pieceData={pieceData}
            progress={progress}
            viewerColor={viewerColor}
          />
        ))}
      </Canvas>
    </Animated.View>
  );
}

// Separate component for moving pieces to use derived values
const MovingPieceGroup = React.memo(function MovingPieceGroup({
  pieceData,
  progress,
  viewerColor = null,
}: {
  pieceData: AnimatedPiece;
  progress: SharedValue<number>;
  viewerColor?: string | null;
}) {
  // Calculate piece center offset for proper rotation pivot
  const bounds = pieceData.path.getBounds();
  const pieceCenterX = bounds.x + bounds.width / 2;
  const pieceCenterY = bounds.y + bounds.height / 2;
  
  const rotationDegrees = getAnimationPieceRotation(pieceData.piece[0], viewerColor);
  const counterRotationRad = rotationDegrees * (Math.PI / 180);
  const rotationTransform = [
    { translateX: pieceCenterX },
    { translateY: pieceCenterY },
    { rotate: counterRotationRad },
    { translateX: -pieceCenterX },
    { translateY: -pieceCenterY },
  ];
  
  // Derive animated transform from progress and current piece data
  const moveTransform = useDerivedValue(
    () => [
      {
        translateX:
          pieceData.startX + (pieceData.endX - pieceData.startX) * progress.value,
      },
      {
        translateY:
          pieceData.startY + (pieceData.endY - pieceData.startY) * progress.value,
      },
    ],
    [
      pieceData.startX,
      pieceData.endX,
      pieceData.startY,
      pieceData.endY,
    ]
  );

  const innerTransform = useDerivedValue(() => {
    const lift = Math.sin(Math.PI * progress.value);
    const scale = 1 + lift * 0.04;
    return [
      { translateX: pieceCenterX },
      { translateY: pieceCenterY },
      { scale },
      { translateX: -pieceCenterX },
      { translateY: -pieceCenterY },
    ];
  }, [pieceCenterX, pieceCenterY]);

  return (
    <Group transform={moveTransform}>
      {/* Apply rotation in a non-animated transform for immediate updates */}
      <Group transform={rotationTransform}>
        {/* Subtle lift scale around piece center */}
        <Group transform={innerTransform}>
          <Path path={pieceData.path} color={pieceData.fillColor} style="fill" />
          {pieceData.strokeColor && (
            <Path
              path={pieceData.path}
              color={pieceData.strokeColor}
              style="stroke"
              strokeWidth={pieceData.strokeWidth}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Group>
      </Group>
    </Group>
  );
});
