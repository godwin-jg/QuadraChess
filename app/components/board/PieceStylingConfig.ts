/**
 * Configuration for different piece styling approaches
 */

export type PieceStylingMode =
  | "solid" // Full solid color (current approach)
  | "gradient" // Gradient fill
  | "accent" // Colored accents on dark base
  | "outline" // Colored outline on dark base
  | "wood" // Wooden pieces with colored bands
  | "metallic"; // Metallic finish with colored highlights

export interface PieceStylingConfig {
  mode: PieceStylingMode;
  // Gradient settings
  gradient: {
    enabled: boolean;
    direction: "vertical" | "horizontal" | "diagonal";
    intensity: number; // 0-1, how much gradient effect
  };
  // Accent settings
  accent: {
    enabled: boolean;
    parts: ("crown" | "base" | "details" | "outline")[];
    opacity: number; // 0-1
  };
  // Outline settings
  outline: {
    enabled: boolean;
    width: number;
    style: "solid" | "dashed" | "dotted";
  };
  // Wood settings
  wood: {
    enabled: boolean;
    grain: boolean;
    coloredBands: boolean;
  };
  // Metallic settings
  metallic: {
    enabled: boolean;
    finish: "brushed" | "polished" | "matte";
    coloredHighlights: boolean;
  };
}

export const PIECE_STYLING_CONFIG: PieceStylingConfig = {
  mode: "gradient", // Change this to switch styling modes

  gradient: {
    enabled: true,
    direction: "diagonal",
    intensity: 0.7,
  },

  accent: {
    enabled: false,
    parts: ["crown", "details"],
    opacity: 0.8,
  },

  outline: {
    enabled: false,
    width: 2,
    style: "solid",
  },

  wood: {
    enabled: false,
    grain: true,
    coloredBands: true,
  },

  metallic: {
    enabled: false,
    finish: "brushed",
    coloredHighlights: true,
  },
};

// Color schemes for different styling modes
export const STYLING_COLORS = {
  solid: {
    red: "#B91C1C",
    blue: "#1E40AF",
    purple: "#7C3AED",
    green: "#059669",
  },
  gradient: {
    red: { start: "#DC2626", end: "#B91C1C" },
    blue: { start: "#2563EB", end: "#1E40AF" },
    purple: { start: "#8B5CF6", end: "#7C3AED" },
    green: { start: "#10B981", end: "#059669" },
  },
  accent: {
    red: "#B91C1C",
    blue: "#1E40AF",
    purple: "#7C3AED",
    green: "#059669",
    base: "#1f2937", // Dark base color
  },
  outline: {
    red: "#B91C1C",
    blue: "#1E40AF",
    purple: "#7C3AED",
    green: "#059669",
    base: "#1f2937", // Dark base color
  },
  wood: {
    base: "#D2B48C", // Light wood
    dark: "#8B4513", // Dark wood
    red: "#B91C1C",
    blue: "#1E40AF",
    purple: "#7C3AED",
    green: "#059669",
  },
  metallic: {
    base: "#C0C0C0", // Silver base
    red: "#B91C1C",
    blue: "#1E40AF",
    purple: "#7C3AED",
    green: "#059669",
  },
};

// Helper function to get colors based on current styling mode
export const getStylingColors = (pieceColor: string) => {
  const mode = PIECE_STYLING_CONFIG.mode;
  const colors = STYLING_COLORS[mode];

  switch (pieceColor) {
    case "r":
      return colors.red;
    case "b":
      return colors.blue;
    case "y":
      return colors.purple;
    case "g":
      return colors.green;
    default:
      return colors.red;
  }
};

// Helper function to check if a styling feature is enabled
export const isStylingEnabled = (feature: keyof PieceStylingConfig) => {
  const config = PIECE_STYLING_CONFIG[feature];
  return typeof config === "object" && "enabled" in config
    ? config.enabled
    : false;
};
