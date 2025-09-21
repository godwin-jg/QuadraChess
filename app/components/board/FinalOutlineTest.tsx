import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Piece from "./Piece";

/**
 * Final test to showcase the new dark gray outline
 */
export default function FinalOutlineTest() {
  const testPieces = [
    { code: "rK", name: "Red King", color: "Red" },
    { code: "bQ", name: "Blue Queen", color: "Blue" },
    { code: "yR", name: "Yellow Rook", color: "Yellow" },
    { code: "gB", name: "Green Bishop", color: "Green" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>✨ Dark Gray Outline - Active!</Text>
      <Text style={styles.subtitle}>
        Your chess pieces now have elegant dark gray outlines instead of harsh
        black
      </Text>

      <View style={styles.piecesGrid}>
        {testPieces.map((piece, index) => (
          <View key={index} style={styles.pieceContainer}>
            <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
              <Piece piece={piece.code} size={80} />
            </View>
            <Text style={styles.pieceName}>{piece.name}</Text>
            <Text style={styles.pieceCode}>{piece.code}</Text>
            <Text style={styles.pieceColor}>{piece.color}</Text>
          </View>
        ))}
      </View>

      <View style={styles.detailsContainer}>
        <Text style={styles.detailsTitle}>🎯 Outline Details:</Text>
        <Text style={styles.detailsText}>
          • SVG Stroke: <Text style={styles.code}>#374151</Text> (0.8px width)
        </Text>
        <Text style={styles.detailsText}>
          • Text Stroke: <Text style={styles.code}>#374151</Text> (1.2px width)
        </Text>
        <Text style={styles.detailsText}>
          • Style: Dark gray - elegant and professional
        </Text>
        <Text style={styles.detailsText}>
          • Effect: Better contrast than black, more sophisticated
        </Text>
      </View>

      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitsTitle}>
          🚀 Benefits of Dark Gray Outline:
        </Text>
        <Text style={styles.benefitText}>
          ✅ More elegant than harsh black outlines
        </Text>
        <Text style={styles.benefitText}>
          ✅ Better contrast and visibility
        </Text>
        <Text style={styles.benefitText}>
          ✅ Professional, sophisticated appearance
        </Text>
        <Text style={styles.benefitText}>
          ✅ Works perfectly with enhanced colors
        </Text>
        <Text style={styles.benefitText}>
          ✅ Maintains excellent definition
        </Text>
      </View>

      <View style={styles.comparisonContainer}>
        <Text style={styles.comparisonTitle}>📊 Before vs After:</Text>
        <View style={styles.comparisonRow}>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>Before (Black):</Text>
            <Text style={styles.comparisonText}>Harsh, too strong</Text>
            <Text style={styles.comparisonText}>Less elegant</Text>
            <Text style={styles.comparisonText}>Overwhelming</Text>
          </View>
          <View style={styles.comparisonItem}>
            <Text style={styles.comparisonLabel}>After (Dark Gray):</Text>
            <Text style={styles.comparisonText}>Elegant, refined</Text>
            <Text style={styles.comparisonText}>Professional look</Text>
            <Text style={styles.comparisonText}>Perfect balance</Text>
          </View>
        </View>
      </View>

      <View style={styles.successContainer}>
        <Text style={styles.successTitle}>🎉 Outline Upgrade Complete!</Text>
        <Text style={styles.successText}>
          Your chess pieces now have beautiful, elegant dark gray outlines that
          look professional and provide excellent visibility without being
          overwhelming.
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
    width: 100,
    height: 100,
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
    textAlign: "center",
  },
  pieceCode: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  pieceColor: {
    fontSize: 12,
    color: "#9ca3af",
    fontStyle: "italic",
  },
  detailsContainer: {
    backgroundColor: "#f0f9ff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  detailsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  detailsText: {
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
    color: "#1f2937",
  },
  benefitsContainer: {
    backgroundColor: "#f0fdf4",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  benefitText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    lineHeight: 20,
  },
  comparisonContainer: {
    backgroundColor: "#fef3c7",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
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
    color: "#1f2937",
    marginBottom: 8,
  },
  comparisonText: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 4,
    lineHeight: 16,
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

