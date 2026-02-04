// Import the name generator
import { getDefaultAnimationsEnabled } from "../app/utils/devicePerformance";
import { generateRandomName } from "../app/utils/nameGenerator";
import type { BotDifficulty } from "../config/gameConfig";

// Try to import AsyncStorage, fallback to in-memory storage
let AsyncStorage: {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
};

try {
  // Try to use the real AsyncStorage
  const AsyncStorageModule = require("@react-native-async-storage/async-storage");
  AsyncStorage = AsyncStorageModule.default || AsyncStorageModule;
} catch (error) {
  console.warn("AsyncStorage not available, using in-memory fallback:", error);

  // Fallback to in-memory storage
  const memoryStorage: { [key: string]: string } = {};
  AsyncStorage = {
    getItem: async (key: string): Promise<string | null> => {
      return memoryStorage[key] || null;
    },
    setItem: async (key: string, value: string): Promise<void> => {
      memoryStorage[key] = value;
    },
  };
}

export interface UserSettings {
  profile: {
    name: string;
    avatar?: string;
  };
  board: {
    theme: "brown" | "grey-white" | "green-ivory";
  };
  pieces: {
    style:
      | "wooden"
      | "solid"
      | "white-bordered"
      | "black-bordered"
      | "colored-bordered";
    size: "small" | "medium" | "large";
  };
  game: {
    soundEnabled: boolean;
    animationsEnabled: boolean;
    showMoveHints: boolean;
    hapticsEnabled: boolean;
    botDifficulty: BotDifficulty;
    botTeamMode: boolean; // If true, all bots cooperate against human
    tapToMoveEnabled: boolean;
    dragToMoveEnabled: boolean;
    premoveEnabled: boolean; // Allow queueing moves before your turn in online/p2p
  };
  accessibility: {
    highContrast: boolean;
    largeText: boolean;
    reducedMotion: boolean;
  };
  developer: {
    soloMode: boolean;
  };
}

const DEFAULT_SETTINGS: UserSettings = {
  profile: {
    name: (() => {
      try {
        return generateRandomName();
      } catch (error) {
        console.warn("Failed to generate random name, using fallback:", error);
        return "Player";
      }
    })(),
  },
  board: {
    theme: "brown",
  },
  pieces: {
    style: "colored-bordered",
    size: "medium",
  },
  game: {
    soundEnabled: true,
    animationsEnabled: getDefaultAnimationsEnabled(),
    showMoveHints: true,
    hapticsEnabled: true,
    botDifficulty: "easy",
    botTeamMode: false, // Default: bots play independently
    tapToMoveEnabled: true,
    dragToMoveEnabled: true,
    premoveEnabled: true, // Default: allow premoves in online/p2p
  },
  accessibility: {
    highContrast: false,
    largeText: false,
    reducedMotion: false,
  },
  developer: {
    soloMode: false,
  },
};

const normalizeGameSettings = (
  game: UserSettings["game"]
): UserSettings["game"] => {
  if (game.botDifficulty === "superHard" || game.botTeamMode) {
    return { ...game, botDifficulty: "superHard", botTeamMode: true };
  }
  return { ...game, botTeamMode: false };
};

const SETTINGS_KEY = "user_settings";

export class SettingsService {
  private static instance: SettingsService;
  private settings: UserSettings = DEFAULT_SETTINGS;

  static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  async loadSettings(): Promise<UserSettings> {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        const mergedGame = { ...DEFAULT_SETTINGS.game, ...(parsed.game || {}) };
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...parsed,
          profile: { ...DEFAULT_SETTINGS.profile, ...(parsed.profile || {}) },
          board: { ...DEFAULT_SETTINGS.board, ...(parsed.board || {}) },
          pieces: { ...DEFAULT_SETTINGS.pieces, ...(parsed.pieces || {}) },
          game: normalizeGameSettings(mergedGame),
          accessibility: {
            ...DEFAULT_SETTINGS.accessibility,
            ...(parsed.accessibility || {}),
          },
          developer: {
            ...DEFAULT_SETTINGS.developer,
            ...(parsed.developer || {}),
            soloMode: false, // Force reset: soloMode should always start disabled
          },
        };
      }
      return this.settings;
    } catch (error) {
      console.error("Failed to load settings:", error);
      return DEFAULT_SETTINGS;
    }
  }

  async saveSettings(settings: Partial<UserSettings>): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      this.settings.game = normalizeGameSettings(this.settings.game);
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch (error) {
      console.error("Failed to save settings:", error);
    }
  }

  getSettings(): UserSettings {
    return this.settings;
  }

  async updateProfile(
    profile: Partial<UserSettings["profile"]>
  ): Promise<void> {
    await this.saveSettings({
      profile: { ...this.settings.profile, ...profile },
    });
  }

  async updateBoard(board: Partial<UserSettings["board"]>): Promise<void> {
    await this.saveSettings({ board: { ...this.settings.board, ...board } });
  }

  async updatePieces(pieces: Partial<UserSettings["pieces"]>): Promise<void> {
    await this.saveSettings({ pieces: { ...this.settings.pieces, ...pieces } });
  }

  async updateGame(game: Partial<UserSettings["game"]>): Promise<void> {
    await this.saveSettings({ game: { ...this.settings.game, ...game } });
  }

  async updateAccessibility(
    accessibility: Partial<UserSettings["accessibility"]>
  ): Promise<void> {
    await this.saveSettings({
      accessibility: { ...this.settings.accessibility, ...accessibility },
    });
  }

  async resetToDefaults(): Promise<void> {
    this.settings = DEFAULT_SETTINGS;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
  }
}

export const settingsService = SettingsService.getInstance();
