import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import { useSettings } from "../../../context/SettingsContext";
import { getBoardTheme } from "./BoardThemeConfig";
import Board from "./Board";

/**
 * Test component to verify board theme changes
 */
export default function BoardThemeTest() {
  const { settings } = useSettings();
  const boardTheme = getBoardTheme(settings);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎨 Board Theme Test</Text>
      <Text style={styles.subtitle}>Current theme: {settings.board.theme}</Text>

      <View style={styles.themeInfo}>
        <Text style={styles.infoTitle}>Theme Colors:</Text>
        <View style={styles.colorInfo}>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: boardTheme.lightSquare },
              ]}
            />
            <Text style={styles.colorLabel}>
              Light Square: {boardTheme.lightSquare}
            </Text>
          </View>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: boardTheme.darkSquare },
              ]}
            />
            <Text style={styles.colorLabel}>
              Dark Square: {boardTheme.darkSquare}
            </Text>
          </View>
          <View style={styles.colorRow}>
            <View
              style={[
                styles.colorSwatch,
                { backgroundColor: boardTheme.borderColor },
              ]}
            />
            <Text style={styles.colorLabel}>
              Border: {boardTheme.borderColor}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.boardContainer}>
        <Text style={styles.boardTitle}>Live Board Preview</Text>
        <Text style={styles.boardSubtitle}>
          This board should reflect your current theme settings
        </Text>
        <View style={styles.boardWrapper}>
          <Board />
        </View>
      </View>

      <View style={styles.instructions}>
        <Text style={styles.instructionsTitle}>How to Test:</Text>
        <Text style={styles.instructionText}>1. Go to Profile Settings</Text>
        <Text style={styles.instructionText}>
          2. Change the board theme (Brown, Grey & White, Green & Ivory)
        </Text>
        <Text style={styles.instructionText}>
          3. Return to this screen to see the changes
        </Text>
        <Text style={styles.instructionText}>
          4. The board colors should update immediately
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 10,
    color: "#FFFFFF",
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    textAlign: "center",
    marginBottom: 30,
    color: "#9CA3AF",
    fontStyle: "italic",
    paddingHorizontal: 20,
  },
  themeInfo: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#FFFFFF",
  },
  colorInfo: {
    gap: 12,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  colorSwatch: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#666666",
  },
  colorLabel: {
    fontSize: 14,
    color: "#D1D5DB",
    fontFamily: "monospace",
  },
  boardContainer: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
    alignItems: "center",
  },
  boardTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#FFFFFF",
  },
  boardSubtitle: {
    fontSize: 14,
    color: "#9CA3AF",
    marginBottom: 20,
    textAlign: "center",
  },
  boardWrapper: {
    backgroundColor: "#000000",
    padding: 10,
    borderRadius: 8,
  },
  instructions: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3B82F6",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#FFFFFF",
  },
  instructionText: {
    fontSize: 14,
    color: "#D1D5DB",
    marginBottom: 5,
  },
});

