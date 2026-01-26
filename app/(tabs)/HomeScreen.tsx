import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, Alert } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from 'react-redux';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  withSpring
} from "react-native-reanimated";
import { hapticsService } from "@/services/hapticsService";
import modeSwitchService from "../../services/modeSwitchService";
import { resetGame, setBotPlayers, setBotDifficulty, setBotTeamMode, setGameMode } from '../../state/gameSlice';
import { useSettings } from "../../context/SettingsContext";
// import Piece from "../../components/board/Piece";
import Svg, { G, Path } from "react-native-svg";
import GridBackground from "../components/ui/GridBackground";
import FloatingPieces from "@/app/components/ui/FloatingPieces";

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
    hapticsService.buttonPress();
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
              className="py-3 px-5 rounded-xl active:opacity-80 items-center overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
        <LinearGradient 
          colors={gradientColors as any} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} 
        />
        <Text className="text-2xl text-center mb-1">{icon}</Text>
        <Text
          className="text-lg font-extrabold text-center mb-1 tracking-wider"
          style={{ 
            color: textColor === 'white' ? '#ffffff' : '#000000',
            fontWeight: '900', 
            letterSpacing: 1.2, 
            textShadowColor: 'rgba(0,0,0,0.3)', 
            textShadowOffset: {width: 1, height: 1}, 
            textShadowRadius: 2 
          }}
        >
          {title}
        </Text>
        <Text 
          className="text-xs text-center font-semibold tracking-widest uppercase"
          style={{ 
            color: subtitleColor === 'gray-300' ? '#d1d5db' : 
                   subtitleColor === 'blue-100' ? '#dbeafe' : '#6b7280',
            fontWeight: '600', 
            letterSpacing: 0.8 
          }}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { settings } = useSettings();
  const [isNavigating, setIsNavigating] = useState(false);
  const botDifficulty = settings.game.botDifficulty || "easy";
  const difficultyLabel = botDifficulty.charAt(0).toUpperCase() + botDifficulty.slice(1);

  const handleStartSinglePlayer = () => {
    // Set default bot players and start single player game
    hapticsService.buttonPress();
    dispatch(resetGame()); // ✅ CRITICAL FIX: Reset game state first
    dispatch(setGameMode("single")); // Set game mode to single player
    dispatch(setBotPlayers(['b', 'y', 'g'])); // Default to 3 AI players (Blue, Yellow, Green)
    dispatch(
      setBotDifficulty(
        (settings.game.botDifficulty || "easy") as "easy" | "medium" | "hard"
      )
    );
    dispatch(setBotTeamMode(settings.game.botTeamMode || false));
    router.push("/(tabs)/GameScreen");
  };


  const handleModeSwitch = async (
    targetMode: "online" | "local" | "solo",
    path: string
  ) => {
    if (isNavigating) return;

    // ✅ Check if solo mode is enabled and prevent mode switching
    // Get fresh settings from the service to ensure we have the latest state
    const settingsService = require('../../services/settingsService').settingsService;
    const currentSettings = settingsService.getSettings();
    
    if (currentSettings.developer.soloMode) {
      Alert.alert(
        "Solo Mode Active",
        "Solo mode is currently enabled. Please disable it in Settings to switch to other game modes.",
        [
          {
            text: "Go to Settings",
            onPress: () => router.push("/settings")
          },
          {
            text: "Cancel",
            style: "cancel"
          }
        ]
      );
      return;
    }

    setIsNavigating(true);

    try {
      // 🔊 Play home screen button sound
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playButtonHomescreenSound();
      } catch (error) {
      }

      await modeSwitchService.handleModeSwitch(
        targetMode,
        () => {
          // Confirm: Navigate to the target mode immediately
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

  // Animated styles
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-black">
      {/* Subtle blueprint grid background */}
      <GridBackground />
      
      {/* Background Chess Pieces */}
      <FloatingPieces />

      <View className="flex-1" style={{ zIndex: 1 }}>
      {/* Top Navigation Bar */}
      <View className="flex-row justify-between items-center px-6 pt-8 pb-4">
        <View className="w-10" />
        {/* <Text className="text-3xl font-bold text-white">
          ♔ QUAD CHESS ♔
        </Text> */}
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/10 justify-center items-center border border-white/20"
          onPress={async () => {
            try {
              // ✅ CRITICAL FIX: Use sound service to respect haptics settings
              const soundService = require('../../services/soundService').default;
              // Sound effect removed for menu clicks
            } catch (error) {
            }
            router.push("/settings");
          }}
        >
          <Text className="text-xl">⚙️</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pb-16 justify-between mt-8">
        {/* Header Section */}
        
        <View className="items-center mb-8">
          <Text className="text-xl text-gray-300 text-center mb-1 font-semibold" style={{
            letterSpacing: 0.8,
            textShadowColor: 'rgba(0,0,0,0.3)',
            textShadowOffset: {width: 1, height: 1},
            textShadowRadius: 2,
          }}>
            MASTER THE ULTIMATE STRATEGY
          </Text>
          {/* <Text className="text-lg text-gray-400 text-center mb-2 font-medium" style={{
            letterSpacing: 0.5,
          }}>
            Where Four Minds Collide
          </Text> */}
          {/* Main column container for the new title layout */}
          <View className="items-center mb-4">
            {/* Top line of text */}
            {/* <Text className="text-xl font-semibold text-gray-300 tracking-wider">
              4 PLAYERS
            </Text> */}

            {/* Bottom line with flanking icons */}
            <View className="flex-row items-center justify-center">
              {/* <Svg width={32} height={32} viewBox="0 0 48 48" className="mr-2">
                <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5 M 4,12 A 2,2 0 1,1 8,12 A 2,2 0 1,1 4,12 M 12,9 A 2,2 0 1,1 16,9 A 2,2 0 1,1 12,9 M 20.5,8 A 2,2 0 1,1 24.5,8 A 2,2 0 1,1 20.5,8 M 29,9 A 2,2 0 1,1 33,9 A 2,2 0 1,1 29,9 M 37,12 A 2,2 0 1,1 41,12 A 2,2 0 1,1 37,12" />
                </G>
              </Svg> */}
              <Text className="text-4xl font-extrabold text-white tracking-widest">
              QUADRA CHESS
              </Text>
              {/* <Svg width={32} height={32} viewBox="0 0 48 48" className="ml-2">
                <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5 M 4,12 A 2,2 0 1,1 8,12 A 2,2 0 1,1 4,12 M 12,9 A 2,2 0 1,1 16,9 A 2,2 0 1,1 12,9 M 20.5,8 A 2,2 0 1,1 24.5,8 A 2,2 0 1,1 20.5,8 M 29,9 A 2,2 0 1,1 33,9 A 2,2 0 1,1 29,9 M 37,12 A 2,2 0 1,1 41,12 A 2,2 0 1,1 37,12" />
                </G>
              </Svg> */}
            </View>
          </View>
            <View className="w-20 h-20 rounded-full bg-white/10 justify-center items-center border-2 border-white/20">
              <Svg width={48} height={48} viewBox="0 0 48 48">
                <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M22.5 11.63V6M20 8h5 M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5 M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7 M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" />
                </G>
              </Svg>
            </View>
        </View>

          {/* Buttons Section - Now using the component */}
          <View className="gap-4">
            <AnimatedButton
              delay={300} // Stagger delay
              icon="🦁"
              title="SINGLE PLAYER"
              subtitle={`AI: ${difficultyLabel}`}
              gradientColors={['rgb(255, 255, 255)', 'rgb(245, 200, 200)']}
              onPress={handleStartSinglePlayer}
            disabled={isNavigating}
            />
            <AnimatedButton
              delay={450} // Stagger delay
              icon="🏠"
              title="LOCAL MULTIPLAYER"
              subtitle="Play with friends"
              textColor="white"
              subtitleColor="gray-300"
              gradientColors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              onPress={() => handleModeSwitch("local", "/(tabs)/P2PLobbyScreen")}
            disabled={isNavigating}
            />
            <AnimatedButton
              delay={600} // Stagger delay
              icon="🌍"
              title="ONLINE MULTIPLAYER"
              subtitle="Play online"
              textColor="white"
              subtitleColor="blue-100"
              gradientColors={['rgba(0, 106, 255, 0.35)', 'rgba(155, 173, 234, 0.2)']}
              onPress={() => handleModeSwitch("online", "/(tabs)/OnlineLobbyScreen")}
            disabled={isNavigating}
            />
        </View>

        {/* Features Section */}
        <View className="flex-row justify-around px-5 pb-4 mt-4">
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

    </SafeAreaView>
  );
}
