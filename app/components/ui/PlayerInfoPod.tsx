import React from "react";
import { View, Text } from "react-native";
import Piece from "../board/Piece";

interface PlayerInfoPodProps {
  player: {
    name: string;
    color: string;
    score: number;
  };
  capturedPieces: string[];
  isCurrentTurn: boolean;
}

export default function PlayerInfoPod({
  player,
  capturedPieces,
  isCurrentTurn,
}: PlayerInfoPodProps) {
  const getPlayerAccentColor = (playerColor: string) => {
    if (!isCurrentTurn) {
      return "bg-gray-400"; // Greyed out for inactive players
    }

    switch (playerColor) {
      case "r":
        return "bg-red-500";
      case "b":
        return "bg-blue-500";
      case "y":
        return "bg-yellow-500";
      case "g":
        return "bg-green-500";
      default:
        return "bg-gray-500";
    }
  };

  const getPlayerTextColor = (playerColor: string) => {
    if (!isCurrentTurn) {
      return "text-gray-500"; // Greyed out for inactive players
    }

    switch (playerColor) {
      case "r":
        return "text-red-600";
      case "b":
        return "text-blue-600";
      case "y":
        return "text-yellow-600";
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
    <View className="items-center">
      {/* Avatar Container */}
      <View
        className={`
          relative w-20 h-20 rounded-full shadow-xl border-4 items-center justify-center
          ${
            isCurrentTurn
              ? `${getPlayerAccentColor(player.color)} border-white ring-4 ring-amber-400 ring-opacity-80`
              : "bg-gray-400 border-gray-300 opacity-75"
          }
        `}
      >
        {/* King Symbol in Avatar */}
        <Text className="text-white text-3xl font-bold">
          {getPlayerKingSymbol(player.color)}
        </Text>

        {/* Current Turn Indicator */}
        {isCurrentTurn && (
          <View className="absolute -top-1 -right-1 w-5 h-5 bg-amber-400 rounded-full shadow-lg border-2 border-white">
            <View className="w-full h-full bg-white/30 rounded-full" />
          </View>
        )}
      </View>

      {/* Player Name */}
      <Text
        className={`text-sm font-bold mt-2 ${
          isCurrentTurn ? getPlayerTextColor(player.color) : "text-gray-500"
        }`}
      >
        {player.name}
      </Text>

      {/* Score */}
      <View className="mt-2 relative">
        <Text
          className="text-center tracking-wider relative z-10"
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: "#FFFFFF",
            textShadowColor: "#FFFFFF",
            textShadowOffset: { width: 0, height: 0 },
            textShadowRadius: 8,
            letterSpacing: 2,
            transform: [{ scaleX: 1.1 }],
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
    </View>
  );
}
