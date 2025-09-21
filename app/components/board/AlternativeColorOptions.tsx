import React from "react";
import { View, Text, StyleSheet } from "react-native";

/**
 * Component showing alternative color options for the fourth player
 */
export default function AlternativeColorOptions() {
  const alternatives = [
    {
      name: "Purple (Current)",
      color: "#7C3AED",
      description: "Rich purple - excellent visibility",
      rating: "⭐⭐⭐⭐⭐",
    },
    {
      name: "Orange",
      color: "#EA580C",
      description: "Vibrant orange - very visible",
      rating: "⭐⭐⭐⭐⭐",
    },
    {
      name: "Teal",
      color: "#0D9488",
      description: "Deep teal - sophisticated",
      rating: "⭐⭐⭐⭐",
    },
    {
      name: "Pink",
      color: "#C026D3",
      description: "Magenta pink - distinctive",
      rating: "⭐⭐⭐⭐",
    },
    {
      name: "Indigo",
      color: "#4F46E5",
      description: "Deep indigo - professional",
      rating: "⭐⭐⭐⭐",
    },
    {
      name: "Emerald",
      color: "#059669",
      description: "Rich emerald - elegant",
      rating: "⭐⭐⭐⭐",
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 Alternative Color Options</Text>
      <Text style={styles.subtitle}>
        Instead of yellow, here are better color choices for the fourth player
      </Text>

      <View style={styles.colorsGrid}>
        {alternatives.map((option, index) => (
          <View key={index} style={styles.colorCard}>
            <View
              style={[styles.colorBox, { backgroundColor: option.color }]}
            />
            <Text style={styles.colorName}>{option.name}</Text>
            <Text style={styles.colorCode}>{option.color}</Text>
            <Text style={styles.colorDescription}>{option.description}</Text>
            <Text style={styles.rating}>{option.rating}</Text>
          </View>
        ))}
      </View>

      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>💡 Top Recommendations:</Text>
        <Text style={styles.recommendationText}>
          🥇 <Text style={styles.bold}>Purple (#7C3AED)</Text> - Currently
          active! Excellent contrast and professional look
        </Text>
        <Text style={styles.recommendationText}>
          🥈 <Text style={styles.bold}>Orange (#EA580C)</Text> - Very high
          visibility, warm and vibrant
        </Text>
        <Text style={styles.recommendationText}>
          🥉 <Text style={styles.bold}>Teal (#0D9488)</Text> - Sophisticated and
          unique, great contrast
        </Text>
      </View>

      <View style={styles.whyNotYellowContainer}>
        <Text style={styles.whyNotYellowTitle}>❌ Why Not Yellow?</Text>
        <Text style={styles.whyNotYellowText}>
          • Poor visibility on light squares (cream/beige)
        </Text>
        <Text style={styles.whyNotYellowText}>
          • Can look washed out or faded
        </Text>
        <Text style={styles.whyNotYellowText}>
          • Less professional appearance
        </Text>
        <Text style={styles.whyNotYellowText}>
          • Hard to distinguish from board highlights
        </Text>
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>🔧 How to Change Color:</Text>
        <Text style={styles.instructionsText}>
          1. Open <Text style={styles.code}>PieceConfig.ts</Text>
        </Text>
        <Text style={styles.instructionsText}>
          2. Find the <Text style={styles.code}>COLORS</Text> section
        </Text>
        <Text style={styles.instructionsText}>
          3. Change <Text style={styles.code}>purple: "#7C3AED"</Text> to your
          preferred color
        </Text>
        <Text style={styles.instructionsText}>
          4. Save and refresh your app
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
  colorsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  colorCard: {
    alignItems: "center",
    margin: 8,
    padding: 15,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minWidth: 120,
  },
  colorBox: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  colorName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
    textAlign: "center",
  },
  colorCode: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 6,
  },
  colorDescription: {
    fontSize: 11,
    color: "#4b5563",
    marginBottom: 6,
    textAlign: "center",
    lineHeight: 14,
  },
  rating: {
    fontSize: 12,
    color: "#f59e0b",
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
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
  },
  whyNotYellowContainer: {
    backgroundColor: "#fef2f2",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#ef4444",
  },
  whyNotYellowTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  whyNotYellowText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    lineHeight: 20,
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

