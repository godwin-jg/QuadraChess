import React, { useEffect } from "react";
import { View, Text, Pressable, Modal, ScrollView, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withDelay,
  withTiming,
  withRepeat,
  withSequence
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";

interface PlayerResult {
  color: string;
  name: string;
  score: number;
  isEliminated: boolean;
  eliminationOrder?: number; // 1st eliminated, 2nd eliminated, etc.
}

interface GameOverModalProps {
  status: "checkmate" | "stalemate" | "finished";
  winner?: string;
  eliminatedPlayer?: string;
  justEliminated?: string;
  scores?: { r: number; b: number; y: number; g: number };
  eliminatedPlayers?: string[];
  players?: Array<{ color: string; name: string; isEliminated: boolean }>;
  onReset: () => void;
  onDismiss?: () => void; // ✅ NEW: Optional dismiss callback
}

export default function GameOverModal({
  status,
  winner,
  eliminatedPlayer,
  justEliminated,
  scores = { r: 0, b: 0, y: 0, g: 0 },
  eliminatedPlayers = [],
  players = [],
  onReset,
  onDismiss,
}: GameOverModalProps) {
  const router = useRouter();
  // Create leaderboard data first
  const createLeaderboard = (): PlayerResult[] => {
    const colorNames = { r: "Red", b: "Blue", y: "Yellow", g: "Green" };
    const colorEmojis = { r: "🔴", b: "🔵", y: "🟡", g: "🟢" };
    
    const results: PlayerResult[] = [];
    
    // Add all players with their scores and elimination status
    ['r', 'b', 'y', 'g'].forEach((color) => {
      const player = players.find(p => p.color === color);
      const isEliminated = eliminatedPlayers.includes(color);
      
      results.push({
        color,
        name: player?.name || colorNames[color as keyof typeof colorNames],
        score: scores[color as keyof typeof scores],
        isEliminated,
        eliminationOrder: isEliminated ? eliminatedPlayers.indexOf(color) + 1 : undefined,
      });
    });
    
    // Sort by: 1st = winner (not eliminated), then by elimination order (last eliminated = 2nd place)
    return results.sort((a, b) => {
      if (!a.isEliminated && !b.isEliminated) {
        // Both not eliminated - winner is first
        return a.color === winner ? -1 : 1;
      }
      if (!a.isEliminated) return -1; // Winner first
      if (!b.isEliminated) return 1;  // Winner first
      
      // Both eliminated - sort by elimination order (last eliminated = higher rank)
      return (b.eliminationOrder || 0) - (a.eliminationOrder || 0);
    });
  };

  const leaderboard = createLeaderboard();

  // Animation values
  const modalScale = useSharedValue(0.8);
  const modalOpacity = useSharedValue(0);
  const titleOpacity = useSharedValue(0);
  const messageOpacity = useSharedValue(0);
  const statsOpacity = useSharedValue(0);
  const buttonOpacity = useSharedValue(0);
  
  // Individual player row animations - create shared values at top level (max 4 players)
  const player1Opacity = useSharedValue(0);
  const player1TranslateY = useSharedValue(30);
  const player1Scale = useSharedValue(0.9);
  
  const player2Opacity = useSharedValue(0);
  const player2TranslateY = useSharedValue(30);
  const player2Scale = useSharedValue(0.9);
  
  const player3Opacity = useSharedValue(0);
  const player3TranslateY = useSharedValue(30);
  const player3Scale = useSharedValue(0.9);
  
  const player4Opacity = useSharedValue(0);
  const player4TranslateY = useSharedValue(30);
  const player4Scale = useSharedValue(0.9);
  
  // Winner-specific animations
  const winnerPulseScale = useSharedValue(1);
  const winnerGlowOpacity = useSharedValue(0);
  const winnerShimmerTranslate = useSharedValue(-200);
  
  // Map animations to players
  const playerAnimations = React.useMemo(() => [
    { opacity: player1Opacity, translateY: player1TranslateY, scale: player1Scale },
    { opacity: player2Opacity, translateY: player2TranslateY, scale: player2Scale },
    { opacity: player3Opacity, translateY: player3TranslateY, scale: player3Scale },
    { opacity: player4Opacity, translateY: player4TranslateY, scale: player4Scale }
  ].slice(0, leaderboard.length), [leaderboard.length]);

  // Play game end sound when modal appears
  useEffect(() => {
    try {
      const soundService = require('../../../services/soundService').default;
      soundService.playGameEndSound();
    } catch (error) {
    }

    // Start entrance animation sequence
    modalOpacity.value = withTiming(1, { duration: 300 });
    modalScale.value = withSpring(1, { damping: 15, stiffness: 150 });
    
    // Stagger the content animations
    titleOpacity.value = withDelay(200, withTiming(1, { duration: 400 }));
    messageOpacity.value = withDelay(400, withTiming(1, { duration: 400 }));
    
    // Animate player rows from 4th to 1st place (reverse order for dramatic effect)
    leaderboard.forEach((_, index) => {
      const reverseIndex = leaderboard.length - 1 - index;
      const delay = 600 + (reverseIndex * 150);
      
      playerAnimations[reverseIndex].opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
      playerAnimations[reverseIndex].translateY.value = withDelay(delay, withSpring(0, { damping: 12, stiffness: 200 }));
      playerAnimations[reverseIndex].scale.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 200 }));
    });
    
    // Animate stats and button
    statsOpacity.value = withDelay(1200, withTiming(1, { duration: 400 }));
    buttonOpacity.value = withDelay(1400, withTiming(1, { duration: 400 }));
    
    // Start winner animations after the winner appears
    const winnerDelay = 600 + ((leaderboard.length - 1) * 150) + 300; // After winner appears
    winnerGlowOpacity.value = withDelay(winnerDelay, withTiming(1, { duration: 500 }));
    winnerPulseScale.value = withDelay(winnerDelay, withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1, // Infinite repeat
      false // Don't reverse
    ));
    winnerShimmerTranslate.value = withDelay(winnerDelay + 500, withRepeat(
      withTiming(200, { duration: 2000 }),
      -1, // Infinite repeat
      false // Don't reverse
    ));
  }, []);

  // Helper functions
  const getRankText = (index: number, player: PlayerResult) => {
    if (!player.isEliminated && player.color === winner) {
      return "🥇 1st Place";
    }
    
    const rank = index + 1;
    switch (rank) {
      case 1: return "🥇 1st Place";
      case 2: return "🥈 2nd Place";
      case 3: return "🥉 3rd Place";
      case 4: return "4th Place";
      default: return `${rank}th Place`;
    }
  };

  const getRankColor = (index: number, player: PlayerResult) => {
    if (!player.isEliminated && player.color === winner) {
      return "text-yellow-300"; // Gold for winner
    }
    
    const rank = index + 1;
    switch (rank) {
      case 1: return "text-yellow-300"; // Gold
      case 2: return "text-gray-300";   // Silver
      case 3: return "text-orange-300"; // Bronze
      default: return "text-gray-400";
    }
  };

  const getMessage = () => {
    switch (status) {
      case "finished":
        return `${winner?.toUpperCase()} emerges victorious!`;
      default:
        return "The battle has concluded.";
    }
  };

  const getTitle = () => {
    switch (status) {
      case "finished":
        return "🏆 Victory!";
      default:
        return "Game Complete";
    }
  };

  // Animation styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [{ scale: modalScale.value }],
  }));

  const titleAnimatedStyle = useAnimatedStyle(() => ({
    opacity: titleOpacity.value,
  }));

  const messageAnimatedStyle = useAnimatedStyle(() => ({
    opacity: messageOpacity.value,
  }));

  const statsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: statsOpacity.value,
  }));

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    opacity: buttonOpacity.value,
  }));

  // Winner animation styles
  const winnerPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: winnerPulseScale.value }],
  }));

  const winnerGlowStyle = useAnimatedStyle(() => ({
    opacity: winnerGlowOpacity.value,
  }));

  const winnerShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: winnerShimmerTranslate.value }],
  }));

  return (
    <Modal visible={true} transparent animationType="fade">
      <SafeAreaView className="flex-1 bg-black/70 justify-center items-center px-4 py-8">
        {/* The main animated container for a spring/slide-in effect */}
        <Animated.View 
          className="w-full max-w-md mx-auto rounded-2xl overflow-hidden"
          style={[
            { borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.2)' },
            modalAnimatedStyle
          ]}
        >
          <LinearGradient
            colors={['rgba(31, 41, 55, 0.8)', 'rgba(17, 24, 39, 0.8)']}
            style={StyleSheet.absoluteFill}
          />
          
          {/* Close Button - positioned outside ScrollView */}
          {onDismiss && (
            <Pressable
              onPress={() => {
                try {
                  const { hapticsService } = require('../../../services/hapticsService');
                  hapticsService.buttonPress();
                } catch (error) {
                  // Haptics not critical, continue
                }
                onDismiss();
              }}
              className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-black/30 justify-center items-center active:opacity-70"
            >
              <Text className="text-white text-xl font-bold">×</Text>
            </Pressable>
          )}
          
          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 0 }}
          >
            <View className="p-6">
              <Animated.View style={titleAnimatedStyle}>
                <Text className="text-3xl font-bold text-center mb-4 text-white">
                  {getTitle()}
                </Text>
              </Animated.View>

              <Animated.View style={messageAnimatedStyle}>
                <Text className="text-lg text-center mb-6 text-gray-300 leading-6">
                  {getMessage()}
                </Text>
              </Animated.View>

              {/* Leaderboard */}
              <View className="mb-6">
                <Animated.Text style={messageAnimatedStyle} className="text-xl font-bold text-center mb-4 text-white">
                  🏆 Final Rankings
                </Animated.Text>
                
                {leaderboard.map((player, index) => {
                  const colorEmojis = { r: "🔴", b: "🔵", y: "🟡", g: "🟢" };
                  const isWinner = !player.isEliminated && player.color === winner;
                  const playerAnimation = playerAnimations[index];
                  
                  const playerAnimatedStyle = useAnimatedStyle(() => ({
                    opacity: playerAnimation.opacity.value,
                    transform: [
                      { translateY: playerAnimation.translateY.value },
                      { scale: playerAnimation.scale.value }
                    ],
                  }));
                  
                  return (
                    <Animated.View
                      key={player.color}
                      style={[
                        playerAnimatedStyle,
                        isWinner ? winnerPulseStyle : undefined
                      ]}
                      className={`flex-row items-center justify-between p-3 mb-2 rounded-xl overflow-hidden ${
                        isWinner ? '' : 'bg-white/5 border border-white/10'
                      }`}
                    >
                      {isWinner && (
                        <>
                          {/* More transparent yellow gradient */}
                          <LinearGradient
                            colors={['rgba(255, 215, 0, 0.3)', 'rgba(255, 193, 7, 0.3)']}
                            style={StyleSheet.absoluteFill}
                          />
                          
                          {/* Glow effect */}
                          <Animated.View
                            style={[
                              StyleSheet.absoluteFill,
                              winnerGlowStyle,
                              {
                                backgroundColor: 'rgba(255, 215, 0, 0.1)',
                                borderRadius: 12,
                              }
                            ]}
                          />
                          
                          {/* Shimmer effect */}
                          <Animated.View
                            style={[
                              {
                                position: 'absolute',
                                top: 0,
                                left: -200,
                                width: 200,
                                bottom: 0,
                                backgroundColor: 'transparent',
                                borderRadius: 12,
                              },
                              winnerShimmerStyle
                            ]}
                          >
                            <LinearGradient
                              colors={['transparent', 'transparent', 'rgba(255, 255, 255, 0.4)', 'transparent', 'transparent']}
                              start={{ x: 0, y: 0 }}
                              end={{ x: 1, y: 0 }}
                              style={{
                                width: '100%',
                                height: '100%',
                                borderRadius: 12,
                              }}
                            />
                          </Animated.View>
                        </>
                      )}

                      <View className="flex-row items-center flex-1">
                        {isWinner && (
                          <Text className="text-3xl mr-3">👑</Text>
                        )}
                        <Text className="text-2xl mr-3">
                          {colorEmojis[player.color as keyof typeof colorEmojis]}
                        </Text>
                        <View className="flex-1">
                          <Text className={`font-bold text-lg ${getRankColor(index, player)}`}>
                            {getRankText(index, player)}
                          </Text>
                          <Text className="text-gray-200 font-medium">
                            {player.name}
                          </Text>
                          {player.isEliminated && (
                            <Text className="text-sm text-red-300">
                              Eliminated {player.eliminationOrder === 1 ? '1st' : 
                                         player.eliminationOrder === 2 ? '2nd' : 
                                         player.eliminationOrder === 3 ? '3rd' : '4th'}
                            </Text>
                          )}
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-lg font-bold text-white">
                          {player.score}
                        </Text>
                        <Text className="text-xs text-gray-400">
                          points
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Game Statistics */}
              <Animated.View style={statsAnimatedStyle} className="mb-6">
                <Text className="text-lg font-bold text-center mb-3 text-white">
                  📊 After-Action Report
                </Text>
                <View className="flex-row justify-between gap-2">
                  <View className="flex-1 items-center bg-white/5 p-3 rounded-lg border border-white/10">
                    <Text className="text-3xl font-bold text-blue-400">
                      {eliminatedPlayers.length}
                    </Text>
                    <Text className="text-sm text-gray-300">Eliminated</Text>
                  </View>
                  <View className="flex-1 items-center bg-white/5 p-3 rounded-lg border border-white/10">
                    <Text className="text-3xl font-bold text-green-400">
                      {leaderboard.find(p => !p.isEliminated)?.score || 0}
                    </Text>
                    <Text className="text-sm text-gray-300">Winner's Score</Text>
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={buttonAnimatedStyle}>
                <View className="gap-3">
                  {/* Play Again Button */}
                  <Pressable
                    onPress={() => {
                      try {
                        const { hapticsService } = require('../../../services/hapticsService');
                        hapticsService.buttonPress();
                      } catch (error) {
                      }
                      onReset();
                    }}
                    className="bg-blue-600 py-4 px-8 rounded-xl active:opacity-70"
                  >
                    <Text className="text-white text-lg font-semibold text-center">
                      🎮 Play Again
                    </Text>
                  </Pressable>

                  {/* Return to Home Button */}
                  <Pressable
                    onPress={() => {
                      try {
                        const { hapticsService } = require('../../../services/hapticsService');
                        hapticsService.buttonPress();
                      } catch (error) {
                      }
                      router.push("/(tabs)/");
                    }}
                    className="bg-gray-600 py-4 px-8 rounded-xl active:opacity-70"
                  >
                    <Text className="text-white text-lg font-semibold text-center">
                      🏠 Return to Home
                    </Text>
                  </Pressable>
                </View>
              </Animated.View>
            </View>
          </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}
