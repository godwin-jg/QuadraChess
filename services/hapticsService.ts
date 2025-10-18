import * as Haptics from 'expo-haptics';
import { settingsService } from './settingsService';

// Centralized haptics service that respects user settings
export class HapticsService {
  private static instance: HapticsService;

  static getInstance(): HapticsService {
    if (!HapticsService.instance) {
      HapticsService.instance = new HapticsService();
    }
    return HapticsService.instance;
  }

  // Helper function to safely trigger haptic feedback
  async triggerHaptic(style: Haptics.ImpactFeedbackStyle): Promise<void> {
    const settings = settingsService.getSettings();
    
    // Only trigger haptics if they're enabled in settings
    if (!settings?.game?.hapticsEnabled) {
      console.log('❌ Haptics disabled in settings, skipping haptic feedback');
      return;
    }
    
    console.log('✅ Haptics enabled, triggering:', style);
    try {
      await Haptics.impactAsync(style);
      console.log('✅ Haptic feedback triggered successfully');
    } catch (error) {
      // Silently fail if haptics are not available (e.g., on Android without proper linking)
      console.log('❌ Haptic feedback not available:', error);
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
