import { Audio } from 'expo-av';
import * as Haptics from 'expo-haptics';
import { settingsService } from './settingsService';

class SoundService {
  private static instance: SoundService;
  private sounds: Map<string, Audio.Sound> = new Map();
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): SoundService {
    if (!SoundService.instance) {
      SoundService.instance = new SoundService();
    }
    return SoundService.instance;
  }

  // Initialize the sound service
  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        staysActiveInBackground: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      // Load sound files if they exist
      await this.loadSoundFiles();

      this.isInitialized = true;
    } catch (error) {
    }
  }

  // Load sound files from assets
  private async loadSoundFiles(): Promise<void> {
    const soundFiles = {
      // Game events
      'game-start': require('../assets/sounds/game-start.mp3'),
      'game-end': require('../assets/sounds/game-end.mp3'),
      'move': require('../assets/sounds/move.mp3'),
      'capture': require('../assets/sounds/capture.mp3'),
      'castle': require('../assets/sounds/castle.mp3'),
      'check': require('../assets/sounds/check.mp3'),
      'checkmate': require('../assets/sounds/game-end.mp3'), // Use game-end for checkmate
      'stalemate': require('../assets/sounds/stalemate.mp3'),
      'promote': require('../assets/sounds/promote.mp3'),
      'illegal': require('../assets/sounds/illegal.mp3'),
      'notify': require('../assets/sounds/notify.mp3'),
      'tenseconds': require('../assets/sounds/tenseconds.mp3'),
      
      // UI events
      'button': require('../assets/sounds/button.mp3'),
      'button-homescreen': require('../assets/sounds/button-only-homescreen.mp3'),
      'toggle': require('../assets/sounds/toggle.mp3'),
      'error': require('../assets/sounds/error.mp3'),
      'success': require('../assets/sounds/notify.mp3'), // Use notify as fallback for success
    };

    for (const [name, file] of Object.entries(soundFiles)) {
      try {
        const { sound } = await Audio.Sound.createAsync(file, {
          shouldPlay: false,
          isLooping: false,
          volume: 0.7,
        });
        
        this.sounds.set(name, sound);
      } catch (error) {
      }
    }
  }

  // Check if sound effects are enabled
  private isSoundEnabled(): boolean {
    try {
      const settings = settingsService.getSettings();
      return settings?.game?.soundEnabled ?? true;
    } catch (error) {
      return true;
    }
  }

  // Check if haptic feedback is enabled
  private isHapticsEnabled(): boolean {
    try {
      const settings = settingsService.getSettings();
      return settings?.game?.hapticsEnabled ?? true;
    } catch (error) {
      return true;
    }
  }

  // Play a sound effect using loaded sound files or haptic feedback
  public async playSound(soundName: string): Promise<void> {
    if (!this.isInitialized) {
      try {
        await this.initialize();
      } catch (error) {
        return;
      }
      if (!this.isInitialized) {
        return;
      }
    }

    try {
      // First try to play the actual sound file (only if sound is enabled)
      if (this.isSoundEnabled()) {
        const sound = this.sounds.get(soundName);
        if (sound) {
          await sound.setPositionAsync(0); // Reset to beginning
          
          // ✅ CRITICAL FIX: Play sound and haptics simultaneously
          const soundPromise = sound.playAsync();
          const hapticPromise = this.isHapticsEnabled() 
            ? Haptics.impactAsync(this.getHapticStyleForSound(soundName))
            : Promise.resolve();
          
          // Wait for both to complete simultaneously
          await Promise.all([soundPromise, hapticPromise]);
          
          if (this.isHapticsEnabled()) {
          }
          return;
        }
      }
      
      // If sound is disabled OR no sound file loaded, fall back to haptic feedback (only if haptics are enabled)
      if (this.isHapticsEnabled()) {
        const hapticStyle = this.getHapticStyleForSound(soundName);
        await Haptics.impactAsync(hapticStyle);
      } else {
      }
      
    } catch (error) {
      // Final fallback to haptic (only if haptics are enabled)
      if (this.isHapticsEnabled()) {
        try {
          const hapticStyle = this.getHapticStyleForSound(soundName);
          await Haptics.impactAsync(hapticStyle);
        } catch (hapticError) {
        }
      } else {
      }
    }
  }

  // Get appropriate haptic style for different sound types
  private getHapticStyleForSound(soundName: string): Haptics.ImpactFeedbackStyle {
    switch (soundName) {
      case 'move': 
        return Haptics.ImpactFeedbackStyle.Light;
      case 'capture': 
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'castle':
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'check': 
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'checkmate': 
      case 'game-end':
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'stalemate': 
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'promote':
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'illegal':
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'notify':
        return Haptics.ImpactFeedbackStyle.Light;
      case 'tenseconds':
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'game-start':
        return Haptics.ImpactFeedbackStyle.Medium;
      case 'button': 
      case 'button-homescreen':
        return Haptics.ImpactFeedbackStyle.Light;
      case 'toggle': 
        return Haptics.ImpactFeedbackStyle.Light;
      case 'error': 
        return Haptics.ImpactFeedbackStyle.Heavy;
      case 'success': 
        return Haptics.ImpactFeedbackStyle.Medium;
      default: 
        return Haptics.ImpactFeedbackStyle.Light;
    }
  }

  // Convenience methods
  public async playMoveSound(): Promise<void> {
    await this.playSound('move');
  }

  public async playCaptureSound(): Promise<void> {
    await this.playSound('capture');
  }

  public async playCheckSound(): Promise<void> {
    await this.playSound('check');
  }

  public async playCheckmateSound(): Promise<void> {
    await this.playSound('checkmate');
  }

  public async playButtonSound(): Promise<void> {
    await this.playSound('button');
  }

  // New convenience methods for additional sounds
  public async playGameStartSound(): Promise<void> {
    await this.playSound('game-start');
  }

  public async playGameEndSound(): Promise<void> {
    await this.playSound('game-end');
  }

  public async playCastleSound(): Promise<void> {
    await this.playSound('castle');
  }

  public async playPromoteSound(): Promise<void> {
    await this.playSound('promote');
  }

  public async playIllegalMoveSound(): Promise<void> {
    await this.playSound('illegal');
  }

  public async playNotifySound(): Promise<void> {
    await this.playSound('notify');
  }

  public async playTenSecondsSound(): Promise<void> {
    await this.playSound('tenseconds');
  }

  public async playButtonHomescreenSound(): Promise<void> {
    await this.playSound('button-homescreen');
  }

  public async playToggleSound(): Promise<void> {
    await this.playSound('toggle');
  }

  public async playErrorSound(): Promise<void> {
    await this.playSound('error');
  }

  public async playSuccessSound(): Promise<void> {
    await this.playSound('success');
  }
}

const soundService = SoundService.getInstance();
export default soundService;