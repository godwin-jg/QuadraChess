import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import onlineGameService from "../../../services/onlineGameService";
import ResignConfirmationModal from "./ResignConfirmationModal";
import { useLocalSearchParams } from "expo-router";

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
        // Online multiplayer - call online service
        await onlineGameService.resignGame();
      } else {
        // Local multiplayer or single player - use Redux action
        dispatch(resignGame());
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
        playerName={getPlayerName(currentPlayerTurn)}
      />
    </>
  );
}
