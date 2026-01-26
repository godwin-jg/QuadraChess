import React from "react";
import { View, Text, Pressable, Modal, Dimensions } from "react-native";
import Piece from "../board/Piece";

interface PromotionModalProps {
  visible: boolean;
  playerColor: string;
  onSelectPiece: (pieceType: string) => void;
}

export default function PromotionModal({
  visible,
  playerColor,
  onSelectPiece,
}: PromotionModalProps) {
  const { width } = Dimensions.get("window");

  const getPlayerName = (color: string) => {
    switch (color) {
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

  const getPlayerAccentColor = (color: string) => {
    switch (color) {
      case "r":
        return "#ef4444";
      case "b":
        return "#3b82f6";
      case "y":
        return "#a855f7";
      case "g":
        return "#10b981";
      default:
        return "#6b7280";
    }
  };

  const promotionOptions = [
    { type: "Q", name: "Queen", symbol: "♛" },
    { type: "R", name: "Rook", symbol: "♜" },
    { type: "B", name: "Bishop", symbol: "♝" },
    { type: "N", name: "Knight", symbol: "♞" },
  ];

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <View className="flex-1 bg-black/70 justify-center items-center">
        <View
          className="bg-gray-900 rounded-xl shadow-2xl border border-gray-700 p-6 mx-4"
          style={{ maxWidth: width * 0.9 }}
        >
          {/* Header */}
          <View className="items-center mb-4">
            <Text className="text-xl font-bold text-white mb-1">
              Pawn Promotion
            </Text>
            <Text className="text-base text-gray-400">
              Choose a piece for {getPlayerName(playerColor)}
            </Text>
            <View className="flex-row items-center mt-2">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: getPlayerAccentColor(playerColor) }}
              />
              <Text className="text-xs text-gray-400">Promoting pawn</Text>
            </View>
          </View>

          {/* Promotion Options */}
          <View className="flex-row justify-center gap-4 mb-4">
            {promotionOptions.map((option) => (
              <Pressable
                key={option.type}
                onPress={() => onSelectPiece(option.type)}
                className="items-center active:opacity-70"
              >
                <View className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                  <Piece piece={`${playerColor}${option.type}`} size={60} />
                </View>
                <Text className="text-sm font-medium text-gray-300 mt-2">
                  {option.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Instructions */}
          <Text className="text-center text-xs text-gray-500">
            Tap a piece to promote your pawn
          </Text>
        </View>
      </View>
    </Modal>
  );
}
