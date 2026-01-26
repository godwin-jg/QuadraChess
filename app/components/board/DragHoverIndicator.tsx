import React from "react";
import { View } from "react-native";
import { DRAG_ACCENT, LEGAL_DOT_RATIO, type DragAccentColor } from "./boardConstants";

export interface DragTarget {
  row: number;
  col: number;
  type: "move" | "capture";
}

interface DragHoverIndicatorProps {
  dragHover: DragTarget;
  squareSize: number;
  pieceColor?: string;
}

/**
 * Visual indicator shown when dragging a piece over a valid move target.
 * Shows a ring and dot with color indicating move or capture.
 */
const DragHoverIndicator = React.memo(function DragHoverIndicator({
  dragHover,
  squareSize,
  pieceColor,
}: DragHoverIndicatorProps) {
  const dragAccent =
    DRAG_ACCENT[pieceColor as DragAccentColor] ?? DRAG_ACCENT.g;

  const isCapture = dragHover.type === "capture";
  const ringSize = squareSize * 2;
  const dotSize = squareSize * LEGAL_DOT_RATIO;

  return (
    <View
      pointerEvents="none"
      style={{
        position: "absolute",
        left: dragHover.col * squareSize,
        top: dragHover.row * squareSize,
        width: squareSize,
        height: squareSize,
        zIndex: 2,
      }}
    >
      {/* Outer ring */}
      <View
        style={{
          position: "absolute",
          left: (squareSize - ringSize) / 2,
          top: (squareSize - ringSize) / 2,
          width: ringSize,
          height: ringSize,
          borderRadius: squareSize,
          backgroundColor: isCapture
            ? "rgba(239, 68, 68, 0.12)"
            : `${dragAccent.border}33`,
          borderWidth: 2,
          borderColor: isCapture
            ? "rgba(239, 68, 68, 0.45)"
            : `${dragAccent.border}66`,
        }}
      />
      {/* Center dot */}
      <View
        style={{
          position: "absolute",
          left: (squareSize - dotSize) / 2,
          top: (squareSize - dotSize) / 2,
          width: dotSize,
          height: dotSize,
          borderRadius: dotSize / 2,
          backgroundColor: isCapture
            ? "rgba(239, 68, 68, 0.55)"
            : `${dragAccent.border}88`,
          shadowColor: isCapture ? "#ef4444" : dragAccent.border,
          shadowOpacity: 0.35,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 2 },
          elevation: 4,
        }}
      />
    </View>
  );
});

export default DragHoverIndicator;
