import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, Alert, ScrollView } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch } from 'react-redux';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay,
  withSpring
} from "react-native-reanimated";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { hapticsService } from "@/services/hapticsService";
import modeSwitchService from "../../services/modeSwitchService";
import { resetGame, setBotPlayers, setBotDifficulty, setBotTeamMode, setGameMode } from '../../state/gameSlice';
import { useSettings } from "../../context/SettingsContext";
import type { BotDifficulty } from "../../config/gameConfig";
import Svg, { G, Path } from "react-native-svg";
import RadialGlowBackground from "../components/ui/RadialGlowBackground";
import GridBackground from "../components/ui/GridBackground";
import FloatingPieces from "@/app/components/ui/FloatingPieces";
import { getTabBarSpacer } from "../utils/responsive";

const HOME_FONTS = {
  title: "Rajdhani_700Bold",
  heading: "Rajdhani_600SemiBold",
  body: "Rajdhani_500Medium",
};

type QuoteEntry = {
  text: string;
  author?: string;
};

const rawQuotes = require("../../assets/chessQuotes.json");

const normalizeQuotes = (data: any): QuoteEntry[] => {
  const list = Array.isArray(data?.quotes)
    ? data.quotes
    : Array.isArray(data?.data)
    ? data.data
    : Array.isArray(data)
    ? data
    : [];

  return list
    .map((item: any) => {
      if (typeof item === "string") {
        const trimmed = item.trim();
        return trimmed ? { text: trimmed } : null;
      }

      if (item && typeof item === "object") {
        const text =
          typeof item.text === "string"
            ? item.text.trim()
            : typeof item.quote === "string"
            ? item.quote.trim()
            : typeof item.message === "string"
            ? item.message.trim()
            : "";
        const author =
          typeof item.author === "string"
            ? item.author.trim()
            : typeof item.by === "string"
            ? item.by.trim()
            : typeof item.source === "string"
            ? item.source.trim()
            : undefined;

        return text ? { text, author } : null;
      }

      return null;
    })
    .filter((entry: QuoteEntry | null): entry is QuoteEntry => Boolean(entry));
};

const QUOTES = normalizeQuotes(rawQuotes);

const getDailyQuote = (quotes: QuoteEntry[]) => {
  if (!quotes.length) return null;
  const today = new Date();
  const dayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const seed = Math.floor(dayKey / 86400000);
  const index = (seed * 9301 + 49297) % quotes.length;
  return quotes[index];
};

// --- Reusable AnimatedButton Component ---
interface AnimatedButtonProps {
  onPress: () => void;
  disabled: boolean;
  iconName: string;
  iconColor: string;
  title: string;
  subtitle: string;
  borderColor?: string;
  delay?: number;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  onPress,
  disabled,
  iconName,
  iconColor,
  title,
  subtitle,
  borderColor = "rgba(255,255,255,0.15)",
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

  const iconFill =
    iconColor.startsWith("#") && iconColor.length === 7
      ? `${iconColor}26`
      : "rgba(255,255,255,0.08)";

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={disabled}
        className="py-4 px-5 rounded-2xl active:opacity-80 flex-row items-center overflow-hidden"
        style={{
          backgroundColor: 'rgba(255,255,255,0.05)',
          borderWidth: 1,
          borderColor: borderColor,
        }}
      >
        <View 
          className="w-12 h-12 rounded-xl justify-center items-center mr-4"
          style={{ 
            backgroundColor: iconFill,
          }}
        >
          <MaterialCommunityIcons name={iconName as any} size={26} color={iconColor} />
        </View>
        <View className="flex-1">
          <Text
            className="text-xl tracking-wide"
            style={{ color: '#ffffff', fontFamily: HOME_FONTS.heading }}
          >
            {title}
          </Text>
          <Text 
            className="text-base mt-0.5"
            style={{ color: 'rgba(255,255,255,0.5)', fontFamily: HOME_FONTS.body }}
          >
            {subtitle}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-right" size={24} color="rgba(255,255,255,0.3)" />
      </TouchableOpacity>
    </Animated.View>
  );
};

