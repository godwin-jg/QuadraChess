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
 * Enhanced test component showcasing all the new piece features
 * This demonstrates the visual effects, animations, and interactions
 */
export default function EnhancedPieceTest() {
  const [selectedPiece, setSelectedPiece] = useState<string | null>(null);
  const [highlightedPieces, setHighlightedPieces] = useState<string[]>([]);

  const testPieces = [
    { code: "rK", name: "Red King", color: "Red", value: "High" },
    { code: "rQ", name: "Red Queen", color: "Red", value: "High" },
    { code: "rR", name: "Red Rook", color: "Red", value: "Medium" },
    { code: "rB", name: "Red Bishop", color: "Red", value: "Medium" },
    { code: "rN", name: "Red Knight", color: "Red", value: "Medium" },
    { code: "rP", name: "Red Pawn", color: "Red", value: "Low" },
    { code: "bK", name: "Blue King", color: "Blue", value: "High" },
    { code: "bQ", name: "Blue Queen", color: "Blue", value: "High" },
    { code: "bR", name: "Blue Rook", color: "Blue", value: "Medium" },
    { code: "bB", name: "Blue Bishop", color: "Blue", value: "Medium" },
    { code: "bN", name: "Blue Knight", color: "Blue", value: "Medium" },
    { code: "bP", name: "Blue Pawn", color: "Blue", value: "Low" },
    { code: "yK", name: "Yellow King", color: "Yellow", value: "High" },
    { code: "yQ", name: "Yellow Queen", color: "Yellow", value: "High" },
    { code: "yR", name: "Yellow Rook", color: "Yellow", value: "Medium" },
    { code: "yB", name: "Yellow Bishop", color: "Yellow", value: "Medium" },
    { code: "yN", name: "Yellow Knight", color: "Yellow", value: "Medium" },
    { code: "yP", name: "Yellow Pawn", color: "Yellow", value: "Low" },
    { code: "gK", name: "Green King", color: "Green", value: "High" },
    { code: "gQ", name: "Green Queen", color: "Green", value: "High" },
    { code: "gR", name: "Green Rook", color: "Green", value: "Medium" },
    { code: "gB", name: "Green Bishop", color: "Green", value: "Medium" },
    { code: "gN", name: "Green Knight", color: "Green", value: "Medium" },
    { code: "gP", name: "Green Pawn", color: "Green", value: "Low" },
  ];

  const handlePiecePress = (pieceCode: string) => {
    setSelectedPiece(selectedPiece === pieceCode ? null : pieceCode);

    // Simulate move highlights
    const possibleMoves = testPieces
      .filter((p) => p.code !== pieceCode && Math.random() > 0.7)
      .map((p) => p.code);
    setHighlightedPieces(possibleMoves);
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

  const getValueColor = (value: string): string => {
    switch (value) {
      case "High":
        return "#dc2626"; // Red
      case "Medium":
        return "#f59e0b"; // Orange
      case "Low":
        return "#10b981"; // Green
      default:
        return "#6b7280"; // Gray
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Enhanced Chess Pieces</Text>
      <Text style={styles.subtitle}>
        Mode: {PIECE_CONFIG.USE_SVG_PIECES ? "SVG Pieces" : "Unicode Symbols"}
      </Text>

      <View style={styles.featuresContainer}>
        <Text style={styles.featuresTitle}>✨ New Features:</Text>
        <Text style={styles.featureText}>• 3D Drop Shadows</Text>
        <Text style={styles.featureText}>• Selection Glow Effects</Text>
        <Text style={styles.featureText}>• Enhanced Outlines</Text>
        <Text style={styles.featureText}>• Interactive Selection</Text>
        <Text style={styles.featureText}>• Move Highlights</Text>
        <Text style={styles.featureText}>• Value Indicators</Text>
      </View>

      <Text style={styles.instructionText}>
        Tap pieces to select them and see glow effects!
      </Text>

      <View style={styles.piecesGrid}>
        {testPieces.map((piece, index) => (
          <TouchableOpacity
            key={index}
            style={styles.pieceContainer}
            onPress={() => handlePiecePress(piece.code)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.pieceWrapper,
                { backgroundColor: getBackgroundColor(piece.color) },
                selectedPiece === piece.code && styles.selectedPiece,
                highlightedPieces.includes(piece.code) &&
                  styles.highlightedPiece,
              ]}
            >
              <Piece
                piece={piece.code}
                size={80}
                isSelected={selectedPiece === piece.code}
                isHighlighted={highlightedPieces.includes(piece.code)}
                animationDelay={index * 50}
              />
            </View>
            <Text style={styles.pieceName}>{piece.name}</Text>
            <Text style={styles.pieceCode}>{piece.code}</Text>
            <View
              style={[
                styles.valueBadge,
                { backgroundColor: getValueColor(piece.value) },
              ]}
            >
              <Text style={styles.valueText}>{piece.value}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>🎯 Enhanced Features:</Text>
        <Text style={styles.infoText}>✅ 3D Drop Shadows for depth</Text>
        <Text style={styles.infoText}>✅ Selection glow effects</Text>
        <Text style={styles.infoText}>✅ Interactive piece selection</Text>
        <Text style={styles.infoText}>✅ Move highlight simulation</Text>
        <Text style={styles.infoText}>✅ Value-based color coding</Text>
        <Text style={styles.infoText}>✅ Smooth animations</Text>
        <Text style={styles.infoText}>✅ Enhanced accessibility</Text>
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
  featuresContainer: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  featureText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
  },
  instructionText: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 20,
    color: "#3b82f6",
    fontWeight: "600",
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
  pieceWrapper: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
    // transition: "all 0.2s ease", // Not supported in React Native
  },
  selectedPiece: {
    transform: [{ scale: 1.1 }],
    shadowColor: "#3b82f6",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  highlightedPiece: {
    borderWidth: 2,
    borderColor: "#10b981",
    borderStyle: "dashed",
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
    marginBottom: 4,
  },
  valueBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  valueText: {
    fontSize: 10,
    color: "white",
    fontWeight: "bold",
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
});
