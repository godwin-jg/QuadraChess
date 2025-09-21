import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from "react-native";
import Piece from "./Piece";
import { PIECE_CONFIG } from "./PieceConfig";

/**
 * Test component specifically for showcasing 3D drop shadow effects
 */
export default function ShadowTest() {
  const [showShadows, setShowShadows] = useState(true);

  const testPieces = [
    { code: "rK", name: "Red King", color: "Red" },
    { code: "bQ", name: "Blue Queen", color: "Blue" },
    { code: "yR", name: "Yellow Rook", color: "Yellow" },
    { code: "gB", name: "Green Bishop", color: "Green" },
    { code: "rN", name: "Red Knight", color: "Red" },
    { code: "bP", name: "Blue Pawn", color: "Blue" },
  ];

  const toggleShadows = () => {
    setShowShadows(!showShadows);
    // Temporarily disable shadows in config
    PIECE_CONFIG.SVG.EFFECTS.DROP_SHADOW.enabled = !showShadows;
    PIECE_CONFIG.UNICODE.EFFECTS.DROP_SHADOW.enabled = !showShadows;
  };

  const getBackgroundColor = (color: string): string => {
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
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>3D Drop Shadow Effects</Text>
      <Text style={styles.subtitle}>
        Showcasing enhanced depth and visual appeal
      </Text>

      <TouchableOpacity style={styles.toggleButton} onPress={toggleShadows}>
        <Text style={styles.toggleButtonText}>
          {showShadows ? "Hide" : "Show"} Drop Shadows
        </Text>
      </TouchableOpacity>

      <View style={styles.comparisonContainer}>
        <Text style={styles.comparisonTitle}>Before vs After</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Without Shadows</Text>
            <View style={[styles.pieceWrapper, { backgroundColor: "#f0f0f0" }]}>
              <Text style={styles.flatPiece}>♚</Text>
            </View>
          </View>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>With 3D Shadows</Text>
            <View style={[styles.pieceWrapper, { backgroundColor: "#f0f0f0" }]}>
              <Piece piece="rK" size={60} />
            </View>
          </View>
        </View>
      </View>

      <View style={styles.piecesGrid}>
        {testPieces.map((piece, index) => (
          <View key={index} style={styles.pieceContainer}>
            <View
              style={[
                styles.pieceWrapper,
                { backgroundColor: getBackgroundColor(piece.color) },
              ]}
            >
              <Piece piece={piece.code} size={80} />
            </View>
            <Text style={styles.pieceName}>{piece.name}</Text>
            <Text style={styles.pieceCode}>{piece.code}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>🎯 3D Shadow Features:</Text>
        <Text style={styles.infoText}>✅ Enhanced depth perception</Text>
        <Text style={styles.infoText}>✅ Professional 3D appearance</Text>
        <Text style={styles.infoText}>✅ Better visual hierarchy</Text>
        <Text style={styles.infoText}>✅ Improved piece definition</Text>
        <Text style={styles.infoText}>✅ Subtle but impactful effect</Text>
        <Text style={styles.infoText}>✅ Works on all backgrounds</Text>
      </View>

      <View style={styles.technicalContainer}>
        <Text style={styles.technicalTitle}>🔧 Technical Details:</Text>
        <Text style={styles.technicalText}>
          • SVG Pieces: 2px offset, 6px blur, 40% opacity
        </Text>
        <Text style={styles.technicalText}>
          • Unicode Pieces: 2px offset, 4px blur, 50% opacity
        </Text>
        <Text style={styles.technicalText}>
          • Elevation: 4-6 for Android material design
        </Text>
        <Text style={styles.technicalText}>
          • Color: rgba(0, 0, 0, 0.4-0.5) for natural shadows
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#1f2937",
  },
  subtitle: {
    fontSize: 18,
    textAlign: "center",
    marginBottom: 20,
    color: "#6b7280",
    fontStyle: "italic",
  },
  toggleButton: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "center",
    marginBottom: 30,
  },
  toggleButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  comparisonContainer: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  comparisonTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1f2937",
  },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  comparisonItem: {
    alignItems: "center",
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
    color: "#4b5563",
  },
  pieceWrapper: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  flatPiece: {
    fontSize: 48,
    color: "#1f2937",
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
    minWidth: 120,
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
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
  },
  technicalContainer: {
    backgroundColor: "#f3f4f6",
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  technicalTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  technicalText: {
    fontSize: 13,
    color: "#4b5563",
    marginBottom: 4,
    fontFamily: "monospace",
  },
});

