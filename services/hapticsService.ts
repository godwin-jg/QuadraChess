import * as Haptics from 'expo-haptics';
import { settingsService } from './settingsService';

// Debounce interval in milliseconds - prevents rapid consecutive haptics
const HAPTIC_DEBOUNCE_MS = 80;

// Centralized haptics service that respects user settings
export class HapticsService {
  private static instance: HapticsService;
  private lastHapticTime: number = 0;

  static getInstance(): HapticsService {
    if (!HapticsService.instance) {
      HapticsService.instance = new HapticsService();
    }
    return HapticsService.instance;
  }

  // Helper function to safely trigger haptic feedback with debouncing
  async triggerHaptic(style: Haptics.ImpactFeedbackStyle): Promise<void> {
    const settings = settingsService.getSettings();
    
    // Only trigger haptics if they're enabled in settings
    if (!settings?.game?.hapticsEnabled) {
      return;
    }
    
    // Debounce: Skip if a haptic was triggered very recently
    const now = Date.now();
    if (now - this.lastHapticTime < HAPTIC_DEBOUNCE_MS) {
      return;
    }
    this.lastHapticTime = now;
    
    try {
      await Haptics.impactAsync(style);
    } catch (error) {
      // Silently fail if haptics are not available (e.g., on Android without proper linking)
    }
  }

  // Convenience methods for common haptic patterns
  async light(): Promise<void> {
    await this.triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
  }

  async medium(): Promise<void> {
    await this.triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }

  async heavy(): Promise<void> {
    await this.triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
  }

  // For selection feedback (when user selects something)
  async selection(): Promise<void> {
    await this.triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }

  // For button press feedback
  async buttonPress(): Promise<void> {
    await this.triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }

  // For toggle switch feedback
  async toggle(): Promise<void> {
    await this.triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
  }
}

export const hapticsService = HapticsService.getInstance();
