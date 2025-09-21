import React from "react";
import Piece from "./Piece";
import { PIECE_CONFIG } from "./PieceConfig";

interface PieceRendererProps {
  piece: string;
  size: number;
  isEliminated?: boolean;
  useSVG?: boolean; // Override global config
}

/**
 * PieceRenderer - A wrapper component that handles piece rendering
 * with global configuration support
 */
export default function PieceRenderer({
  piece,
  size,
  isEliminated = false,
  useSVG,
}: PieceRendererProps) {
  // Use prop override or global config
  const shouldUseSVG =
    useSVG !== undefined ? useSVG : PIECE_CONFIG.USE_SVG_PIECES;

  return (
    <Piece
      piece={piece}
      size={size}
      isEliminated={isEliminated}
      useSVG={shouldUseSVG}
    />
  );
}

// Export the config for easy access
export { PIECE_CONFIG };

