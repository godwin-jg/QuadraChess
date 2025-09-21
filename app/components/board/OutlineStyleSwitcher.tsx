import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import Piece from "./Piece";

/**
 * Interactive component to test different outline styles
 */
export default function OutlineStyleSwitcher() {
  const [currentStyle, setCurrentStyle] = useState(0);

  const outlineStyles = [
    {
      name: "Dark Gray",
      description: "Elegant dark gray outline",
      svgStroke: { color: "#374151", width: 0.8 },
      textStroke: { color: "#374151", width: 1.2 },
    },
    {
      name: "Subtle Dark",
      description: "Very dark gray, thinner",
      svgStroke: { color: "#1f2937", width: 0.6 },
      textStroke: { color: "#1f2937", width: 1 },
    },
    {
      name: "Medium Gray",
      description: "Softer gray, slightly thicker",
      svgStroke: { color: "#4b5563", width: 0.7 },
      textStroke: { color: "#4b5563", width: 1.5 },
    },
    {
      name: "No Outline",
      description: "Clean, modern look",
      svgStroke: { color: "transparent", width: 0 },
      textStroke: { color: "transparent", width: 0 },
    },
    {
      name: "White Outline",
      description: "White outline for contrast",
      svgStroke: { color: "#ffffff", width: 0.6 },
      textStroke: { color: "#ffffff", width: 1 },
    },
  ];

  const testPieces = ["rK", "bQ", "yR", "gB"];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 Outline Style Switcher</Text>
      <Text style={styles.subtitle}>
        Tap to cycle through different outline styles
      </Text>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={styles.button}
          onPress={() =>
            setCurrentStyle((prev) => (prev + 1) % outlineStyles.length)
          }
        >
          <Text style={styles.buttonText}>Next Style</Text>
        </TouchableOpacity>

        <View style={styles.currentStyleInfo}>
          <Text style={styles.currentStyleName}>
            {outlineStyles[currentStyle].name}
          </Text>
          <Text style={styles.currentStyleDescription}>
            {outlineStyles[currentStyle].description}
          </Text>
        </View>
      </View>

      <View style={styles.piecesContainer}>
        {testPieces.map((piece, index) => (
          <View key={index} style={styles.pieceWrapper}>
            <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
              <Piece piece={piece} size={60} />
            </View>
            <Text style={styles.pieceCode}>{piece}</Text>
          </View>
        ))}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Current Style Details:</Text>
        <Text style={styles.infoText}>
          SVG Stroke: {outlineStyles[currentStyle].svgStroke.color} (
          {outlineStyles[currentStyle].svgStroke.width}px)
        </Text>
        <Text style={styles.infoText}>
          Text Stroke: {outlineStyles[currentStyle].textStroke.color} (
          {outlineStyles[currentStyle].textStroke.width}px)
        </Text>
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>💡 To Apply This Style:</Text>
        <Text style={styles.instructionsText}>
          1. Open <Text style={styles.code}>PieceConfig.ts</Text>
        </Text>
        <Text style={styles.instructionsText}>
          2. Update the <Text style={styles.code}>STROKE</Text> and{" "}
          <Text style={styles.code}>TEXT_STROKE</Text> values
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
  controlsContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  button: {
    backgroundColor: "#3b82f6",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "bold",
  },
  currentStyleInfo: {
    flex: 1,
    marginLeft: 20,
  },
  currentStyleName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  currentStyleDescription: {
    fontSize: 14,
    color: "#6b7280",
  },
  piecesContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  pieceWrapper: {
    alignItems: "center",
  },
  square: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  pieceCode: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
  },
  infoContainer: {
    backgroundColor: "#f0f9ff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    fontFamily: "monospace",
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

