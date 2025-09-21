import React, { useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import Piece from "./Piece";
import { PIECE_CONFIG } from "./PieceConfig";

/**
 * Example component showing how to switch between Unicode and SVG modes
 * This is for demonstration purposes - you can use this pattern in your settings
 */
export default function PieceModeExample() {
  const [useSVG, setUseSVG] = useState(PIECE_CONFIG.USE_SVG_PIECES);

  const examplePieces = [
    { code: "rK", name: "Red King" },
    { code: "bQ", name: "Blue Queen" },
    { code: "yR", name: "Yellow Rook" },
    { code: "gB", name: "Green Bishop" },
    { code: "rN", name: "Red Knight" },
    { code: "bP", name: "Blue Pawn" },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Chess Piece Rendering</Text>

      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[styles.button, !useSVG && styles.activeButton]}
          onPress={() => setUseSVG(false)}
        >
          <Text style={[styles.buttonText, !useSVG && styles.activeButtonText]}>
            Unicode Symbols
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, useSVG && styles.activeButton]}
          onPress={() => setUseSVG(true)}
        >
          <Text style={[styles.buttonText, useSVG && styles.activeButtonText]}>
            SVG Pieces
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.piecesContainer}>
        {examplePieces.map((piece, index) => (
          <View key={index} style={styles.pieceContainer}>
            <Text style={styles.pieceLabel}>{piece.name}</Text>
            <Piece piece={piece.code} size={60} useSVG={useSVG} />
          </View>
        ))}
      </View>

      <Text style={styles.info}>
        {useSVG
          ? "Using SVG pieces (requires SVG files in assets/chess-pieces/)"
          : "Using Unicode symbols (default fallback)"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
  },
  toggleContainer: {
    flexDirection: "row",
    marginBottom: 30,
    borderRadius: 8,
    backgroundColor: "#f0f0f0",
    padding: 4,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 6,
  },
  activeButton: {
    backgroundColor: "#007AFF",
  },
  buttonText: {
    fontSize: 16,
    color: "#666",
  },
  activeButtonText: {
    color: "white",
    fontWeight: "bold",
  },
  piecesContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 20,
  },
  pieceContainer: {
    alignItems: "center",
    margin: 10,
    padding: 10,
    backgroundColor: "#f8f8f8",
    borderRadius: 8,
  },
  pieceLabel: {
    fontSize: 12,
    marginBottom: 5,
    textAlign: "center",
  },
  info: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    fontStyle: "italic",
  },
});

