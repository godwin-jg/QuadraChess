import React from "react";
import { View, Text, StyleSheet, ScrollView } from "react-native";
import Svg, { G, Path, Defs, LinearGradient, Stop } from "react-native-svg";
import MixedStylePiece from "./MixedStylePiece";

/**
 * Comparison showing lighter colors for wood pieces
 */
export default function WoodColorComparison() {
  const testPiece = "bK"; // Blue King for testing
  const piecePath =
    "M 22.5,11.63 L 22.5,6 M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 M 20,8 L 25,8 M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5 M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37";

  const colorStyles = [
    {
      name: "❌ Old: Dark Colors",
      description: "Too dark for wood pieces",
      blueColor: "#1E40AF",
      greenColor: "#059669",
    },
    {
      name: "✅ New: Cyan & Green",
      description: "Fresh cyan and lighter green for wood",
      blueColor: "#06B6D4",
      greenColor: "#10B981",
    },
  ];

  const renderWoodPiece = (
    blueColor: string,
    greenColor: string,
    isBlue: boolean
  ) => (
    <Svg width={80} height={80} viewBox="0 0 48 48">
      <Defs>
        <LinearGradient id="woodGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <Stop offset="0%" stopColor="#D2B48C" />
          <Stop offset="30%" stopColor="#CD853F" />
          <Stop offset="70%" stopColor="#8B4513" />
          <Stop offset="100%" stopColor="#654321" />
        </LinearGradient>
      </Defs>

      {/* Wood base piece */}
      <G
        fill="url(#woodGradient)"
        stroke="#8B4513"
        strokeWidth={1}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <Path d={piecePath} />
      </G>

      {/* Colored band around base */}
      <G fill={isBlue ? blueColor : greenColor}>
        <Path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,35 C 32.5,35 27,37.5 22.5,37.5 C 18,37.5 12.5,35 12.5,35 L 12.5,37" />
      </G>
    </Svg>
  );

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎨 Wood Color Comparison</Text>
      <Text style={styles.subtitle}>
        Lighter colors work better with classic wood pieces
      </Text>

      <View style={styles.comparisonSection}>
        <Text style={styles.sectionTitle}>🔍 Color Comparison</Text>
        {colorStyles.map((style, index) => (
          <View key={index} style={styles.styleCard}>
            <Text style={styles.styleName}>{style.name}</Text>
            <Text style={styles.styleDescription}>{style.description}</Text>

            <View style={styles.piecesRow}>
              <View style={styles.pieceContainer}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  {renderWoodPiece(style.blueColor, style.greenColor, true)}
                </View>
                <Text style={styles.pieceLabel}>Blue King</Text>
                <Text style={styles.colorCode}>{style.blueColor}</Text>
              </View>

              <View style={styles.pieceContainer}>
                <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                  {renderWoodPiece(style.blueColor, style.greenColor, false)}
                </View>
                <Text style={styles.pieceLabel}>Green King</Text>
                <Text style={styles.colorCode}>{style.greenColor}</Text>
              </View>
            </View>
          </View>
        ))}
      </View>

      <View style={styles.benefitsSection}>
        <Text style={styles.benefitsTitle}>✨ Benefits of Lighter Colors</Text>
        <Text style={styles.benefitText}>
          🎨 <Text style={styles.bold}>Better Harmony</Text> - Lighter colors
          complement wood better
        </Text>
        <Text style={styles.benefitText}>
          👁️ <Text style={styles.bold}>Subtle Elegance</Text> - Not overwhelming
          on wood base
        </Text>
        <Text style={styles.benefitText}>
          🏆 <Text style={styles.bold}>Premium Look</Text> - More sophisticated
          appearance
        </Text>
        <Text style={styles.benefitText}>
          🎯 <Text style={styles.bold}>Better Contrast</Text> - Still visible
          but not harsh
        </Text>
      </View>

      <View style={styles.colorDetailsSection}>
        <Text style={styles.colorDetailsTitle}>🎨 Color Details</Text>
        <View style={styles.colorRow}>
          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: "#1E40AF" }]} />
            <Text style={styles.colorName}>Old Blue</Text>
            <Text style={styles.colorCode}>#1E40AF</Text>
            <Text style={styles.colorDescription}>Too dark for wood</Text>
          </View>

          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: "#06B6D4" }]} />
            <Text style={styles.colorName}>New Cyan</Text>
            <Text style={styles.colorCode}>#06B6D4</Text>
            <Text style={styles.colorDescription}>Fresh cyan for wood</Text>
          </View>
        </View>

        <View style={styles.colorRow}>
          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: "#059669" }]} />
            <Text style={styles.colorName}>Old Green</Text>
            <Text style={styles.colorCode}>#059669</Text>
            <Text style={styles.colorDescription}>Too dark for wood</Text>
          </View>

          <View style={styles.colorItem}>
            <View style={[styles.colorBox, { backgroundColor: "#10B981" }]} />
            <Text style={styles.colorName}>New Green</Text>
            <Text style={styles.colorCode}>#10B981</Text>
            <Text style={styles.colorDescription}>Perfect for wood</Text>
          </View>
        </View>
      </View>

      <View style={styles.finalSection}>
        <Text style={styles.finalTitle}>🎉 Wood Colors Optimized!</Text>
        <Text style={styles.finalText}>
          The wood pieces now use fresh cyan and lighter green colors that
          complement the classic wood appearance perfectly. This creates a more
          sophisticated and elegant look while maintaining excellent visibility!
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
  comparisonSection: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  styleCard: {
    marginBottom: 20,
    padding: 20,
    backgroundColor: "white",
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  styleName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 6,
    textAlign: "center",
  },
  styleDescription: {
    fontSize: 14,
    color: "#6b7280",
    textAlign: "center",
    fontStyle: "italic",
    marginBottom: 15,
  },
  piecesRow: {
    flexDirection: "row",
    justifyContent: "space-around",
  },
  pieceContainer: {
    alignItems: "center",
  },
  square: {
    width: 90,
    height: 90,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  pieceLabel: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
  },
  colorCode: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  benefitsSection: {
    backgroundColor: "#f0fdf4",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#10b981",
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  benefitText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
  },
  colorDetailsSection: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  colorDetailsTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  colorRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 20,
  },
  colorItem: {
    alignItems: "center",
    flex: 1,
  },
  colorBox: {
    width: 50,
    height: 50,
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#d1d5db",
  },
  colorName: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 4,
  },
  colorCode: {
    fontSize: 10,
    color: "#6b7280",
    fontFamily: "monospace",
    marginBottom: 4,
  },
  colorDescription: {
    fontSize: 10,
    color: "#9ca3af",
    textAlign: "center",
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
