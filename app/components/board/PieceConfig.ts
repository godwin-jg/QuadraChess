// Piece Configuration
// This file controls how chess pieces are displayed

export const PIECE_CONFIG = {
  // Set to true to use SVG pieces, false to use Unicode symbols
  USE_SVG_PIECES: true,

  // SVG settings
  SVG: {
    // Base size multiplier for SVG pieces - MAXIMUM SIZE for maximum visibility
    SIZE_MULTIPLIER: 1.0,
    // ViewBox for SVG pieces (should match your SVG files)
    VIEW_BOX: "0 0 48 48",
    // Stroke outline for better visibility - Enhanced options
    STROKE: {
      // Option 1: Dark gray - more elegant than black
      color: "#374151", // Dark gray
      width: 0.8,
      // Option 2: Subtle dark outline
      // color: "#1f2937", // Very dark gray
      // width: 0.6,
      // Option 3: Warm dark outline
      // color: "#374151", // Dark gray with slight warmth
      // width: 0.7,
      // Option 4: No outline (clean look)
      // color: "transparent",
      // width: 0,
    },
    // Enhanced visual effects
    EFFECTS: {
      // Drop shadow for 3D effect
      DROP_SHADOW: {
        enabled: true,
        color: "rgba(0, 0, 0, 0.4)",
        offset: { width: 2, height: 4 },
        blur: 6,
      },
      // Glow effect for selected pieces
      GLOW: {
        enabled: true,
        color: "rgba(59, 130, 246, 0.5)", // Blue glow
        radius: 8,
      },
    },
  },

  // Unicode symbol settings
  UNICODE: {
    // Font size multiplier for Unicode pieces - MAXIMUM SIZE for maximum visibility
    FONT_SIZE_MULTIPLIER: 1.0,
    // Font weight for Unicode pieces
    FONT_WEIGHT: "bold" as const,
    // Text stroke outline for better visibility - Enhanced options
    TEXT_STROKE: {
      // Option 1: Dark gray - more elegant than black
      color: "#374151", // Dark gray
      width: 1.2,
      // Option 2: Subtle dark outline
      // color: "#1f2937", // Very dark gray
      // width: 1,
      // Option 3: Warm dark outline
      // color: "#4b5563", // Medium gray
      // width: 1.5,
      // Option 4: No outline (clean look)
      // color: "transparent",
      // width: 0,
    },
    // Enhanced visual effects for Unicode
    EFFECTS: {
      // Drop shadow for 3D effect
      DROP_SHADOW: {
        enabled: true,
        color: "rgba(0, 0, 0, 0.5)",
        offset: { width: 2, height: 3 },
        blur: 4,
      },
      // Glow effect for selected pieces
      GLOW: {
        enabled: true,
        color: "rgba(59, 130, 246, 0.6)",
        radius: 6,
      },
    },
  },

  // Color settings - Enhanced for better contrast and elegance
  COLORS: {
    // Red - Deep crimson for elegance and contrast
    red: "#B91C1C", // Slightly darker, more sophisticated
    // Blue - Rich navy for excellent contrast
    blue: "#1E40AF", // Deeper blue, better on brown board
    // Purple - Rich purple instead of yellow (much better visibility!)
    purple: "#7C3AED", // Deep purple, excellent contrast on both light and dark squares
    // Green - Forest green for better contrast
    green: "#059669", // Deeper green, more professional
    // Eliminated pieces
    eliminated: "#9CA3AF",
  },

  // Shadow settings for Unicode pieces
  SHADOW: {
    color: "#000",
    offset: { width: 0.4, height: 0.4 },
    radius: 1,
  },

  // Eliminated piece shadow
  ELIMINATED_SHADOW: {
    color: "#6B7280",
    offset: { width: 0.4, height: 0.4 },
    radius: 1,
  },

  // Animation settings
  ANIMATION: {
    // Enable smooth animations
    ENABLED: true,
    // Animation duration in milliseconds
    DURATION: 200,
    // Easing function
    EASING: "ease-in-out",
  },

  // Accessibility settings
  ACCESSIBILITY: {
    // High contrast mode
    HIGH_CONTRAST: false,
    // Reduced motion for accessibility
    REDUCE_MOTION: false,
    // Larger touch targets
    LARGE_TOUCH_TARGETS: true,
  },

  // Theme settings
  THEME: {
    // Current theme
    CURRENT: "classic",
    // Available themes
    THEMES: {
      classic: "Classic",
      modern: "Modern",
      minimal: "Minimal",
      luxury: "Luxury",
    },
  },
};

// Helper function to get piece color
export const getPieceColor = (piece: string): string => {
  const color = piece[0];
  switch (color) {
    case "r":
      return PIECE_CONFIG.COLORS.red;
    case "b":
      return PIECE_CONFIG.COLORS.blue;
    case "y":
      return PIECE_CONFIG.COLORS.purple; // Changed from yellow to purple
    case "g":
      return PIECE_CONFIG.COLORS.green;
    default:
      return "#000";
  }
};

// Helper function to determine if piece should use dark or light SVG
export const getPieceFolder = (piece: string): "dark" | "light" => {
  const color = piece[0];
  return ["r", "b"].includes(color) ? "dark" : "light";
};

// Helper function to get piece type
export const getPieceType = (piece: string): string => {
  const pieceType = piece[1];
  switch (pieceType) {
    case "R":
      return "rook";
    case "N":
      return "knight";
    case "B":
      return "bishop";
    case "Q":
      return "queen";
    case "K":
      return "king";
    case "P":
      return "pawn";
    default:
      return "pawn";
  }
};
