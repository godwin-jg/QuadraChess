import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Piece from "./Piece";

/**
 * Component to showcase the color replacement from yellow to purple
 */
export default function ColorReplacementTest() {
  const testPieces = [
    { code: "rK", name: "Red King", color: "Red" },
    { code: "bQ", name: "Blue Queen", color: "Blue" },
    { code: "yR", name: "Purple Rook", color: "Purple (was Yellow)" },
    { code: "gB", name: "Green Bishop", color: "Green" },
  ];

  const colorOptions = [
    {
      name: "Purple (Current)",
      color: "#7C3AED",
      description: "Rich purple - excellent visibility",
      pros: [
        "Great contrast on both squares",
        "Professional look",
        "Easy to distinguish",
      ],
    },
    {
      name: "Orange Alternative",
      color: "#EA580C",
      description: "Vibrant orange - very visible",
      pros: ["High visibility", "Warm color", "Good contrast"],
    },
    {
      name: "Teal Alternative",
      color: "#0D9488",
      description: "Deep teal - sophisticated",
      pros: ["Elegant", "Good contrast", "Unique color"],
    },
    {
      name: "Pink Alternative",
      color: "#C026D3",
      description: "Magenta pink - distinctive",
      pros: ["Very distinctive", "Good visibility", "Modern look"],
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 Color Replacement: Yellow → Purple</Text>
      <Text style={styles.subtitle}>
        Yellow pieces are now purple for much better visibility!
      </Text>

      <View style={styles.currentPiecesContainer}>
        <Text style={styles.sectionTitle}>✨ Current Piece Colors:</Text>
        <View style={styles.piecesGrid}>
          {testPieces.map((piece, index) => (
            <View key={index} style={styles.pieceContainer}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <Piece piece={piece.code} size={70} />
              </View>
              <Text style={styles.pieceName}>{piece.name}</Text>
              <Text style={styles.pieceCode}>{piece.code}</Text>
              <Text style={styles.pieceColor}>{piece.color}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.comparisonContainer}>
        <Text style={styles.sectionTitle}>
          🔍 Why Purple Instead of Yellow?
        </Text>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>❌ Yellow Problems:</Text>
            <Text style={styles.problemText}>
              • Hard to see on light squares
            </Text>
            <Text style={styles.problemText}>• Poor contrast with board</Text>
            <Text style={styles.problemText}>• Can look washed out</Text>
            <Text style={styles.problemText}>
              • Less professional appearance
            </Text>
          </View>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>✅ Purple Benefits:</Text>
            <Text style={styles.benefitText}>
              • Excellent contrast on both squares
            </Text>
            <Text style={styles.benefitText}>• Rich, professional color</Text>
            <Text style={styles.benefitText}>• Easy to distinguish</Text>
            <Text style={styles.benefitText}>• Modern, elegant look</Text>
          </View>
        </View>
      </View>

      <View style={styles.alternativesContainer}>
        <Text style={styles.sectionTitle}>🎯 Other Color Options:</Text>
        <View style={styles.colorOptionsGrid}>
          {colorOptions.map((option, index) => (
            <View key={index} style={styles.colorOptionContainer}>
              <View
                style={[styles.colorBox, { backgroundColor: option.color }]}
              />
              <Text style={styles.colorOptionName}>{option.name}</Text>
              <Text style={styles.colorOptionDescription}>
                {option.description}
              </Text>
              <Text style={styles.colorOptionCode}>{option.color}</Text>
              <View style={styles.prosContainer}>
                {option.pros.map((pro, proIndex) => (
                  <Text key={proIndex} style={styles.proText}>
                    • {pro}
                  </Text>
                ))}
              </View>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>🎉 Color Update Complete!</Text>
        <Text style={styles.successText}>
          Your yellow pieces are now purple (#7C3AED) - much better visibility
          and a more professional appearance!
        </Text>
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>🔧 Want a Different Color?</Text>
        <Text style={styles.instructionsText}>
          1. Open <Text style={styles.code}>PieceConfig.ts</Text>
        </Text>
        <Text style={styles.instructionsText}>
          2. Change the <Text style={styles.code}>purple</Text> color value
        </Text>
        <Text style={styles.instructionsText}>
          3. Save and refresh your app
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
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  currentPiecesContainer: {
    marginBottom: 30,
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
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
    minWidth: 100,
  },
  square: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  pieceName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  pieceCode: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  pieceColor: {
    fontSize: 10,
    color: "#9ca3af",
    fontStyle: "italic",
    textAlign: "center",
  },
  comparisonContainer: {
    backgroundColor: "#fef3c7",
    padding: 20,
    borderRadius: 12,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  comparisonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  comparisonItem: {
    flex: 1,
    padding: 10,
  },
  comparisonLabel: {
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1f2937",
  },
  problemText: {
    fontSize: 12,
    color: "#dc2626",
    marginBottom: 4,
    lineHeight: 16,
  },
  benefitText: {
    fontSize: 12,
    color: "#059669",
    marginBottom: 4,
    lineHeight: 16,
  },
  alternativesContainer: {
    marginBottom: 30,
  },
  colorOptionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  colorOptionContainer: {
    alignItems: "center",
    margin: 8,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 140,
  },
  colorBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  colorOptionName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  colorOptionDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    textAlign: "center",
  },
  colorOptionCode: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "monospace",
    marginBottom: 8,
  },
  prosContainer: {
    alignItems: "flex-start",
  },
  proText: {
    fontSize: 10,
    color: "#4b5563",
    marginBottom: 2,
    lineHeight: 14,
  },
  successContainer: {
    backgroundColor: "#f0fdf4",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
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
  instructionsContainer: {
    backgroundColor: "#f9fafb",
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  instructionsText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    lineHeight: 20,
  },
  code: {
    fontFamily: "monospace",
    backgroundColor: "#e5e7eb",
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontSize: 12,
  },
});

