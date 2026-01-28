import React from "react";
import { View } from "react-native";
import Animated, {
  type SharedValue,
  useAnimatedStyle,
} from "react-native-reanimated";
import Piece from "./Piece";
import { getDragPieceRotation } from "./PieceConfig";

interface DraggedPieceProps {
  piece: string;
  size: number;
  viewerColor?: string | null;
  dragX: SharedValue<number>;
  dragY: SharedValue<number>;
  dragScale: SharedValue<number>;
  dragOffsetX: SharedValue<number>;
  dragOffsetY: SharedValue<number>;
}

/**
 * Animated piece that follows the user's finger during drag.
 * Renders above the board with proper rotation and scaling.
 */
const DraggedPiece = React.memo(function DraggedPiece({
  piece,
  size,
  viewerColor = null,
  dragX,
  dragY,
  dragScale,
  dragOffsetX,
  dragOffsetY,
}: DraggedPieceProps) {
  const dragStyle = useAnimatedStyle(() => ({
    position: "absolute",
    transform: [
      { translateX: dragX.value + dragOffsetX.value },
      { translateY: dragY.value + dragOffsetY.value },
      { scale: dragScale.value },
    ],
    zIndex: 3,
  }));

  const rotationDegrees = getDragPieceRotation(piece[0], viewerColor);

  return (
    <Animated.View pointerEvents="none" style={dragStyle}>
      {/* Rotate to match static pieces via configurable per-color rotation */}
      <View style={{ transform: [{ rotate: `${rotationDegrees}deg` }] }}>
        <Piece piece={piece} size={size} />
      </View>
    </Animated.View>
  );
});

export default DraggedPiece;
