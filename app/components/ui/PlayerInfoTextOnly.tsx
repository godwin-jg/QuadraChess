import React from "react";
import { View, Text, Image } from "react-native";
import Piece from "../board/Piece";

interface PlayerInfoTextOnlyProps {
  player: {
    name: string;
    color: string;
    score: number;
  };
  capturedPieces: string[];
  isCurrentTurn: boolean;
  isEliminated?: boolean;
}

export default function PlayerInfoTextOnly({
  player,
  capturedPieces,
  isCurrentTurn,
  isEliminated = false,
}: PlayerInfoTextOnlyProps) {
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
        return "text-yellow-600";
      case "g":
        return "text-green-600";
      default:
        return "text-gray-600";
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

  return (
    <View className="items-center" style={{ backgroundColor: 'rgba(255, 0, 0, 0.1)', padding: 8, borderRadius: 8 }}>
      {/* Player Name */}
      <View className="items-center mb-2">
        <Text
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: isEliminated 
              ? '#9CA3AF' 
              : isCurrentTurn 
              ? '#FFFFFF' 
              : '#D1D5DB',
            textDecorationLine: isEliminated ? 'line-through' : 'none',
          }}
        >
          {player.name}
        </Text>
        {isEliminated && (
          <Text style={{
            fontSize: 12,
            color: '#F87171',
            fontWeight: '600',
            marginTop: 4,
          }}>
            ELIMINATED
          </Text>
        )}
      </View>

      {/* Score */}
      <View className="mb-2 relative">
        <Text
          className="text-center tracking-wider relative z-10"
          style={{
            fontSize: 28,
            fontWeight: "900",
            color: isEliminated ? "#9CA3AF" : player.score === 0 ? "#9CA3AF" : "#FFFFFF",
            textShadowColor: isEliminated ? "#9CA3AF" : player.score === 0 ? "#9CA3AF" : "#FFFFFF",
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
      <View className="max-w-[120px]">
        <Text
          style={{
            fontSize: 14,
            fontWeight: '600',
            marginBottom: 4,
            textAlign: 'center',
            color: isCurrentTurn ? '#FFFFFF' : '#D1D5DB',
          }}
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
