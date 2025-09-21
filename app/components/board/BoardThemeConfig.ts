import { UserSettings } from "../../../services/settingsService";

export interface BoardTheme {
  lightSquare: string;
  darkSquare: string;
  borderColor: string;
  highlightColor: string;
  selectedColor: string;
  moveHintColor: string;
}

export const BOARD_THEMES: Record<UserSettings["board"]["theme"], BoardTheme> =
  {
    brown: {
      lightSquare: "#F0D9B5",
      darkSquare: "#B58863",
      borderColor: "#8B4513",
      highlightColor: "#FEF3C7",
      selectedColor: "#FDE68A",
      moveHintColor: "#A7F3D0",
    },
    "grey-white": {
      lightSquare: "#F5F5F5",
      darkSquare: "#9E9E9E",
      borderColor: "#616161",
      highlightColor: "#E0E0E0",
      selectedColor: "#BDBDBD",
      moveHintColor: "#C8E6C9",
    },
    "green-ivory": {
      lightSquare: "#F0F0F0", // Ivory
      darkSquare: "#4A7C59", // Green
      borderColor: "#2D5A3D",
      highlightColor: "#E8F5E8",
      selectedColor: "#C8E6C9",
      moveHintColor: "#A7F3D0",
    },
  };

export const getBoardTheme = (settings: UserSettings): BoardTheme => {
  return BOARD_THEMES[settings.board.theme];
};
