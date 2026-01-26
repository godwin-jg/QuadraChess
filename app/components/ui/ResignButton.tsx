import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";

const PLAYER_NAMES: Record<string, string> = { r: "Red", b: "Blue", y: "Yellow", g: "Green" };

export default function ResignButton() {
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{ gameId?: string; mode?: string }>();
  const { currentPlayerTurn, gameStatus, viewingHistoryIndex } = useSelector((state: RootState) => state.game);

  const isOnlineMode = mode === "online" && !!gameId;
  const localPlayerColor = isOnlineMode ? onlineGameService.currentPlayer?.color : currentPlayerTurn;
  const canResign = viewingHistoryIndex === null && 
    (gameStatus === "active" || gameStatus === "waiting") &&
    !["finished", "checkmate", "stalemate"].includes(gameStatus);

  const handleConfirm = async () => {
    setIsResigning(true);
    try {
      if (isOnlineMode) {
        await Promise.race([
          onlineGameService.resignGame(),
          new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout")), 10000))
        ]);
      } else {
        dispatch(resignGame(localPlayerColor || undefined));
      }
      soundService.playGameEndSound();
      setShowModal(false);
    } catch {
      if (isOnlineMode) setShowModal(false);
      else alert("Failed to resign. Please try again.");
    } finally {
      setIsResigning(false);
    }
  };

  if (!canResign) return null;

  return (
    <>
      <TouchableOpacity onPress={() => setShowModal(true)} activeOpacity={0.7} style={styles.button}>
        <Text style={styles.buttonText}>Resign</Text>
      </TouchableOpacity>
      <ResignConfirmationModal
        visible={showModal}
        onConfirm={handleConfirm}
        onCancel={() => setShowModal(false)}
        playerName={PLAYER_NAMES[localPlayerColor || ''] || "Player"}
        isResigning={isResigning}
      />
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
    color: '#F87171',
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
