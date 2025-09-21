import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Piece from "./Piece";

/**
 * Debug test to verify piece color detection and styling
 */
export default function ColorDebugTest() {
  const testPieces = [
    { code: "rK", name: "Red King", expected: "White outline style" },
    { code: "yQ", name: "Purple Queen", expected: "White outline style" },
    { code: "bR", name: "Blue Rook", expected: "Wood style with cyan" },
    { code: "gB", name: "Green Bishop", expected: "Wood style with green" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔍 Piece Color Debug Test</Text>
      <Text style={styles.subtitle}>
        Testing color detection and mixed styling
      </Text>

      <View style={styles.piecesSection}>
        {testPieces.map((piece, index) => (
          <View key={index} style={styles.pieceCard}>
            <Text style={styles.pieceName}>{piece.name}</Text>
            <Text style={styles.pieceCode}>Code: {piece.code}</Text>
            <Text style={styles.expectedStyle}>Expected: {piece.expected}</Text>

            <View style={styles.pieceContainer}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <Piece piece={piece.code} size={60} useSVG={true} />
              </View>
            </View>

            <View style={styles.colorInfo}>
              <Text style={styles.colorLabel}>Color Code: {piece.code[0]}</Text>
              <Text style={styles.colorLabel}>
                Style:{" "}
                {piece.code[0] === "r" || piece.code[0] === "y"
                  ? "White Outline"
                  : "Wood"}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.debugSection}>
        <Text style={styles.debugTitle}>🐛 Debug Information</Text>
        <Text style={styles.debugText}>
          • Red pieces (r): Should have white outline style
        </Text>
        <Text style={styles.debugText}>
          • Purple pieces (y): Should have white outline style
        </Text>
        <Text style={styles.debugText}>
          • Blue pieces (b): Should have wood style with cyan
        </Text>
        <Text style={styles.debugText}>
          • Green pieces (g): Should have wood style with green
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
    fontSize: 24,
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
  piecesSection: {
    paddingHorizontal: 20,
    marginBottom: 30,
  },
  pieceCard: {
    backgroundColor: "white",
    borderRadius: 12,
    padding: 20,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pieceName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 5,
  },
  pieceCode: {
    fontSize: 14,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 5,
  },
  expectedStyle: {
    fontSize: 14,
    color: "#059669",
    fontStyle: "italic",
    marginBottom: 15,
  },
  pieceContainer: {
    alignItems: "center",
    marginBottom: 15,
  },
  square: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  colorInfo: {
    backgroundColor: "#f3f4f6",
    padding: 10,
    borderRadius: 8,
  },
  colorLabel: {
    fontSize: 12,
    color: "#374151",
    marginBottom: 2,
  },
  debugSection: {
    backgroundColor: "#fef3c7",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#f59e0b",
  },
  debugTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  debugText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
});

