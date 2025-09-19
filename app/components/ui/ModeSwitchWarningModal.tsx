import React from "react";
import { View, Text, Pressable, Modal } from "react-native";

interface ModeSwitchWarningModalProps {
  visible: boolean;
  currentMode: "online" | "local" | "solo";
  targetMode: "online" | "local" | "solo";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ModeSwitchWarningModal({
  visible,
  currentMode,
  targetMode,
  onConfirm,
  onCancel,
}: ModeSwitchWarningModalProps) {
  const getModeDisplayName = (mode: string) => {
    switch (mode) {
      case "online":
        return "Online Multiplayer";
      case "local":
        return "Local Multiplayer";
      case "solo":
        return "Solo Play";
      default:
        return mode;
    }
  };

  const getWarningMessage = () => {
    if (currentMode === "online") {
      return "You are currently in an online multiplayer game. Switching to solo mode will disconnect you from the online game and you will lose your current progress.";
    } else if (currentMode === "local") {
      return "You are currently in a local multiplayer game. Switching to solo mode will disconnect you from the local game and you will lose your current progress.";
    }
    return "Switching modes will reset your current game.";
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-8">
        <View className="bg-white rounded-2xl p-8 max-w-sm w-full shadow-2xl">
          <Text className="text-2xl font-bold text-center mb-4 text-gray-800">
            Switch to {getModeDisplayName(targetMode)}?
          </Text>

          <Text className="text-lg text-center mb-6 text-gray-600 leading-6">
            {getWarningMessage()}
          </Text>

          <View className="flex-row space-x-4">
            <Pressable
              onPress={onCancel}
              className="flex-1 bg-gray-300 py-4 px-6 rounded-xl active:opacity-70"
            >
              <Text className="text-gray-700 text-lg font-semibold text-center">
                Cancel
              </Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              className="flex-1 bg-red-600 py-4 px-6 rounded-xl active:opacity-70"
            >
              <Text className="text-white text-lg font-semibold text-center">
                Switch Anyway
              </Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
