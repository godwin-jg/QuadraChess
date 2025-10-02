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
        return "bg-red-500";
      case "b":
        return "bg-blue-500";
      case "y":
        return "bg-purple-500";
      case "g":
        return "bg-green-500";
      default:
        return "bg-gray-500";
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
      <View className="flex-1 bg-black/50 justify-center items-center">
        <View
          className="bg-white rounded-xl shadow-2xl border border-gray-200 p-4 mx-4"
          style={{ maxWidth: width * 0.8 }}
        >
          {/* Header */}
          <View className="items-center mb-4">
            <Text className="text-xl font-bold text-gray-800 mb-1">
              Pawn Promotion
            </Text>
            <Text className="text-base text-gray-600">
              Choose a piece for {getPlayerName(playerColor)} player
            </Text>
          </View>

          {/* Promotion Options */}
          <View className="flex-row justify-center gap-6 mb-4">
            {promotionOptions.map((option) => (
              <Pressable
                key={option.type}
                onPress={() => onSelectPiece(option.type)}
                className="items-center active:opacity-70"
              >
                <Piece piece={`${playerColor}${option.type}`} size={45} />
                <Text className="text-xs font-medium text-gray-600 mt-1">
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
