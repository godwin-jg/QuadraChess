import React from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { BoardTheme } from "./BoardThemeConfig";
import Piece from "./Piece";
import MiniPlayerCircle from "../ui/MiniPlayerCircle";

interface SquareProps {
  piece: string | null;
  color: "light" | "dark";
  size: number;
  row: number;
  col: number;
  isSelected?: boolean;
  moveType?: "move" | "capture" | null;
  isInCheck?: boolean;
  capturingPieceColor?: string;
  isEliminated?: boolean;
  isInteractable?: boolean;
  dragTargetType?: "move" | "capture" | null;
  dragHighlightColor?: string;
  pressEnabled?: boolean;
  onPress?: () => void;
  onHover?: () => void;
  onHoverOut?: () => void;
  boardTheme?: BoardTheme;
  playerData?: Array<{
    name: string;
    color: string;
    score: number;
    capturedPieces: string[];
    isCurrentTurn: boolean;
    isEliminated: boolean;
  }>;
  boardRotation?: number;
  visibilityMask?: SharedValue<number[]>;
}

const ROTATION_CONFIGS: Record<number, { topLeft: { x: number; y: number }; topRight: { x: number; y: number }; bottomLeft: { x: number; y: number }; bottomRight: { x: number; y: number } }> = {
  0: { topLeft: { x: -5, y: -10 }, topRight: { x: 3, y: -12 }, bottomLeft: { x: -5, y: 0 }, bottomRight: { x: 3, y: 0 } },
  [-90]: { topLeft: { x: 5, y: 0 }, topRight: { x: 3, y: 8 }, bottomLeft: { x: -5, y: 0 }, bottomRight: { x: -5, y: 12 } },
  [-180]: { topLeft: { x: 5, y: 0 }, topRight: { x: -3, y: 0 }, bottomLeft: { x: 8, y: -12 }, bottomRight: { x: -3, y: -9 } },
  [-270]: { topLeft: { x: -3, y: 8 }, topRight: { x: -3, y: 3 }, bottomLeft: { x: 3, y: 8 }, bottomRight: { x: 3, y: 3 } },
};

const isCornerSquare = (row: number, col: number) =>
  (row < 3 && col < 3) ||
  (row < 3 && col > 10) ||
  (row > 10 && col < 3) ||
  (row > 10 && col > 10);

const isCornerCenter = (row: number, col: number) =>
  (row === 1 && col === 1) ||
  (row === 1 && col === 12) ||
  (row === 12 && col === 1) ||
  (row === 12 && col === 12);

const getCornerPlayer = (
  row: number,
  col: number,
  playerData: SquareProps["playerData"]
) => {
  if (!playerData) return null;
  if (row === 1 && col === 1) return playerData.find((p) => p.color === "y");
  if (row === 1 && col === 12) return playerData.find((p) => p.color === "g");
  if (row === 12 && col === 1) return playerData.find((p) => p.color === "b");
  if (row === 12 && col === 12) return playerData.find((p) => p.color === "r");
  return null;
};

const getCornerOffset = (row: number, col: number, boardRotation: number) => {
  const offsets = ROTATION_CONFIGS[boardRotation] || ROTATION_CONFIGS[0];
  if (row === 1 && col === 1) return offsets.topLeft;
  if (row === 1 && col === 12) return offsets.topRight;
  if (row === 12 && col === 1) return offsets.bottomLeft;
  if (row === 12 && col === 12) return offsets.bottomRight;
  return { x: 0, y: 0 };
};

