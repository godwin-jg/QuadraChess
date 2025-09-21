import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Svg, { G, Path, Defs, LinearGradient, Stop } from "react-native-svg";

/**
 * Component showcasing different piece styling approaches instead of full coloring
 */
export default function EnhancedPieceStyling() {
  const testPiece = "rK"; // Red King for testing
  const piecePath =
    "M 22.5,11.63 L 22.5,6 M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37 M 20,8 L 25,8 M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5 M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5 M 12.5,37 C 18,34 27,34 32.5,37";

  const stylingOptions = [
    {
      name: "Gradient Fill",
      description: "Subtle gradient instead of solid color",
      component: (
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <Defs>
            <LinearGradient
              id="redGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#DC2626" />
              <Stop offset="100%" stopColor="#B91C1C" />
            </LinearGradient>
          </Defs>
          <G
            fill="url(#redGradient)"
            stroke="#374151"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
        </Svg>
      ),
    },
    {
      name: "Accent Color",
      description: "Black piece with colored accent details",
      component: (
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <G
            fill="#1f2937"
            stroke="#374151"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
          {/* Colored accent on crown */}
          <G fill="#B91C1C">
            <Path d="M 20,8 L 25,8" stroke="#B91C1C" strokeWidth={2} />
          </G>
        </Svg>
      ),
    },
    {
      name: "Colored Outline",
      description: "Black piece with colored outline",
      component: (
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <G
            fill="#1f2937"
            stroke="#B91C1C"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
        </Svg>
      ),
    },
    {
      name: "Colored Base",
      description: "Colored base with black details",
      component: (
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <G
            fill="#B91C1C"
            stroke="#374151"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,30 C 32.5,30 41.5,25.5 38.5,19.5 C 34.5,13 25,16 22.5,23.5 L 22.5,27 L 22.5,23.5 C 20,16 10.5,13 6.5,19.5 C 3.5,25.5 12.5,30 12.5,30 L 12.5,37" />
          </G>
          <G
            fill="#1f2937"
            stroke="#374151"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d="M 22.5,11.63 L 22.5,6 M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25 M 20,8 L 25,8 M 32,29.5 C 32,29.5 40.5,25.5 38.03,19.85 C 34.15,14 25,18 22.5,24.5 L 22.5,26.6 L 22.5,24.5 C 20,18 10.85,14 6.97,19.85 C 4.5,25.5 13,29.5 13,29.5 M 12.5,30 C 18,27 27,27 32.5,30 M 12.5,33.5 C 18,30.5 27,30.5 32.5,33.5" />
          </G>
        </Svg>
      ),
    },
    {
      name: "Colored Highlights",
      description: "Black piece with colored highlight details",
      component: (
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <G
            fill="#1f2937"
            stroke="#374151"
            strokeWidth={0.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <Path d={piecePath} />
          </G>
          {/* Colored highlights */}
          <G fill="#B91C1C" opacity={0.7}>
            <Path d="M 22.5,25 C 22.5,25 27,17.5 25.5,14.5 C 25.5,14.5 24.5,12 22.5,12 C 20.5,12 19.5,14.5 19.5,14.5 C 18,17.5 22.5,25 22.5,25" />
          </G>
        </Svg>
      ),
    },
    {
      name: "Classic Wood",
      description: "Wooden piece with colored band",
      component: (
        <Svg width={60} height={60} viewBox="0 0 48 48">
          <Defs>
            <LinearGradient
              id="woodGradient"
              x1="0%"
              y1="0%"
              x2="100%"
              y2="100%"
            >
              <Stop offset="0%" stopColor="#D2B48C" />
              <Stop offset="50%" stopColor="#CD853F" />
              <Stop offset="100%" stopColor="#8B4513" />
            </LinearGradient>
          </Defs>
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
          <G fill="#B91C1C">
            <Path d="M 12.5,37 C 18,40.5 27,40.5 32.5,37 L 32.5,35 C 32.5,35 27,37.5 22.5,37.5 C 18,37.5 12.5,35 12.5,35 L 12.5,37" />
          </G>
        </Svg>
      ),
    },
  ];

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🎨 Enhanced Piece Styling Options</Text>
      <Text style={styles.subtitle}>
        Instead of full coloring, here are more elegant approaches
      </Text>

      <View style={styles.optionsGrid}>
        {stylingOptions.map((option, index) => (
          <View key={index} style={styles.optionContainer}>
            <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
              {option.component}
            </View>
            <Text style={styles.optionName}>{option.name}</Text>
            <Text style={styles.optionDescription}>{option.description}</Text>
          </View>
        ))}
      </View>

      <View style={styles.benefitsContainer}>
        <Text style={styles.benefitsTitle}>
          ✨ Benefits of Enhanced Styling:
        </Text>
        <Text style={styles.benefitText}>
          • <Text style={styles.bold}>More Elegant</Text> - Sophisticated
          appearance
        </Text>
        <Text style={styles.benefitText}>
          • <Text style={styles.bold}>Better Contrast</Text> - Easier to
          distinguish
        </Text>
        <Text style={styles.benefitText}>
          • <Text style={styles.bold}>Professional Look</Text> - Like premium
          chess sets
        </Text>
        <Text style={styles.benefitText}>
          • <Text style={styles.bold}>Visual Hierarchy</Text> - Important
          details stand out
        </Text>
        <Text style={styles.benefitText}>
          • <Text style={styles.bold}>Less Overwhelming</Text> - Subtle color
          usage
        </Text>
      </View>

      <View style={styles.recommendationsContainer}>
        <Text style={styles.recommendationsTitle}>💡 Top Recommendations:</Text>
        <Text style={styles.recommendationText}>
          🥇 <Text style={styles.bold}>Gradient Fill</Text> - Subtle, elegant,
          modern
        </Text>
        <Text style={styles.recommendationText}>
          🥈 <Text style={styles.bold}>Colored Outline</Text> - Clear
          distinction, classic
        </Text>
        <Text style={styles.recommendationText}>
          🥉 <Text style={styles.bold}>Accent Color</Text> - Sophisticated,
          detailed
        </Text>
      </View>

      <View style={styles.instructionsContainer}>
        <Text style={styles.instructionsTitle}>🔧 Implementation Options:</Text>
        <Text style={styles.instructionsText}>
          1. <Text style={styles.bold}>Gradient Approach</Text> - Use SVG
          gradients for subtle color
        </Text>
        <Text style={styles.instructionsText}>
          2. <Text style={styles.bold}>Accent Approach</Text> - Color specific
          parts (crown, base, etc.)
        </Text>
        <Text style={styles.instructionsText}>
          3. <Text style={styles.bold}>Outline Approach</Text> - Colored stroke
          instead of fill
        </Text>
        <Text style={styles.instructionsText}>
          4. <Text style={styles.bold}>Hybrid Approach</Text> - Combine multiple
          techniques
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
  optionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
    marginBottom: 30,
  },
  optionContainer: {
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
    minWidth: 140,
  },
  square: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 10,
  },
  optionName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 6,
    textAlign: "center",
  },
  optionDescription: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
    lineHeight: 16,
  },
  benefitsContainer: {
    backgroundColor: "#f0fdf4",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
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
    marginBottom: 6,
    lineHeight: 20,
  },
  bold: {
    fontWeight: "bold",
    color: "#1f2937",
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
});

