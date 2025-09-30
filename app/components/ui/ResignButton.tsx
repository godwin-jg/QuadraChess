import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";

export default function ResignButton() {
  const dispatch = useDispatch();
  const [showResignModal, setShowResignModal] = useState(false);
  const [isResigning, setIsResigning] = useState(false);
  const { gameId, mode } = useLocalSearchParams<{
    gameId?: string;
    mode?: string;
  }>();
  const { currentPlayerTurn, gameStatus, viewingHistoryIndex } = useSelector(
    (state: RootState) => state.game
  );
  
  // Get the local player's color for online games
  const getLocalPlayerColor = (): string | null => {
    if (isOnlineMode && onlineGameService.currentPlayer) {
      return onlineGameService.currentPlayer.color;
    }
    // For local games, we don't have a specific local player concept
    // The resign button should only appear for the current player's turn
    return currentPlayerTurn;
  };
  
  const localPlayerColor = getLocalPlayerColor();

  const isOnlineMode = mode === "online" && !!gameId;
  const isViewingHistory = viewingHistoryIndex !== null;
  const canResign =
    !isViewingHistory &&
    (gameStatus === "active" ||
      gameStatus === "playing" ||
      gameStatus === "waiting") &&
    !["finished", "checkmate", "stalemate"].includes(gameStatus);

  const getPlayerName = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Yellow";
      case "g":
        return "Green";
      default:
        return "Player";
    }
  };

  const handleResignPress = () => {
    setShowResignModal(true);
  };

  const handleConfirmResign = async () => {
    setIsResigning(true);
    try {
      console.log("ResignButton: Resigning player:", localPlayerColor, "in mode:", isOnlineMode ? "online" : "local");
      
      if (isOnlineMode) {
        // Online multiplayer - update local state immediately for better UX
        // Pass the local player's color to resign the correct player
        dispatch(resignGame(localPlayerColor || undefined));
        // Then call online service to sync with server
        console.log("ResignButton: Calling online service resign...");
        
        // Add timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error("Resign request timed out")), 10000); // 10 second timeout
        });
        
        await Promise.race([
          onlineGameService.resignGame(),
          timeoutPromise
        ]);
        console.log("ResignButton: Online service resign completed");
      } else {
        // Local multiplayer or single player - use Redux action only
        // For local games, resign the current player's turn
        dispatch(resignGame(localPlayerColor || undefined));
      }
      
      // 🔊 Play game-end sound for resignation
      try {
        soundService.playGameEndSound();
      } catch (error) {
        console.log('🔊 SoundService: Failed to play game-end sound for resignation:', error);
      }
      
      setShowResignModal(false);
    } catch (error) {
      console.error("ResignButton: Error resigning from game:", error);
      
      // For online mode, the local state was already updated, so we can close the modal
      if (isOnlineMode) {
        console.log("ResignButton: Local resign completed, closing modal despite server error");
        setShowResignModal(false);
        // Don't show error alert since the resign worked locally
      } else {
        // Show error to user for local games
        alert("Failed to resign from game. Please try again.");
      }
    } finally {
      console.log("ResignButton: Resetting isResigning to false");
      setIsResigning(false);
    }
  };

  const handleCancelResign = () => {
    setShowResignModal(false);
  };

  if (!canResign) {
    return null;
  }

  return (
    <>
      <TouchableOpacity
        onPress={handleResignPress}
        activeOpacity={0.7}
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.8)',
          paddingHorizontal: 16,
          paddingVertical: 8,
          borderRadius: 8,
          borderWidth: 1,
          borderColor: 'rgba(239, 68, 68, 0.3)',
        }}
      >
        <Text style={{
          color: '#FFFFFF',
          fontSize: 14,
          fontWeight: '600',
          fontFamily: 'SpaceMono-Regular',
          letterSpacing: 0.8,
          textAlign: 'center',
        }}>
          Resign
        </Text>
      </TouchableOpacity>

      <ResignConfirmationModal
        visible={showResignModal}
        onConfirm={handleConfirmResign}
        onCancel={handleCancelResign}
        playerName={localPlayerColor ? getPlayerName(localPlayerColor) : "Player"}
        isResigning={isResigning}
      />
    </>
  );
}
