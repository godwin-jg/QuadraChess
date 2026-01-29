import React from "react";
import { View, Text, Pressable, Modal, Dimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
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
  const modalWidth = Math.min(width * 0.9, 420);
  const containerHorizontalPadding = 24 * 2; // matches p-6
  const optionGap = 12; // gap-3
  const availableWidth = modalWidth - containerHorizontalPadding - optionGap * 3;
  const optionWidth = Math.floor(availableWidth / 4);
  const pieceSize = Math.max(40, Math.min(64, optionWidth));

  const getPlayerName = (color: string) => {
    switch (color) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Purple";
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
  const playerName = getPlayerName(playerColor);
  const accentColor = getPlayerAccentColor(playerColor);

  const handleSelectPiece = (pieceType: string) => {
    try {
      const { hapticsService } = require("../../../services/hapticsService");
      hapticsService.selection();
    } catch {
      // Haptics not available
    }
    onSelectPiece(pieceType);
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      statusBarTranslucent={true}
    >
      <SafeAreaView className="flex-1 bg-black/70 justify-center items-center">
        <View
          className="bg-transparent rounded-2xl shadow-2xl /10 p-6 mx-4"
          style={{ maxWidth: modalWidth, width: modalWidth }}
        >
          {/* Header */}
          <View className="items-center">
            <View className="flex-row items-center mt-3 px-3 py-1 rounded-full border border-white/10 bg-white/5">
              <View
                className="w-2 h-2 rounded-full mr-2"
                style={{ backgroundColor: accentColor }}
              />
              <Text className="text-xs text-gray-300">Promote to</Text>
            </View>
          </View>

          {/* Promotion Options */}
          <View className="flex-row justify-center gap-3 mt-4">
            {promotionOptions.map((option) => (
              <Pressable
                key={option.type}
                onPress={() => handleSelectPiece(option.type)}
                className="items-center active:opacity-70"
                style={({ pressed }) => [
                  {
                    width: optionWidth,
                    opacity: pressed ? 0.9 : 1,
                    transform: [{ scale: pressed ? 0.96 : 1 }],
                  },
                ]}
              >
                <View
                  className="items-center justify-center rounded-full border border-white/10 bg-white/5"
                  style={{ width: optionWidth, height: optionWidth }}
                >
                  <Piece piece={`${playerColor}${option.type}`} size={pieceSize} />
                </View>
                <Text className="text-xs font-semibold text-gray-300 mt-2">
                  {option.name}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Instructions */}
          <Text className="text-center text-[11px] text-gray-500 mt-4">
            Tap a piece to promote
          </Text>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
