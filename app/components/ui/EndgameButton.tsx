import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, endGame } from "../../../state";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";
import { sw, sh, sf, isCompact } from "../../utils/responsive";
import { FontAwesome } from "@expo/vector-icons";

interface EndgameButtonProps {
  textScale?: number;
}

export default function EndgameButton({ textScale = 1 }: EndgameButtonProps) {
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{ gameId?: string; mode?: string }>();
  const { gameStatus, viewingHistoryIndex, gameMode } = useSelector((state: RootState) => state.game);
  const clampedTextScale = Math.min(1.2, Math.max(1, textScale));
  const iconSize = sf(c ? 11 : 12) * clampedTextScale;
  const labelSize = sf(c ? 12 : 14) * clampedTextScale;
  
  // Check both route mode param and Redux gameMode to reliably detect online/p2p
  const isOnlineMode = mode === "online" || gameMode === "online";
  const isP2PMode = mode === "p2p" || gameMode === "p2p";
  const isNetworkMode = isOnlineMode || isP2PMode;
  
  // Only show for local/single-player games
  const isLocalGame = !isNetworkMode && (gameMode === "solo" || gameMode === "single" || !gameId);
  
  const canEndGame = viewingHistoryIndex === null &&
    (gameStatus === "active" || gameStatus === "waiting") &&
    !["finished", "checkmate", "stalemate"].includes(gameStatus) &&
    isLocalGame;

  const handleConfirm = () => {
    dispatch(endGame());
    soundService.playGameEndSound();
    setShowModal(false);
  };

  if (!canEndGame) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.7} style={styles.button}>
        <View style={styles.buttonContent}>
          <FontAwesome name="stop-circle" size={iconSize} color="#FDBA74" style={styles.icon} />
          <Text style={[styles.buttonText, { fontSize: labelSize }]}>End Game</Text>
        </View>
      </TouchableOpacity>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>End Game?</Text>
            <Text style={styles.modalMessage}>
              This will end the current game and declare a winner based on current scores.
            </Text>
            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setShowModal(false)} style={styles.cancelButton}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleConfirm} style={styles.confirmButton}>
                <Text style={styles.confirmText}>End Game</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const c = isCompact;
const ENDGAME_RAISE_Y = -Math.min(sh(c ? 2 : 4), c ? 4 : 6);

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(251, 146, 60, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(251, 146, 60, 0.6)',
    paddingHorizontal: sw(c ? 14 : 18),
    paddingVertical: sh(c ? 6 : 8),
    borderRadius: sw(50),
    marginTop: ENDGAME_RAISE_Y,
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
    color: '#FDBA74',
    fontSize: sf(c ? 12 : 14),
    fontWeight: '600',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1F2937',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    maxWidth: 320,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  modalMessage: {
    color: '#D1D5DB',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 20,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  cancelText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  confirmButton: {
    backgroundColor: 'rgba(251, 146, 60, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    flex: 1,
  },
  confirmText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});
