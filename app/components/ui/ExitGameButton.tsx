import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet, View, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSelector, useDispatch } from "react-redux";
import { RootState, resetGame, setPlayers, setIsHost, setCanStartGame } from "../../../state";
import onlineGameService from "../../../services/onlineGameService";
import { useLocalSearchParams, useRouter } from "expo-router";
import soundService from "../../../services/soundService";
import { sw, sh, sf, isCompact } from "../../utils/responsive";
import { FontAwesome } from "@expo/vector-icons";

const PLAYER_NAMES: Record<string, string> = { r: "Red", b: "Blue", y: "Purple", g: "Green" };

interface ExitGameButtonProps {
  textScale?: number;
}

export default function ExitGameButton({ textScale = 1 }: ExitGameButtonProps) {
  const dispatch = useDispatch();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{ gameId?: string; mode?: string }>();
  const { gameStatus, viewingHistoryIndex } = useSelector((state: RootState) => state.game);
  const clampedTextScale = Math.min(1.2, Math.max(1, textScale));
  const iconSize = sf(c ? 11 : 12) * clampedTextScale;
  const labelSize = sf(c ? 12 : 14) * clampedTextScale;

  const isOnlineMode = mode === "online" && !!gameId;
  const isP2PMode = mode === "p2p";
  const isNetworkMode = isOnlineMode || isP2PMode;
  const localPlayerColor = isNetworkMode 
    ? (onlineGameService.currentPlayer?.color ?? require('../../../services/p2pGameService').default.currentPlayer?.color) 
    : null;
  const canExit = viewingHistoryIndex === null && 
    (gameStatus === "active" || gameStatus === "waiting") &&
    !["finished", "checkmate", "stalemate"].includes(gameStatus);

  // Only show in network modes
  if (!isNetworkMode || !canExit) return null;

  const handleConfirm = async () => {
    setIsExiting(true);
    try {
      if (isOnlineMode) {
        await Promise.race([
          onlineGameService.resignGame(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
        ]);
        soundService.playGameEndSound();
        setShowModal(false);
        
        // Clear Redux lobby state before navigating
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        
        // Navigate to lobby after successful online resignation
        router.replace("/(tabs)/OnlineLobbyScreen?resigned=true");
      } else if (isP2PMode) {
        const p2pGameService = require('../../../services/p2pGameService').default;
        await Promise.race([
          p2pGameService.resignGame(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
        ]);
        try {
          await p2pGameService.disconnect();
        } catch (error) {
          console.warn("P2P disconnect failed after resignation:", error);
        }
        soundService.playGameEndSound();
        setShowModal(false);
        
        // Reset P2P game state to avoid stale eliminations
        dispatch(resetGame());
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        
        // Navigate to P2P lobby after resignation
        router.replace("/(tabs)/P2PLobbyScreen");
      }
    } catch {
      if (isOnlineMode) {
        setShowModal(false);
        
        // Clear Redux lobby state even on error
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        
        // Still navigate away even if there was an error
        router.replace("/(tabs)/OnlineLobbyScreen?resigned=true");
      } else if (isP2PMode) {
        setShowModal(false);
        dispatch(resetGame());
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        router.replace("/(tabs)/P2PLobbyScreen");
      }
    } finally {
      setIsExiting(false);
    }
  };

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.7} style={styles.button}>
        <View style={styles.buttonContent}>
          <FontAwesome name="sign-out" size={iconSize} color="#FBBF24" style={styles.icon} />
          <Text style={[styles.buttonText, { fontSize: labelSize }]}>Exit Game</Text>
        </View>
      </TouchableOpacity>
      <Modal
        visible={showModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowModal(false)}
      >
        <SafeAreaView style={modalStyles.overlay}>
          <View style={modalStyles.container}>
            <Text style={modalStyles.title}>Exit Game</Text>
            <Text style={modalStyles.message}>
              Are you sure you want to exit the game?
            </Text>
            <Text style={modalStyles.warning}>
              You will resign and leave the match.
            </Text>

            <View style={modalStyles.buttonRow}>
              <TouchableOpacity
                style={modalStyles.cancelButton}
                onPress={() => setShowModal(false)}
                activeOpacity={0.8}
              >
                <Text style={modalStyles.buttonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[modalStyles.confirmButton, isExiting && modalStyles.disabledButton]}
                onPress={handleConfirm}
                activeOpacity={isExiting ? 1 : 0.8}
                disabled={isExiting}
              >
                <Text style={modalStyles.buttonText}>
                  {isExiting ? 'Exiting...' : 'Exit'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const c = isCompact;

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(251, 191, 36, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(251, 191, 36, 0.55)',
    paddingHorizontal: sw(c ? 14 : 18),
    paddingVertical: sh(c ? 6 : 8),
    borderRadius: sw(50),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: sw(6),
  },
  buttonText: {
    color: '#FCD34D',
    fontSize: sf(c ? 12 : 14),
    fontWeight: '600',
    textAlign: 'center',
  },
});

const modalStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 32,
    maxWidth: 320,
    width: '100%',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 18,
    color: '#D1D5DB',
    textAlign: 'center',
    marginBottom: 16,
  },
  warning: {
    fontSize: 14,
    color: '#FBBF24',
    textAlign: 'center',
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#4B5563',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: '#D97706',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  disabledButton: {
    backgroundColor: '#6B7280',
  },
  buttonText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontWeight: '600',
  },
});
