import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import MixedStylePiece from "./MixedStylePiece";
import Piece from "./Piece";

/**
 * Test component showcasing the mixed styling approach
 */
export default function MixedStyleTest() {
  const testPieces = [
    { code: "rK", name: "Red King", style: "White Outline" },
    { code: "bQ", name: "Blue Queen", style: "Classic Wood" },
    { code: "yR", name: "Purple Rook", style: "White Outline" },
    { code: "gB", name: "Green Bishop", style: "Classic Wood" },
  ];

  const allPieces = [
    { code: "rK", name: "Red King" },
    { code: "rQ", name: "Red Queen" },
    { code: "rR", name: "Red Rook" },
    { code: "rB", name: "Red Bishop" },
    { code: "rN", name: "Red Knight" },
    { code: "rP", name: "Red Pawn" },
    { code: "bK", name: "Blue King" },
    { code: "bQ", name: "Blue Queen" },
    { code: "bR", name: "Blue Rook" },
    { code: "bB", name: "Blue Bishop" },
    { code: "bN", name: "Blue Knight" },
    { code: "bP", name: "Blue Pawn" },
    { code: "yK", name: "Purple King" },
    { code: "yQ", name: "Purple Queen" },
    { code: "yR", name: "Purple Rook" },
    { code: "yB", name: "Purple Bishop" },
    { code: "yN", name: "Purple Knight" },
    { code: "yP", name: "Purple Pawn" },
    { code: "gK", name: "Green King" },
    { code: "gQ", name: "Green Queen" },
    { code: "gR", name: "Green Rook" },
    { code: "gB", name: "Green Bishop" },
    { code: "gN", name: "Green Knight" },
    { code: "gP", name: "Green Pawn" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎨 Mixed Style Pieces</Text>
      <Text style={styles.subtitle}>
        Red & Purple: White outline | Blue & Green: Classic wood
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>✨ Style Overview</Text>
        <View style={styles.overviewGrid}>
          {testPieces.map((piece, index) => (
            <View key={index} style={styles.overviewCard}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <MixedStylePiece piece={piece.code} size={70} />
              </View>
              <Text style={styles.pieceName}>{piece.name}</Text>
              <Text style={styles.pieceStyle}>{piece.style}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🔴 Red Pieces - White Outline Style
        </Text>
        <Text style={styles.styleDescription}>
          Colored pieces with white outline for elegant, high-contrast
          appearance
        </Text>
        <View style={styles.piecesGrid}>
          {allPieces
            .filter((piece) => piece.code[0] === "r")
            .map((piece, index) => (
              <View key={index} style={styles.pieceCard}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  <MixedStylePiece piece={piece.code} size={50} />
                </View>
                <Text style={styles.pieceCode}>{piece.code}</Text>
              </View>
            ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🔵 Blue Pieces - Classic Wood Style
        </Text>
        <Text style={styles.styleDescription}>
          Wooden pieces with cyan bands for fresh, modern look
        </Text>
        <View style={styles.piecesGrid}>
          {allPieces
            .filter((piece) => piece.code[0] === "b")
            .map((piece, index) => (
              <View key={index} style={styles.pieceCard}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  <MixedStylePiece piece={piece.code} size={50} />
                </View>
                <Text style={styles.pieceCode}>{piece.code}</Text>
              </View>
            ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🟣 Purple Pieces - White Outline Style
        </Text>
        <Text style={styles.styleDescription}>
          Purple pieces with white outline for elegant, high-contrast appearance
        </Text>
        <View style={styles.piecesGrid}>
          {allPieces
            .filter((piece) => piece.code[0] === "y")
            .map((piece, index) => (
              <View key={index} style={styles.pieceCard}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  <MixedStylePiece piece={piece.code} size={50} />
                </View>
                <Text style={styles.pieceCode}>{piece.code}</Text>
              </View>
            ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          🟢 Green Pieces - Classic Wood Style
        </Text>
        <Text style={styles.styleDescription}>
          Wooden pieces with lighter green bands for sophisticated, premium look
        </Text>
        <View style={styles.piecesGrid}>
          {allPieces
            .filter((piece) => piece.code[0] === "g")
            .map((piece, index) => (
              <View key={index} style={styles.pieceCard}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  <MixedStylePiece piece={piece.code} size={50} />
                </View>
                <Text style={styles.pieceCode}>{piece.code}</Text>
              </View>
            ))}
        </View>
      </View>

      <View style={styles.comparisonSection}>
        <Text style={styles.comparisonTitle}>📊 Style Comparison</Text>
        <View style={styles.comparisonGrid}>
          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonCardTitle}>White Outline Style</Text>
            <Text style={styles.comparisonCardSubtitle}>
              Red & Purple Pieces
            </Text>
            <View style={styles.comparisonPieces}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <MixedStylePiece piece="rK" size={40} />
              </View>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <MixedStylePiece piece="yQ" size={40} />
              </View>
            </View>
            <Text style={styles.comparisonText}>
              • High contrast and visibility
            </Text>
            <Text style={styles.comparisonText}>
              • Elegant, modern appearance
            </Text>
            <Text style={styles.comparisonText}>• Clear team distinction</Text>
          </View>

          <View style={styles.comparisonCard}>
            <Text style={styles.comparisonCardTitle}>Classic Wood Style</Text>
            <Text style={styles.comparisonCardSubtitle}>
              Blue & Green Pieces
            </Text>
            <View style={styles.comparisonPieces}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <MixedStylePiece piece="bK" size={40} />
              </View>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <MixedStylePiece piece="gQ" size={40} />
              </View>
            </View>
            <Text style={styles.comparisonText}>
              • Premium, sophisticated look
            </Text>
            <Text style={styles.comparisonText}>• Natural wood appearance</Text>
            <Text style={styles.comparisonText}>
              • Lighter colored accent bands
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>✨ Benefits of Mixed Styling</Text>
        <Text style={styles.benefitText}>
          🎯 <Text style={styles.bold}>Visual Variety</Text> - Different styles
          create interesting contrast
        </Text>
        <Text style={styles.benefitText}>
          🏆 <Text style={styles.bold}>Premium Look</Text> - Wood pieces add
          sophistication
        </Text>
        <Text style={styles.benefitText}>
          👁️ <Text style={styles.bold}>High Visibility</Text> - Outline pieces
          ensure clear distinction
        </Text>
        <Text style={styles.benefitText}>
          🎨 <Text style={styles.bold}>Elegant Design</Text> - Combines modern
          and classic aesthetics
        </Text>
        <Text style={styles.benefitText}>
          🎮 <Text style={styles.bold}>Better Gameplay</Text> - Easy to
          distinguish all pieces
        </Text>
      </View>

      <View style={styles.implementationSection}>
        <Text style={styles.implementationTitle}>🔧 Implementation</Text>
        <Text style={styles.implementationText}>
          This mixed styling approach uses:
        </Text>
        <Text style={styles.codeText}>
          • Red & Purple: Dark base + colored outline
        </Text>
        <Text style={styles.codeText}>
          • Blue & Green: Wood gradient + colored bands
        </Text>
        <Text style={styles.codeText}>• SVG gradients for wood effect</Text>
        <Text style={styles.codeText}>
          • High contrast outlines for visibility
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#1f2937",
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#6b7280",
    fontStyle: "italic",
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  styleDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 15,
    fontStyle: "italic",
  },
  overviewGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  overviewCard: {
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
    minWidth: 120,
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  pieceCard: {
    alignItems: "center",
    margin: 4,
    padding: 8,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 80,
  },
  square: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 6,
    marginBottom: 6,
  },
  pieceName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  pieceStyle: {
    fontSize: 10,
    color: "#6b7280",
    textAlign: "center",
  },
  pieceCode: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "monospace",
  },
  comparisonSection: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  comparisonTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#1f2937",
  },
  comparisonGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  comparisonCard: {
    flex: 1,
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    margin: 5,
    alignItems: "center",
  },
  comparisonCardTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  comparisonCardSubtitle: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 10,
  },
  comparisonPieces: {
    flexDirection: "row",
    marginBottom: 10,
  },
  comparisonText: {
    fontSize: 11,
    color: "#4b5563",
    marginBottom: 3,
    textAlign: "center",
  },
  benefitsSection: {
    backgroundColor: "#f0fdf4",
    margin: 20,
    padding: 20,
    borderRadius: 12,
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
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
  },
  implementationSection: {
    backgroundColor: "#f9fafb",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    marginBottom: 40,
  },
  implementationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  implementationText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 10,
  },
  codeText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 16,
    marginBottom: 4,
    fontFamily: "monospace",
  },
});
