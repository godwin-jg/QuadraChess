import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Piece from "./Piece";
import { getPieceColor } from "./PieceConfig";

/**
 * Simple test to verify the enhanced colors are working
 */
export default function ColorTest() {
  const testPieces = ["rK", "bQ", "yR", "gB"];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Color Test - Enhanced Colors</Text>

      <View style={styles.piecesContainer}>
        {testPieces.map((piece, index) => {
          const color = getPieceColor(piece);
          return (
            <View key={index} style={styles.pieceWrapper}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <Piece piece={piece} size={60} />
              </View>
              <Text style={styles.pieceCode}>{piece}</Text>
              <Text style={styles.colorValue}>{color}</Text>
            </View>
          );
        })}
      </View>

      <View style={styles.infoContainer}>
        <Text style={styles.infoTitle}>Expected Colors:</Text>
        <Text style={styles.infoText}>Red (r): #B91C1C</Text>
        <Text style={styles.infoText}>Blue (b): #1E40AF</Text>
        <Text style={styles.infoText}>Yellow (y): #D97706</Text>
        <Text style={styles.infoText}>Green (g): #059669</Text>
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
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1f2937",
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
    marginBottom: 4,
  },
  colorValue: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
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
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
  },
});

