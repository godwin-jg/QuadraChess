import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView, Dimensions } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming,
  FadeIn,
  FadeInDown
} from "react-native-reanimated";
import RadialGlowBackground from "../components/ui/RadialGlowBackground";
import GridBackground from "../components/ui/GridBackground";
import { hapticsService } from "@/services/hapticsService";
import { getTabBarSpacer } from "../utils/responsive";

const FONTS = {
  title: "Rajdhani_700Bold",
  heading: "Rajdhani_600SemiBold",
  body: "Rajdhani_500Medium",
};

const { width: SCREEN_WIDTH } = Dimensions.get("window");

type TutorialStep = {
  id: string;
  title: string;
  icon: string;
  iconColor: string;
  content: string[];
};

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: "basics",
    title: "The Basics",
    icon: "chess-board",
    iconColor: "#ef4444",
    content: [
      "Quadra Chess is played on a 14×14 board with 4 players.",
      "Each player starts with a full set of chess pieces in one of the four corners.",
      "Players are assigned colors: Red, Blue, Purple, and Green.",
      "Don't have 4 players? Add AI bots to fill empty slots and start playing!",
      "The player with the highest score wins (more info in Scoring section).",
    ],
  },
  {
    id: "turns",
    title: "Turn Order",
    icon: "rotate-right",
    iconColor: "#3b82f6",
    content: [
      "Players take turns in clockwise order: Red → Blue → Purple → Green.",
      "Each player makes one move per turn, just like standard chess.",
      "If a player is eliminated, their turn is skipped.",
      "The game continues until only one player (or team) remains.",
    ],
  },
  {
    id: "teams",
    title: "Team Mode",
    icon: "account-group",
    iconColor: "#a855f7",
    content: [
      "In Team Mode, players form two teams of two.",
      "Teammates sit on opposite sides of the board (Red+Purple vs Blue+Green by default).",
      "If one teammate is checkmated or times out, the whole team loses!",
      "Coordinate with your teammate to protect each other and attack together.",
    ],
  },
  {
    id: "pieces",
    title: "Piece Movement",
    icon: "chess-queen",
    iconColor: "#22c55e",
    content: [
      "All pieces move the same as in standard chess.",
      "Pawns promote when reaching the opposite edge or the center promotion ranks.",
      "Castling is available if king and rook haven't moved.",
      "En passant captures work as in traditional chess.",
    ],
  },
  {
    id: "scoring",
    title: "Scoring",
    icon: "trophy",
    iconColor: "#06b6d4",
    content: [
      "Earn points by capturing opponent pieces based on their value.",
      "Pawn = 1 pt, Knight = 3 pts, Bishop = 5 pts, Rook = 5 pts, Queen = 9 pts.",
      "Checkmate an opponent to earn a +20 point bonus.",
      "Stalemate an opponent to earn +10 points per player still in the game.",
      "You can win by capturing the most pieces even without checkmating anyone!",
    ],
  },
  {
    id: "strategy",
    title: "Strategy Tips",
    icon: "lightbulb",
    iconColor: "#f59e0b",
    content: [
      "Watch all four sides - attacks can come from anywhere!",
      "Control the center to maximize your piece mobility.",
      "In team games, coordinate attacks with your partner.",
      "Sometimes defense is the best offense - protect your king!",
    ],
  },
];

