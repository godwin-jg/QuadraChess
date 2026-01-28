import React, { useEffect } from "react";
import { View, Text, Pressable, Modal, StyleSheet, Share, ScrollView, useWindowDimensions } from "react-native";
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
  withSequence,
  Easing
} from "react-native-reanimated";

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
  capturedPieces?: { r: string[]; b: string[]; y: string[]; g: string[] };
  moveCount?: number;
  eliminatedPlayers?: string[];
  players?: Array<{ color: string; name: string; isEliminated: boolean }>;
  teamMode?: boolean;
  teamAssignments?: { r: "A" | "B"; b: "A" | "B"; y: "A" | "B"; g: "A" | "B" };
  winningTeam?: "A" | "B" | null;
  onReset: () => void;
  onWatchReplay?: () => void;
  onDismiss?: () => void; // ✅ NEW: Optional dismiss callback
}

export default function GameOverModal({
  status,
  winner,
  eliminatedPlayer,
  justEliminated,
  scores = { r: 0, b: 0, y: 0, g: 0 },
  capturedPieces = { r: [], b: [], y: [], g: [] },
  moveCount = 0,
  eliminatedPlayers = [],
  players = [],
  teamMode = false,
  teamAssignments = { r: "A", y: "A", b: "B", g: "B" },
  winningTeam = null,
  onReset,
  onWatchReplay,
  onDismiss,
}: GameOverModalProps) {
  const router = useRouter();
  const { height } = useWindowDimensions();
  const maxModalHeight = height * 0.9;
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
    
    if (teamMode && winningTeam) {
      return results.sort((a, b) => {
        const aTeam = teamAssignments[a.color as keyof typeof teamAssignments];
        const bTeam = teamAssignments[b.color as keyof typeof teamAssignments];
        if (aTeam === winningTeam && bTeam !== winningTeam) return -1;
        if (bTeam === winningTeam && aTeam !== winningTeam) return 1;
        return (b.eliminationOrder || 0) - (a.eliminationOrder || 0);
      });
    }

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
  const captureCounts = {
    r: capturedPieces.r?.length ?? 0,
    b: capturedPieces.b?.length ?? 0,
    y: capturedPieces.y?.length ?? 0,
    g: capturedPieces.g?.length ?? 0,
  };
  const totalCaptures = captureCounts.r + captureCounts.b + captureCounts.y + captureCounts.g;

  const handleShare = async () => {
    const colorNames = { r: "Red", b: "Blue", y: "Yellow", g: "Green" };
    const winningTeamPlayers = teamMode && winningTeam
      ? players.filter((p) => teamAssignments[p.color as keyof typeof teamAssignments] === winningTeam)
      : [];
    const winnerName = teamMode && winningTeam
      ? `Team ${winningTeam} (${winningTeamPlayers.map((p) => p.name || colorNames[p.color as keyof typeof colorNames]).join(" & ")})`
      : leaderboard.find((p) => p.color === winner)?.name || "Unknown";
    const scoreLine = `Scores: R ${scores.r} · B ${scores.b} · Y ${scores.y} · G ${scores.g}`;
    const captureLine = `Captures: R ${captureCounts.r} · B ${captureCounts.b} · Y ${captureCounts.y} · G ${captureCounts.g}`;
    const moveLine = `Moves: ${moveCount}`;
    const message = `Quadrachess Result\nWinner: ${winnerName}\n${scoreLine}\n${captureLine}\n${moveLine}`;
    try {
      await Share.share({ message });
    } catch (error) {
      // Share is optional; ignore failures
    }
  };

  // Animation values
  const modalScale = useSharedValue(0.9);
  const modalOpacity = useSharedValue(0);
  const modalTranslateY = useSharedValue(20);
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
  const winnerGlowOpacity = useSharedValue(0);
  const winnerShimmerTranslate = useSharedValue(0);
  const sparkleOpacity = useSharedValue(0);
  const sparkleTranslateY = useSharedValue(0);
  
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

    // Start entrance animation sequence – smoother, modern spring + slight slide
    modalOpacity.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
    modalScale.value = withSpring(1, { damping: 18, stiffness: 220, mass: 0.9 });
    modalTranslateY.value = withSpring(0, { damping: 18, stiffness: 220, mass: 0.9 });
    
    // Stagger the content animations
    titleOpacity.value = withDelay(160, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    messageOpacity.value = withDelay(320, withTiming(1, { duration: 380, easing: Easing.out(Easing.cubic) }));
    
    // Animate player rows from 4th to 1st place (reverse order for dramatic effect)
    leaderboard.forEach((_, index) => {
      const reverseIndex = leaderboard.length - 1 - index;
      const delay = 520 + (reverseIndex * 140);
      const entryPlayer = leaderboard[reverseIndex];
      const isWinnerRow = !!entryPlayer && !entryPlayer.isEliminated && (
        teamMode && winningTeam
          ? teamAssignments[entryPlayer.color as keyof typeof teamAssignments] === winningTeam
          : entryPlayer.color === winner
      );
      playerAnimations[reverseIndex].opacity.value = withDelay(delay, withTiming(1, { duration: 260, easing: Easing.out(Easing.cubic) }));
      playerAnimations[reverseIndex].translateY.value = withDelay(delay, withSpring(0, { damping: 16, stiffness: 240 }));
      if (isWinnerRow) {
        // Avoid a bouncy pop on the winner row; use a smooth fade/slide instead.
        playerAnimations[reverseIndex].scale.value = 1;
      } else {
        playerAnimations[reverseIndex].scale.value = withDelay(delay, withSpring(1, { damping: 16, stiffness: 240 }));
      }
    });
    
    // Animate stats and button
    statsOpacity.value = withDelay(1100, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    buttonOpacity.value = withDelay(1280, withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) }));
    
    // Start winner animations after the winner appears
    const winnerDelay = 540 + ((leaderboard.length - 1) * 140) + 300; // After winner appears
    winnerGlowOpacity.value = withDelay(winnerDelay, withTiming(1, { duration: 420 }));
    winnerShimmerTranslate.value = withDelay(winnerDelay + 420, withRepeat(
      withSequence(
        withTiming(0, { duration: 0 }), // Reset to start position
        withTiming(700, { duration: 2500, easing: Easing.inOut(Easing.quad) }) // Travel full width
      ),
      -1, // Infinite repeat
      false // Don't reverse - loops back smoothly
    ));

    sparkleOpacity.value = withDelay(
      winnerDelay + 200,
      withRepeat(
        withSequence(
          withTiming(1, { duration: 600, easing: Easing.out(Easing.quad) }),
          withTiming(0, { duration: 600, easing: Easing.in(Easing.quad) })
        ),
        -1,
        false
      )
    );
    sparkleTranslateY.value = withDelay(
      winnerDelay + 200,
      withRepeat(
        withSequence(
          withTiming(-6, { duration: 600, easing: Easing.inOut(Easing.quad) }),
          withTiming(6, { duration: 600, easing: Easing.inOut(Easing.quad) })
        ),
        -1,
        true
      )
    );
  }, []);

  // Helper functions
  const getRankText = (index: number, player: PlayerResult) => {
    if (!player.isEliminated) {
      if (teamMode && winningTeam) {
        const teamId = teamAssignments[player.color as keyof typeof teamAssignments];
        if (teamId === winningTeam) {
          return "🥇 1st Place";
        }
      } else if (player.color === winner) {
        return "🥇 1st Place";
      }
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
    if (!player.isEliminated) {
      if (teamMode && winningTeam) {
        const teamId = teamAssignments[player.color as keyof typeof teamAssignments];
        if (teamId === winningTeam) {
          return "text-yellow-300"; // Gold for winner
        }
      } else if (player.color === winner) {
        return "text-yellow-300"; // Gold for winner
      }
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
    if (teamMode && winningTeam) {
      const colorNames = { r: "Red", b: "Blue", y: "Yellow", g: "Green" };
      const winningTeamPlayers = players.filter(
        (p) => teamAssignments[p.color as keyof typeof teamAssignments] === winningTeam
      );
      const names = winningTeamPlayers
        .map((p) => p.name || colorNames[p.color as keyof typeof colorNames])
        .join(" & ");
      return `Team ${winningTeam} wins! ${names ? `(${names})` : ""}`;
    }
    switch (status) {
      case "finished":
        switch (winner) {
          case "r":
            return "Red Dragon emerges victorious!";
          case "b":
            return "Blue Megalodon emerges victorious!";
          case "y":
            return "Black Wolf emerges victorious!";
          case "g":
            return "Green Serpent emerges victorious!";
          default:
            return `${winner?.toUpperCase()} emerges victorious!`;
        }
      default:
        return "The battle has concluded.";
    }
  };

  const getTitle = () => {
    switch (status) {
      case "finished":
        return teamMode ? "🏆 Team Victory!" : "🏆 Victory!";
      default:
        return "Game Complete";
    }
  };

  // Animation styles
  const modalAnimatedStyle = useAnimatedStyle(() => ({
    opacity: modalOpacity.value,
    transform: [
      { translateY: modalTranslateY.value },
      { scale: modalScale.value }
    ],
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
  const winnerGlowStyle = useAnimatedStyle(() => ({
    opacity: winnerGlowOpacity.value,
  }));

  const winnerShimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: winnerShimmerTranslate.value }],
  }));

  const sparkleStyle = useAnimatedStyle(() => ({
    opacity: sparkleOpacity.value,
    transform: [{ translateY: sparkleTranslateY.value }],
  }));

  // Pre-create player row animated styles to avoid hooks in a render loop
  const player1RowStyle = useAnimatedStyle(() => ({
    opacity: player1Opacity.value,
    transform: [
      { translateY: player1TranslateY.value },
      { scale: player1Scale.value },
    ],
  }));
  const player2RowStyle = useAnimatedStyle(() => ({
    opacity: player2Opacity.value,
    transform: [
      { translateY: player2TranslateY.value },
      { scale: player2Scale.value },
    ],
  }));
  const player3RowStyle = useAnimatedStyle(() => ({
    opacity: player3Opacity.value,
    transform: [
      { translateY: player3TranslateY.value },
      { scale: player3Scale.value },
    ],
  }));
  const player4RowStyle = useAnimatedStyle(() => ({
    opacity: player4Opacity.value,
    transform: [
      { translateY: player4TranslateY.value },
      { scale: player4Scale.value },
    ],
  }));
  const playerRowStyles = React.useMemo(() => [
    player1RowStyle,
    player2RowStyle,
    player3RowStyle,
    player4RowStyle,
  ].slice(0, leaderboard.length), [leaderboard.length, player1RowStyle, player2RowStyle, player3RowStyle, player4RowStyle]);

  return (
    <Modal visible={true} transparent animationType="fade">
      <SafeAreaView className="flex-1 bg-black/70 justify-center items-center px-4">
        {/* The main animated container for a spring/slide-in effect */}
        <Animated.View 
          className="w-full max-w-md mx-auto rounded-2xl overflow-hidden"
          style={[
            { 
              borderWidth: 1, 
              borderColor: 'rgba(255, 255, 255, 0.12)',
              shadowColor: '#000',
              shadowOpacity: 0.3,
              shadowRadius: 24,
              shadowOffset: { width: 0, height: 12 },
              elevation: 12,
              maxHeight: maxModalHeight,
            },
            modalAnimatedStyle
          ]}
        >
          <LinearGradient
            colors={['rgba(17, 24, 39, 0.96)', 'rgba(15, 23, 42, 0.95)']}
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
            contentContainerStyle={styles.modalContent}
          >
              <Animated.View style={titleAnimatedStyle}>
                <Text className="text-2xl font-bold text-center mb-2 text-white">
                  {getTitle()}
                </Text>
              </Animated.View>

              <Animated.View style={messageAnimatedStyle}>
                <Text className="text-sm text-center mb-4 text-gray-300 leading-5">
                  {getMessage()}
                </Text>
              </Animated.View>

              {/* Leaderboard */}
              <View className="mb-4">
                <Animated.Text style={messageAnimatedStyle} className="text-base font-semibold text-center mb-3 text-white">
                  Final Standings
                </Animated.Text>
                
                {leaderboard.map((player, index) => {
                  const colorEmojis = { r: "🔴", b: "🔵", y: "🟡", g: "🟢" };
                  const isWinner =
                    !player.isEliminated &&
                    (teamMode && winningTeam
                      ? teamAssignments[player.color as keyof typeof teamAssignments] === winningTeam
                      : player.color === winner);
                  const playerAnimatedStyle = playerRowStyles[index];
                  
                  return (
                    <Animated.View
                      key={player.color}
                      style={[
                        playerAnimatedStyle,
                        isWinner ? styles.winnerRow : styles.playerRow
                      ]}
                      className="flex-row items-center justify-between px-3 py-2 mb-2 rounded-xl overflow-hidden"
                    >
                      {isWinner && (
                        <>
                          {/* Winner gradient - higher opacity */}
                          <LinearGradient
                            colors={['rgba(255, 215, 0, 0.6)', 'rgba(255, 193, 7, 0.55)']}
                            style={StyleSheet.absoluteFill}
                          />
                          
                          {/* Glow effect */}
                          <Animated.View
                            style={[
                              StyleSheet.absoluteFill,
                              winnerGlowStyle,
                              {
                                backgroundColor: 'rgba(255, 215, 0, 0.2)',
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
                          <Animated.View style={[styles.sprinkleCluster, sparkleStyle]}>
                            <View style={[styles.sprinkleDot, styles.sprinkleDotLarge]} />
                            <View style={[styles.sprinkleDot, styles.sprinkleDotMedium]} />
                            <View style={[styles.sprinkleDot, styles.sprinkleDotSmall]} />
                          </Animated.View>
                        </>
                      )}

                      <View className="flex-row items-center flex-1">
                        {isWinner && (
                          <Text style={styles.crown}>👑</Text>
                        )}
                        <Text className="text-xl mr-3">
                          {colorEmojis[player.color as keyof typeof colorEmojis]}
                        </Text>
                        <View className="flex-1">
                          <Text className="text-white font-semibold text-base">
                            {player.name}
                          </Text>
                          <Text className={`text-xs ${getRankColor(index, player)}`}>
                            {getRankText(index, player)}
                          </Text>
                        </View>
                      </View>
                      <View className="items-end">
                        <Text className="text-base font-bold text-white">
                          {player.score}
                        </Text>
                        <Text className="text-[10px] text-gray-400">
                          pts
                        </Text>
                      </View>
                    </Animated.View>
                  );
                })}
              </View>

              {/* Game Statistics */}
              <Animated.View style={statsAnimatedStyle} className="mb-4">
                <View className="flex-row gap-2">
                  <View className="flex-1 items-center bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                    <Text className="text-lg font-bold text-blue-300">
                      {moveCount}
                    </Text>
                    <Text className="text-[10px] text-gray-300">Moves</Text>
                  </View>
                  <View className="flex-1 items-center bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                    <Text className="text-lg font-bold text-green-300">
                      {totalCaptures}
                    </Text>
                    <Text className="text-[10px] text-gray-300">Captures</Text>
                  </View>
                  <View className="flex-1 items-center bg-white/5 px-3 py-2 rounded-lg border border-white/10">
                    <Text className="text-lg font-bold text-yellow-300">
                      {eliminatedPlayers.length}
                    </Text>
                    <Text className="text-[10px] text-gray-300">Eliminated</Text>
                  </View>
                </View>
              </Animated.View>

              <Animated.View style={buttonAnimatedStyle}>
                <View className="gap-2">
                  <View className="flex-row gap-2">
                    {onWatchReplay && (
                      <Pressable
                        onPress={() => {
                          try {
                            const { hapticsService } = require('../../../services/hapticsService');
                            hapticsService.buttonPress();
                          } catch (error) {
                          }
                          onWatchReplay();
                        }}
                        className="flex-1 bg-white/10 border border-white/20 py-3 rounded-xl active:opacity-70"
                      >
                        <Text className="text-white text-sm font-semibold text-center">
                          Watch Replay
                        </Text>
                      </Pressable>
                    )}
                    <Pressable
                      onPress={handleShare}
                      className={`${onWatchReplay ? "flex-1" : "flex-1"} bg-white/10 border border-white/20 py-3 rounded-xl active:opacity-70`}
                    >
                      <Text className="text-white text-sm font-semibold text-center">
                        Share Result
                      </Text>
                    </Pressable>
                  </View>
                  <View className="flex-row gap-2">
                    <Pressable
                      onPress={() => {
                        try {
                          const { hapticsService } = require('../../../services/hapticsService');
                          hapticsService.buttonPress();
                        } catch (error) {
                        }
                        onReset();
                      }}
                      className="flex-1 bg-blue-600 py-3 rounded-xl active:opacity-70"
                    >
                      <Text className="text-white text-sm font-semibold text-center">
                        Play Again
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        try {
                          const { hapticsService } = require('../../../services/hapticsService');
                          hapticsService.buttonPress();
                        } catch (error) {
                        }
                        router.push("/(tabs)/");
                      }}
                      className="flex-1 bg-gray-600 py-3 rounded-xl active:opacity-70"
                    >
                      <Text className="text-white text-sm font-semibold text-center">
                        Home
                      </Text>
                    </Pressable>
                  </View>
                </View>
              </Animated.View>
            </ScrollView>
        </Animated.View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContent: {
    padding: 24,
    paddingTop: 56,
  },
  winnerRow: {
    borderWidth: 1,
    borderColor: "rgba(255, 215, 0, 0.6)",
    backgroundColor: "rgba(255, 215, 0, 0.18)",
  },
  playerRow: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  crown: {
    fontSize: 28,
    marginRight: 10,
  },
  sprinkleCluster: {
    position: "absolute",
    top: 2,
    right: 8,
    width: 34,
    height: 20,
  },
  sprinkleDot: {
    position: "absolute",
    borderRadius: 999,
  },
  sprinkleDotLarge: {
    width: 6,
    height: 6,
    top: -2,
    right: 0,
    backgroundColor: "rgba(251, 191, 36, 0.95)",
  },
  sprinkleDotMedium: {
    width: 5,
    height: 5,
    top: 8,
    right: 14,
    backgroundColor: "rgba(255, 215, 0, 0.85)",
  },
  sprinkleDotSmall: {
    width: 4,
    height: 4,
    top: 2,
    right: 24,
    backgroundColor: "rgba(255, 255, 255, 0.75)",
  },
  statDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
});
