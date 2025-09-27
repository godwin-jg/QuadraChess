import { UserSettings } from "../../../services/settingsService";

export interface PieceStyleConfig {
  wooden: {
    red: { fill: string; stroke: string; strokeWidth: number };
    purple: { fill: string; stroke: string; strokeWidth: number };
    blue: {
      fill: string;
      stroke: string;
      strokeWidth: number;
      bandColor: string;
    };
    green: {
      fill: string;
      stroke: string;
      strokeWidth: number;
      bandColor: string;
    };
  };
  solid: {
    red: { fill: string; stroke: string; strokeWidth: number };
    purple: { fill: string; stroke: string; strokeWidth: number };
    blue: { fill: string; stroke: string; strokeWidth: number };
    green: { fill: string; stroke: string; strokeWidth: number };
  };
  "white-bordered": {
    red: { fill: string; stroke: string; strokeWidth: number };
    purple: { fill: string; stroke: string; strokeWidth: number };
    blue: { fill: string; stroke: string; strokeWidth: number };
    green: { fill: string; stroke: string; strokeWidth: number };
  };
  "black-bordered": {
    red: { fill: string; stroke: string; strokeWidth: number };
    purple: { fill: string; stroke: string; strokeWidth: number };
    blue: { fill: string; stroke: string; strokeWidth: number };
    green: { fill: string; stroke: string; strokeWidth: number };
  };
  "colored-bordered": {
    red: { fill: string; stroke: string; strokeWidth: number };
    purple: { fill: string; stroke: string; strokeWidth: number };
    blue: { fill: string; stroke: string; strokeWidth: number };
    green: { fill: string; stroke: string; strokeWidth: number };
  };
}

export const PIECE_STYLES: PieceStyleConfig = {
  wooden: {
    red: {
      fill: "url(#woodGradient)",
      stroke: "#8B4513",
      strokeWidth: 1,
      bandColor: "#B91C1C",
    },
    purple: {
      fill: "url(#woodGradient)",
      stroke: "#8B4513",
      strokeWidth: 1,
      bandColor: "#7C3AED",
    },
    blue: {
      fill: "url(#woodGradient)",
      stroke: "#8B4513",
      strokeWidth: 1,
      bandColor: "#06B6D4",
    },
    green: {
      fill: "url(#woodGradient)",
      stroke: "#8B4513",
      strokeWidth: 1,
      bandColor: "#10B981",
    },
  },
  solid: {
    red: { fill: "#B91C1C", stroke: "none", strokeWidth: 0 },
    purple: { fill: "#7C3AED", stroke: "none", strokeWidth: 0 },
    blue: { fill: "#1E40AF", stroke: "none", strokeWidth: 0 },
    green: { fill: "#059669", stroke: "none", strokeWidth: 0 },
  },
  "white-bordered": {
    red: { fill: "#B91C1C", stroke: "#ffffff", strokeWidth: 0.8 },
    purple: { fill: "#7C3AED", stroke: "#ffffff", strokeWidth: 0.8 },
    blue: { fill: "#1E40AF", stroke: "#ffffff", strokeWidth: 0.8 },
    green: { fill: "#059669", stroke: "#ffffff", strokeWidth: 0.8 },
  },
  "black-bordered": {
    red: { fill: "#B91C1C", stroke: "#000000", strokeWidth: 0.8 },
    purple: { fill: "#7C3AED", stroke: "#000000", strokeWidth: 0.8 },
    blue: { fill: "#1E40AF", stroke: "#000000", strokeWidth: 0.8 },
    green: { fill: "#059669", stroke: "#000000", strokeWidth: 0.8 },
  },
  "colored-bordered": {
    red: { fill: "#B91C1C", stroke: "#7F1D1D", strokeWidth: 0.8 }, // Darker red border
    purple: { fill: "#7C3AED", stroke: "#4C1D95", strokeWidth: 0.8 }, // Darker purple border
    blue: { fill: "#1E40AF", stroke: "#1E3A8A", strokeWidth: 0.8 }, // Darker blue border
    green: { fill: "#059669", stroke: "#064E3B", strokeWidth: 0.8 }, // Darker green border
  },
};

export const getPieceStyle = (settings: UserSettings, colorCode: string) => {
  const style = settings.pieces.style;
  const colorMap = {
    r: "red" as const,
    y: "purple" as const,
    b: "blue" as const,
    g: "green" as const,
  };

  const color = colorMap[colorCode as keyof typeof colorMap];
  if (!color) return PIECE_STYLES.solid.red;

  return PIECE_STYLES[style][color];
};

export const getPieceSize = (settings: UserSettings): number => {
  switch (settings.pieces.size) {
    case "small":
      return 0.8;
    case "medium":
      return 1.0;
    case "large":
      return 1.2;
    default:
      return 1.0;
  }
};
