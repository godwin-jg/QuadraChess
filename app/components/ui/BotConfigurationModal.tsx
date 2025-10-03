import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withDelay,
} from 'react-native-reanimated';
import { hapticsService } from '../../../services/hapticsService';
import GridBackground from './GridBackground';

interface BotConfigurationModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: (botPlayers: string[]) => void;
  initialBotPlayers?: string[];
}

const BotConfigurationModal: React.FC<BotConfigurationModalProps> = ({
  visible,
  onClose,
  onConfirm,
  initialBotPlayers = ['b', 'y', 'g'], // Default: Red is human, others are bots
}) => {
  const [botPlayers, setBotPlayers] = useState<string[]>(initialBotPlayers);
  
  // Animation values
  const modalOpacity = useSharedValue(0);
  const modalScale = useSharedValue(0.9);
  const titleOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const playersOpacity = useSharedValue(0);
  const buttonsOpacity = useSharedValue(0);
  
  // Individual player animations
  const playerAnimations = Array.from({ length: 4 }, () => ({
    opacity: useSharedValue(0),
    scale: useSharedValue(0.8),
    rotateY: useSharedValue(-15),
  }));

  useEffect(() => {
    if (visible) {
      // Entry animations
      modalOpacity.value = withTiming(1, { duration: 300 });
      modalScale.value = withSpring(1, { damping: 15, stiffness: 100 });
      
      titleOpacity.value = withDelay(100, withTiming(1, { duration: 400 }));
      subtitleOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
      
      // Staggered player animations
      playerAnimations.forEach((player, index) => {
        player.opacity.value = withDelay(300 + (index * 100), withTiming(1, { duration: 400 }));
        player.scale.value = withDelay(300 + (index * 100), withSpring(1, { damping: 12, stiffness: 100 }));
        player.rotateY.value = withDelay(300 + (index * 100), withSpring(0, { damping: 10, stiffness: 80 }));
      });
      
      playersOpacity.value = withDelay(700, withTiming(1, { duration: 300 }));
      buttonsOpacity.value = withDelay(800, withTiming(1, { duration: 400 }));
    } else {
      // Exit animations
      modalOpacity.value = withTiming(0, { duration: 200 });
      modalScale.value = withTiming(0.9, { duration: 200 });
      
      titleOpacity.value = withTiming(0, { duration: 150 });
      subtitleOpacity.value = withTiming(0, { duration: 150 });
      playersOpacity.value = withTiming(0, { duration: 150 });
      buttonsOpacity.value = withTiming(0, { duration: 150 });
      
      playerAnimations.forEach((player) => {
        player.opacity.value = withTiming(0, { duration: 150 });
        player.scale.value = withTiming(0.8, { duration: 150 });
        player.rotateY.value = withTiming(-15, { duration: 150 });
      });
    }
  }, [visible]);

  const toggleBotPlayer = (color: string) => {
    hapticsService.selection();
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    setBotPlayers(newBotPlayers);
  };

  const handleConfirm = () => {
    hapticsService.buttonPress();
    onConfirm(botPlayers);
    onClose();
  };

  const handleClose = () => {
    hapticsService.buttonPress();
    onClose();
  };

  const getColorInfo = (color: string) => {
    switch (color) {
      case 'r':
        return { 
          name: 'Red', 
          gradient: ['#FF6B6B', '#FF5252', '#E53E3E'], 
          emoji: '🔴',
          borderColor: '#FF4444'
        };
      case 'b':
        return { 
          name: 'Blue', 
          gradient: ['#60A5FA', '#3B82F6', '#2563EB'], 
          emoji: '🔵',
          borderColor: '#3B82F6'
        };
      case 'y':
        return { 
          name: 'Yellow', 
          gradient: ['#A78BFA', '#8B5CF6', '#7C3AED'], 
          emoji: '🟡',
          borderColor: '#8B5CF6'
        };
      case 'g':
        return { 
          name: 'Green', 
          gradient: ['#34D399', '#10B981', '#059669'], 
          emoji: '🟢',
          borderColor: '#10B981'
        };
      default:
        return { 
          name: 'Unknown', 
          gradient: ['#9CA3AF', '#6B7280', '#4B5563'], 
          emoji: '⚪',
          borderColor: '#9CA3AF'
        };
    }
  };

  // Animated styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
    transform: [{ translateY: titleOpacity.value === 0 ? -20 : 0 }],
  }));

  const subtitleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
    transform: [{ translateY: subtitleOpacity.value === 0 ? -15 : 0 }],
  }));

  const playersAnimatedStyle = useAnimatedStyle(() => ({
    opacity: playersOpacity.value,
  }));

  const buttonsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonsOpacity.value,
    transform: [{ translateY: buttonsOpacity.value === 0 ? 20 : 0 }],
  }));

  const getPlayerAnimatedStyle = (index: number) => useAnimatedStyle(() => {
    const player = playerAnimations[index];
    return {
      opacity: player.opacity.value,
      transform: [
        { scale: player.scale.value },
        { rotateY: `${player.rotateY.value}deg` },
      ],
    };
  });

  return (
    <Modal
      visible={visible}
      animationType="none"
      presentationStyle="overFullScreen"
      onRequestClose={handleClose}
      transparent
    >
      <SafeAreaView style={styles.container}>
        {/* Background with gradient overlay */}
        <LinearGradient
          colors={['rgba(0,0,0,0.85)', 'rgba(0,0,0,0.95)']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Grid background */}
        <GridBackground />
        
        {/* Close button */}
        <TouchableOpacity
          style={styles.closeButton}
          onPress={handleClose}
          activeOpacity={0.7}
        >
          <LinearGradient
            colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
            style={styles.closeButtonGradient}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </LinearGradient>
        </TouchableOpacity>

        {/* Main modal container */}
        <Animated.View style={[styles.modalContainer, modalAnimatedStyle]}>
          <LinearGradient
            colors={['rgba(31, 41, 55, 0.95)', 'rgba(17, 24, 39, 0.95)']}
            style={styles.modalGradient}
          >
            {/* Header */}
            <View style={styles.header}>
              <Animated.Text style={[styles.title, titleAnimatedStyle]}>
                🤖 Bot Configuration
              </Animated.Text>
              <Animated.Text style={[styles.subtitle, subtitleAnimatedStyle]}>
                Choose which players will be controlled by AI opponents
              </Animated.Text>
            </View>

            {/* Player Selection */}
            <Animated.View style={[styles.selectionContainer, playersAnimatedStyle]}>
              <Text style={styles.sectionTitle}>Player Types</Text>
              <Text style={styles.sectionSubtitle}>
                Tap to toggle between Human and Bot players
              </Text>
              
              <View style={styles.playerGrid}>
                {['r', 'b', 'y', 'g'].map((color, index) => {
                  const isBot = botPlayers.includes(color);
                  const colorInfo = getColorInfo(color);
                  
                  return (
                    <Animated.View 
                      key={color} 
                      style={[styles.playerCard, getPlayerAnimatedStyle(index)]}
                    >
                      <TouchableOpacity
                        style={styles.playerButton}
                        onPress={() => toggleBotPlayer(color)}
                        activeOpacity={0.8}
                      >
                        <LinearGradient
                          colors={isBot ? colorInfo.gradient as any : ['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                          style={styles.playerGradient}
                        >
                          {/* Player content */}
                          <View style={styles.playerContent}>
                            {/* Color indicator with emoji */}
                            <View style={styles.playerIndicator}>
                              <LinearGradient
                                colors={colorInfo.gradient as any}
                                style={styles.colorCircle}
                              >
                                <Text style={styles.colorEmoji}>{colorInfo.emoji}</Text>
                              </LinearGradient>
                            </View>
                            
                            {/* Player name */}
                            <Text style={[
                              styles.playerName,
                              isBot && styles.playerNameActive
                            ]}>
                              {colorInfo.name}
                            </Text>
                            
                            {/* Player type indicator */}
                            <View style={[
                              styles.typeIndicator,
                              isBot && styles.typeIndicatorActive
                            ]}>
                              <Text style={[
                                styles.typeIcon,
                                isBot && styles.typeIconActive
                              ]}>
                                {isBot ? '🤖' : '👤'}
                              </Text>
                              <Text style={[
                                styles.typeText,
                                isBot && styles.typeTextActive
                              ]}>
                                {isBot ? 'Bot' : 'Human'}
                              </Text>
                            </View>
                          </View>
                          
                          {/* Status indicator */}
                          <View style={[
                            styles.statusIndicator,
                            isBot && { borderColor: colorInfo.borderColor }
                          ]} />
                        </LinearGradient>
                      </TouchableOpacity>
                    </Animated.View>
                  );
                })}
              </View>
            </Animated.View>

            {/* Action Buttons */}
            <Animated.View style={[styles.buttonContainer, buttonsAnimatedStyle]}>
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={handleClose}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['rgba(255,255,255,0.1)', 'rgba(255,255,255,0.05)']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </LinearGradient>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleConfirm}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#FFFFFF', '#F0F0F0']}
                  style={styles.buttonGradient}
                >
                  <Text style={styles.confirmButtonText}>🎮 Start Game</Text>
                </LinearGradient>
              </TouchableOpacity>
            </Animated.View>
          </LinearGradient>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 20,
    borderRadius: 20,
    overflow: 'hidden',
  },
  closeButtonGradient: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 20,
    marginVertical: 60,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.5,
    shadowRadius: 25,
    elevation: 20,
  },
  modalGradient: {
    flex: 1,
    justifyContent: 'space-between',
    paddingVertical: 32,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 32,
    marginBottom: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 20,
  },
  selectionContainer: {
    flex: 1,
    paddingHorizontal: 32,
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 40,
    lineHeight: 20,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  playerCard: {
    width: '48%',
    marginBottom: 20,
  },
  playerButton: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  playerGradient: {
    padding: 24,
    minHeight: 120,
  },
  playerContent: {
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
  playerIndicator: {
    marginBottom: 12,
  },
  colorCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  colorEmoji: {
    fontSize: 20,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  playerNameActive: {
    color: '#FFFFFF',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  typeIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  typeIndicatorActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderColor: 'rgba(255,255,255,0.4)',
  },
  typeIcon: {
    fontSize: 14,
    marginRight: 6,
  },
  typeIconActive: {
    // Keep same styling for icons
  },
  typeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeTextActive: {
    color: '#FFFFFF',
  },
  statusIndicator: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 32,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  buttonGradient: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    letterSpacing: 0.5,
  },
});

export default BotConfigurationModal;
