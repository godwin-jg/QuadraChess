// Server startup guide component
import React from "react";
import { View, Text, TouchableOpacity, Alert } from "react-native";

interface ServerStartupGuideProps {
  onDismiss: () => void;
  serverInfo?: { host: string; port: number };
}

export default function ServerStartupGuide({
  onDismiss,
  serverInfo,
}: ServerStartupGuideProps) {
  const showServerInstructions = () => {
    const instructions = serverInfo
      ? `To start the server:\n\n1. Open terminal/command prompt\n2. Navigate to the project folder\n3. Run: node server.js\n4. Server will start on ${serverInfo.host}:${serverInfo.port}\n\nOther players can then join your game!`
      : `To start the server:\n\n1. Open terminal/command prompt\n2. Navigate to the project folder\n3. Run: node server.js\n4. Server will start on port 3001\n\nOther players can then join your game!`;

    Alert.alert("Server Setup Instructions", instructions);
  };

  return (
    <View className="flex-1 bg-black/50 justify-center items-center p-6">
      <View className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm">
        <Text className="text-white text-2xl font-bold text-center mb-4">
          🚀 Start Server
        </Text>

        <Text className="text-gray-300 text-center mb-6">
          To host a game, you need to start the server first
        </Text>

        {serverInfo && (
          <View className="bg-gray-700 p-4 rounded-xl mb-6">
            <Text className="text-white text-lg font-semibold mb-2">
              Server Details:
            </Text>
            <Text className="text-gray-300">Host: {serverInfo.host}</Text>
            <Text className="text-gray-300">Port: {serverInfo.port}</Text>
          </View>
        )}

        <View className="space-y-3">
          <TouchableOpacity
            className="bg-blue-600 py-3 px-4 rounded-xl"
            onPress={showServerInstructions}
          >
            <Text className="text-white text-center font-semibold">
              Show Instructions
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="bg-gray-600 py-3 px-4 rounded-xl"
            onPress={onDismiss}
          >
            <Text className="text-white text-center font-semibold">
              I'll Start It Later
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

