import React, { useEffect } from "react";
import { Text, TouchableOpacity, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSpring,
  withDelay
} from "react-native-reanimated";
import { hapticsService } from "@/services/hapticsService";
import soundService from "@/services/soundService";

// --- Reusable AnimatedButton Component ---
interface AnimatedButtonProps {
  onPress: () => void;
  disabled: boolean;
  gradientColors: string[];
  icon: string;
  title: string;
  subtitle: string;
  textColor?: string;
  subtitleColor?: string;
  delay?: number;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  onPress,
  disabled,
  gradientColors,
  icon,
  title,
  subtitle,
  textColor = "black",
  subtitleColor = "gray-600",
  delay = 0,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  // Staggered entrance animation for each button
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 12, stiffness: 80 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    // ✅ No automatic haptics - each action handles its own haptics through soundService
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        className="py-3 px-5 rounded-xl shadow-lg active:opacity-80 items-center overflow-hidden"
        style={{
          shadowOffset: { width: 0, height: 8 },
          shadowRadius: 12,
          elevation: 8,
        }}
      >
        <LinearGradient
          colors={gradientColors as any}
          style={[StyleSheet.absoluteFill, { borderRadius: 12 }]}
        />
        <Text className="text-2xl text-center mb-1">{icon}</Text>
        <Text
          style={{
            color: textColor,
            fontWeight: '900',
            letterSpacing: 1.2,
            textShadowColor: 'rgba(0,0,0,0.3)',
            textShadowOffset: {width: 1, height: 1},
            textShadowRadius: 2,
            textTransform: 'uppercase',
          }}
          className="text-lg font-extrabold text-center mb-1 tracking-wider"
        >
          {title}
        </Text>
        <Text
          style={{
            fontWeight: '600',
            letterSpacing: 0.8,
          }}
          className={`text-xs text-center font-semibold tracking-widest uppercase ${subtitleColor}`}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default AnimatedButton;
