import React, { useState } from "react";
import { View, Text, TouchableOpacity, Modal, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, endGame } from "../../../state";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";
import onlineGameService from "../../../services/onlineGameService";

export default function EndgameButton() {
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(false);
  const { gameId } = useLocalSearchParams<{ gameId?: string }>();
  const { gameStatus, viewingHistoryIndex, gameMode } = useSelector((state: RootState) => state.game);
  
  const isActuallyOnline = gameMode === "online" && onlineGameService.isConnected && gameId;
  const isLocalGame = gameMode === "solo" || gameMode === "single" || !isActuallyOnline;
  
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
        <Text style={styles.buttonText}>End Game</Text>
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

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#374151',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  buttonText: {
    color: '#FBBF24',
    fontSize: 13,
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
