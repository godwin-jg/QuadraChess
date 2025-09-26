import { useState, useEffect } from "react";
import { settingsService, UserSettings } from "../services/settingsService";

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(
    settingsService.getSettings()
  );
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await settingsService.loadSettings();
        setSettings(loadedSettings);
      } catch (error) {
        console.warn("Failed to load settings, using defaults:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const updateSettings = async (updates: Partial<UserSettings>) => {
    try {
      const newSettings = { ...settings, ...updates };
      // Update UI immediately for instant feedback
      setSettings(newSettings);
      // Mark as having unsaved changes
      setHasUnsavedChanges(true);
    } catch (error) {
      console.error("Failed to update settings:", error);
    }
  };

  const saveSettings = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      await settingsService.saveSettings(settings);
      setHasUnsavedChanges(false);
      console.log("Settings saved successfully");
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = () => {
    // Reload settings from storage
    settingsService.loadSettings().then((loadedSettings) => {
      setSettings(loadedSettings);
      setHasUnsavedChanges(false);
    });
  };

  const updateProfile = async (profile: Partial<UserSettings["profile"]>) => {
    await updateSettings({
      profile: { ...settings.profile, ...profile },
    });
  };

  const updateBoard = async (board: Partial<UserSettings["board"]>) => {
    await updateSettings({
      board: { ...settings.board, ...board },
    });
  };

  const updatePieces = async (pieces: Partial<UserSettings["pieces"]>) => {
    await updateSettings({
      pieces: { ...settings.pieces, ...pieces },
    });
  };

  const updateGame = async (game: Partial<UserSettings["game"]>) => {
    await updateSettings({
      game: { ...settings.game, ...game },
    });
  };

  const updateAccessibility = async (
    accessibility: Partial<UserSettings["accessibility"]>
  ) => {
    await updateSettings({
      accessibility: { ...settings.accessibility, ...accessibility },
    });
  };

  const updateDeveloper = async (
    developer: Partial<UserSettings["developer"]>
  ) => {
    await updateSettings({
      developer: { ...settings.developer, ...developer },
    });
  };

  const resetToDefaults = async () => {
    await settingsService.resetToDefaults();
    const defaultSettings = settingsService.getSettings();
    setSettings(defaultSettings);
  };

  return {
    settings,
    isLoading,
    hasUnsavedChanges,
    isSaving,
    updateSettings,
    updateProfile,
    updateBoard,
    updatePieces,
    updateGame,
    updateAccessibility,
    updateDeveloper,
    saveSettings,
    discardChanges,
    resetToDefaults,
  };
}
