import React from "react";
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

interface ResignConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  playerName: string;
  isResigning?: boolean;
}

export default function ResignConfirmationModal({
  visible,
  onConfirm,
  onCancel,
  playerName,
  isResigning = false,
}: ResignConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <SafeAreaView className="flex-1 bg-black/70 justify-center items-center">
        <View className="bg-gray-800 rounded-2xl p-6 mx-8 max-w-sm w-full">
          <Text className="text-2xl font-bold text-white text-center mb-4">
            Resign Game
          </Text>
          <Text className="text-lg text-center mb-4 text-gray-300">
            Are you sure you want to resign?
          </Text>
          <Text className="text-sm text-center mb-6 text-red-400">
            This will eliminate you from the game.
          </Text>

          <View className="flex-row gap-3">
            <TouchableOpacity
              className="flex-1 bg-gray-600 py-3 px-4 rounded-xl active:opacity-80"
              onPress={onCancel}
              activeOpacity={0.8}
            >
              <Text className="text-white text-center font-semibold">
                Cancel
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className={`flex-1 py-3 px-4 rounded-xl ${
                isResigning ? 'bg-gray-500' : 'bg-red-600 active:opacity-80'
              }`}
              onPress={onConfirm}
              activeOpacity={isResigning ? 1 : 0.8}
              disabled={isResigning}
            >
              <Text className="text-white text-center font-semibold">
                {isResigning ? 'Resigning...' : 'Resign'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  );
}
