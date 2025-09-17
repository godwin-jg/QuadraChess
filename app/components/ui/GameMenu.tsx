import React, { useState } from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { resignGame } from "../../../state/gameSlice";
import ResignConfirmationModal from "./ResignConfirmationModal";

export default function GameMenu() {
  const dispatch = useDispatch();
  const [showResignModal, setShowResignModal] = useState(false);
  const { currentPlayerTurn, gameStatus, history, historyIndex } = useSelector(
    (state: RootState) => state.game
  );

  const isViewingHistory = historyIndex < history.length - 1;
  const canResign =
    !isViewingHistory && gameStatus === "active" && currentPlayerTurn;

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

  const handleConfirmResign = () => {
    dispatch(resignGame());
    setShowResignModal(false);
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
