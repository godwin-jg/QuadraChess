import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, StyleSheet, View } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";
import { sw, sh, sf, isCompact } from "../../utils/responsive";
import { FontAwesome } from "@expo/vector-icons";

const PLAYER_NAMES: Record<string, string> = { r: "Red", b: "Blue", y: "Purple", g: "Green" };

interface ResignButtonProps {
  textScale?: number;
}

export default function ResignButton({ textScale = 1 }: ResignButtonProps) {
  const dispatch = useDispatch();
  const [showModal, setShowModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{ gameId?: string; mode?: string }>();
  const { currentPlayerTurn, gameStatus, viewingHistoryIndex, eliminatedPlayers } = useSelector((state: RootState) => state.game);
  const clampedTextScale = Math.min(1.2, Math.max(1, textScale));
  const iconSize = sf(c ? 11 : 12) * clampedTextScale;
  const labelSize = sf(c ? 12 : 14) * clampedTextScale;

  const isOnlineMode = mode === "online" && !!gameId;
  const isP2PMode = mode === "p2p";
  const isNetworkMode = isOnlineMode || isP2PMode;
  const localPlayerColor = isNetworkMode 
    ? (onlineGameService.currentPlayer?.color ?? require('../../../services/p2pGameService').default.currentPlayer?.color) 
    : currentPlayerTurn;
  const isEliminated = !!localPlayerColor && (eliminatedPlayers || []).includes(localPlayerColor);
  const canResign = viewingHistoryIndex === null && 
    (gameStatus === "active" || gameStatus === "waiting") &&
    !["finished", "checkmate", "stalemate"].includes(gameStatus);
  const isDisabled = isResigning || isEliminated;

  useEffect(() => {
    if (isResigning && gameStatus === "waiting" && (eliminatedPlayers?.length ?? 0) === 0) {
      setIsResigning(false);
    }
  }, [isResigning, gameStatus, eliminatedPlayers]);

  const handleConfirm = async () => {
    if (isResigning) return;
    setIsResigning(true);
    // Simple and elegant: eliminate the player (like checkmate)
    if (isOnlineMode) {
      // For online mode, sync elimination to Firebase
      // The Firebase listener will sync the update back to Redux
      try {
        await onlineGameService.eliminateSelf();
        soundService.playGameEndSound();
      } catch (error) {
        console.error("Failed to sync elimination:", error);
        setIsResigning(false);
      }
    } else if (isP2PMode) {
      // For P2P mode, sync resignation through the P2P service
      try {
        const p2pGameService = require('../../../services/p2pGameService').default;
        await p2pGameService.resignGame();
        soundService.playGameEndSound();
      } catch (error) {
        console.error("Failed to sync elimination:", error);
        dispatch(resignGame(localPlayerColor || undefined));
        soundService.playGameEndSound();
        setIsResigning(false);
      }
    } else {
      // Local mode: just dispatch Redux action
      dispatch(resignGame(localPlayerColor || undefined));
      soundService.playGameEndSound();
    }
    setShowModal(false);
  };

  if (!canResign) return null;

  return (
    <>
      <TouchableOpacity
        onPress={() => setShowModal(true)}
        activeOpacity={0.7}
        disabled={isDisabled}
        style={[styles.button, isDisabled && styles.buttonDisabled]}
      >
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
  buttonDisabled: {
    opacity: 0.5,
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