export default function TutorialScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const tabBarSpacer = getTabBarSpacer(insets.bottom);
  const [activeStep, setActiveStep] = useState(0);

  const currentStep = TUTORIAL_STEPS[activeStep];

  const handleNext = () => {
    hapticsService.buttonPress();
    if (activeStep < TUTORIAL_STEPS.length - 1) {
      setActiveStep(activeStep + 1);
    }
  };

  const handlePrev = () => {
    hapticsService.buttonPress();
    if (activeStep > 0) {
      setActiveStep(activeStep - 1);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-black">
      <RadialGlowBackground />
      <GridBackground />

      <View className="flex-1" style={{ zIndex: 1 }}>
        {/* Header */}
        <View className="flex-row items-center px-6 pt-4 pb-4">
          <TouchableOpacity
            className="w-10 h-10 rounded-full justify-center items-center mr-4"
            style={{ backgroundColor: "rgba(255,255,255,0.08)" }}
            onPress={() => {
              hapticsService.buttonPress();
              router.back();
            }}
          >
            <MaterialCommunityIcons
              name="arrow-left"
              size={22}
              color="rgba(255,255,255,0.6)"
            />
          </TouchableOpacity>
          <Text
            className="text-2xl text-white"
            style={{ fontFamily: FONTS.title, letterSpacing: 1 }}
          >
            How to Play
          </Text>
        </View>

        {/* Step Indicators */}
        <View className="flex-row justify-center gap-2 px-6 mb-6">
          {TUTORIAL_STEPS.map((step, index) => (
            <TouchableOpacity
              key={step.id}
              onPress={() => {
                hapticsService.buttonPress();
                setActiveStep(index);
              }}
              className="flex-1 h-1 rounded-full"
              style={{
                backgroundColor:
                  index === activeStep
                    ? currentStep.iconColor
                    : "rgba(255,255,255,0.15)",
              }}
            />
          ))}
        </View>

        {/* Content */}
        <ScrollView
          className="flex-1 px-6"
          contentContainerStyle={{ paddingBottom: tabBarSpacer + 100 }}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            key={currentStep.id}
            entering={FadeIn.duration(300)}
          >
            {/* Step Icon & Title */}
            <View className="items-center mb-8">
              <View
                className="w-20 h-20 rounded-2xl justify-center items-center mb-4"
                style={{
                  backgroundColor: `${currentStep.iconColor}20`,
                  borderWidth: 1,
                  borderColor: `${currentStep.iconColor}40`,
                }}
              >
                <MaterialCommunityIcons
                  name={currentStep.icon as any}
                  size={40}
                  color={currentStep.iconColor}
                />
              </View>
              <Text
                className="text-2xl text-white text-center"
                style={{ fontFamily: FONTS.heading }}
              >
                {currentStep.title}
              </Text>
              <Text
                className="text-sm mt-1"
                style={{
                  color: "rgba(255,255,255,0.4)",
                  fontFamily: FONTS.body,
                }}
              >
                Step {activeStep + 1} of {TUTORIAL_STEPS.length}
              </Text>
            </View>

            {/* Content Cards */}
            <View className="gap-3">
              {currentStep.content.map((text, index) => (
                <Animated.View
                  key={index}
                  entering={FadeInDown.delay(index * 100).duration(400)}
                  className="p-4 rounded-xl"
                  style={{
                    backgroundColor: "rgba(255,255,255,0.05)",
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.1)",
                  }}
                >
                  <View className="flex-row items-start">
                    <View
                      className="w-6 h-6 rounded-full justify-center items-center mr-3 mt-0.5"
                      style={{ backgroundColor: `${currentStep.iconColor}30` }}
                    >
                      <Text
                        style={{
                          color: currentStep.iconColor,
                          fontFamily: FONTS.heading,
                          fontSize: 12,
                        }}
                      >
                        {index + 1}
                      </Text>
                    </View>
                    <Text
                      className="flex-1 text-base"
                      style={{
                        color: "rgba(255,255,255,0.8)",
                        fontFamily: FONTS.body,
                        lineHeight: 24,
                      }}
                    >
                      {text}
                    </Text>
                  </View>
                </Animated.View>
              ))}
            </View>
          </Animated.View>
        </ScrollView>

        {/* Navigation Buttons */}
        <View
          className="flex-row gap-3 px-6 pt-4"
          style={{ paddingBottom: tabBarSpacer + 16 }}
        >
          <TouchableOpacity
            className="flex-1 py-4 rounded-xl flex-row justify-center items-center"
            style={{
              backgroundColor:
                activeStep > 0 ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
              borderWidth: 1,
              borderColor:
                activeStep > 0 ? "rgba(255,255,255,0.15)" : "rgba(255,255,255,0.05)",
            }}
            onPress={handlePrev}
            disabled={activeStep === 0}
          >
            <MaterialCommunityIcons
              name="chevron-left"
              size={20}
              color={activeStep > 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)"}
            />
            <Text
              className="text-base ml-1"
              style={{
                color: activeStep > 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.2)",
                fontFamily: FONTS.heading,
              }}
            >
              Previous
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            className="flex-1 py-4 rounded-xl flex-row justify-center items-center"
            style={{
              backgroundColor:
                activeStep < TUTORIAL_STEPS.length - 1
                  ? currentStep.iconColor
                  : "#22c55e",
            }}
            onPress={
              activeStep < TUTORIAL_STEPS.length - 1
                ? handleNext
                : () => {
                    hapticsService.buttonPress();
                    router.back();
                  }
            }
          >
            <Text
              className="text-base mr-1"
              style={{ color: "#000", fontFamily: FONTS.heading }}
            >
              {activeStep < TUTORIAL_STEPS.length - 1 ? "Next" : "Start Playing"}
            </Text>
            <MaterialCommunityIcons
              name={activeStep < TUTORIAL_STEPS.length - 1 ? "chevron-right" : "play"}
              size={20}
              color="#000"
            />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
}
