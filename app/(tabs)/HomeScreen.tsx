import { View } from "@/components/Themed";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Text, TouchableOpacity } from "react-native";
import modeSwitchService from "../../services/modeSwitchService";
import TestGallery from "../components/board/TestGallery";

export default function HomeScreen() {
  const router = useRouter();
  const [isNavigating, setIsNavigating] = useState(false);
  const [showTestGallery, setShowTestGallery] = useState(false);

  const handleModeSwitch = async (
    targetMode: "online" | "local" | "solo",
    path: string
  ) => {
    if (isNavigating) return;

    setIsNavigating(true);

    try {
      await modeSwitchService.handleModeSwitch(
        targetMode,
        () => {
          // Confirm: Navigate to the target mode
          router.push(path as any);
        },
        () => {
          // Cancel: Stay on current screen
          console.log("Mode switch cancelled by user");
        }
      );
    } finally {
      setIsNavigating(false);
    }
  };

  if (showTestGallery) {
    return <TestGallery onBack={() => setShowTestGallery(false)} />;
  }

  return (
    <View className="flex-1 bg-black">
      {/* Top Navigation Bar */}
      <View className="flex-row justify-between items-center px-6 pt-16 pb-4">
        <View className="w-10" />
        <Text className="text-2xl font-bold text-white">
          ♔ Four Player Chess ♔
        </Text>
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/10 justify-center items-center border border-white/20"
          onPress={() => router.push("/settings")}
        >
          <Text className="text-xl">⚙️</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pb-8 justify-between">
        {/* Header Section */}
        <View className="items-center mb-8">
          <Text className="text-lg text-gray-300 text-center mb-4">
            Strategic Multiplayer Chess
          </Text>
          <View className="w-20 h-20 rounded-full bg-white/10 justify-center items-center border-2 border-white/20">
            <Text className="text-4xl text-white">♛</Text>
          </View>
        </View>

        {/* Buttons Section */}
        <View className="gap-3">
          <TouchableOpacity
            className="bg-white py-3 px-5 rounded-xl shadow-lg active:opacity-80 items-center"
            onPress={() =>
              handleModeSwitch("single", "/(tabs)/GameScreen?mode=single")
            }
            disabled={isNavigating}
          >
            <Text className="text-2xl text-center mb-1">🤖</Text>
            <Text className="text-black text-lg font-bold text-center mb-1">
              Single Player
            </Text>
            <Text className="text-gray-600 text-xs text-center">
              Play against AI
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-white/20 py-3 px-5 rounded-xl border-2 border-white/30 shadow-lg active:opacity-80 items-center"
            onPress={() => handleModeSwitch("local", "/(tabs)/LobbyScreen")}
            disabled={isNavigating}
          >
            <Text className="text-2xl text-center mb-1">🏠</Text>
            <Text className="text-white text-lg font-bold text-center mb-1">
              Local Multiplayer
            </Text>
            <Text className="text-gray-300 text-xs text-center">
              Play with friends
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-blue-600 py-3 px-5 rounded-xl shadow-lg active:opacity-80 items-center"
            onPress={() =>
              handleModeSwitch("online", "/(tabs)/OnlineLobbyScreen")
            }
            disabled={isNavigating}
          >
            <Text className="text-2xl text-center mb-1">🌍</Text>
            <Text className="text-white text-lg font-bold text-center mb-1">
              Online Multiplayer
            </Text>
            <Text className="text-blue-100 text-xs text-center">
              Play online
            </Text>
          </TouchableOpacity>

          {/* Temporary Test Button */}
          <TouchableOpacity
            className="bg-purple-600 py-3 px-5 rounded-xl shadow-lg active:opacity-80 items-center mt-4"
            onPress={() => setShowTestGallery(true)}
          >
            <Text className="text-2xl text-center mb-1">🧪</Text>
            <Text className="text-white text-lg font-bold text-center mb-1">
              Test Gallery
            </Text>
            <Text className="text-purple-100 text-xs text-center">
              View all test components
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Section */}
        <View className="flex-row justify-around px-5 mt-4">
          <View className="items-center flex-1">
            <Text className="text-2xl mb-2">👥</Text>
            <Text className="text-gray-300 text-sm font-semibold text-center">
              Up to 4 Players
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl mb-2">⚡</Text>
            <Text className="text-gray-300 text-sm font-semibold text-center">
              Real-time Play
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl mb-2">🏆</Text>
            <Text className="text-gray-300 text-sm font-semibold text-center">
              Strategic Gameplay
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}
