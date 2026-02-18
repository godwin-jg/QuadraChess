import React, { useEffect } from "react";
import { View, Image, Text } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withRepeat,
  withSequence,
  cancelAnimation,
} from "react-native-reanimated";

// Default sizes (used as fallback when no squareSize is provided)
export const MINI_PLAYER_AVATAR_SIZE = 56;
export const MINI_PLAYER_TIMER_HEIGHT = 18;
export const MINI_PLAYER_GAP = 4;
export const MINI_PLAYER_STACK_HEIGHT =
  MINI_PLAYER_AVATAR_SIZE + MINI_PLAYER_GAP + MINI_PLAYER_TIMER_HEIGHT;
export const MINI_PLAYER_STACK_WIDTH = 70;

/** Derive all mini-player sizes from a single square size so they scale with the board */
export function getMiniPlayerSizes(squareSize?: number) {
  if (!squareSize || squareSize <= 0) {
    return {
      avatarSize: MINI_PLAYER_AVATAR_SIZE,
      timerHeight: MINI_PLAYER_TIMER_HEIGHT,
      gap: MINI_PLAYER_GAP,
      stackHeight: MINI_PLAYER_STACK_HEIGHT,
      stackWidth: MINI_PLAYER_STACK_WIDTH,
      crestSize: 32,
      timerFontSize: 12,
      turnDotSize: 14,
      turnDotInner: 6,
    };
  }
  // Avatar ≈ 1.8× square size, clamped between 28–56px
  const avatarSize = Math.round(Math.min(56, Math.max(28, squareSize * 1.8)));
  const gap = Math.round(Math.max(2, avatarSize * 0.05));
  const timerHeight = Math.round(Math.max(12, avatarSize * 0.25));
  const stackHeight = avatarSize + gap + timerHeight;
  const stackWidth = Math.round(Math.max(40, avatarSize * 1.2));
  const crestSize = Math.round(Math.max(16, avatarSize * 0.6));
  const timerFontSize = Math.round(Math.max(8, avatarSize * 0.21));
  const turnDotSize = Math.round(Math.max(8, avatarSize * 0.25));
  const turnDotInner = Math.round(Math.max(4, turnDotSize * 0.43));
  return { avatarSize, timerHeight, gap, stackHeight, stackWidth, crestSize, timerFontSize, turnDotSize, turnDotInner };
}

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
  isTimerDisabled?: boolean;
  squareSize?: number;
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
  isTimerDisabled = false,
  squareSize,
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

    return () => {
      cancelAnimation(scale);
      cancelAnimation(glowOpacity);
      cancelAnimation(eliminationOpacity);
      cancelAnimation(eliminationScale);
    };
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

  // All sizes scale with squareSize (falls back to fixed defaults)
  const sizes = getMiniPlayerSizes(squareSize);

  return (
    <Animated.View 
      style={[
        eliminationAnimatedStyle, 
        { 
          width: sizes.stackWidth,
          height: sizes.stackHeight,
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
            width: sizes.avatarSize,
            height: sizes.avatarSize,
            borderRadius: sizes.avatarSize / 2,
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
            width: sizes.crestSize,
            height: sizes.crestSize,
            opacity: isEliminated ? 0.5 : 1,
            zIndex: 1,
          }}
          resizeMode="contain"
        />

        {/* Current Turn Indicator - always mounted to avoid Fabric view-tag race */}
        <Animated.View 
          pointerEvents="none"
          style={[
            glowAnimatedStyle,
            {
              position: 'absolute',
              top: -1,
              right: -1,
              width: sizes.turnDotSize,
              height: sizes.turnDotSize,
              borderRadius: sizes.turnDotSize / 2,
              backgroundColor: 'rgba(251, 191, 36, 0.8)',
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
              width: sizes.turnDotInner,
              height: sizes.turnDotInner,
              borderRadius: sizes.turnDotInner / 2,
              backgroundColor: 'rgba(255, 255, 255, 0.6)',
            }} 
          />
        </Animated.View>

      </Animated.View>

      {/* Timer text - below avatar, no background */}
      {timeMs !== undefined && (
        <Text 
          style={{
            marginTop: sizes.gap,
            fontSize: Math.round(sizes.timerFontSize * (isTimerDisabled ? 1.7 : 1.25)),
            fontWeight: '800',
            fontVariant: ['tabular-nums'],
            letterSpacing: isTimerDisabled ? 0 : 1.2,
            textAlign: 'center',
            opacity: isTimerDisabled ? 0.6 : 1,
            textShadowColor: 'rgba(0, 0, 0, 0.8)',
            textShadowOffset: { width: 0, height: 1 },
            textShadowRadius: 3,
            color: isTimerDisabled
              ? '#9CA3AF'
              : isEliminated 
                ? '#9CA3AF' 
                : (timeMs <= 10000 && !isEliminated)
                  ? '#F87171'
                  : isCurrentTurn 
                    ? '#FFFFFF' 
                    : '#D1D5DB',
          }}
        >
          {isTimerDisabled ? '∞' : formatTime(timeMs)}
        </Text>
      )}
    </Animated.View>
  );
}

// StyleSheet removed — all sizes now derived from squareSize via getMiniPlayerSizes()
