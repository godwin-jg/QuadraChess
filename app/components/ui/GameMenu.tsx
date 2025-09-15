import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../state";
import { resignGame } from "../../state/gameSlice";
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
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.menuButton}
          onPress={handleResignPress}
          activeOpacity={0.8}
        >
          <Text style={styles.menuButtonText}>⋮</Text>
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

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 16,
    right: 16,
    zIndex: 20,
  },
  menuButton: {
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  menuButtonText: {
    color: "#FFFFFF",
    fontSize: 18,
    fontWeight: "bold",
  },
});
