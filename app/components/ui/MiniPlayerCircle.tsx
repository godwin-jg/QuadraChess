import React, { useEffect } from "react";
import { View, Image, Text, StyleSheet } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withRepeat,
  withSequence
} from "react-native-reanimated";

interface MiniPlayerCircleProps {
  player: {
    name: string;
    color: string;
    score: number;
  };
  isCurrentTurn: boolean;
  isEliminated?: boolean;
  boardRotation?: number;
  timeMs?: number;
}

const formatTime = (ms?: number) => {
  if (typeof ms !== "number") return "--:--";
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
};

export default function MiniPlayerCircle({
  player,
  isCurrentTurn,
  isEliminated = false,
  boardRotation = 0,
  timeMs,
}: MiniPlayerCircleProps) {
  // Animation values
  const scale = useSharedValue(1);
  const glowOpacity = useSharedValue(0);
  const eliminationOpacity = useSharedValue(1);
  const eliminationScale = useSharedValue(1);
  const previousIsCurrentTurn = useSharedValue(isCurrentTurn);
  const previousIsEliminated = useSharedValue(isEliminated);

  // Handle turn changes and elimination
  useEffect(() => {
    // Active player animation
    if (isCurrentTurn && !isEliminated) {
      // Scale up and glow when becoming active
      scale.value = withSpring(1.08, { damping: 12, stiffness: 200 });
      glowOpacity.value = withSpring(1, { damping: 15, stiffness: 150 });
      
      // Subtle pulsing glow effect
      glowOpacity.value = withRepeat(
        withSequence(
          withTiming(0.6, { duration: 1000 }),
          withTiming(1, { duration: 1000 })
        ),
        -1,
        true
      );
    } else if (!isCurrentTurn && !isEliminated) {
      // Keep the scale big, just remove glow when becoming inactive
      // scale.value = withSpring(1, { damping: 12, stiffness: 200 }); // REMOVED - don't shrink back
      glowOpacity.value = withTiming(0, { duration: 300 });
    }

    // Elimination animation
    if (isEliminated && !previousIsEliminated.value) {
      // Trigger elimination animation
      eliminationOpacity.value = withSequence(
        withTiming(0.3, { duration: 200 }),
        withTiming(0.7, { duration: 200 }),
        withTiming(0.5, { duration: 300 })
      );
      eliminationScale.value = withSequence(
        withTiming(0.95, { duration: 200 }),
        withTiming(1.05, { duration: 200 }),
        withTiming(0.98, { duration: 300 })
      );
      
      // Remove active animations
      scale.value = withSpring(1, { damping: 12, stiffness: 200 });
      glowOpacity.value = withTiming(0, { duration: 200 });
    }

    // Update previous values
    previousIsCurrentTurn.value = isCurrentTurn;
    previousIsEliminated.value = isEliminated;
  }, [isCurrentTurn, isEliminated]);

  // Animation styles
  const avatarAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const glowAnimatedStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const eliminationAnimatedStyle = useAnimatedStyle(() => ({
    opacity: eliminationOpacity.value,
    transform: [{ scale: eliminationScale.value }],
  }));

  const getPlayerAccentColor = (playerColor: string) => {
    if (isEliminated) {
      return "bg-gray-600"; // Darker grey for eliminated players
    }
    if (!isCurrentTurn) {
      return "bg-gray-400"; // Greyed out for inactive players
    }

    switch (playerColor) {
      case "r":
        return "bg-red-500";
      case "b":
        return "bg-blue-500";
      case "y":
        return "bg-purple-500";
      case "g":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPlayerCrestSource = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return require("../../../assets/player-crests/red-crest.png");
      case "b":
        return require("../../../assets/player-crests/blue-crest.png");
      case "y":
        return require("../../../assets/player-crests/yellow-crest.png");
      case "g":
        return require("../../../assets/player-crests/green-crest.png");
      default:
        return require("../../../assets/player-crests/red-crest.png");
    }
  };

  // Smaller avatar to fit timer below within 3x3 corner region (~78px total height)
  const AVATAR_SIZE = 56;
  const TIMER_HEIGHT = 18;
  const GAP = 4;

  return (
    <Animated.View 
      style={[
        eliminationAnimatedStyle, 
        { 
          width: 70,
          height: AVATAR_SIZE + GAP + TIMER_HEIGHT,
          justifyContent: 'flex-start',
          alignItems: 'center',
        }
      ]}
    >
      {/* Avatar Container - Glass Effect */}
      <Animated.View
        style={[
          avatarAnimatedStyle,
          {
            width: AVATAR_SIZE,
            height: AVATAR_SIZE,
            borderRadius: AVATAR_SIZE / 2,
            backgroundColor: isEliminated 
              ? 'rgba(107, 114, 128, 0.3)' // Gray glass for eliminated
              : isCurrentTurn
              ? (player.color === 'r' ? 'rgba(239, 68, 68, 0.3)' : 
                 player.color === 'b' ? 'rgba(59, 130, 246, 0.3)' : 
                 player.color === 'y' ? 'rgba(124, 58, 237, 0.3)' : 'rgba(16, 185, 129, 0.3)')
              : 'rgba(156, 163, 175, 0.3)', // Gray glass for inactive
            borderWidth: 2,
            borderColor: isEliminated 
              ? 'rgba(107, 114, 128, 0.6)' 
              : isCurrentTurn
              ? 'rgba(255, 255, 255, 0.8)'
              : 'rgba(255, 255, 255, 0.4)',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 8,
            justifyContent: 'center',
            alignItems: 'center',
          }
        ]}
      >

        {/* Player Crest in Avatar */}
        <Image
          source={getPlayerCrestSource(player.color)}
          style={{
            width: 32,
            height: 32,
            opacity: isEliminated ? 0.5 : 1,
            zIndex: 1,
          }}
          resizeMode="contain"
        />

        {/* Current Turn Indicator - Glassy */}
        {isCurrentTurn && !isEliminated && (
          <Animated.View 
            style={[
              glowAnimatedStyle,
              {
                position: 'absolute',
                top: -1,
                right: -1,
                width: 14,
                height: 14,
                borderRadius: 7,
                backgroundColor: 'rgba(251, 191, 36, 0.8)', // Amber with transparency
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.9)',
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.6,
                shadowRadius: 3,
                elevation: 8,
                justifyContent: 'center',
                alignItems: 'center',
              }
            ]}
          >
            <View 
              style={{
                width: 6,
                height: 6,
                borderRadius: 3,
                backgroundColor: 'rgba(255, 255, 255, 0.6)',
              }} 
            />
          </Animated.View>
        )}

      </Animated.View>

      {/* Timer Badge - Below avatar */}
      {timeMs !== undefined && (
        <View 
          style={[
            styles.timerBadge,
            {
              backgroundColor: isEliminated 
                ? 'rgba(107, 114, 128, 0.9)' 
                : isCurrentTurn
                  ? 'rgba(0, 0, 0, 0.85)'
                  : 'rgba(0, 0, 0, 0.7)',
              borderColor: isEliminated
                ? 'rgba(107, 114, 128, 0.6)'
                : isCurrentTurn
                  ? (player.color === 'r' ? 'rgba(239, 68, 68, 0.8)' : 
                     player.color === 'b' ? 'rgba(59, 130, 246, 0.8)' : 
                     player.color === 'y' ? 'rgba(124, 58, 237, 0.8)' : 'rgba(16, 185, 129, 0.8)')
                  : 'rgba(255, 255, 255, 0.3)',
            }
          ]}
        >
          <Text 
            style={[
              styles.timerText,
              {
                color: isEliminated 
                  ? '#9CA3AF' 
                  : (timeMs <= 10000 && !isEliminated)
                    ? '#F87171' // Red when low time
                    : isCurrentTurn 
                      ? '#FFFFFF' 
                      : '#D1D5DB',
              }
            ]}
          >
            {formatTime(timeMs)}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  timerBadge: {
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    minWidth: 54,
    alignItems: 'center',
  },
  timerText: {
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    letterSpacing: 0.5,
  },
});
