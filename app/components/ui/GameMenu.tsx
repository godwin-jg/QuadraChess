import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams } from "expo-router";
import soundService from "../../../services/soundService";

export default function GameMenu() {
  const dispatch = useDispatch();
  const [showResignModal, setShowResignModal] = useState(false);
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
      console.log("GameMenu: Online mode - currentPlayer:", onlineGameService.currentPlayer);
      console.log("GameMenu: Online mode - player color:", onlineGameService.currentPlayer.color);
      return onlineGameService.currentPlayer.color;
    }
    // For local games, we don't have a specific local player concept
    // The resign button should only appear for the current player's turn
    console.log("GameMenu: Local mode - currentPlayerTurn:", currentPlayerTurn);
    return currentPlayerTurn;
  };
  
  const localPlayerColor = getLocalPlayerColor();
  console.log("GameMenu: Final localPlayerColor:", localPlayerColor);

  const isOnlineMode = mode === "online" && !!gameId;
  const isViewingHistory = viewingHistoryIndex !== null;
  const canResign =
    !isViewingHistory &&
    (gameStatus === "active" ||
      gameStatus === "playing" ||
      gameStatus === "waiting") &&
    gameStatus !== "finished" &&
    gameStatus !== "checkmate" &&
    gameStatus !== "stalemate";

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
        return "Unknown";
    }
  };

  const handleResignPress = () => {
    setShowResignModal(true);
  };

  const handleConfirmResign = async () => {
    try {
      
      if (isOnlineMode) {
        // ✅ CRITICAL FIX: For online mode, don't update local state immediately
        // Let the online service handle the resignation and sync the correct state
        console.log("GameMenu: Online mode - calling onlineGameService.resignGame() first");
        await onlineGameService.resignGame();
        console.log("GameMenu: Online mode - onlineGameService.resignGame() completed");
      } else {
        // Local multiplayer or single player - use Redux action
        // Pass the local player's color to resign the correct player
        console.log("GameMenu: Local mode - calling dispatch(resignGame()) with:", localPlayerColor);
        dispatch(resignGame(localPlayerColor || undefined));
      }
      
      // 🔊 Play game-end sound for resignation
      try {
        soundService.playGameEndSound();
      } catch (error) {
      }
      
      setShowResignModal(false);
    } catch (error) {
      console.error("Error resigning from game:", error);
      // You might want to show an error message to the user here
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
      <View className="absolute top-4 right-4 z-20">
        <TouchableOpacity
          className="w-10 h-10 bg-gray-800 rounded-full justify-center items-center shadow-lg"
          onPress={handleResignPress}
          activeOpacity={0.8}
        >
          <Text className="text-white text-xl font-bold">⋮</Text>
        </TouchableOpacity>
      </View>

      <ResignConfirmationModal
        visible={showResignModal}
        onConfirm={handleConfirmResign}
        onCancel={handleCancelResign}
        playerName={getPlayerName(localPlayerColor || currentPlayerTurn)}
      />
    </>
  );
}
