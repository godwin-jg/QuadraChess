import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";

/**
 * Implementation guide for mixed style pieces
 */
export default function MixedStyleImplementation() {
  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔧 Mixed Style Implementation Guide</Text>
      <Text style={styles.subtitle}>
        How to implement white outline + classic wood styling
      </Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎯 Styling Rules</Text>
        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>Red & Purple Pieces</Text>
          <Text style={styles.ruleDescription}>White Outline Style</Text>
          <Text style={styles.ruleDetails}>
            • Colored pieces with white outline
          </Text>
          <Text style={styles.ruleDetails}>
            • Red: #B91C1C fill with white outline
          </Text>
          <Text style={styles.ruleDetails}>
            • Purple: #7C3AED fill with white outline
          </Text>
          <Text style={styles.ruleDetails}>• Outline width: 0.6px</Text>
        </View>

        <View style={styles.ruleCard}>
          <Text style={styles.ruleTitle}>Blue & Green Pieces</Text>
          <Text style={styles.ruleDescription}>Classic Wood Style</Text>
          <Text style={styles.ruleDetails}>
            • Wood gradient base (light to dark brown)
          </Text>
          <Text style={styles.ruleDetails}>• Blue: #06B6D4 band (cyan)</Text>
          <Text style={styles.ruleDetails}>
            • Green: #10B981 band (lighter)
          </Text>
          <Text style={styles.ruleDetails}>• Band around base of piece</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📝 Code Implementation</Text>
        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>1. Update Piece.tsx</Text>
          <Text style={styles.codeText}>
            Replace the current Piece component with MixedStylePiece:
          </Text>
          <Text style={styles.codeLine}>
            import MixedStylePiece from "./MixedStylePiece";
          </Text>
          <Text style={styles.codeLine}>
            // Use MixedStylePiece instead of current Piece
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>2. Conditional Styling Logic</Text>
          <Text style={styles.codeText}>
            The component automatically determines style based on piece color:
          </Text>
          <Text style={styles.codeLine}>
            const isOutlineStyle = pieceColor === "r" || pieceColor === "y";
          </Text>
          <Text style={styles.codeLine}>
            const isWoodStyle = pieceColor === "b" || pieceColor === "g";
          </Text>
        </View>

        <View style={styles.codeBlock}>
          <Text style={styles.codeTitle}>3. SVG Implementation</Text>
          <Text style={styles.codeText}>
            Uses SVG gradients and stroke properties:
          </Text>
          <Text style={styles.codeLine}>// Wood gradient</Text>
          <Text style={styles.codeLine}>
            &lt;LinearGradient id="woodGradient"&gt;
          </Text>
          <Text style={styles.codeLine}>// Colored outline</Text>
          <Text style={styles.codeLine}>
            stroke="#ffffff" strokeWidth={2.5}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🎨 Visual Benefits</Text>
        <View style={styles.benefitGrid}>
          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🔴</Text>
            <Text style={styles.benefitTitle}>Red Pieces</Text>
            <Text style={styles.benefitText}>
              High contrast white outline ensures excellent visibility
            </Text>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🔵</Text>
            <Text style={styles.benefitTitle}>Blue Pieces</Text>
            <Text style={styles.benefitText}>
              Classic wood appearance with blue accent bands
            </Text>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🟣</Text>
            <Text style={styles.benefitTitle}>Purple Pieces</Text>
            <Text style={styles.benefitText}>
              Elegant outline style for clear distinction
            </Text>
          </View>

          <View style={styles.benefitCard}>
            <Text style={styles.benefitIcon}>🟢</Text>
            <Text style={styles.benefitTitle}>Green Pieces</Text>
            <Text style={styles.benefitText}>
              Premium wood look with green accent bands
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>⚙️ Customization Options</Text>
        <View style={styles.customizationCard}>
          <Text style={styles.customizationTitle}>Outline Style</Text>
          <Text style={styles.customizationText}>
            • Change outline width (current: 2.5px)
          </Text>
          <Text style={styles.customizationText}>• Adjust outline colors</Text>
          <Text style={styles.customizationText}>
            • Modify base color (current: #1f2937)
          </Text>
        </View>

        <View style={styles.customizationCard}>
          <Text style={styles.customizationTitle}>Wood Style</Text>
          <Text style={styles.customizationText}>
            • Adjust wood gradient colors
          </Text>
          <Text style={styles.customizationText}>• Change band colors</Text>
          <Text style={styles.customizationText}>
            • Modify band position/size
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🚀 Quick Start</Text>
        <View style={styles.stepCard}>
          <Text style={styles.stepNumber}>1</Text>
          <Text style={styles.stepText}>Open your current Piece.tsx file</Text>
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepNumber}>2</Text>
          <Text style={styles.stepText}>Import MixedStylePiece component</Text>
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepNumber}>3</Text>
          <Text style={styles.stepText}>
            Replace Piece with MixedStylePiece in your render
          </Text>
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepNumber}>4</Text>
          <Text style={styles.stepText}>
            Test with all piece types and colors
          </Text>
        </View>
      </View>

      <View style={styles.finalSection}>
        <Text style={styles.finalTitle}>✨ Ready to Implement!</Text>
        <Text style={styles.finalText}>
          The mixed styling approach gives you the best of both worlds:
          high-contrast outline pieces for red and purple, and elegant wood
          pieces for blue and green. This creates a sophisticated, premium look
          that's both beautiful and functional!
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
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  ruleCard: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  ruleTitle: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 4,
  },
  ruleDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 10,
    fontStyle: "italic",
  },
  ruleDetails: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 4,
    marginLeft: 10,
  },
  codeBlock: {
    backgroundColor: "#1f2937",
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  codeTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#10b981",
    marginBottom: 8,
  },
  codeText: {
    fontSize: 12,
    color: "#d1d5db",
    marginBottom: 8,
  },
  codeLine: {
    fontSize: 11,
    color: "#9ca3af",
    fontFamily: "monospace",
    marginBottom: 4,
    marginLeft: 10,
  },
  benefitGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },
  benefitCard: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    width: "48%",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  benefitIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  benefitTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 6,
  },
  benefitText: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 14,
  },
  customizationCard: {
    backgroundColor: "#f0f9ff",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  customizationTitle: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  customizationText: {
    fontSize: 12,
    color: "#4b5563",
    marginBottom: 4,
    marginLeft: 10,
  },
  stepCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  stepNumber: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#3b82f6",
    marginRight: 15,
    width: 30,
    textAlign: "center",
  },
  stepText: {
    fontSize: 14,
    color: "#4b5563",
    flex: 1,
  },
  finalSection: {
    backgroundColor: "#f0fdf4",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
    marginBottom: 40,
  },
  finalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  finalText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
});
