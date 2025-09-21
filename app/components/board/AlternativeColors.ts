// Alternative color schemes for chess pieces
// These are optimized for different board styles and preferences

export const COLOR_SCHEMES = {
  // Current enhanced scheme (recommended)
  enhanced: {
    name: "Enhanced (Recommended)",
    description: "Optimized for brown board with excellent contrast",
    colors: {
      red: "#B91C1C", // Deep crimson
      blue: "#1E40AF", // Rich navy
      yellow: "#D97706", // Golden amber
      green: "#059669", // Forest green
    },
  },

  // Luxury scheme - more sophisticated
  luxury: {
    name: "Luxury",
    description: "Sophisticated colors with premium feel",
    colors: {
      red: "#991B1B", // Deep burgundy
      blue: "#1E3A8A", // Royal blue
      yellow: "#B45309", // Rich gold
      green: "#047857", // Deep emerald
    },
  },

  // High contrast scheme - maximum visibility
  highContrast: {
    name: "High Contrast",
    description: "Maximum visibility and accessibility",
    colors: {
      red: "#DC2626", // Bright red
      blue: "#2563EB", // Bright blue
      yellow: "#CA8A04", // Darker yellow
      green: "#16A34A", // Bright green
    },
  },

  // Warm scheme - cozy and inviting
  warm: {
    name: "Warm",
    description: "Warm, inviting colors for friendly games",
    colors: {
      red: "#DC2626", // Warm red
      blue: "#3B82F6", // Sky blue
      yellow: "#F59E0B", // Amber
      green: "#10B981", // Emerald
    },
  },

  // Cool scheme - modern and sleek
  cool: {
    name: "Cool",
    description: "Modern, sleek colors for contemporary feel",
    colors: {
      red: "#EF4444", // Modern red
      blue: "#6366F1", // Indigo
      yellow: "#F59E0B", // Amber
      green: "#22C55E", // Modern green
    },
  },

  // Monochrome scheme - elegant simplicity
  monochrome: {
    name: "Monochrome",
    description: "Elegant grayscale with subtle color hints",
    colors: {
      red: "#7F1D1D", // Dark red
      blue: "#1E3A8A", // Dark blue
      yellow: "#92400E", // Dark amber
      green: "#064E3B", // Dark green
    },
  },
};

// Helper function to get color scheme
export const getColorScheme = (schemeName: keyof typeof COLOR_SCHEMES) => {
  return COLOR_SCHEMES[schemeName] || COLOR_SCHEMES.enhanced;
};

// Helper function to get all available schemes
export const getAllColorSchemes = () => {
  return Object.entries(COLOR_SCHEMES).map(([key, scheme]) => ({
    key,
    ...scheme,
  }));
};

// Color accessibility helpers
export const getContrastRatio = (color1: string, color2: string): number => {
  // Simplified contrast ratio calculation
  // In a real implementation, you'd use proper color space calculations
  return 4.5; // Placeholder - would need proper implementation
};

export const isAccessible = (
  foreground: string,
  background: string
): boolean => {
  return getContrastRatio(foreground, background) >= 4.5;
};

