import React, { useEffect, useMemo } from "react";
import { View } from "react-native";
import Animated, {
  runOnJS,
  runOnUI,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from "react-native-reanimated";
import { ANIMATION_DURATIONS } from "../../../config/gameConfig";
import Piece from "./Piece";
import { AnimPlan, keyToRowCol } from "./chessgroundAnimations";
import { getAnimationPieceRotation } from "./PieceConfig";

type MovingPiece = {
  key: number;
  piece: string;
  vector: [number, number];
  baseX: number;
  baseY: number;
};

type FadingPiece = {
  key: number;
  piece: string;
  baseX: number;
  baseY: number;
};

interface MoveAnimatorProps {
  plan: AnimPlan | null;
  piecesMap: Map<number, string>;
  movePieceOverrides?: Map<number, string> | null;
  squareSize: number;
  viewerColor?: string | null;
  onComplete: () => void;
  animationRunning?: SharedValue<number>;
  onCompleteUI?: () => void;
}

const CAPTURE_RING_COLOR = "rgba(255, 255, 255, 0.4)";
const moveEasing = Easing.inOut(Easing.cubic);

const CaptureRing = React.memo(function CaptureRing({
  squareSize,
  progress,
}: {
  squareSize: number;
  progress: SharedValue<number>;
}) {
  const ringSize = squareSize * 0.8;
  const ringInset = (squareSize - ringSize) / 2;
  const ringWidth = Math.max(1, Math.round(squareSize * 0.08));
  const style = useAnimatedStyle(() => {
    const t = 1 - progress.value;
    return {
      position: "absolute",
      width: ringSize,
      height: ringSize,
      borderRadius: ringSize / 2,
      borderWidth: ringWidth,
      borderColor: CAPTURE_RING_COLOR,
      opacity: progress.value,
      transform: [
        { translateX: ringInset },
        { translateY: ringInset },
        { scale: 1 + t * 0.2 },
      ],
    };
  });
  return <Animated.View pointerEvents="none" style={style} />;
});

const MovingPieceView = React.memo(function MovingPieceView({
  piece,
  baseX,
  baseY,
  vector,
  squareSize,
  progress,
  viewerColor = null,
}: {
  piece: string;
  baseX: number;
  baseY: number;
  vector: [number, number];
  squareSize: number;
  progress: SharedValue<number>;
  viewerColor?: string | null;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    transform: [
      { translateX: baseX + vector[0] * squareSize * progress.value },
      { translateY: baseY + vector[1] * squareSize * progress.value },
    ],
  }));

  const rotationDegrees = getAnimationPieceRotation(piece[0], viewerColor);
  const liftStyle = useAnimatedStyle(() => {
    const lift = Math.sin(Math.PI * progress.value);
    return {
      transform: [
        { scale: 1 + lift * 0.04 },
      ],
    };
  });

  return (
    <Animated.View style={animatedStyle}>
      {/* Keep rotation on a non-animated View to update immediately */}
      <View style={{ transform: [{ rotate: `${rotationDegrees}deg` }] }}>
        <Animated.View style={liftStyle}>
          <Piece piece={piece} size={squareSize} />
        </Animated.View>
      </View>
    </Animated.View>
  );
});

const FadingPieceView = React.memo(function FadingPieceView({
  piece,
  baseX,
  baseY,
  squareSize,
  progress,
  viewerColor = null,
}: {
  piece: string;
  baseX: number;
  baseY: number;
  squareSize: number;
  progress: SharedValue<number>;
  viewerColor?: string | null;
}) {
  const animatedStyle = useAnimatedStyle(() => ({
    position: "absolute",
    opacity: progress.value,
    transform: [{ translateX: baseX }, { translateY: baseY }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      {/* Keep rotation on a non-animated View to update immediately */}
      <View
        style={{
          transform: [{ rotate: `${getAnimationPieceRotation(piece[0], viewerColor)}deg` }],
        }}
      >
        <Piece piece={piece} size={squareSize} />
      </View>
    </Animated.View>
  );
});

export default function MoveAnimator({
  plan,
  piecesMap,
  movePieceOverrides,
  squareSize,
  viewerColor = null,
  onComplete,
  animationRunning,
  onCompleteUI,
}: MoveAnimatorProps) {
  // Use refs to avoid re-running effect when callbacks change
  const onCompleteRef = React.useRef(onComplete);
  React.useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);
  
  const progress = useSharedValue(1);
  const completedRef = React.useRef(false);

  const movingPieces = useMemo<MovingPiece[]>(() => {
    if (!plan) return [];
    return Array.from(plan.anims.entries())
      .map(([key, vector]) => {
        const piece = movePieceOverrides?.get(key) ?? piecesMap.get(key);
        if (!piece) return null;
        const { row, col } = keyToRowCol(key);
        return {
          key,
          piece,
          vector: [vector[0], vector[1]],
          baseX: col * squareSize,
          baseY: row * squareSize,
        };
      })
      .filter((entry): entry is MovingPiece => !!entry);
  }, [plan, piecesMap, movePieceOverrides, squareSize]);

  const fadingPieces = useMemo<FadingPiece[]>(() => {
    if (!plan) return [];
    return Array.from(plan.fadings.entries()).map(([key, piece]) => {
      const { row, col } = keyToRowCol(key);
      return {
        key,
        piece,
        baseX: col * squareSize,
        baseY: row * squareSize,
      };
    });
  }, [plan, squareSize]);

  const hasCaptureEffect = !!plan && plan.fadings.size > 0;

  useEffect(() => {
    if (!plan) return;
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
    progress.value = 1;
    let frameId: number | null = null;
    frameId = requestAnimationFrame(() => {
      progress.value = withTiming(
        0,
        { duration: ANIMATION_DURATIONS.PIECE_MOVE, easing: moveEasing },
        (finished) => {
          if (finished) {
            if (animationRunning) {
              animationRunning.value = 0;
            }
            if (onCompleteUI) {
              onCompleteUI();
            }
            runOnJS(completeOnce)();
          }
        }
      );
    });
    return () => {
      // If the animator unmounts early (e.g. drag starts), finalize once
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
      if (!completedRef.current) {
        if (onCompleteUI) {
          runOnUI(onCompleteUI)();
        }
        completeOnce();
      }
    };
  }, [plan, progress, animationRunning, onCompleteUI]);

  if (!plan) {
    return null;
  }

  return (
    <View pointerEvents="none" style={{ position: "absolute", inset: 0, zIndex: 2 }}>
      {movingPieces.map((pieceData) => (
        <MovingPieceView
          key={`move-${pieceData.key}`}
          piece={pieceData.piece}
          baseX={pieceData.baseX}
          baseY={pieceData.baseY}
          vector={pieceData.vector}
          squareSize={squareSize}
          progress={progress}
          viewerColor={viewerColor}
        />
      ))}
      {fadingPieces.map((pieceData) => (
        <FadingPieceView
          key={`fade-${pieceData.key}`}
          piece={pieceData.piece}
          baseX={pieceData.baseX}
          baseY={pieceData.baseY}
          squareSize={squareSize}
          progress={progress}
          viewerColor={viewerColor}
        />
      ))}
      {hasCaptureEffect &&
        Array.from(plan.fadings.keys()).map((key) => {
          const { row, col } = keyToRowCol(key);
          return (
            <View
              key={`capture-burst-${key}`}
              pointerEvents="none"
              style={{
                position: "absolute",
                left: col * squareSize,
                top: row * squareSize,
                width: squareSize,
                height: squareSize,
              }}
            >
              <CaptureRing squareSize={squareSize} progress={progress} />
            </View>
          );
        })}
    </View>
  );
}
