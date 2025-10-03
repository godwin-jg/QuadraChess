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
  const [shouldShow, setShouldShow] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (isVisible && message) {
      // 🔊 Play notification sound
      try {
        const soundService = require('../../../services/soundService').default;
        soundService.playNotifySound();
      } catch (error) {
        console.log('🔊 SoundService: Failed to play notification sound:', error);
      }

      // Show notification
      setShouldShow(true);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Auto-dismiss after duration
      const timer = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }).start(() => {
          setShouldShow(false);
        });
      }, duration);

      return () => clearTimeout(timer);
    } else {
      // Hide notification immediately
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start(() => {
        setShouldShow(false);
      });
    }
  }, [isVisible, message, duration, fadeAnim]);

  if (!shouldShow) return null;

  return (
    <Animated.View
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
        opacity: fadeAnim,
        transform: [
          {
            scale: fadeAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [0.8, 1],
            }),
          },
        ],
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
    </Animated.View>
  );
}
