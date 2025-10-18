import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Piece from "../board/Piece";

interface PlayerHUDPanelProps {
  players: Array<{
    name: string;
    color: string;
    score: number;
    capturedPieces: string[];
    isCurrentTurn: boolean;
    isEliminated: boolean;
  }>;
  panelType: 'top' | 'bottom';
}

export default function PlayerHUDPanel({ players, panelType }: PlayerHUDPanelProps) {
  const getPlayerTextColor = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "#DC2626"; // Red
      case "b":
        return "#2563EB"; // Blue
      case "y":
        return "#7C3AED"; // Purple
      case "g":
        return "#16A34A"; // Green
      default:
        return "#6B7280"; // Gray
    }
  };

  const getPlayerName = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Purple";
      case "g":
        return "Green";
      default:
        return "Unknown";
    }
  };

  return (
    <View style={[
      styles.panel,
      panelType === 'top' ? styles.topPanel : styles.bottomPanel
    ]}>
      <View style={styles.playersContainer}>
        {players.map((player, index) => (
          <View key={player.color} style={styles.playerSection}>
            {/* Player Info */}
            <View style={styles.playerInfo}>
              <Text style={[
                styles.playerName,
                {
                  color: player.isEliminated 
                    ? '#9CA3AF' 
                    : player.isCurrentTurn 
                    ? getPlayerTextColor(player.color)
                    : '#D1D5DB',
                  textDecorationLine: player.isEliminated ? 'line-through' : 'none',
                }
              ]}>
                {getPlayerName(player.color)}
              </Text>
              <Text style={[
                styles.playerScore,
                {
                  color: player.isEliminated 
                    ? '#9CA3AF' 
                    : player.score === 0 
                    ? '#9CA3AF' 
                    : '#FFFFFF',
                  textDecorationLine: player.isEliminated ? 'line-through' : 'none',
                }
              ]}>
                {player.score}
              </Text>
              {player.isEliminated && (
                <Text style={styles.eliminatedText}>ELIMINATED</Text>
              )}
            </View>

            {/* Captured Pieces */}
            <View style={styles.capturedSection}>
              <Text style={[
                styles.capturedLabel,
                {
                  color: player.isCurrentTurn ? '#FFFFFF' : '#D1D5DB'
                }
              ]}>
                Captured
              </Text>
              <View style={styles.capturedPieces}>
                {player.capturedPieces.length > 0 ? (
                  player.capturedPieces
                    .slice(0, 6) // Show up to 6 pieces
                    .map((piece, pieceIndex) => (
                      <Piece 
                        key={`${piece}-${pieceIndex}`} 
                        piece={piece} 
                        size={12} 
                      />
                    ))
                ) : (
                  <Text style={[
                    styles.noCapturedText,
                    {
                      color: player.isCurrentTurn ? '#FFFFFF' : '#9CA3AF'
                    }
                  ]}>
                    None
                  </Text>
                )}
                {player.capturedPieces.length > 6 && (
                  <Text style={[
                    styles.moreText,
                    {
                      color: player.isCurrentTurn ? '#FFFFFF' : '#9CA3AF'
                    }
                  ]}>
                    +{player.capturedPieces.length - 6}
                  </Text>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 16,
    marginHorizontal: 16,
    marginVertical: 6,
  },
  topPanel: {
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: 0,
  },
  bottomPanel: {
    borderBottomWidth: 0,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    marginBottom: 0,
  },
  playersContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 24,
  },
  playerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  playerInfo: {
    alignItems: 'center',
    marginBottom: 8,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '900',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 1.2,
    marginBottom: 4,
  },
  playerScore: {
    fontSize: 24,
    fontWeight: '900',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 1.5,
    textShadowColor: '#FFFFFF',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 6,
  },
  eliminatedText: {
    fontSize: 11,
    color: '#F87171',
    fontWeight: '600',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.8,
    marginTop: 4,
  },
  capturedSection: {
    alignItems: 'center',
    height: 50, // Fixed height to prevent layout shifts
    minHeight: 50, // Fixed height to prevent layout shifts
  },
  capturedLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 1.0,
    marginBottom: 4,
  },
  capturedPieces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 3,
    maxWidth: 100,
    minHeight: 30, // Fixed height to prevent layout shifts
    height: 30, // Fixed height to prevent layout shifts
  },
  noCapturedText: {
    fontSize: 11,
    fontStyle: 'italic',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.5,
  },
  moreText: {
    fontSize: 11,
    fontWeight: '600',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 0.8,
  },
});
