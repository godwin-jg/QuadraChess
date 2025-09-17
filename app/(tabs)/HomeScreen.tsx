import { StyleSheet, TouchableOpacity, Dimensions } from "react-native";
import { Link } from "expo-router";
import { Text, View } from "@/components/Themed";
import { LinearGradient } from "expo-linear-gradient";

const { width, height } = Dimensions.get("window");

export default function HomeScreen() {
  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#1e3a8a", "#1e40af", "#3b82f6"]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          {/* Header Section */}
          <View style={styles.header}>
            <Text style={styles.title}>♔ Four Player Chess ♔</Text>
            <Text style={styles.subtitle}>Strategic Multiplayer Chess</Text>
            <View style={styles.chessIcon}>
              <Text style={styles.chessSymbol}>♛</Text>
            </View>
          </View>

          {/* Buttons Section */}
          <View style={styles.buttonsContainer}>
            <Link href="/(tabs)/GameScreen" asChild>
              <TouchableOpacity style={styles.primaryButton}>
                <Text style={styles.buttonIcon}>🎮</Text>
                <Text style={styles.buttonText}>Start Single Player</Text>
              </TouchableOpacity>
            </Link>

            <Link href="/(tabs)/LobbyScreen" asChild>
              <TouchableOpacity style={styles.secondaryButton}>
                <Text style={styles.buttonIcon}>🌐</Text>
                <Text style={[styles.buttonText, styles.secondaryButtonText]}>
                  Local Multiplayer
                </Text>
              </TouchableOpacity>
            </Link>
          </View>

          {/* Features Section */}
          <View style={styles.featuresContainer}>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>👥</Text>
              <Text style={styles.featureText}>Up to 4 Players</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>⚡</Text>
              <Text style={styles.featureText}>Real-time Play</Text>
            </View>
            <View style={styles.featureItem}>
              <Text style={styles.featureIcon}>🏆</Text>
              <Text style={styles.featureText}>Strategic Gameplay</Text>
            </View>
          </View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: "space-between",
  },
  header: {
    alignItems: "center",
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 8,
    textShadowColor: "rgba(0, 0, 0, 0.3)",
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 4,
  },
  subtitle: {
    fontSize: 16,
    color: "#E5E7EB",
    textAlign: "center",
    marginBottom: 24,
    opacity: 0.9,
  },
  chessIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  chessSymbol: {
    fontSize: 40,
    color: "#FFFFFF",
  },
  buttonsContainer: {
    gap: 20,
  },
  primaryButton: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 255, 255, 0.2)",
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 32,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  buttonText: {
    color: "#1F2937",
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
  },
  secondaryButtonText: {
    color: "#FFFFFF",
  },
  featuresContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingHorizontal: 20,
  },
  featureItem: {
    alignItems: "center",
    flex: 1,
  },
  featureIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  featureText: {
    color: "#E5E7EB",
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.9,
  },
});
