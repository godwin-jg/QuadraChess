import * as Haptics from 'expo-haptics';
import { settingsService } from './settingsService';

// Test service to help diagnose haptics issues
export class HapticsTestService {
  static async testHaptics(): Promise<void> {
    console.log('🔍 Testing haptics...');
    
    // Check if haptics are enabled in settings
    const settings = settingsService.getSettings();
    console.log('📱 Haptics enabled in settings:', settings?.game?.hapticsEnabled);
    
    // Test different haptic styles
    try {
      console.log('🎯 Testing Light haptic...');
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      
      setTimeout(async () => {
        try {
          console.log('🎯 Testing Medium haptic...');
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        } catch (error) {
          console.log('❌ Medium haptic failed:', error);
        }
      }, 500);
      
      setTimeout(async () => {
        try {
          console.log('🎯 Testing Heavy haptic...');
          await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
        } catch (error) {
          console.log('❌ Heavy haptic failed:', error);
        }
      }, 1000);
      
      setTimeout(async () => {
        try {
          console.log('🎯 Testing Selection haptic...');
          await Haptics.selectionAsync();
        } catch (error) {
          console.log('❌ Selection haptic failed:', error);
        }
      }, 1500);
      
      setTimeout(async () => {
        try {
          console.log('🎯 Testing Notification haptic...');
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        } catch (error) {
          console.log('❌ Notification haptic failed:', error);
        }
      }, 2000);
      
    } catch (error) {
      console.log('❌ Haptics test failed:', error);
    }
  }
  
  static async testHapticsService(): Promise<void> {
    console.log('🔍 Testing haptics service...');
    
    const { hapticsService } = await import('./hapticsService');
    
    try {
      console.log('🎯 Testing hapticsService.light()...');
      await hapticsService.light();
      
      setTimeout(async () => {
        try {
          console.log('🎯 Testing hapticsService.medium()...');
          await hapticsService.medium();
        } catch (error) {
          console.log('❌ hapticsService.medium() failed:', error);
        }
      }, 500);
      
      setTimeout(async () => {
        try {
          console.log('🎯 Testing hapticsService.heavy()...');
          await hapticsService.heavy();
        } catch (error) {
          console.log('❌ hapticsService.heavy() failed:', error);
        }
      }, 1000);
      
    } catch (error) {
      console.log('❌ Haptics service test failed:', error);
    }
  }
}
