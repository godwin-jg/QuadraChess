import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, setPlayers, setIsHost, setCanStartGame } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams, useRouter } from "expo-router";
import soundService from "../../../services/soundService";

const PLAYER_NAMES: Record<string, string> = { r: "Red", b: "Blue", y: "Yellow", g: "Green" };

export default function ResignButton() {
  const dispatch = useDispatch();
  const router = useRouter();
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
        soundService.playGameEndSound();
        setShowModal(false);
        
        // ✅ CRITICAL FIX: Clear Redux lobby state before navigating
        // This ensures OnlineLobbyScreen doesn't show the waiting room
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        
        // Navigate to lobby after successful online resignation
        // Use query param to signal that user just resigned and should clear game context
        router.replace("/(tabs)/OnlineLobbyScreen?resigned=true");
      } else {
        dispatch(resignGame(localPlayerColor || undefined));
        soundService.playGameEndSound();
        setShowModal(false);
        // For local games, stay on GameScreen to see the game over modal
      }
    } catch {
      if (isOnlineMode) {
        setShowModal(false);
        
        // ✅ CRITICAL FIX: Clear Redux lobby state even on error
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setCanStartGame(false));
        
        // Still navigate away even if there was an error - player has left the game
        router.replace("/(tabs)/OnlineLobbyScreen?resigned=true");
      } else {
        alert("Failed to resign. Please try again.");
      }
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
