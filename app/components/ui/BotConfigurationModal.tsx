import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hapticsService } from '../../../services/hapticsService';

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
        return { name: 'Red', colorClass: 'bg-red-500', colorHex: '#ef4444' };
      case 'b':
        return { name: 'Blue', colorClass: 'bg-blue-500', colorHex: '#3b82f6' };
      case 'y':
        return { name: 'Yellow', colorClass: 'bg-purple-500', colorHex: '#7c3aed' };
      case 'g':
        return { name: 'Green', colorClass: 'bg-green-500', colorHex: '#10b981' };
      default:
        return { name: 'Unknown', colorClass: 'bg-gray-500', colorHex: '#6b7280' };
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <SafeAreaView style={styles.container}>
        <LinearGradient
          colors={['#000000', '#1a1a1a']}
          style={StyleSheet.absoluteFill}
        />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Bot Configuration</Text>
          <Text style={styles.subtitle}>
            Choose which players will be controlled by AI
          </Text>
        </View>

        {/* Player Selection */}
        <View style={styles.selectionContainer}>
          <Text style={styles.sectionTitle}>Select Bot Players</Text>
          <Text style={styles.sectionSubtitle}>
            Tap to toggle between Human and Bot
          </Text>
          
          <View style={styles.playerGrid}>
            {['r', 'b', 'y', 'g'].map((color) => {
              const isBot = botPlayers.includes(color);
              const colorInfo = getColorInfo(color);
              
              return (
                <TouchableOpacity
                  key={color}
                  style={[
                    styles.playerButton,
                    isBot ? styles.playerButtonActive : styles.playerButtonInactive,
                  ]}
                  onPress={() => toggleBotPlayer(color)}
                >
                  <View style={styles.playerContent}>
                    <View
                      style={[
                        styles.colorIndicator,
                        { backgroundColor: colorInfo.colorHex },
                      ]}
                    />
                    <Text style={[
                      styles.playerName,
                      isBot ? styles.playerNameActive : styles.playerNameInactive,
                    ]}>
                      {colorInfo.name}
                    </Text>
                    <Text style={[
                      styles.playerType,
                      isBot ? styles.playerTypeActive : styles.playerTypeInactive,
                    ]}>
                      {isBot ? '🤖 Bot' : '👤 Human'}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={handleClose}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
          
          <TouchableOpacity
            style={styles.confirmButton}
            onPress={handleConfirm}
          >
            <LinearGradient
              colors={['#ffffff', '#f0f0f0']}
              style={styles.confirmButtonGradient}
            >
              <Text style={styles.confirmButtonText}>Start Game</Text>
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 22,
  },
  selectionContainer: {
    flex: 1,
    paddingHorizontal: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 32,
  },
  playerGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 16,
  },
  playerButton: {
    width: '48%',
    padding: 20,
    borderRadius: 16,
    borderWidth: 2,
  },
  playerButtonActive: {
    borderColor: '#10b981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  playerButtonInactive: {
    borderColor: 'rgba(255, 255, 255, 0.2)',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  playerContent: {
    alignItems: 'center',
  },
  colorIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    marginBottom: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  playerNameActive: {
    color: '#10b981',
  },
  playerNameInactive: {
    color: '#ffffff',
  },
  playerType: {
    fontSize: 12,
    fontWeight: '500',
  },
  playerTypeActive: {
    color: '#34d399',
  },
  playerTypeInactive: {
    color: '#9ca3af',
  },
  buttonContainer: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingBottom: 32,
    gap: 16,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  confirmButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  confirmButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});

export default BotConfigurationModal;
