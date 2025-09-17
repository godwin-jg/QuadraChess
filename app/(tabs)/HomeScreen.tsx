import { TouchableOpacity, Text } from "react-native";
import { Link } from "expo-router";
import { View } from "@/components/Themed";

export default function HomeScreen() {
  return (
    <View className="flex-1 bg-black">
      <View className="flex-1 px-6 pt-16 pb-8 justify-between">
        {/* Header Section */}
        <View className="items-center mb-8">
          <Text className="text-4xl font-bold text-white text-center mb-2">
            ♔ Four Player Chess ♔
          </Text>
          <Text className="text-lg text-gray-300 text-center mb-4">
            Strategic Multiplayer Chess
          </Text>
          <View className="w-20 h-20 rounded-full bg-white/10 justify-center items-center border-2 border-white/20">
            <Text className="text-4xl text-white">♛</Text>
          </View>
        </View>

        {/* Buttons Section */}
        <View className="gap-3">
          <Link href="/(tabs)/GameScreen" asChild>
            <TouchableOpacity className="bg-white py-3 px-5 rounded-xl shadow-lg active:opacity-80 items-center">
              <Text className="text-2xl text-center mb-1">🎮</Text>
              <Text className="text-black text-lg font-bold text-center mb-1">
                Single Player
              </Text>
              <Text className="text-gray-600 text-xs text-center">
                Play against AI
              </Text>
            </TouchableOpacity>
          </Link>

          <Link href="/(tabs)/LobbyScreen" asChild>
            <TouchableOpacity className="bg-white/20 py-3 px-5 rounded-xl border-2 border-white/30 shadow-lg active:opacity-80 items-center">
              <Text className="text-2xl text-center mb-1">🏠</Text>
              <Text className="text-white text-lg font-bold text-center mb-1">
                Local Multiplayer
              </Text>
              <Text className="text-gray-300 text-xs text-center">
                Play with friends
              </Text>
            </TouchableOpacity>
          </Link>

          <TouchableOpacity className="bg-blue-600 py-3 px-5 rounded-xl shadow-lg active:opacity-80 items-center">
            <Text className="text-2xl text-center mb-1">🌍</Text>
            <Text className="text-white text-lg font-bold text-center mb-1">
              Online Multiplayer
            </Text>
            <Text className="text-blue-100 text-xs text-center">
              Coming Soon
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
