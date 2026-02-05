import React from "react";
import { View, Text, Pressable, Modal, Platform } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

interface UpdatePromptModalProps {
  visible: boolean;
  currentVersion: string;
  latestVersion: string;
  updateMessage: string;
  forceUpdate: boolean;
  onUpdate: () => void;
  onLater: () => void;
}

export default function UpdatePromptModal({
  visible,
  currentVersion,
  latestVersion,
  updateMessage,
  forceUpdate,
  onUpdate,
  onLater,
}: UpdatePromptModalProps) {
  const storeName = Platform.OS === "ios" ? "App Store" : "Play Store";

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View className="flex-1 bg-black/50 justify-center items-center px-6">
        <View className="bg-gray-900/90 rounded-3xl p-6 max-w-sm w-full shadow-2xl border border-gray-700">
          {/* Icon */}
          <View className="items-center mb-4">
            <View className="bg-blue-600/20 rounded-full p-4">
              <MaterialIcons name="system-update" size={48} color="#3B82F6" />
            </View>
          </View>

          {/* Title */}
          <Text className="text-2xl font-bold text-center mb-2 text-white">
            {forceUpdate ? "Update Required" : "Update Available"}
          </Text>

          {/* Version info */}
          <View className="bg-gray-800 rounded-xl p-3 mb-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-400 text-sm">Current version</Text>
              <Text className="text-gray-300 font-semibold">{currentVersion}</Text>
            </View>
            <View className="h-px bg-gray-700 my-2" />
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-400 text-sm">New version</Text>
              <Text className="text-green-400 font-semibold">{latestVersion}</Text>
            </View>
          </View>

          {/* Update message */}
          <Text className="text-base text-center mb-6 text-gray-300 leading-6">
            {updateMessage}
          </Text>

          {/* Warning for forced updates */}
          {forceUpdate && (
            <View className="bg-red-900/30 border border-red-700 rounded-xl p-3 mb-4">
              <Text className="text-red-300 text-sm text-center">
                This update is required to continue using the app. Please update to the latest version.
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View className="space-y-3">
            {/* Update button */}
            <Pressable
              onPress={onUpdate}
              className="overflow-hidden rounded-xl active:opacity-80"
            >
              <LinearGradient
                colors={["#3B82F6", "#2563EB"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                className="py-4 px-6"
              >
                <View className="flex-row items-center justify-center">
                  <MaterialIcons name="get-app" size={20} color="white" />
                  <Text className="text-white text-lg font-bold ml-2">
                    Update from {storeName}
                  </Text>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Later button - only show if not forced */}
            {!forceUpdate && (
              <Pressable
                onPress={onLater}
                className="bg-gray-800 py-4 px-6 rounded-xl active:opacity-70 border border-gray-700"
              >
                <Text className="text-gray-400 text-lg font-semibold text-center">
                  Maybe Later
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}
