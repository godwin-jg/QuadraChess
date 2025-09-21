import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { settingsService } from "../../../services/settingsService";

/**
 * Quick test to verify settings service works
 */
export default function SettingsQuickTest() {
  const [settings, setSettings] = useState(settingsService.getSettings());
  const [testResult, setTestResult] = useState("");

  const testSettings = async () => {
    try {
      // Test loading settings
      const loadedSettings = await settingsService.loadSettings();
      setSettings(loadedSettings);

      // Test updating settings
      await settingsService.updatePieces({ style: "solid" });
      const updatedSettings = settingsService.getSettings();

      setTestResult(
        `✅ Settings working! Current style: ${updatedSettings.pieces.style}`
      );
    } catch (error) {
      setTestResult(`❌ Error: ${error}`);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>⚙️ Settings Quick Test</Text>

      <View style={styles.info}>
        <Text style={styles.label}>Current Settings:</Text>
        <Text style={styles.value}>Board: {settings.board.theme}</Text>
        <Text style={styles.value}>Pieces: {settings.pieces.style}</Text>
        <Text style={styles.value}>Size: {settings.pieces.size}</Text>
        <Text style={styles.value}>Name: {settings.profile.name}</Text>
      </View>

      <TouchableOpacity style={styles.button} onPress={testSettings}>
        <Text style={styles.buttonText}>Test Settings</Text>
      </TouchableOpacity>

      {testResult ? <Text style={styles.result}>{testResult}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f9fa",
    justifyContent: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    textAlign: "center",
    marginBottom: 30,
    color: "#1f2937",
  },
  info: {
    backgroundColor: "white",
    padding: 20,
    borderRadius: 12,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  label: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  value: {
    fontSize: 16,
    color: "#6b7280",
    marginBottom: 5,
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
  result: {
    fontSize: 16,
    textAlign: "center",
    padding: 10,
    backgroundColor: "#f0f9ff",
    borderRadius: 8,
    color: "#1f2937",
  },
});

