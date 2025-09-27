import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { useSettings } from "../../../context/SettingsContext";
import { getBoardTheme } from "./BoardThemeConfig";
import Piece from "./Piece";

/**
 * Verify that settings are working correctly
 */
export default function SettingsVerification() {
  const { settings, isLoading } = useSettings();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  const boardTheme = getBoardTheme(settings);

  const testPieces = [
    { code: "rK", name: "Red King", color: "Red" },
    { code: "yQ", name: "Purple Queen", color: "Purple" },
    { code: "bR", name: "Blue Rook", color: "Blue" },
    { code: "gB", name: "Green Bishop", color: "Green" },
  ];

  const renderBoardPreview = () => {
    return (
      <View style={styles.boardPreview}>
        <Text style={styles.previewTitle}>Board Theme Preview</Text>
        <View
          style={[styles.board, { backgroundColor: boardTheme.borderColor }]}
        >
          {[0, 1, 2, 3, 4, 5, 6, 7].map((row) => (
            <View key={row} style={styles.boardRow}>
              {[0, 1, 2, 3, 4, 5, 6, 7].map((col) => (
                <View
                  key={col}
                  style={[
                    styles.square,
                    {
                      backgroundColor:
                        (row + col) % 2 === 0
                          ? boardTheme.lightSquare
                          : boardTheme.darkSquare,
                    },
                  ]}
                />
              ))}
            </View>
          ))}
        </View>
        <Text style={styles.themeInfo}>
          Theme: {settings.board.theme} | Light: {boardTheme.lightSquare} |
          Dark: {boardTheme.darkSquare}
        </Text>
      </View>
    );
  };

  const renderPiecePreview = () => {
    return (
      <View style={styles.piecePreview}>
        <Text style={styles.previewTitle}>Piece Style Preview</Text>
        <View style={styles.piecesGrid}>
          {testPieces.map((piece, index) => (
            <View key={index} style={styles.pieceContainer}>
              <View
                style={[
                  styles.pieceSquare,
                  { backgroundColor: boardTheme.lightSquare },
                ]}
              >
                <Piece piece={piece.code} size={40} useSVG={true} />
              </View>
              <Text style={styles.pieceLabel}>{piece.name}</Text>
              <Text style={styles.pieceColor}>{piece.color}</Text>
            </View>
          ))}
        </View>
        <Text style={styles.styleInfo}>
          Style: {settings.pieces.style} | Size: {settings.pieces.size}
        </Text>
      </View>
    );
  };

  const renderSettingsInfo = () => {
    return (
      <View style={styles.settingsInfo}>
        <Text style={styles.infoTitle}>Current Settings</Text>
        <View style={styles.infoGrid}>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Player Name:</Text>
            <Text style={styles.infoValue}>{settings.profile.name}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Board Theme:</Text>
            <Text style={styles.infoValue}>{settings.board.theme}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Piece Style:</Text>
            <Text style={styles.infoValue}>{settings.pieces.style}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Piece Size:</Text>
            <Text style={styles.infoValue}>{settings.pieces.size}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Sound:</Text>
            <Text style={styles.infoValue}>
              {settings.game.soundEnabled ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Animations:</Text>
            <Text style={styles.infoValue}>
              {settings.game.animationsEnabled ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Move Hints:</Text>
            <Text style={styles.infoValue}>
              {settings.game.showMoveHints ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>High Contrast:</Text>
            <Text style={styles.infoValue}>
              {settings.accessibility.highContrast ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Large Text:</Text>
            <Text style={styles.infoValue}>
              {settings.accessibility.largeText ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Reduced Motion:</Text>
            <Text style={styles.infoValue}>
              {settings.accessibility.reducedMotion ? "On" : "Off"}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔍 Settings Verification</Text>
      <Text style={styles.subtitle}>
        Verify that settings are working correctly
      </Text>

      {renderSettingsInfo()}
      {renderBoardPreview()}
      {renderPiecePreview()}

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to Test:</Text>
        <Text style={styles.instructionText}>
          1. Go to Profile Settings and change any setting
        </Text>
        <Text style={styles.instructionText}>
          2. Return to this screen to see the changes
        </Text>
        <Text style={styles.instructionText}>
          3. The board colors and piece styles should update immediately
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
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f8f9fa",
  },
  loadingText: {
    fontSize: 16,
    color: "#6B7280",
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
  settingsInfo: {
    backgroundColor: "#ffffff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  infoGrid: {
    gap: 8,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  infoLabel: {
    fontSize: 14,
    color: "#6b7280",
    fontWeight: "500",
  },
  infoValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600",
  },
  boardPreview: {
    backgroundColor: "#ffffff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  board: {
    padding: 4,
    borderRadius: 8,
    marginBottom: 10,
    alignSelf: "center",
  },
  boardRow: {
    flexDirection: "row",
  },
  square: {
    width: 20,
    height: 20,
  },
  themeInfo: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    fontFamily: "monospace",
  },
  piecePreview: {
    backgroundColor: "#ffffff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  pieceContainer: {
    alignItems: "center",
    margin: 8,
  },
  pieceSquare: {
    width: 60,
    height: 60,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  pieceLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
  },
  pieceColor: {
    fontSize: 10,
    color: "#6b7280",
  },
  styleInfo: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    fontFamily: "monospace",
  },
  instructions: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  instructionText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 5,
  },
});

