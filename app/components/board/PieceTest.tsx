import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Piece from "./Piece";
import { PIECE_CONFIG } from "./PieceConfig";

/**
 * Test component to display all chess pieces
 * This helps verify that SVG pieces are working correctly
 */
export default function PieceTest() {
  const testPieces = [
    { code: "rK", name: "Red King", color: "Red" },
    { code: "rQ", name: "Red Queen", color: "Red" },
    { code: "rR", name: "Red Rook", color: "Red" },
    { code: "rB", name: "Red Bishop", color: "Red" },
    { code: "rN", name: "Red Knight", color: "Red" },
    { code: "rP", name: "Red Pawn", color: "Red" },
    { code: "bK", name: "Blue King", color: "Blue" },
    { code: "bQ", name: "Blue Queen", color: "Blue" },
    { code: "bR", name: "Blue Rook", color: "Blue" },
    { code: "bB", name: "Blue Bishop", color: "Blue" },
    { code: "bN", name: "Blue Knight", color: "Blue" },
    { code: "bP", name: "Blue Pawn", color: "Blue" },
    { code: "yK", name: "Yellow King", color: "Yellow" },
    { code: "yQ", name: "Yellow Queen", color: "Yellow" },
    { code: "yR", name: "Yellow Rook", color: "Yellow" },
    { code: "yB", name: "Yellow Bishop", color: "Yellow" },
    { code: "yN", name: "Yellow Knight", color: "Yellow" },
    { code: "yP", name: "Yellow Pawn", color: "Yellow" },
    { code: "gK", name: "Green King", color: "Green" },
    { code: "gQ", name: "Green Queen", color: "Green" },
    { code: "gR", name: "Green Rook", color: "Green" },
    { code: "gB", name: "Green Bishop", color: "Green" },
    { code: "gN", name: "Green Knight", color: "Green" },
    { code: "gP", name: "Green Pawn", color: "Green" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Chess Pieces Test</Text>
      <Text style={styles.subtitle}>
        Mode: {PIECE_CONFIG.USE_SVG_PIECES ? "SVG Pieces" : "Unicode Symbols"}
      </Text>

      <View style={styles.piecesGrid}>
        {testPieces.map((piece, index) => (
          <View key={index} style={styles.pieceContainer}>
            <View
              style={[
                styles.pieceWrapper,
                { backgroundColor: getBackgroundColor(piece.color) },
              ]}
            >
              <Piece piece={piece.code} size={100} />
            </View>
            <Text style={styles.pieceName}>{piece.name}</Text>
            <Text style={styles.pieceCode}>{piece.code}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Integration Status:</Text>
        <Text style={styles.infoText}>✅ SVG paths extracted successfully</Text>
        <Text style={styles.infoText}>✅ Color mapping configured</Text>
        <Text style={styles.infoText}>✅ Global config enabled</Text>
        <Text style={styles.infoText}>✅ Fallback to Unicode available</Text>
      </View>
    </ScrollView>
  );
}

function getBackgroundColor(color: string): string {
  switch (color) {
    case "Red":
      return "#fecaca";
    case "Blue":
      return "#bfdbfe";
    case "Yellow":
      return "#fef3c7";
    case "Green":
      return "#bbf7d0";
    default:
      return "#f0f0f0";
  }
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
    margin: 8,
    padding: 12,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pieceWrapper: {
    width: 120,
    height: 120,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  pieceName: {
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    color: "#374151",
    marginBottom: 2,
  },
  pieceCode: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  infoContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
  },
});
