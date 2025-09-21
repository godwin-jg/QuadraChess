import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Piece from "./Piece";
import GradientPiece from "./GradientPiece";
import AccentPiece from "./AccentPiece";

/**
 * Comprehensive comparison of different piece styling approaches
 */
export default function StylingComparison() {
  const testPieces = ["rK", "bQ", "yR", "gB"];

  const stylingApproaches = [
    {
      name: "Current: Solid Color",
      description: "Full piece colored with team color",
      component: (piece: string) => <Piece piece={piece} size={60} />,
      pros: ["Simple", "Clear team distinction", "Easy to implement"],
      cons: ["Can be overwhelming", "Less elegant", "Harsh appearance"],
    },
    {
      name: "Gradient Fill",
      description: "Subtle gradient instead of solid color",
      component: (piece: string) => <GradientPiece piece={piece} size={60} />,
      pros: ["Elegant", "Professional look", "Subtle color usage"],
      cons: ["More complex", "Requires SVG gradients"],
    },
    {
      name: "Accent Color",
      description: "Dark piece with colored accent details",
      component: (piece: string) => <AccentPiece piece={piece} size={60} />,
      pros: ["Sophisticated", "Classic appearance", "High contrast"],
      cons: ["Complex implementation", "Requires path segmentation"],
    },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎨 Piece Styling Comparison</Text>
      <Text style={styles.subtitle}>
        Different approaches to piece coloring and styling
      </Text>

      {stylingApproaches.map((approach, approachIndex) => (
        <View key={approachIndex} style={styles.approachContainer}>
          <Text style={styles.approachName}>{approach.name}</Text>
          <Text style={styles.approachDescription}>{approach.description}</Text>

          <View style={styles.piecesGrid}>
            {testPieces.map((piece, pieceIndex) => (
              <View key={pieceIndex} style={styles.pieceContainer}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  {approach.component(piece)}
                </View>
                <Text style={styles.pieceCode}>{piece}</Text>
              </View>
            ))}
          </View>

          <View style={styles.prosConsContainer}>
            <View style={styles.prosContainer}>
              <Text style={styles.prosTitle}>✅ Pros:</Text>
              {approach.pros.map((pro, proIndex) => (
                <Text key={proIndex} style={styles.proText}>
                  • {pro}
                </Text>
              ))}
            </View>
            <View style={styles.consContainer}>
              <Text style={styles.consTitle}>❌ Cons:</Text>
              {approach.cons.map((con, conIndex) => (
                <Text key={conIndex} style={styles.conText}>
                  • {con}
                </Text>
              ))}
            </View>
          </View>
        </View>
      ))}

      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>💡 Recommendations:</Text>
        <Text style={styles.recommendationText}>
          🥇 <Text style={styles.bold}>Gradient Fill</Text> - Best balance of
          elegance and simplicity
        </Text>
        <Text style={styles.recommendationText}>
          🥈 <Text style={styles.bold}>Accent Color</Text> - Most sophisticated
          and professional
        </Text>
        <Text style={styles.recommendationText}>
          🥉 <Text style={styles.bold}>Solid Color</Text> - Simplest but less
          elegant
        </Text>
      </View>

      <View style={styles.implementationContainer}>
        <Text style={styles.implementationTitle}>🔧 Implementation Guide:</Text>
        <Text style={styles.implementationText}>
          1. <Text style={styles.bold}>Gradient Approach:</Text>
        </Text>
        <Text style={styles.codeText}>• Use SVG LinearGradient elements</Text>
        <Text style={styles.codeText}>
          • Define start and end colors for each team
        </Text>
        <Text style={styles.codeText}>
          • Apply gradient as fill instead of solid color
        </Text>

        <Text style={styles.implementationText}>
          2. <Text style={styles.bold}>Accent Approach:</Text>
        </Text>
        <Text style={styles.codeText}>
          • Segment SVG paths into base and accent parts
        </Text>
        <Text style={styles.codeText}>
          • Color base in dark color (black/gray)
        </Text>
        <Text style={styles.codeText}>• Color accent parts in team colors</Text>

        <Text style={styles.implementationText}>
          3. <Text style={styles.bold}>Configuration:</Text>
        </Text>
        <Text style={styles.codeText}>
          • Use PieceStylingConfig.ts to switch modes
        </Text>
        <Text style={styles.codeText}>
          • Update Piece.tsx to use selected styling
        </Text>
      </View>

      <View style={styles.nextStepsContainer}>
        <Text style={styles.nextStepsTitle}>🚀 Next Steps:</Text>
        <Text style={styles.nextStepText}>
          1. Choose your preferred styling approach
        </Text>
        <Text style={styles.nextStepText}>
          2. Update Piece.tsx to implement the chosen style
        </Text>
        <Text style={styles.nextStepText}>
          3. Test with all piece types and colors
        </Text>
        <Text style={styles.nextStepText}>
          4. Fine-tune colors and effects as needed
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
  approachContainer: {
    backgroundColor: "white",
    margin: 20,
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  approachName: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  approachDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 20,
    fontStyle: "italic",
  },
  piecesGrid: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  pieceContainer: {
    alignItems: "center",
  },
  square: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  pieceCode: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  prosConsContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  prosContainer: {
    flex: 1,
    marginRight: 10,
  },
  prosTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#059669",
    marginBottom: 8,
  },
  proText: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 4,
    lineHeight: 16,
  },
  consContainer: {
    flex: 1,
    marginLeft: 10,
  },
  consTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#dc2626",
    marginBottom: 8,
  },
  conText: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 4,
    lineHeight: 16,
  },
  recommendationsContainer: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
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
  implementationContainer: {
    backgroundColor: "#f9fafb",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  implementationTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  implementationText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    marginTop: 12,
    fontWeight: "500",
  },
  codeText: {
    fontSize: 12,
    color: "#6b7280",
    marginLeft: 16,
    marginBottom: 4,
    fontFamily: "monospace",
  },
  nextStepsContainer: {
    backgroundColor: "#f0fdf4",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
    marginBottom: 40,
  },
  nextStepsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  nextStepText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 6,
    lineHeight: 20,
  },
});

