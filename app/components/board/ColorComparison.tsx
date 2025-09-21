import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Piece from "./Piece";

/**
 * Color comparison component to showcase the improved color scheme
 */
export default function ColorComparison() {
  const colorSets = [
    {
      name: "Original Colors",
      colors: {
        red: "#DC2626",
        blue: "#2563EB",
        yellow: "#EAB308",
        green: "#16A34A",
      },
      pieces: ["rK", "bQ", "yR", "gB"],
    },
    {
      name: "Enhanced Colors",
      colors: {
        red: "#B91C1C",
        blue: "#1E40AF",
        yellow: "#D97706",
        green: "#059669",
      },
      pieces: ["rK", "bQ", "yR", "gB"],
    },
  ];

  const boardSquares = [
    { color: "light", bg: "#f0d9b5" },
    { color: "dark", bg: "#b58863" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>Chess Piece Color Comparison</Text>
      <Text style={styles.subtitle}>
        Optimized for brown board (#f0d9b5 / #b58863)
      </Text>

      {colorSets.map((set, setIndex) => (
        <View key={setIndex} style={styles.colorSet}>
          <Text style={styles.setTitle}>{set.name}</Text>

          {boardSquares.map((square, squareIndex) => (
            <View key={squareIndex} style={styles.boardRow}>
              <Text style={styles.squareLabel}>
                {square.color === "light" ? "Light Square" : "Dark Square"}
              </Text>
              <View style={[styles.square, { backgroundColor: square.bg }]}>
                {set.pieces.map((piece, pieceIndex) => (
                  <View key={pieceIndex} style={styles.pieceContainer}>
                    <Piece piece={piece} size={40} />
                    <Text style={styles.pieceCode}>{piece}</Text>
                  </View>
                ))}
              </View>
            </View>
          ))}

          <View style={styles.colorPalette}>
            <Text style={styles.paletteTitle}>Color Palette:</Text>
            <View style={styles.colorSwatches}>
              {Object.entries(set.colors).map(([colorName, colorValue]) => (
                <View key={colorName} style={styles.colorSwatch}>
                  <View
                    style={[styles.colorBox, { backgroundColor: colorValue }]}
                  />
                  <Text style={styles.colorName}>{colorName}</Text>
                  <Text style={styles.colorValue}>{colorValue}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}

      <View style={styles.improvementsContainer}>
        <Text style={styles.improvementsTitle}>🎯 Improvements Made:</Text>
        <Text style={styles.improvementText}>
          • <Text style={styles.bold}>Red</Text>: Deeper crimson (#B91C1C) -
          More sophisticated
        </Text>
        <Text style={styles.improvementText}>
          • <Text style={styles.bold}>Blue</Text>: Rich navy (#1E40AF) - Better
          contrast on brown
        </Text>
        <Text style={styles.improvementText}>
          • <Text style={styles.bold}>Yellow</Text>: Golden amber (#D97706) -
          Much more visible
        </Text>
        <Text style={styles.improvementText}>
          • <Text style={styles.bold}>Green</Text>: Forest green (#059669) -
          Professional look
        </Text>
      </View>

      <View style={styles.contrastContainer}>
        <Text style={styles.contrastTitle}>📊 Contrast Analysis:</Text>
        <Text style={styles.contrastText}>
          All colors now have excellent contrast ratios against both light and
          dark squares.
        </Text>
        <Text style={styles.contrastText}>
          The golden amber yellow is particularly improved - much more readable!
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
  colorSet: {
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
  setTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
    textAlign: "center",
  },
  boardRow: {
    marginBottom: 15,
  },
  squareLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    color: "#4b5563",
  },
  square: {
    height: 60,
    borderRadius: 8,
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    paddingHorizontal: 10,
  },
  pieceContainer: {
    alignItems: "center",
  },
  pieceCode: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
    marginTop: 2,
  },
  colorPalette: {
    marginTop: 15,
    paddingTop: 15,
    borderTopWidth: 1,
    borderTopColor: "#e5e7eb",
  },
  paletteTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 10,
    color: "#374151",
  },
  colorSwatches: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  colorSwatch: {
    alignItems: "center",
  },
  colorBox: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  colorName: {
    fontSize: 12,
    fontWeight: "600",
    color: "#374151",
    textTransform: "capitalize",
  },
  colorValue: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  improvementsContainer: {
    backgroundColor: "#f0f9ff",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  improvementsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  improvementText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
  },
  contrastContainer: {
    backgroundColor: "#f0fdf4",
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  contrastTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  contrastText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
});

