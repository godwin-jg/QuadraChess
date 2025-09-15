import React, { useEffect, useState } from "react";
import { View, Text, Animated } from "react-native";

interface GameNotificationProps {
  message: string;
  isVisible: boolean;
  duration?: number;
}

export default function GameNotification({
  message,
  isVisible,
  duration = 3000,
}: GameNotificationProps) {
  if (!isVisible || !message) return null;

  return (
    <View
      style={{
        position: "absolute",
        top: 40,
        left: 20,
        right: 20,
        zIndex: 9999,
        backgroundColor: "rgba(0, 0, 0, 0.9)",
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <Text
        style={{
          color: "#FFD700",
          fontSize: 20,
          fontWeight: "800",
          textAlign: "center",
          letterSpacing: 0.5,
          textShadowColor: "#000",
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        }}
      >
        {message}
      </Text>
    </View>
  );
}
