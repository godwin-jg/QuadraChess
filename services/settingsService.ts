// Import the name generator
import { generateRandomName } from "../app/utils/nameGenerator";

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
    name: generateRandomName(),
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
    animationsEnabled: true,
    showMoveHints: true,
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
        this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
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
