import React from "react";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Piece from "./Piece";

interface DraggedPieceProps {
  piece: string;
  size: number;
  boardRotation: number;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  dragScale: SharedValue<number>;
  dragOffsetY: SharedValue<number>;
}

/**
 * Animated piece that follows the user's finger during drag.
 * Renders above the board with proper rotation and scaling.
 */
const DraggedPiece = React.memo(function DraggedPiece({
  piece,
  size,
  boardRotation,
  dragX,
  dragY,
  dragScale,
  dragOffsetY,
}: DraggedPieceProps) {
  const dragStyle = useAnimatedStyle(() => ({
    position: "absolute",
    transform: [
      { translateX: dragX.value },
      { translateY: dragY.value + dragOffsetY.value },
      { scale: dragScale.value },
    ],
    zIndex: 3,
  }));

  return (
    <Animated.View pointerEvents="none" style={dragStyle}>
      <Animated.View style={{ transform: [{ rotate: `${-boardRotation}deg` }] }}>
        <Piece piece={piece} size={size} />
      </Animated.View>
    </Animated.View>
  );
});

export default DraggedPiece;
