import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import MixedStylePiece from "./MixedStylePiece";

/**
 * Comparison showing the correct white outline style
 */
export default function WhiteOutlineComparison() {
  const testPiece = "rK"; // Red King for testing
  const piecePath =
    "M 22.5,11.63 L 22.5,6 M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 M 20,8 L 25,8 M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5 M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37";

  const styles = [
    {
      name: "❌ Wrong: Dark Base + Colored Outline",
      description: "What I had before (incorrect)",
      component: (
        <Svg width={80} height={80} viewBox="0 0 48 48">
          {/* Dark base piece */}
          <G fill="#1f2937" stroke="none" strokeWidth={0}>
            <Path d={piecePath} />
          </G>
          {/* Colored outline */}
          <G
            fill="none"
            stroke="#B91C1C"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
        </Svg>
      ),
    },
    {
      name: "✅ Correct: Colored Fill + White Outline",
      description: "What you wanted (correct)",
      component: (
        <Svg width={80} height={80} viewBox="0 0 48 48">
          <G
            fill="#B91C1C"
            stroke="#ffffff"
            strokeWidth={0.6}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
        </Svg>
      ),
    },
    {
      name: "🎯 Mixed Style Component",
      description: "Using MixedStylePiece component",
      component: <MixedStylePiece piece="rK" size={80} />,
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>✅ White Outline Style - Fixed!</Text>
      <Text style={styles.subtitle}>
        Now using the correct white outline approach from OutlineComparison.tsx
      </Text>

      <View style={styles.comparisonSection}>
        <Text style={styles.sectionTitle}>🔍 Style Comparison</Text>
        {styles.map((style, index) => (
          <View key={index} style={styles.styleCard}>
            <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
              {style.component}
            </View>
            <Text style={styles.styleName}>{style.name}</Text>
            <Text style={styles.styleDescription}>{style.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.correctSection}>
        <Text style={styles.correctTitle}>✅ Correct White Outline Style</Text>
        <Text style={styles.correctText}>
          • <Text style={styles.bold}>Colored fill</Text> - Red (#B91C1C) or
          Purple (#7C3AED)
        </Text>
        <Text style={styles.correctText}>
          • <Text style={styles.bold}>White outline</Text> - #ffffff stroke
        </Text>
        <Text style={styles.correctText}>
          • <Text style={styles.bold}>Outline width</Text> - 0.6px (thin and
          elegant)
        </Text>
        <Text style={styles.correctText}>
          • <Text style={styles.bold}>High contrast</Text> - White outline on
          colored background
        </Text>
      </View>

      <View style={styles.piecesSection}>
        <Text style={styles.sectionTitle}>
          🎨 All Pieces with Correct Styling
        </Text>
        <View style={styles.piecesGrid}>
          {["rK", "bQ", "yR", "gB"].map((piece, index) => (
            <View key={index} style={styles.pieceCard}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <MixedStylePiece piece={piece} size={60} />
              </View>
              <Text style={styles.pieceCode}>{piece}</Text>
              <Text style={styles.pieceStyle}>
                {piece[0] === "r" || piece[0] === "y"
                  ? "White Outline"
                  : "Classic Wood"}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>
          ✨ Benefits of Correct White Outline
        </Text>
        <Text style={styles.benefitText}>
          🎯 <Text style={styles.bold}>True White Outline</Text> - Like in
          OutlineComparison.tsx
        </Text>
        <Text style={styles.benefitText}>
          👁️ <Text style={styles.bold}>High Visibility</Text> - White outline on
          colored background
        </Text>
        <Text style={styles.benefitText}>
          🎨 <Text style={styles.bold}>Elegant Look</Text> - Thin, refined white
          outline
        </Text>
        <Text style={styles.benefitText}>
          🎮 <Text style={styles.bold}>Clear Distinction</Text> - Easy to
          distinguish pieces
        </Text>
      </View>

      <View style={styles.finalSection}>
        <Text style={styles.finalTitle}>🎉 White Outline Style Fixed!</Text>
        <Text style={styles.finalText}>
          The mixed styling now uses the correct white outline approach: colored
          pieces with white outlines, exactly like in the OutlineComparison.tsx
          component. This provides excellent visibility and a sophisticated
          appearance!
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
  comparisonSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  styleCard: {
    alignItems: "center",
    marginBottom: 20,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  square: {
    width: 100,
    height: 100,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  styleName: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 6,
    textAlign: "center",
  },
  styleDescription: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    fontStyle: "italic",
  },
  correctSection: {
    backgroundColor: "#f0fdf4",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  correctTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  correctText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
  },
  piecesSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  pieceCard: {
    alignItems: "center",
    margin: 8,
    padding: 12,
    backgroundColor: "white",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    minWidth: 100,
  },
  pieceCode: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  pieceStyle: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
  },
  benefitsSection: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
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
  finalSection: {
    backgroundColor: "#f0fdf4",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
    marginBottom: 40,
  },
  finalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  finalText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
});
