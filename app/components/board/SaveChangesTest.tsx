import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
} from "react-native";
import { useSettings } from "../../../context/SettingsContext";

export default function SaveChangesTest() {
  const {
    settings,
    hasUnsavedChanges,
    isSaving,
    updateProfile,
    updateBoard,
    updatePieces,
    saveSettings,
    discardChanges,
  } = useSettings();

  const [testResults, setTestResults] = useState<string[]>([]);

  const addResult = (result: string) => {
    setTestResults((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${result}`,
    ]);
  };

  const testSaveChanges = async () => {
    addResult("🧪 Testing Save Changes Functionality...");

    try {
      // Test 1: Make changes
      addResult("1. Making test changes...");
      await updateProfile({ name: "Test User" });
      await updateBoard({ theme: "grey-white" });
      await updatePieces({ style: "solid" });

      if (hasUnsavedChanges) {
        addResult("✅ Changes detected as unsaved");
      } else {
        addResult("❌ Changes not detected as unsaved");
      }

      // Test 2: Save changes
      addResult("2. Saving changes...");
      await saveSettings();

      if (!hasUnsavedChanges) {
        addResult("✅ Changes saved successfully");
      } else {
        addResult("❌ Changes still showing as unsaved after save");
      }

      // Test 3: Make more changes and discard
      addResult("3. Making more changes to test discard...");
      await updateProfile({ name: "Another User" });
      await updateBoard({ theme: "green-ivory" });

      if (hasUnsavedChanges) {
        addResult("✅ New changes detected as unsaved");
      } else {
        addResult("❌ New changes not detected as unsaved");
      }

      addResult("4. Discarding changes...");
      discardChanges();

      // Wait a moment for state to update
      setTimeout(() => {
        if (!hasUnsavedChanges) {
          addResult("✅ Changes discarded successfully");
        } else {
          addResult("❌ Changes still showing as unsaved after discard");
        }
        addResult("🎉 Save Changes Test Complete!");
      }, 100);
    } catch (error) {
      addResult(`❌ Test failed: ${error}`);
    }
  };

  const clearResults = () => {
    setTestResults([]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>💾 Save Changes Test</Text>

      <View style={styles.statusContainer}>
        <Text style={styles.statusTitle}>Current Status:</Text>
        <Text style={styles.statusText}>
          Unsaved Changes: {hasUnsavedChanges ? "⚠️ Yes" : "✅ No"}
        </Text>
        <Text style={styles.statusText}>
          Currently Saving: {isSaving ? "⏳ Yes" : "✅ No"}
        </Text>
        <Text style={styles.statusText}>
          Current Name: {settings.profile.name}
        </Text>
        <Text style={styles.statusText}>
          Current Theme: {settings.board.theme}
        </Text>
        <Text style={styles.statusText}>
          Current Style: {settings.pieces.style}
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity style={styles.testButton} onPress={testSaveChanges}>
          <Text style={styles.testButtonText}>🧪 Run Save Test</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.clearButton} onPress={clearResults}>
          <Text style={styles.clearButtonText}>🗑️ Clear Results</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.resultsContainer}>
        <Text style={styles.resultsTitle}>Test Results:</Text>
        {testResults.map((result, index) => (
          <Text key={index} style={styles.resultText}>
            {result}
          </Text>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
    textAlign: "center",
    marginBottom: 20,
  },
  statusContainer: {
    backgroundColor: "#1F1F1F",
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "#333333",
  },
  statusTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  statusText: {
    fontSize: 14,
    color: "#D1D5DB",
    marginBottom: 4,
  },
  buttonContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  testButton: {
    flex: 1,
    backgroundColor: "#059669",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  testButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  clearButton: {
    flex: 1,
    backgroundColor: "#7F1D1D",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  resultsContainer: {
    backgroundColor: "#1F1F1F",
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333333",
  },
  resultsTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#FFFFFF",
    marginBottom: 12,
  },
  resultText: {
    fontSize: 12,
    color: "#D1D5DB",
    marginBottom: 4,
    fontFamily: "monospace",
  },
});

