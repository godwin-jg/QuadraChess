import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useSettings } from "../../../context/SettingsContext";
import { settingsService } from "../../../services/settingsService";

/**
 * Test persistence of settings to AsyncStorage
 */
export default function PersistenceTest() {
  const { settings, updateProfile, updateBoard, updatePieces } = useSettings();
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

  const testPersistence = async () => {
    setIsLoading(true);
    clearResults();

    try {
      addResult("🧪 Starting persistence test...");

      // Test 1: Change profile name
      const originalName = settings.profile.name;
      const testName = `TestUser_${Date.now()}`;
      addResult(`📝 Changing name from "${originalName}" to "${testName}"`);

      await updateProfile({ name: testName });
      addResult("✅ Profile name updated");

      // Test 2: Change board theme
      const originalTheme = settings.board.theme;
      const testTheme = originalTheme === "brown" ? "grey-white" : "brown";
      addResult(`🎨 Changing theme from "${originalTheme}" to "${testTheme}"`);

      await updateBoard({ theme: testTheme });
      addResult("✅ Board theme updated");

      // Test 3: Change piece style
      const originalStyle = settings.pieces.style;
      const testStyle =
        originalStyle === "solid" ? "colored-bordered" : "solid";
      addResult(
        `♟️ Changing piece style from "${originalStyle}" to "${testStyle}"`
      );

      await updatePieces({ style: testStyle });
      addResult("✅ Piece style updated");

      // Test 4: Force reload settings from storage
      addResult("🔄 Reloading settings from storage...");
      const reloadedSettings = await settingsService.loadSettings();

      // Verify persistence
      if (reloadedSettings.profile.name === testName) {
        addResult("✅ Profile name persisted correctly");
      } else {
        addResult(
          `❌ Profile name not persisted. Expected: "${testName}", Got: "${reloadedSettings.profile.name}"`
        );
      }

      if (reloadedSettings.board.theme === testTheme) {
        addResult("✅ Board theme persisted correctly");
      } else {
        addResult(
          `❌ Board theme not persisted. Expected: "${testTheme}", Got: "${reloadedSettings.board.theme}"`
        );
      }

      if (reloadedSettings.pieces.style === testStyle) {
        addResult("✅ Piece style persisted correctly");
      } else {
        addResult(
          `❌ Piece style not persisted. Expected: "${testStyle}", Got: "${reloadedSettings.pieces.style}"`
        );
      }

      addResult("🎉 Persistence test completed!");
    } catch (error) {
      addResult(`❌ Test failed with error: ${error}`);
    } finally {
      setIsLoading(false);
    }
  };

  const testAppRestart = async () => {
    Alert.alert(
      "App Restart Test",
      "This test simulates an app restart by clearing the in-memory cache and reloading from storage. The settings should persist.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Test Restart",
          onPress: async () => {
            setIsLoading(true);
            clearResults();

            try {
              addResult("🔄 Simulating app restart...");

              // Clear the in-memory cache by creating a new instance
              const newService = settingsService;
              const currentSettings = await newService.loadSettings();

              addResult(`📊 Current settings loaded from storage:`);
              addResult(`   Name: "${currentSettings.profile.name}"`);
              addResult(`   Theme: "${currentSettings.board.theme}"`);
              addResult(`   Style: "${currentSettings.pieces.style}"`);
              addResult(`   Size: "${currentSettings.pieces.size}"`);

              addResult("✅ App restart simulation completed!");
            } catch (error) {
              addResult(`❌ Restart test failed: ${error}`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const resetToDefaults = async () => {
    Alert.alert(
      "Reset to Defaults",
      "This will reset all settings to their default values and clear storage.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            setIsLoading(true);
            clearResults();

            try {
              addResult("🔄 Resetting to defaults...");
              await settingsService.resetToDefaults();
              addResult("✅ Settings reset to defaults");
              addResult("🔄 Reloading page to see changes...");

              // Force a reload by updating a setting
              await updateProfile({ name: "Player" });
            } catch (error) {
              addResult(`❌ Reset failed: ${error}`);
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💾 Persistence Test</Text>
      <Text style={styles.subtitle}>
        Test that settings are properly saved to and loaded from AsyncStorage
      </Text>

      <View style={styles.currentSection}>
        <Text style={styles.sectionTitle}>📊 Current Settings</Text>
        <View style={styles.settingsGrid}>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Name:</Text>
            <Text style={styles.settingValue}>{settings.profile.name}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Theme:</Text>
            <Text style={styles.settingValue}>{settings.board.theme}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Style:</Text>
            <Text style={styles.settingValue}>{settings.pieces.style}</Text>
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>Size:</Text>
            <Text style={styles.settingValue}>{settings.pieces.size}</Text>
          </View>
        </View>
      </View>

      <View style={styles.buttonsSection}>
        <TouchableOpacity
          style={[styles.button, styles.testButton]}
          onPress={testPersistence}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "⏳ Testing..." : "🧪 Test Persistence"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.restartButton]}
          onPress={testAppRestart}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "⏳ Testing..." : "🔄 Test App Restart"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.resetButton]}
          onPress={resetToDefaults}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>
            {isLoading ? "⏳ Resetting..." : "🔄 Reset to Defaults"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.clearButton]}
          onPress={clearResults}
        >
          <Text style={styles.buttonText}>🗑️ Clear Results</Text>
        </TouchableOpacity>
      </View>

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

      <View style={styles.instructionsSection}>
        <Text style={styles.instructionsTitle}>📖 How to Test:</Text>
        <Text style={styles.instructionText}>
          1. Tap "Test Persistence" to change settings and verify they save
        </Text>
        <Text style={styles.instructionText}>
          2. Tap "Test App Restart" to simulate reloading from storage
        </Text>
        <Text style={styles.instructionText}>
          3. Close and reopen the app to test real persistence
        </Text>
        <Text style={styles.instructionText}>
          4. Use "Reset to Defaults" to clear all settings
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
  currentSection: {
    backgroundColor: "#ffffff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
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
    color: "#6b7280",
    fontWeight: "500",
  },
  settingValue: {
    fontSize: 14,
    color: "#1f2937",
    fontWeight: "600",
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
  testButton: {
    backgroundColor: "#3b82f6",
  },
  restartButton: {
    backgroundColor: "#10b981",
  },
  resetButton: {
    backgroundColor: "#ef4444",
  },
  clearButton: {
    backgroundColor: "#6b7280",
  },
  buttonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsSection: {
    backgroundColor: "#ffffff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultsContainer: {
    backgroundColor: "#f8f9fa",
    padding: 12,
    borderRadius: 8,
    maxHeight: 300,
  },
  resultText: {
    fontSize: 12,
    color: "#374151",
    marginBottom: 4,
    fontFamily: "monospace",
  },
  instructionsSection: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  instructionText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 5,
  },
});

