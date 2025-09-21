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
import Board from "./Board";

/**
 * Comprehensive test to verify all settings are working correctly
 */
export default function ComprehensiveSettingsTest() {
  const {
    settings,
    updateProfile,
    updateBoard,
    updatePieces,
    updateGame,
    updateAccessibility,
  } = useSettings();

  const [testResults, setTestResults] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const addResult = (message: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${message}`,
    ]);
  };

  const clearResults = () => {
    setTestResults([]);
  };

  const testBoardThemes = async () => {
    setIsLoading(true);
    addResult("🎨 Testing Board Themes...");

    const themes = ["brown", "grey-white", "green-ivory"];
    const originalTheme = settings.board.theme;

    try {
      for (const theme of themes) {
        addResult(`Testing theme: ${theme}`);
        await updateBoard({ theme });
        
        // Wait a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const currentSettings = useSettings().settings;
        if (currentSettings.board.theme === theme) {
          addResult(`✅ Theme ${theme} applied successfully`);
        } else {
          addResult(`❌ Theme ${theme} failed to apply`);
        }
      }

      // Restore original theme
      await updateBoard({ theme: originalTheme });
      addResult(`🔄 Restored original theme: ${originalTheme}`);

    } catch (error) {
      addResult(`❌ Board theme test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testPieceStyles = async () => {
    setIsLoading(true);
    addResult("♟️ Testing Piece Styles...");

    const styles = ["solid", "white-bordered", "black-bordered", "colored-bordered", "wooden"];
    const originalStyle = settings.pieces.style;

    try {
      for (const style of styles) {
        addResult(`Testing style: ${style}`);
        await updatePieces({ style });
        
        // Wait a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const currentSettings = useSettings().settings;
        if (currentSettings.pieces.style === style) {
          addResult(`✅ Style ${style} applied successfully`);
        } else {
          addResult(`❌ Style ${style} failed to apply`);
        }
      }

      // Restore original style
      await updatePieces({ style: originalStyle });
      addResult(`🔄 Restored original style: ${originalStyle}`);

    } catch (error) {
      addResult(`❌ Piece style test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testPieceSizes = async () => {
    setIsLoading(true);
    addResult("📏 Testing Piece Sizes...");

    const sizes = ["small", "medium", "large"];
    const originalSize = settings.pieces.size;

    try {
      for (const size of sizes) {
        addResult(`Testing size: ${size}`);
        await updatePieces({ size });
        
        // Wait a moment for state to update
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const currentSettings = useSettings().settings;
        if (currentSettings.pieces.size === size) {
          addResult(`✅ Size ${size} applied successfully`);
        } else {
          addResult(`❌ Size ${size} failed to apply`);
        }
      }

      // Restore original size
      await updatePieces({ size: originalSize });
      addResult(`🔄 Restored original size: ${originalSize}`);

    } catch (error) {
      addResult(`❌ Piece size test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testGameSettings = async () => {
    setIsLoading(true);
    addResult("🎮 Testing Game Settings...");

    try {
      // Test sound toggle
      await updateGame({ soundEnabled: !settings.game.soundEnabled });
      await new Promise(resolve => setTimeout(resolve, 100));
      const currentSettings = useSettings().settings;
      if (currentSettings.game.soundEnabled === !settings.game.soundEnabled) {
        addResult("✅ Sound setting toggled successfully");
      } else {
        addResult("❌ Sound setting toggle failed");
      }

      // Test animations toggle
      await updateGame({ animationsEnabled: !settings.game.animationsEnabled });
      await new Promise(resolve => setTimeout(resolve, 100));
      const currentSettings2 = useSettings().settings;
      if (currentSettings2.game.animationsEnabled === !settings.game.animationsEnabled) {
        addResult("✅ Animations setting toggled successfully");
      } else {
        addResult("❌ Animations setting toggle failed");
      }

      // Restore original settings
      await updateGame({ 
        soundEnabled: settings.game.soundEnabled,
        animationsEnabled: settings.game.animationsEnabled 
      });
      addResult("🔄 Restored original game settings");

    } catch (error) {
      addResult(`❌ Game settings test failed: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const runAllTests = async () => {
    clearResults();
    addResult("🚀 Starting comprehensive settings test...");
    
    await testBoardThemes();
    await testPieceStyles();
    await testPieceSizes();
    await testGameSettings();
    
    addResult("🎉 All tests completed!");
  };

  const boardTheme = getBoardTheme(settings);
  const pieceStyle = getPieceStyle(settings, "r"); // Red piece style
  const pieceSize = getPieceSize(settings);

  const testPieces = [
    { code: "rK", name: "Red King", color: "Red" },
    { code: "yQ", name: "Purple Queen", color: "Purple" },
    { code: "bR", name: "Blue Rook", color: "Blue" },
    { code: "gB", name: "Green Bishop", color: "Green" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🔍 Comprehensive Settings Test</Text>
      <Text style={styles.subtitle}>
        Verify all settings are working correctly
      </Text>

      {/* Current Settings Display */}
      <View style={styles.currentSection}>
        <Text style={styles.sectionTitle}>📊 Current Settings</Text>
        <View style={styles.settingsGrid}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Board Theme:</Text>
            <Text style={styles.settingValue}>{settings.board.theme}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Piece Style:</Text>
            <Text style={styles.settingValue}>{settings.pieces.style}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Piece Size:</Text>
            <Text style={styles.settingValue}>{settings.pieces.size}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Sound:</Text>
            <Text style={styles.settingValue}>{settings.game.soundEnabled ? "On" : "Off"}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Animations:</Text>
            <Text style={styles.settingValue}>{settings.game.animationsEnabled ? "On" : "Off"}</Text>
          </View>
        </View>
      </View>

      {/* Board Theme Preview */}
      <View style={styles.previewSection}>
        <Text style={styles.sectionTitle}>🎨 Board Theme Preview</Text>
        <View style={styles.themeInfo}>
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: boardTheme.lightSquare }]} />
            <Text style={styles.colorLabel}>Light: {boardTheme.lightSquare}</Text>
          </View>
          <View style={styles.colorRow}>
            <View style={[styles.colorSwatch, { backgroundColor: boardTheme.darkSquare }]} />
            <Text style={styles.colorLabel}>Dark: {boardTheme.darkSquare}</Text>
          </View>
        </View>
        <View style={styles.boardWrapper}>
          <Board />
        </View>
      </View>

      {/* Piece Style Preview */}
      <View style={styles.previewSection}>
        <Text style={styles.sectionTitle}>♟️ Piece Style Preview</Text>
        <View style={styles.pieceInfo}>
          <Text style={styles.pieceInfoText}>
            Style: {settings.pieces.style} | Size: {settings.pieces.size}
          </Text>
          <Text style={styles.pieceInfoText}>
            Fill: {pieceStyle.fill} | Stroke: {pieceStyle.stroke}
          </Text>
        </View>
        <View style={styles.piecesGrid}>
          {testPieces.map((piece, index) => (
            <View key={index} style={styles.pieceContainer}>
              <View style={[styles.pieceSquare, { backgroundColor: boardTheme.lightSquare }]}>
                <Piece piece={piece.code} size={40} useSVG={true} />
              </View>
              <Text style={styles.pieceLabel}>{piece.name}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* Test Buttons */}
      <View style={styles.buttonsSection}>
        <TouchableOpacity
          style={[styles.button, styles.testAllButton]}
          onPress={runAllTests}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "⏳ Testing..." : "🚀 Run All Tests"}
          </Text>
        </TouchableOpacity>

        <View style={styles.testRow}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={testBoardThemes}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🎨 Test Themes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={testPieceStyles}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>♟️ Test Styles</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.testRow}>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={testPieceSizes}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>📏 Test Sizes</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={testGameSettings}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>🎮 Test Game</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>🗑️ Clear Results</Text>
        </TouchableOpacity>
      </View>

      {/* Test Results */}
      {testResults.length > 0 && (
        <View style={styles.resultsSection}>
          <Text style={styles.sectionTitle}>📋 Test Results</Text>
          <View style={styles.resultsContainer}>
            {testResults.map((result, index) => (
              <Text key={index} style={styles.resultText}>
                {result}
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Instructions */}
      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>📖 How to Test:</Text>
        <Text style={styles.instructionText}>
          1. Tap "Run All Tests" to test everything automatically
        </Text>
        <Text style={styles.instructionText}>
          2. Or test individual components with specific buttons
        </Text>
        <Text style={styles.instructionText}>
          3. Check the previews above to see visual changes
        </Text>
        <Text style={styles.instructionText}>
          4. Go to Profile Settings to make manual changes
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
  settingsGrid: {
    gap: 8,
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 4,
  },
  settingLabel: {
    fontSize: 14,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  settingValue: {
    fontSize: 14,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  previewSection: {
    backgroundColor: "#1F1F1F",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  themeInfo: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginBottom: 15,
  },
  colorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  colorSwatch: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#666666",
  },
  colorLabel: {
    fontSize: 12,
    color: "#D1D5DB",
    fontFamily: "monospace",
  },
  boardWrapper: {
    backgroundColor: "#000000",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  pieceInfo: {
    marginBottom: 15,
    padding: 10,
    backgroundColor: "#374151",
    borderRadius: 8,
  },
  pieceInfoText: {
    fontSize: 12,
    color: "#D1D5DB",
    fontFamily: "monospace",
    marginBottom: 2,
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
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
    color: "#D1D5DB",
    textAlign: "center",
  },
  buttonsSection: {
    paddingHorizontal: 20,
    gap: 12,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: "center",
  },
  testAllButton: {
    backgroundColor: "#3B82F6",
  },
  testButton: {
    backgroundColor: "#10B981",
    flex: 1,
  },
  clearButton: {
    backgroundColor: "#6B7280",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  testRow: {
    flexDirection: "row",
    gap: 12,
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
    maxHeight: 300,
  },
  resultText: {
    fontSize: 12,
    color: "#D1D5DB",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  instructionsSection: {
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

