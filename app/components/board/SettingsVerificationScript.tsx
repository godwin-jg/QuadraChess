import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSettings } from "../../../hooks/useSettings";
import { getBoardTheme } from "./BoardThemeConfig";
import { getPieceStyle, getPieceSize } from "./PieceStyleConfig";
import Piece from "./Piece";

/**
 * Automated verification script to test all settings
 */
export default function SettingsVerificationScript() {
  const {
    settings,
    updateProfile,
    updateBoard,
    updatePieces,
    updateGame,
    updateAccessibility,
  } = useSettings();

  const [verificationResults, setVerificationResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const addResult = (message: string) => {
    setVerificationResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearResults = () => {
    setVerificationResults([]);
  };

  const verifyBoardThemes = async () => {
    addResult("🔍 Verifying Board Themes...");

    const themes = [
      { key: "brown", name: "Brown" },
      { key: "grey-white", name: "Grey & White" },
      { key: "green-ivory", name: "Green & Ivory" },
    ];

    for (const theme of themes) {
      try {
        await updateBoard({ theme: theme.key });
        // Settings should be instant now, no delay needed

        const currentSettings = useSettings().settings;
        const boardTheme = getBoardTheme(currentSettings);

        if (currentSettings.board.theme === theme.key) {
          addResult(
            `✅ ${theme.name}: Theme applied (${boardTheme.lightSquare}/${boardTheme.darkSquare})`
          );
        } else {
          addResult(`❌ ${theme.name}: Theme not applied`);
        }
      } catch (error) {
        addResult(`❌ ${theme.name}: Error - ${error}`);
      }
    }
  };

  const verifyPieceStyles = async () => {
    addResult("🔍 Verifying Piece Styles...");

    const styles = [
      { key: "solid", name: "Solid" },
      { key: "white-bordered", name: "White Bordered" },
      { key: "black-bordered", name: "Black Bordered" },
      { key: "colored-bordered", name: "Colored Bordered" },
      { key: "wooden", name: "Wooden" },
    ];

    for (const style of styles) {
      try {
        await updatePieces({ style: style.key });
        // Settings should be instant now, no delay needed

        const currentSettings = useSettings().settings;
        const pieceStyle = getPieceStyle(currentSettings, "r");

        if (currentSettings.pieces.style === style.key) {
          addResult(
            `✅ ${style.name}: Style applied (${pieceStyle.fill}/${pieceStyle.stroke})`
          );
        } else {
          addResult(`❌ ${style.name}: Style not applied`);
        }
      } catch (error) {
        addResult(`❌ ${style.name}: Error - ${error}`);
      }
    }
  };

  const verifyPieceSizes = async () => {
    addResult("🔍 Verifying Piece Sizes...");

    const sizes = [
      { key: "small", name: "Small" },
      { key: "medium", name: "Medium" },
      { key: "large", name: "Large" },
    ];

    for (const size of sizes) {
      try {
        await updatePieces({ size: size.key });
        // Settings should be instant now, no delay needed

        const currentSettings = useSettings().settings;
        const pieceSize = getPieceSize(currentSettings);

        if (currentSettings.pieces.size === size.key) {
          addResult(`✅ ${size.name}: Size applied (${pieceSize}x)`);
        } else {
          addResult(`❌ ${size.name}: Size not applied`);
        }
      } catch (error) {
        addResult(`❌ ${size.name}: Error - ${error}`);
      }
    }
  };

  const verifyGameSettings = async () => {
    addResult("🔍 Verifying Game Settings...");

    try {
      // Test sound setting
      await updateGame({ soundEnabled: true });
      // Settings should be instant now, no delay needed
      let currentSettings = useSettings().settings;
      if (currentSettings.game.soundEnabled) {
        addResult("✅ Sound: Enabled successfully");
      } else {
        addResult("❌ Sound: Failed to enable");
      }

      await updateGame({ soundEnabled: false });
      // Settings should be instant now, no delay needed
      currentSettings = useSettings().settings;
      if (!currentSettings.game.soundEnabled) {
        addResult("✅ Sound: Disabled successfully");
      } else {
        addResult("❌ Sound: Failed to disable");
      }

      // Test animations setting
      await updateGame({ animationsEnabled: true });
      // Settings should be instant now, no delay needed
      currentSettings = useSettings().settings;
      if (currentSettings.game.animationsEnabled) {
        addResult("✅ Animations: Enabled successfully");
      } else {
        addResult("❌ Animations: Failed to enable");
      }

      await updateGame({ animationsEnabled: false });
      // Settings should be instant now, no delay needed
      currentSettings = useSettings().settings;
      if (!currentSettings.game.animationsEnabled) {
        addResult("✅ Animations: Disabled successfully");
      } else {
        addResult("❌ Animations: Failed to disable");
      }
    } catch (error) {
      addResult(`❌ Game Settings: Error - ${error}`);
    }
  };

  const runFullVerification = async () => {
    setIsRunning(true);
    clearResults();
    addResult("🚀 Starting Full Settings Verification...");

    try {
      await verifyBoardThemes();
      await verifyPieceStyles();
      await verifyPieceSizes();
      await verifyGameSettings();

      addResult("🎉 Full verification completed!");

      // Show summary
      const totalResults = verificationResults.length;
      const successCount = verificationResults.filter((r) =>
        r.includes("✅")
      ).length;
      const errorCount = verificationResults.filter((r) =>
        r.includes("❌")
      ).length;

      addResult(
        `📊 Summary: ${successCount} passed, ${errorCount} failed out of ${totalResults} tests`
      );
    } catch (error) {
      addResult(`❌ Verification failed: ${error}`);
    } finally {
      setIsRunning(false);
    }
  };

  const boardTheme = getBoardTheme(settings);
  const pieceStyle = getPieceStyle(settings, "r");
  const pieceSize = getPieceSize(settings);

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔬 Settings Verification Script</Text>
      <Text style={styles.subtitle}>
        Automated testing of all settings functionality
      </Text>

      {/* Current State Display */}
      <View style={styles.currentSection}>
        <Text style={styles.sectionTitle}>📊 Current State</Text>
        <View style={styles.stateGrid}>
          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>Board Theme:</Text>
            <Text style={styles.stateValue}>{settings.board.theme}</Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>Piece Style:</Text>
            <Text style={styles.stateValue}>{settings.pieces.style}</Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>Piece Size:</Text>
            <Text style={styles.stateValue}>{settings.pieces.size}</Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>Sound:</Text>
            <Text style={styles.stateValue}>
              {settings.game.soundEnabled ? "On" : "Off"}
            </Text>
          </View>
          <View style={styles.stateRow}>
            <Text style={styles.stateLabel}>Animations:</Text>
            <Text style={styles.stateValue}>
              {settings.game.animationsEnabled ? "On" : "Off"}
            </Text>
          </View>
        </View>
      </View>

      {/* Visual Verification */}
      <View style={styles.visualSection}>
        <Text style={styles.sectionTitle}>👁️ Visual Verification</Text>
        <View style={styles.boardPreview}>
          <Text style={styles.previewLabel}>
            Board Theme: {settings.board.theme}
          </Text>
          <View style={styles.colorPreview}>
            <View
              style={[
                styles.colorBox,
                { backgroundColor: boardTheme.lightSquare },
              ]}
            />
            <Text style={styles.colorText}>Light</Text>
            <View
              style={[
                styles.colorBox,
                { backgroundColor: boardTheme.darkSquare },
              ]}
            />
            <Text style={styles.colorText}>Dark</Text>
          </View>
        </View>
        <View style={styles.piecePreview}>
          <Text style={styles.previewLabel}>
            Piece Style: {settings.pieces.style}
          </Text>
          <View style={styles.pieceRow}>
            <Piece piece="rK" size={30} useSVG={true} />
            <Piece piece="yQ" size={30} useSVG={true} />
            <Piece piece="bR" size={30} useSVG={true} />
            <Piece piece="gB" size={30} useSVG={true} />
          </View>
        </View>
      </View>

      {/* Control Buttons */}
      <View style={styles.controlsSection}>
        <TouchableOpacity
          style={[styles.button, styles.runButton]}
          onPress={runFullVerification}
          disabled={isRunning}
        >
          <Text style={styles.buttonText}>
            {isRunning ? "⏳ Running..." : "🚀 Run Full Verification"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>🗑️ Clear Results</Text>
        </TouchableOpacity>
      </View>

      {/* Results */}
      {verificationResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>📋 Verification Results</Text>
          <View style={styles.resultsContainer}>
            {verificationResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))}
          </View>
        </View>
      )}
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
  currentSection: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#FFFFFF",
  },
  stateGrid: {
    gap: 8,
  },
  stateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  stateLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  stateValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  visualSection: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  boardPreview: {
    marginBottom: 20,
  },
  previewLabel: {
    fontSize: 14,
    color: "#D1D5DB",
    marginBottom: 10,
  },
  colorPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 15,
  },
  colorBox: {
    width: 30,
    height: 30,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#666666",
  },
  colorText: {
    fontSize: 12,
    color: "#D1D5DB",
  },
  piecePreview: {
    marginBottom: 10,
  },
  pieceRow: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#374151",
    borderRadius: 8,
  },
  controlsSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  runButton: {
    backgroundColor: "#3B82F6",
  },
  clearButton: {
    backgroundColor: "#6B7280",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsSection: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  resultsContainer: {
    backgroundColor: "#000000",
    padding: 12,
    borderRadius: 8,
    maxHeight: 400,
  },
  resultText: {
    fontSize: 12,
    color: "#D1D5DB",
    marginBottom: 4,
    fontFamily: "monospace",
  },
});