const DIFFICULTY_LABELS: Record<BotDifficulty, string> = {
  easy: "Easy",
  medium: "Medium",
  hard: "Hard",
  superHard: "Super Hard",
};

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
  const tabBarSpacer = getTabBarSpacer(insets.bottom);
  const [isNavigating, setIsNavigating] = useState(false);
  const botDifficulty = (settings.game.botDifficulty || "easy") as BotDifficulty;
  const difficultyLabel = DIFFICULTY_LABELS[botDifficulty] ?? "Easy";
  const dailyQuote = getDailyQuote(QUOTES);

  const handleStartSinglePlayer = () => {
    // Set default bot players and start single player game
    hapticsService.buttonPress();
    
    // Get fresh settings from service to ensure we have latest values
    // (avoids stale closure issues with freezeOnBlur)
    const settingsService = require('../../services/settingsService').settingsService;
    const currentSettings = settingsService.getSettings();
    const currentBotDifficulty = (currentSettings.game.botDifficulty || "easy") as BotDifficulty;
    const currentBotTeamMode = currentSettings.game.botTeamMode || false;
    
    // ✅ CRITICAL FIX: Set game mode BEFORE resetGame() so the reset sees the correct mode
    // resetGame() uses the current gameMode to determine if gameStatus should be "active"
    // If we set mode after reset, the status stays "waiting" until the second click
    dispatch(setGameMode("single")); // Set game mode first!
    dispatch(resetGame()); // Now reset will see "single" mode and set status to "active"
    dispatch(setBotPlayers(['b', 'y', 'g'])); // Default to 3 AI players (Blue, Purple, Green)
    dispatch(setBotDifficulty(currentBotDifficulty));
    dispatch(setBotTeamMode(currentBotTeamMode));
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
        }
      );
    } finally {
      setIsNavigating(false);
    }
  };

  // Animated styles
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-black">
      {/* Subtle radial glow background */}
      <RadialGlowBackground />
      
      {/* Grid overlay for tactical texture */}
      <GridBackground />
      
      {/* Background Chess Pieces */}
      <FloatingPieces />

      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
      <View className="flex-1" style={{ zIndex: 1 }}>
      {/* Top Navigation Bar */}
      <View className="flex-row justify-end items-center px-6 pt-4 pb-2">
        <TouchableOpacity
          className="w-10 h-10 rounded-full justify-center items-center"
          style={{ backgroundColor: 'rgba(255,255,255,0.08)' }}
          onPress={async () => {
            try {
              const soundService = require('../../services/soundService').default;
            } catch (error) {
            }
            router.push("/settings");
          }}
        >
          <MaterialCommunityIcons name="cog-outline" size={22} color="rgba(255,255,255,0.6)" />
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 justify-between" style={{ paddingBottom: tabBarSpacer }}>
        {/* Header Section */}
        <View className="items-center mt-3">
          {/* Logo Icon */}
          <View 
            className="w-24 h-24 rounded-3xl justify-center items-center mb-4"
            style={{ 
              backgroundColor: 'rgba(255,255,255,0.08)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.1)',
            }}
          >
            <Svg width={52} height={52} viewBox="0 0 48 48">
              <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <Path d="M22.5 11.63V6M20 8h5 M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5 M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7 M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" />
              </G>
            </Svg>
          </View>
          
          {/* Title */}
          <Text 
            className="text-3xl text-white tracking-widest mb-1"
            style={{ letterSpacing: 3, fontFamily: HOME_FONTS.title }}
          >
            QUADRA CHESS
          </Text>
          <Text 
            className="text-sm tracking-wider"
            style={{ color: 'rgba(255,255,255,0.4)', fontFamily: HOME_FONTS.body }}
          >
            4-Player Strategic Chess
          </Text>
          {dailyQuote && (
            <View className="mt-6 px-4">
              <Text
                className="text-sm text-center"
                style={{
                  color: "rgba(255,255,255,0.55)",
                  fontFamily: HOME_FONTS.body,
                  fontStyle: "italic",
                }}
              >
                "{dailyQuote.text}"
              </Text>
              {dailyQuote.author ? (
                <Text
                  className="text-xs text-center mt-2"
                  style={{
                    color: "rgba(255,255,255,0.35)",
                    fontFamily: HOME_FONTS.body,
                  }}
                >
                  — {dailyQuote.author}
                </Text>
              ) : null}
            </View>
          )}
        </View>

        {/* Buttons Section */}
        <View className="gap-3">
          <AnimatedButton
            delay={300}
            iconName="robot"
            iconColor="#ef4444"
            title="Single Player"
            subtitle={`Play vs AI · ${difficultyLabel}`}
            borderColor="rgba(239, 68, 68, 0.3)"
            onPress={handleStartSinglePlayer}
            disabled={isNavigating}
          />
          <AnimatedButton
            delay={450}
            iconName="account-multiple"
            iconColor="#a855f7"
            title="Local Multiplayer"
            subtitle="Play with friends nearby"
            borderColor="rgba(168, 85, 247, 0.3)"
            onPress={() => handleModeSwitch("local", "/(tabs)/P2PLobbyScreen")}
            disabled={isNavigating}
          />
          <AnimatedButton
            delay={600}
            iconName="cloud-outline"
            iconColor="#3b82f6"
            title="Online Multiplayer"
            subtitle="Challenge players worldwide"
            borderColor="rgba(59, 130, 246, 0.3)"
            onPress={() => handleModeSwitch("online", "/(tabs)/OnlineLobbyScreen")}
            disabled={isNavigating}
          />
          <AnimatedButton
            delay={750}
            iconName="school"
            iconColor="#22c55e"
            title="How to Play"
            subtitle="Learn the rules & strategies"
            borderColor="rgba(34, 197, 94, 0.3)"
            onPress={() => {
              hapticsService.buttonPress();
              router.push("/(tabs)/TutorialScreen" as any);
            }}
            disabled={isNavigating}
          />
        </View>

        {/* Features Section */}
        <View className="flex-row justify-center items-center gap-6 pb-2">
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="account-group-outline" size={18} color="rgba(255,255,255,0.35)" />
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: HOME_FONTS.body }}>
                4 Players
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontFamily: HOME_FONTS.body }}>•</Text>
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="timer-outline" size={18} color="rgba(255,255,255,0.35)" />
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: HOME_FONTS.body }}>
                Real-time
              </Text>
            </View>
            <Text style={{ color: 'rgba(255,255,255,0.15)', fontFamily: HOME_FONTS.body }}>•</Text>
            <View className="flex-row items-center gap-2">
              <MaterialCommunityIcons name="chess-queen" size={18} color="rgba(255,255,255,0.35)" />
              <Text style={{ color: 'rgba(255,255,255,0.35)', fontSize: 12, fontFamily: HOME_FONTS.body }}>
                Strategic
              </Text>
            </View>
          </View>
        </View>
      </View>
      </ScrollView>

    </SafeAreaView>
  );
}
