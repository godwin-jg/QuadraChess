import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { PIECE_CONFIG } from "./PieceConfig";

/**
 * Debug component to show the actual color values from config
 */
export default function DebugColors() {
  const colors = PIECE_CONFIG.COLORS;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug: Current Color Values</Text>

      <View style={styles.colorGrid}>
        <View style={styles.colorItem}>
          <View style={[styles.colorBox, { backgroundColor: colors.red }]} />
          <Text style={styles.colorLabel}>Red</Text>
          <Text style={styles.colorValue}>{colors.red}</Text>
        </View>

        <View style={styles.colorItem}>
          <View style={[styles.colorBox, { backgroundColor: colors.blue }]} />
          <Text style={styles.colorLabel}>Blue</Text>
          <Text style={styles.colorValue}>{colors.blue}</Text>
        </View>

        <View style={styles.colorItem}>
          <View style={[styles.colorBox, { backgroundColor: colors.purple }]} />
          <Text style={styles.colorLabel}>Purple (was Yellow)</Text>
          <Text style={styles.colorValue}>{colors.purple}</Text>
        </View>

        <View style={styles.colorItem}>
          <View style={[styles.colorBox, { backgroundColor: colors.green }]} />
          <Text style={styles.colorLabel}>Green</Text>
          <Text style={styles.colorValue}>{colors.green}</Text>
        </View>
      </View>

      <View style={styles.expectedContainer}>
        <Text style={styles.expectedTitle}>Expected Enhanced Colors:</Text>
        <Text style={styles.expectedText}>Red: #B91C1C (Deep crimson)</Text>
        <Text style={styles.expectedText}>Blue: #1E40AF (Rich navy)</Text>
        <Text style={styles.expectedText}>Yellow: #D97706 (Golden amber)</Text>
        <Text style={styles.expectedText}>Green: #059669 (Forest green)</Text>
      </View>

      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Status Check:</Text>
        <Text
          style={[
            styles.statusText,
            { color: colors.red === "#B91C1C" ? "#10b981" : "#ef4444" },
          ]}
        >
          {colors.red === "#B91C1C" ? "✅" : "❌"} Red:{" "}
          {colors.red === "#B91C1C" ? "Correct" : "Incorrect"}
        </Text>
        <Text
          style={[
            styles.statusText,
            { color: colors.blue === "#1E40AF" ? "#10b981" : "#ef4444" },
          ]}
        >
          {colors.blue === "#1E40AF" ? "✅" : "❌"} Blue:{" "}
          {colors.blue === "#1E40AF" ? "Correct" : "Incorrect"}
        </Text>
        <Text
          style={[
            styles.statusText,
            { color: colors.purple === "#7C3AED" ? "#10b981" : "#ef4444" },
          ]}
        >
          {colors.purple === "#7C3AED" ? "✅" : "❌"} Purple:{" "}
          {colors.purple === "#7C3AED" ? "Correct" : "Incorrect"}
        </Text>
        <Text
          style={[
            styles.statusText,
            { color: colors.green === "#059669" ? "#10b981" : "#ef4444" },
          ]}
        >
          {colors.green === "#059669" ? "✅" : "❌"} Green:{" "}
          {colors.green === "#059669" ? "Correct" : "Incorrect"}
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
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 20,
    color: "#1f2937",
  },
  colorGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  colorItem: {
    alignItems: "center",
  },
  colorBox: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  colorLabel: {
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
  expectedContainer: {
    backgroundColor: "#f0f9ff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
  },
  expectedTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  expectedText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 4,
  },
  statusContainer: {
    backgroundColor: "#f9fafb",
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  statusText: {
    fontSize: 14,
    marginBottom: 4,
    fontWeight: "500",
  },
});
