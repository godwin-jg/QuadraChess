import { useState, useEffect, useCallback, useRef } from "react";
import { settingsService, UserSettings } from "../services/settingsService";

// IMPROVEMENT: Initialize with a default or null state to prevent flickering.
const defaultInitialState = settingsService.getSettings();
const AUTO_SAVE_DELAY_MS = 500;

export function useSettings() {
  const [settings, setSettings] = useState<UserSettings>(defaultInitialState);
  const [isLoading, setIsLoading] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSettingsRef = useRef<UserSettings | null>(null);

  // IMPROVEMENT: Using useCallback for stable function references
  const loadInitialSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const loadedSettings = await settingsService.loadSettings();
      setSettings(loadedSettings);
    } catch (error) {
      console.warn("Failed to load settings, using defaults:", error);
      // The default state is already set, so we can just log the error.
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialSettings();
  }, [loadInitialSettings]);

  // This function is the single source of truth for updates
  const scheduleAutoSave = useCallback((nextSettings: UserSettings) => {
    pendingSettingsRef.current = nextSettings;
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(async () => {
      const settingsToSave = pendingSettingsRef.current;
      if (!settingsToSave) return;
      if (isSaving) {
        scheduleAutoSave(settingsToSave);
        return;
      }
      setIsSaving(true);
      try {
        await settingsService.saveSettings(settingsToSave);
        setHasUnsavedChanges(false);
      } catch (error) {
        console.error("Auto-save failed:", error);
      } finally {
        setIsSaving(false);
      }
    }, AUTO_SAVE_DELAY_MS);
  }, [isSaving]);

  const updateSettings = (updates: Partial<UserSettings>) => {
    // We create a new settings object to ensure React re-renders
    const newSettings = { ...settings, ...updates };
    setSettings(newSettings);
    setHasUnsavedChanges(true);
    scheduleAutoSave(newSettings);
  };

  const saveSettings = async () => {
    if (isSaving) return;

    setIsSaving(true);
    try {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
        autoSaveTimerRef.current = null;
      }
      pendingSettingsRef.current = null;
      await settingsService.saveSettings(settings);
      setHasUnsavedChanges(false); // Settings are now saved
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  };

  const discardChanges = useCallback(async () => {
    setHasUnsavedChanges(false);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }
    pendingSettingsRef.current = null;
    // Just re-run the initial loading logic to discard changes
    await loadInitialSettings();
  }, [loadInitialSettings]);

  // IMPROVEMENT: Helper functions are now synchronous as they don't await anything
  const updateProfile = (profile: Partial<UserSettings["profile"]>) => {
    updateSettings({ profile: { ...settings.profile, ...profile } });
  };

  const updateBoard = (board: Partial<UserSettings["board"]>) => {
    updateSettings({ board: { ...settings.board, ...board } });
  };

  const updatePieces = (pieces: Partial<UserSettings["pieces"]>) => {
    updateSettings({ pieces: { ...settings.pieces, ...pieces } });
  };

  const updateGame = (game: Partial<UserSettings["game"]>) => {
    updateSettings({ game: { ...settings.game, ...game } });
  };

  const updateAccessibility = (accessibility: Partial<UserSettings["accessibility"]>) => {
    updateSettings({ accessibility: { ...settings.accessibility, ...accessibility } });
  };

  const updateDeveloper = (developer: Partial<UserSettings["developer"]>) => {
    updateSettings({ developer: { ...settings.developer, ...developer } });
  };

  const resetToDefaults = async () => {
    await settingsService.resetToDefaults();
    const defaultSettings = settingsService.getSettings();
    setSettings(defaultSettings);
    setHasUnsavedChanges(false);
  };

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

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
