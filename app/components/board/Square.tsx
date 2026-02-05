import React from "react";
import { Pressable, View } from "react-native";
import Animated, { useAnimatedStyle, type SharedValue } from "react-native-reanimated";
import { BoardTheme } from "./BoardThemeConfig";
import Piece from "./Piece";
import MiniPlayerCircle, { MINI_PLAYER_STACK_HEIGHT } from "../ui/MiniPlayerCircle";
import { getStaticPieceRotation } from "./PieceConfig";

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
    timeMs?: number;
    isTimerDisabled?: boolean;
  }>;
  boardRotation?: number;
  viewerColor?: string | null;
  visibilityMask?: SharedValue<number[]>;
}


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

type CornerPosition = "TL" | "TR" | "BL" | "BR";

const getCornerPosition = (row: number, col: number): CornerPosition | null => {
  if (row === 1 && col === 1) return "TL";
  if (row === 1 && col === 12) return "TR";
  if (row === 12 && col === 1) return "BL";
  if (row === 12 && col === 12) return "BR";
  return null;
};

const normalizeRotation = (rotation: number) => {
  const normalized = ((Math.round(rotation) % 360) + 360) % 360;
  const snapped = (Math.round(normalized / 90) * 90) % 360;
  return snapped;
};

const CORNER_ROTATION_MAP: Record<number, Record<CornerPosition, CornerPosition>> = {
  0: { TL: "TL", TR: "TR", BR: "BR", BL: "BL" },
  90: { TL: "TR", TR: "BR", BR: "BL", BL: "TL" },
  180: { TL: "BR", TR: "BL", BR: "TL", BL: "TR" },
  270: { TL: "BL", TR: "TL", BR: "TR", BL: "BR" },
};

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

  const corner = getCornerPosition(row, col);
  const rotation = normalizeRotation(boardRotation);
  const screenCorner = corner
    ? CORNER_ROTATION_MAP[rotation]?.[corner] ?? corner
    : null;
  const baseOffset =
    screenCorner === "TL" || screenCorner === "TR"
      ? -Math.round(size * 0.25)
      : screenCorner === "BL" || screenCorner === "BR"
        ? Math.round(size * 0.25)
        : 0;
  let verticalOffset = baseOffset;
  if (screenCorner === "TL" || screenCorner === "TR") {
    const minInnerGap = Math.max(4, Math.round(size * 0.12));
    const maxBottomFromCenter = size * 1.5 - minInnerGap;
    const baseBottomFromCenter = MINI_PLAYER_STACK_HEIGHT / 2 + baseOffset;
    if (baseBottomFromCenter > maxBottomFromCenter) {
      verticalOffset -= baseBottomFromCenter - maxBottomFromCenter;
    }
  }

  // Container is the size of a single square, but the avatar overflows
  // The avatar counter-rotates to stay upright when the board rotates
  return (
    <View
      style={{
        width: size,
        height: size,
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        overflow: "visible",
      }}
    >
      <Animated.View 
        style={{ 
          transform: [{ rotate: `${-boardRotation}deg` }, { translateY: verticalOffset }],
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <MiniPlayerCircle
          player={player}
          isCurrentTurn={player.isCurrentTurn}
          isEliminated={player.isEliminated}
          boardRotation={boardRotation}
          timeMs={player.timeMs}
          isTimerDisabled={player.isTimerDisabled}
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
  viewerColor = null,
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
    };
  }, [row, col, visibilityMask]);

  const rotationDegrees = piece
    ? getStaticPieceRotation(piece[0], viewerColor)
    : 0;

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
            {/* Keep rotation on a non-animated View to update immediately */}
            <View style={{ transform: [{ rotate: `${rotationDegrees}deg` }] }}>
              <Piece piece={piece} size={size} isEliminated={isEliminated} isSelected={isSelected} />
            </View>
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