const CornerSquare = React.memo(function CornerSquare({
  row,
  col,
  size,
  playerData,
  boardRotation = 0,
}: Pick<SquareProps, "row" | "col" | "size" | "playerData" | "boardRotation">) {
  const player = getCornerPlayer(row, col, playerData);
  if (!player) {
    return <View style={{ width: size, height: size, backgroundColor: "transparent" }} />;
  }

  const cornerOffset = getCornerOffset(row, col, boardRotation);
  const radians = (boardRotation * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  const translateX = cornerOffset.x * cos - cornerOffset.y * sin;
  const translateY = cornerOffset.x * sin + cornerOffset.y * cos;

  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        alignSelf: "center",
        overflow: "visible",
      }}
    >
      <Animated.View style={{ transform: [{ translateX }, { translateY }, { rotate: `${-boardRotation}deg` }] }}>
        <MiniPlayerCircle
          player={player}
          isCurrentTurn={player.isCurrentTurn}
          isEliminated={player.isEliminated}
          boardRotation={boardRotation}
        />
      </Animated.View>
    </View>
  );
});

const PlayableSquare = React.memo(function PlayableSquare({
  piece,
  color,
  size,
  row,
  col,
  isSelected = false,
  moveType = null,
  capturingPieceColor,
  isEliminated = false,
  isInteractable = true,
  pressEnabled = true,
  onPress,
  onHover,
  onHoverOut,
  boardTheme,
  boardRotation = 0,
  visibilityMask,
}: SquareProps) {
  const getCaptureBackgroundColor = (capturingColor: string) => {
    switch (capturingColor) {
      case "r":
        return "#fecaca";
      case "b":
        return "#bfdbfe";
      case "y":
        return "#fef3c7";
      case "g":
        return "#bbf7d0";
      default:
        return color === "light"
          ? boardTheme?.lightSquare || "#f0d9b5"
          : boardTheme?.darkSquare || "#b58863";
    }
  };

  const getBackgroundColor = () => {
    if (isSelected && piece) {
      switch (piece[0]) {
        case "r":
          return "#fecaca";
        case "b":
          return "#bfdbfe";
        case "y":
          return "#fef3c7";
        case "g":
          return "#bbf7d0";
        default:
          return color === "light"
            ? boardTheme?.lightSquare || "#f0d9b5"
            : boardTheme?.darkSquare || "#b58863";
      }
    }
    if (moveType === "capture" && capturingPieceColor) {
      return getCaptureBackgroundColor(capturingPieceColor);
    }
    return color === "light"
      ? boardTheme?.lightSquare || "#f0d9b5"
      : boardTheme?.darkSquare || "#b58863";
  };

  const pieceStyle = useAnimatedStyle(() => {
    const currentIndex = row * 14 + col;
    const isHiddenByMask =
      visibilityMask ? visibilityMask.value[currentIndex] === 1 : false;
    return {
      opacity: isHiddenByMask ? 0 : 1,
      transform: [{ rotate: `${-boardRotation}deg` }],
    };
  }, [boardRotation, row, col, visibilityMask]);

  const pressSlopX = Math.max(10, Math.round(size * 0.25));
  const allowInteraction = isInteractable && pressEnabled;

  return (
    <Pressable
      onPress={allowInteraction ? onPress : undefined}
      onHoverIn={allowInteraction ? onHover : undefined}
      onHoverOut={allowInteraction ? onHoverOut : undefined}
      hitSlop={{ left: pressSlopX, right: pressSlopX }}
      style={({ pressed }) => ({
        opacity: !isInteractable ? 0.6 : pressEnabled && pressed ? 0.8 : 1,
        transform: [{ scale: !isInteractable ? 1 : 1 }],
      })}
    >
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: getBackgroundColor(),
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {piece && (
          <Animated.View style={[pieceStyle, { zIndex: 1 }]}>
            <Piece piece={piece} size={size} isEliminated={isEliminated} isSelected={isSelected} />
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
});

const Square = React.memo(function Square(props: SquareProps) {
  if (isCornerSquare(props.row, props.col)) {
    if (isCornerCenter(props.row, props.col)) {
      return (
        <CornerSquare
          row={props.row}
          col={props.col}
          size={props.size}
          playerData={props.playerData}
          boardRotation={props.boardRotation}
        />
      );
    }
    return <View style={{ width: props.size, height: props.size, backgroundColor: "transparent" }} />;
  }
  return <PlayableSquare {...props} />;
});

export default Square;
