import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Piece from "./Piece";
import { getPieceColor } from "./PieceAssets";

/**
 * Final verification that enhanced colors are working correctly
 */
export default function ColorVerification() {
  const testPieces = [
    { code: "rK", name: "Red King", expected: "#B91C1C" },
    { code: "bQ", name: "Blue Queen", expected: "#1E40AF" },
    { code: "yR", name: "Yellow Rook", expected: "#D97706" },
    { code: "gB", name: "Green Bishop", expected: "#059669" },
  ];

  const checkColor = (actual: string, expected: string) => {
    return actual === expected;
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✅ Enhanced Colors Verification</Text>
      <Text style={styles.subtitle}>
        All pieces should now use the enhanced color scheme
      </Text>

      <View style={styles.piecesGrid}>
        {testPieces.map((piece, index) => {
          const actualColor = getPieceColor(piece.code);
          const isCorrect = checkColor(actualColor, piece.expected);

          return (
            <View key={index} style={styles.pieceContainer}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <Piece piece={piece.code} size={60} />
              </View>
              <Text style={styles.pieceName}>{piece.name}</Text>
              <Text style={styles.pieceCode}>{piece.code}</Text>
              <View
                style={[styles.colorBox, { backgroundColor: actualColor }]}
              />
              <Text style={styles.colorValue}>{actualColor}</Text>
              <Text
                style={[
                  styles.statusText,
                  { color: isCorrect ? "#10b981" : "#ef4444" },
                ]}
              >
                {isCorrect ? "✅ Correct" : "❌ Incorrect"}
              </Text>
            </View>
          );
        })}
      </View>

      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>🎯 Summary:</Text>
        <Text style={styles.summaryText}>
          • Red pieces: Deep crimson (#B91C1C) - More sophisticated
        </Text>
        <Text style={styles.summaryText}>
          • Blue pieces: Rich navy (#1E40AF) - Better contrast
        </Text>
        <Text style={styles.summaryText}>
          • Yellow pieces: Golden amber (#D97706) - Much more visible!
        </Text>
        <Text style={styles.summaryText}>
          • Green pieces: Forest green (#059669) - Professional look
        </Text>
      </View>

      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>🚀 Enhanced Colors Active!</Text>
        <Text style={styles.successText}>
          Your chess pieces now use the enhanced color scheme with better
          contrast, visibility, and a more professional appearance!
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#6b7280",
    fontStyle: "italic",
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  pieceContainer: {
    alignItems: "center",
    margin: 10,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 120,
  },
  square: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  pieceName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
  },
  pieceCode: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  colorBox: {
    width: 30,
    height: 30,
    borderRadius: 6,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  colorValue: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: "bold",
  },
  summaryContainer: {
    backgroundColor: "#f0f9ff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  summaryTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  summaryText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    lineHeight: 20,
  },
  successContainer: {
    backgroundColor: "#f0fdf4",
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  successTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  successText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
});

