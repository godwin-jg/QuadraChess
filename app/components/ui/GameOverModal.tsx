import React from "react";
import { View, Text, Pressable, Modal } from "react-native";

interface GameOverModalProps {
  status: "checkmate" | "stalemate" | "finished";
  winner?: string;
  eliminatedPlayer?: string;
  justEliminated?: string;
  onReset: () => void;
}

export default function GameOverModal({
  status,
  winner,
  eliminatedPlayer,
  justEliminated,
  onReset,
}: GameOverModalProps) {
  const getMessage = () => {
    const playerToShow = justEliminated || eliminatedPlayer;
    switch (status) {
      case "checkmate":
        return `Checkmate! ${playerToShow?.toUpperCase()} has been eliminated.`;
      case "stalemate":
        return `Stalemate! ${playerToShow?.toUpperCase()} has been eliminated.`;
      case "finished":
        return `Game Over! ${winner?.toUpperCase()} is the winner!`;
      default:
        return "Game Over!";
    }
  };

  const getTitle = () => {
    switch (status) {
      case "checkmate":
        return "Checkmate!";
      case "stalemate":
        return "Stalemate!";
      case "finished":
        return "Game Over!";
      default:
        return "Game Over!";
    }
  };

  return (
    <Modal visible={true} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-8">
        <View className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
          <Text className="text-3xl font-bold text-center mb-4 text-gray-800">
            {getTitle()}
          </Text>

          <Text className="text-lg text-center mb-8 text-gray-600 leading-6">
            {getMessage()}
          </Text>

          <Pressable
            onPress={onReset}
            className="bg-blue-600 py-4 px-8 rounded-xl active:opacity-70"
          >
            <Text className="text-white text-lg font-semibold text-center">
              Play Again
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
