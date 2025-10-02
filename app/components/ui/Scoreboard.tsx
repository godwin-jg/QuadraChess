import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../../state";

export default function Scoreboard() {
  const scores = useSelector((state: RootState) => state.game.scores);

  const getPlayerName = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Yellow";
      case "g":
        return "Green";
      default:
        return "Unknown";
    }
  };

  const getPlayerColor = (playerColor: string) => {
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

  const players = [
    { color: "r", name: "Red" },
    { color: "b", name: "Blue" },
    { color: "y", name: "Yellow" },
    { color: "g", name: "Green" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Scores</Text>
      <View style={styles.scoresContainer}>
        {players.map((player) => (
          <View key={player.color} style={styles.scoreItem}>
            <View
              style={[
                styles.colorIndicator,
                { backgroundColor: getPlayerColor(player.color) },
              ]}
            />
            <Text style={styles.playerName}>{player.name}</Text>
            <View style={styles.scoreContainer}>
              <Text style={styles.score}>
                {scores[player.color as keyof typeof scores]}
              </Text>
              {/* Chess piece overlay effect */}
              <Text style={styles.chessPieceOverlay}>♜</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 16,
    margin: 16,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 12,
    color: "#333",
  },
  scoresContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    flexWrap: "wrap",
  },
  scoreItem: {
    alignItems: "center",
    marginVertical: 4,
    minWidth: 60,
  },
  colorIndicator: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  playerName: {
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginBottom: 2,
  },
  scoreContainer: {
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
  },
  score: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FFFFFF",
    textShadowColor: "#FFFFFF",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
    letterSpacing: 2,
    transform: [{ scaleX: 1.1 }],
    zIndex: 10,
  },
  chessPieceOverlay: {
    position: "absolute",
    top: -5,
    right: -5,
    fontSize: 16,
    color: "#16A34A",
    opacity: 0.3,
    fontWeight: "bold",
  },
});
