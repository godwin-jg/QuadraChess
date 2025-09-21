import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { settingsService } from "../../../services/settingsService";

/**
 * Test AsyncStorage fallback functionality
 */
export default function AsyncStorageTest() {
  const [testResults, setTestResults] = useState<string[]>([]);

  const runTests = async () => {
    const results: string[] = [];

    try {
      // Test 1: Load default settings
      const defaultSettings = settingsService.getSettings();
      results.push(
        `✅ Default settings loaded: ${defaultSettings.pieces.style}`
      );

      // Test 2: Update settings
      await settingsService.updatePieces({ style: "solid" });
      const updatedSettings = settingsService.getSettings();
      results.push(`✅ Settings updated: ${updatedSettings.pieces.style}`);

      // Test 3: Update profile
      await settingsService.updateProfile({ name: "Test Player" });
      const profileSettings = settingsService.getSettings();
      results.push(`✅ Profile updated: ${profileSettings.profile.name}`);

      // Test 4: Update board theme
      await settingsService.updateBoard({ theme: "grey" });
      const boardSettings = settingsService.getSettings();
      results.push(`✅ Board theme updated: ${boardSettings.board.theme}`);

      // Test 5: Reset to defaults
      await settingsService.resetToDefaults();
      const resetSettings = settingsService.getSettings();
      results.push(`✅ Reset to defaults: ${resetSettings.pieces.style}`);

      setTestResults(results);
    } catch (error) {
      results.push(`❌ Error: ${error}`);
      setTestResults(results);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🧪 AsyncStorage Fallback Test</Text>
      <Text style={styles.subtitle}>Testing in-memory storage fallback</Text>

      <TouchableOpacity style={styles.button} onPress={runTests}>
        <Text style={styles.buttonText}>Run Tests</Text>
      </TouchableOpacity>

      <View style={styles.results}>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </View>

      <View style={styles.info}>
        <Text style={styles.infoTitle}>ℹ️ About This Test</Text>
        <Text style={styles.infoText}>
          This test verifies that the settings service works without
          AsyncStorage. All settings are stored in memory and will persist
          during the app session.
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
  button: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 20,
  },
  buttonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  results: {
    backgroundColor: "white",
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  resultText: {
    fontSize: 14,
    color: "#1f2937",
    marginBottom: 5,
    fontFamily: "monospace",
  },
  info: {
    backgroundColor: "#f0f9ff",
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#1f2937",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    lineHeight: 20,
  },
});

