import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { PIECE_CONFIG } from "./PieceConfig";

/**
 * Component to showcase different outline options for chess pieces
 */
export default function OutlineComparison() {
  const testPiece = "rK"; // Red King for testing
  const piecePath =
    "M 22.5,11.63 L 22.5,6 M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 M 20,8 L 25,8 M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5 M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37";

  const outlineOptions = [
    {
      name: "Current: Dark Gray",
      description: "Elegant dark gray outline",
      stroke: { color: "#374151", width: 0.8 },
      textStroke: { color: "#374151", width: 1.2 },
    },
    {
      name: "Subtle Dark",
      description: "Very dark gray, thinner",
      stroke: { color: "#1f2937", width: 0.6 },
      textStroke: { color: "#1f2937", width: 1 },
    },
    {
      name: "Medium Gray",
      description: "Softer gray, slightly thicker",
      stroke: { color: "#4b5563", width: 0.7 },
      textStroke: { color: "#4b5563", width: 1.5 },
    },
    {
      name: "Warm Dark",
      description: "Dark with slight brown tint",
      stroke: { color: "#374151", width: 0.7 },
      textStroke: { color: "#374151", width: 1.3 },
    },
    {
      name: "No Outline",
      description: "Clean, modern look",
      stroke: { color: "transparent", width: 0 },
      textStroke: { color: "transparent", width: 0 },
    },
    {
      name: "White Outline",
      description: "White outline for dark pieces",
      stroke: { color: "#ffffff", width: 0.6 },
      textStroke: { color: "#ffffff", width: 1 },
    },
  ];

  const renderSVGPiece = (option: any, index: number) => (
    <View key={index} style={styles.pieceContainer}>
      <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <G
            fill={PIECE_CONFIG.COLORS.red}
            stroke={option.stroke.color}
            strokeWidth={option.stroke.width}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
        </Svg>
      </View>
      <Text style={styles.optionName}>{option.name}</Text>
      <Text style={styles.optionDescription}>{option.description}</Text>
      <Text style={styles.colorCode}>
        SVG: {option.stroke.color} ({option.stroke.width}px)
      </Text>
      <Text style={styles.colorCode}>
        Text: {option.textStroke.color} ({option.textStroke.width}px)
      </Text>
    </View>
  );

  const renderUnicodePiece = (option: any, index: number) => (
    <View key={`unicode-${index}`} style={styles.pieceContainer}>
      <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
        <Text
          style={[
            styles.unicodePiece,
            {
              color: PIECE_CONFIG.COLORS.red,
              textShadowColor: option.textStroke.color,
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: option.textStroke.width,
            },
          ]}
        >
          ♔
        </Text>
      </View>
      <Text style={styles.optionName}>{option.name} (Unicode)</Text>
      <Text style={styles.optionDescription}>{option.description}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 Outline Style Comparison</Text>
      <Text style={styles.subtitle}>
        Choose the best outline style for your chess pieces
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>SVG Pieces</Text>
        <View style={styles.piecesGrid}>
          {outlineOptions.map(renderSVGPiece)}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Unicode Pieces</Text>
        <View style={styles.piecesGrid}>
          {outlineOptions.map(renderUnicodePiece)}
        </View>
      </View>

      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>💡 Recommendations:</Text>
        <Text style={styles.recommendationText}>
          • <Text style={styles.bold}>Dark Gray (#374151)</Text> - Most elegant
          and professional
        </Text>
        <Text style={styles.recommendationText}>
          • <Text style={styles.bold}>Subtle Dark (#1f2937)</Text> - Minimalist
          and clean
        </Text>
        <Text style={styles.recommendationText}>
          • <Text style={styles.bold}>No Outline</Text> - Modern, clean look
          (relies on shadows)
        </Text>
        <Text style={styles.recommendationText}>
          • <Text style={styles.bold}>White Outline</Text> - Great for dark
          pieces on light squares
        </Text>
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>🔧 How to Change:</Text>
        <Text style={styles.instructionsText}>
          1. Open <Text style={styles.code}>PieceConfig.ts</Text>
        </Text>
        <Text style={styles.instructionsText}>
          2. Uncomment your preferred option in{" "}
          <Text style={styles.code}>STROKE</Text> and{" "}
          <Text style={styles.code}>TEXT_STROKE</Text>
        </Text>
        <Text style={styles.instructionsText}>
          3. Comment out the current active option
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
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
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
    minWidth: 140,
  },
  square: {
    width: 70,
    height: 70,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  unicodePiece: {
    fontSize: 40,
    fontWeight: "bold",
  },
  optionName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  optionDescription: {
    fontSize: 12,
    color: "#6b7280",
    marginBottom: 6,
    textAlign: "center",
  },
  colorCode: {
    fontSize: 10,
    color: "#9ca3af",
    fontFamily: "monospace",
    textAlign: "center",
  },
  recommendationsContainer: {
    backgroundColor: "#f0f9ff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  recommendationsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  recommendationText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
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

