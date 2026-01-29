import React, { useState } from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState, setPlayers, setIsHost, setCanStartGame } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams, useRouter } from "expo-router";
import soundService from "../../../services/soundService";
import { sw, sh, sf, isCompact } from "../../utils/responsive";
import { FontAwesome } from "@expo/vector-icons";

const PLAYER_NAMES: Record<string, string> = { r: "Red", b: "Blue", y: "Purple", g: "Green" };

interface ResignButtonProps {
  textScale?: number;
}

export default function ResignButton({ textScale = 1 }: ResignButtonProps) {
  const dispatch = useDispatch();
  const router = useRouter();
  const [showModal, setShowModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{ gameId?: string; mode?: string }>();
  const { currentPlayerTurn, gameStatus, viewingHistoryIndex } = useSelector((state: RootState) => state.game);
  const clampedTextScale = Math.min(1.2, Math.max(1, textScale));
  const iconSize = sf(c ? 11 : 12) * clampedTextScale;
  const labelSize = sf(c ? 12 : 14) * clampedTextScale;

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
        <View style={styles.buttonContent}>
          <FontAwesome name="flag" size={iconSize} color="#F87171" style={styles.icon} />
          <Text style={[styles.buttonText, { fontSize: labelSize }]}>Resign</Text>
        </View>
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

const c = isCompact;

const styles = StyleSheet.create({
  button: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.55)',
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
    color: '#FCA5A5',
    fontSize: sf(c ? 12 : 14),
    fontWeight: '600',
    textAlign: 'center',
  },
});
