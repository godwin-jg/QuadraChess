import React, { useEffect } from "react";
import { View, Text } from "react-native";
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withTiming,
  withRepeat,
  withSequence,
  interpolate
} from "react-native-reanimated";
import Piece from "../board/Piece";

interface PlayerInfoPodProps {
  player: {
    name: string;
    color: string;
    score: number;
  };
  capturedPieces: string[];
  isCurrentTurn: boolean;
  isEliminated?: boolean;
}

export default function PlayerInfoPod({
  player,
  capturedPieces,
  isCurrentTurn,
  isEliminated = false,
}: PlayerInfoPodProps) {
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

  const getPlayerTextColor = (playerColor: string) => {
    if (isEliminated) {
      return "text-gray-400"; // Darker grey text for eliminated players
    }
    if (!isCurrentTurn) {
      return "text-gray-500"; // Greyed out for inactive players
    }

    switch (playerColor) {
      case "r":
        return "text-red-600";
      case "b":
        return "text-blue-600";
      case "y":
        return "text-purple-600";
      case "g":
        return "text-green-600";
      default:
        return "text-gray-600";
    }
  };

  const getPlayerKingSymbol = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "♔";
      case "b":
        return "♚";
      case "y":
        return "♔";
      case "g":
        return "♚";
      default:
        return "♔";
    }
  };

  return (
    <Animated.View style={[eliminationAnimatedStyle, { zIndex: 9999 }]} className="items-center">
      {/* Avatar Container */}
      <Animated.View
        style={avatarAnimatedStyle}
        className={`
          relative w-20 h-20 rounded-full shadow-xl border-4 items-center justify-center
          ${
            isEliminated
              ? `${getPlayerAccentColor(player.color)} border-gray-500 opacity-50`
              : isCurrentTurn
              ? `${getPlayerAccentColor(player.color)} border-white ring-4 ring-amber-400 ring-opacity-80`
              : "bg-gray-400 border-gray-300 opacity-75"
          }
        `}
      >
        {/* Glow Effect for Active Player */}
        {isCurrentTurn && !isEliminated && (
          <Animated.View
            style={[
              glowAnimatedStyle,
              {
                position: 'absolute',
                top: -8,
                left: -8,
                right: -8,
                bottom: -8,
                borderRadius: 50,
                backgroundColor: 'transparent',
                shadowColor: getPlayerAccentColor(player.color) === 'bg-red-500' ? '#EF4444' :
                             getPlayerAccentColor(player.color) === 'bg-blue-500' ? '#3B82F6' :
                             getPlayerAccentColor(player.color) === 'bg-purple-500' ? '#7C3AED' :
                             getPlayerAccentColor(player.color) === 'bg-green-500' ? '#10B981' : '#6B7280',
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.8,
                shadowRadius: 15,
                elevation: 10,
              }
            ]}
          />
        )}

        {/* King Symbol in Avatar */}
        <Text className={`text-3xl font-bold ${isEliminated ? 'text-gray-400' : 'text-white'}`}>
          {getPlayerKingSymbol(player.color)}
        </Text>

        {/* Current Turn Indicator */}
        {isCurrentTurn && !isEliminated && (
          <Animated.View 
            style={glowAnimatedStyle}
            className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full shadow-lg border-2 border-white"
          >
            <View className="w-full h-full bg-white/30 rounded-full" />
          </Animated.View>
        )}
      </Animated.View>

      {/* Player Name */}
      <View className="items-center">
        <Text
          className={`text-sm font-bold mt-2 ${
            isEliminated 
              ? "text-gray-400" 
              : isCurrentTurn 
              ? getPlayerTextColor(player.color) 
              : "text-gray-500"
          }`}
          style={isEliminated ? { textDecorationLine: 'line-through' } : {}}
        >
          {player.name}
        </Text>
        {isEliminated && (
          <Text className="text-xs text-red-400 font-semibold mt-1">
            ELIMINATED
          </Text>
        )}
      </View>

      {/* Score */}
      <View className="mt-2 relative">
        <Text
          className="text-center tracking-wider relative z-10"
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: isEliminated ? "#9CA3AF" : "#FFFFFF",
            textShadowColor: isEliminated ? "#9CA3AF" : "#FFFFFF",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
            letterSpacing: 2,
            transform: [{ scaleX: 1.1 }],
            textDecorationLine: isEliminated ? 'line-through' : 'none',
          }}
        >
          {player.score}
        </Text>
        {/* Chess piece overlay effect */}
        <View className="absolute top-0 right-0 opacity-20">
          <Text className="text-green-500 text-lg font-bold">♜</Text>
        </View>
      </View>

      {/* Captured Pieces */}
      <View className="mt-2 max-w-[120px]">
        <Text
          className={`text-xs font-semibold mb-1 text-center ${
            isCurrentTurn ? "text-white" : "text-gray-500"
          }`}
        >
          Captured
        </Text>
        <View className="flex-row flex-wrap justify-center gap-0.5">
          {capturedPieces.length > 0 ? (
            capturedPieces
              .slice(0, 8)
              .map((piece, index) => (
                <Piece key={`${piece}-${index}`} piece={piece} size={14} />
              ))
          ) : (
            <Text
              className={`text-xs text-center italic ${
                isCurrentTurn ? "text-white/70" : "text-gray-400"
              }`}
            >
              None
            </Text>
          )}
        </View>
        {capturedPieces.length > 8 && (
          <Text
            className={`text-xs text-center mt-1 ${
              isCurrentTurn ? "text-white/70" : "text-gray-400"
            }`}
          >
            +{capturedPieces.length - 8} more
          </Text>
        )}
      </View>
    </Animated.View>
  );
}
