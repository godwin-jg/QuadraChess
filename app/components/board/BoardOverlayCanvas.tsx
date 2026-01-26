import React, { useMemo } from "react";
import { StyleSheet } from "react-native";
import {
  Canvas,
  Circle,
  RoundedRect,
  Group,
} from "@shopify/react-native-skia";
import type { MoveInfo } from "../../../types";

interface BoardOverlayCanvasProps {
  boardSize: number;
  squareSize: number;
  // Valid moves to show as dots
  validMoves: MoveInfo[];
  // Selected piece position
  selectedPiece: { row: number; col: number } | null;
  selectedPieceColor: string | null;
  // Check status - which kings are in check
  checkSquares: Array<{ row: number; col: number }>;
  lastMove: { from: { row: number; col: number }; to: { row: number; col: number } } | null;
}

// Colors for valid move dots
const MOVE_DOT_COLOR = "rgba(107, 114, 128, 0.5)"; // gray-500/50
const CAPTURE_RING_COLORS: Record<string, string> = {
  r: "rgba(185, 28, 28, 0.35)",   // red
  b: "rgba(30, 64, 175, 0.35)",   // blue
  y: "rgba(124, 58, 237, 0.35)",  // purple
  g: "rgba(5, 150, 105, 0.35)",   // green
};

// Check overlay color
const CHECK_OVERLAY_COLOR = "rgba(239, 68, 68, 0.5)"; // red-500/50
const LAST_MOVE_FROM_COLOR = "rgba(99, 102, 241, 0.18)";
const LAST_MOVE_TO_COLOR = "rgba(99, 102, 241, 0.28)";

// Note: Selected square colors are now handled by Square.tsx to render behind pieces

/**
 * GPU-accelerated overlay canvas for board indicators.
 * Renders all overlays in a single Skia Canvas:
 * - Valid move dots (gray circles)
 * - Capture indicators (colored rings)
 * - Check overlay (red tint on king square)
 * - Selected square highlight
 */
const BoardOverlayCanvas = React.memo(function BoardOverlayCanvas({
  boardSize,
  squareSize,
  validMoves,
  selectedPiece,
  selectedPieceColor,
  checkSquares,
  lastMove,
}: BoardOverlayCanvasProps) {
  // Pre-calculate dot sizes
  const dotRadius = squareSize / 6; // 1/3 of square as diameter
  const captureRingRadius = squareSize * 0.4;
  const captureRingStroke = squareSize * 0.08;
  const lastMoveStroke = squareSize * 0.08;

  // Separate moves and captures
  const { moves, captures } = useMemo(() => {
    const moveList: MoveInfo[] = [];
    const captureList: MoveInfo[] = [];
    
    validMoves.forEach((move) => {
      if (move.isCapture) {
        captureList.push(move);
      } else {
        moveList.push(move);
      }
    });
    
    return { moves: moveList, captures: captureList };
  }, [validMoves]);

  // Get capture ring color based on piece color
  const captureColor = selectedPieceColor 
    ? CAPTURE_RING_COLORS[selectedPieceColor] || CAPTURE_RING_COLORS.g
    : CAPTURE_RING_COLORS.g;

  // Note: Selection highlight is handled by Square.tsx to render behind pieces

  // Early return if nothing to render
  const hasContent = 
    moves.length > 0 || 
    captures.length > 0 || 
    checkSquares.length > 0 ||
    !!lastMove;

  if (!hasContent) {
    return null;
  }

  return (
    <Canvas 
      style={[StyleSheet.absoluteFill, { zIndex: 1 }]}
      pointerEvents="none"
    >
      {/* Last move highlights */}
      {lastMove && (
        <Group>
          <RoundedRect
            x={lastMove.from.col * squareSize}
            y={lastMove.from.row * squareSize}
            width={squareSize}
            height={squareSize}
            r={0}
            color={LAST_MOVE_FROM_COLOR}
          />
          <RoundedRect
            x={lastMove.to.col * squareSize}
            y={lastMove.to.row * squareSize}
            width={squareSize}
            height={squareSize}
            r={0}
            color={LAST_MOVE_TO_COLOR}
            style="stroke"
            strokeWidth={lastMoveStroke}
          />
        </Group>
      )}

      {/* Check overlays */}
      {checkSquares.map((square, index) => (
        <RoundedRect
          key={`check-${index}`}
          x={square.col * squareSize}
          y={square.row * squareSize}
          width={squareSize}
          height={squareSize}
          r={0}
          color={CHECK_OVERLAY_COLOR}
        />
      ))}

      {/* Valid move dots (simple moves) */}
      <Group>
        {moves.map((move) => (
          <Circle
            key={`move-${move.row}-${move.col}`}
            cx={move.col * squareSize + squareSize / 2}
            cy={move.row * squareSize + squareSize / 2}
            r={dotRadius}
            color={MOVE_DOT_COLOR}
          />
        ))}
      </Group>

      {/* Capture indicators (rings around pieces that can be captured) */}
      <Group>
        {captures.map((capture) => (
          <Circle
            key={`capture-${capture.row}-${capture.col}`}
            cx={capture.col * squareSize + squareSize / 2}
            cy={capture.row * squareSize + squareSize / 2}
            r={captureRingRadius}
            color={captureColor}
            style="stroke"
            strokeWidth={captureRingStroke}
          />
        ))}
      </Group>
    </Canvas>
  );
});

export default BoardOverlayCanvas;
