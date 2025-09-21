import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import Piece from "./Piece";
import {
  settingsService,
  UserSettings,
} from "../../../services/settingsService";

/**
 * Test component to verify profile settings and piece styling
 */
export default function SettingsTest() {
  const [settings, setSettings] = useState<UserSettings>(
    settingsService.getSettings()
  );
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await settingsService.loadSettings();
      setSettings(loadedSettings);
    };
    loadSettings();
  }, [refreshKey]);

  const refreshSettings = () => {
    setRefreshKey((prev) => prev + 1);
  };

  const testPieces = [
    { code: "rK", name: "Red King" },
    { code: "yQ", name: "Purple Queen" },
    { code: "bR", name: "Blue Rook" },
    { code: "gB", name: "Green Bishop" },
  ];

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>⚙️ Settings Test</Text>
      <Text style={styles.subtitle}>
        Testing profile settings and piece styling
      </Text>

      <View style={styles.settingsSection}>
        <Text style={styles.sectionTitle}>Current Settings</Text>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Board Theme:</Text>
          <Text style={styles.settingValue}>{settings.board.theme}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Piece Style:</Text>
          <Text style={styles.settingValue}>{settings.pieces.style}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Piece Size:</Text>
          <Text style={styles.settingValue}>{settings.pieces.size}</Text>
        </View>
        <View style={styles.settingItem}>
          <Text style={styles.settingLabel}>Player Name:</Text>
          <Text style={styles.settingValue}>{settings.profile.name}</Text>
        </View>
      </View>

      <View style={styles.piecesSection}>
        <Text style={styles.sectionTitle}>Piece Styling Preview</Text>
        <Text style={styles.sectionDescription}>
          Current piece style: {settings.pieces.style} | Size:{" "}
          {settings.pieces.size}
        </Text>

        <View style={styles.piecesGrid}>
          {testPieces.map((piece, index) => (
            <View key={index} style={styles.pieceCard}>
              <View style={[styles.square, { backgroundColor: "#f0d9b5" }]}>
                <Piece piece={piece.code} size={60} useSVG={true} />
              </View>
              <Text style={styles.pieceName}>{piece.name}</Text>
              <Text style={styles.pieceCode}>{piece.code}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={styles.actionsSection}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={refreshSettings}
        >
          <Text style={styles.refreshButtonText}>🔄 Refresh Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>ℹ️ How to Test</Text>
        <Text style={styles.infoText}>
          1. Go to Profile Settings from the main menu
        </Text>
        <Text style={styles.infoText}>
          2. Change board theme, piece style, or size
        </Text>
        <Text style={styles.infoText}>
          3. Return here and tap "Refresh Settings"
        </Text>
        <Text style={styles.infoText}>
          4. See the changes reflected in the piece previews
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
  settingsSection: {
    backgroundColor: "white",
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
  settingItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  settingLabel: {
    fontSize: 16,
    color: "#374151",
    fontWeight: "500",
  },
  settingValue: {
    fontSize: 16,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  piecesSection: {
    backgroundColor: "white",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 15,
    fontStyle: "italic",
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  pieceCard: {
    alignItems: "center",
    marginBottom: 20,
  },
  square: {
    width: 80,
    height: 80,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    marginBottom: 8,
  },
  pieceName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
  },
  pieceCode: {
    fontSize: 12,
    color: "#6b7280",
    fontFamily: "monospace",
  },
  actionsSection: {
    margin: 20,
    alignItems: "center",
  },
  refreshButton: {
    backgroundColor: "#3b82f6",
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
  },
  refreshButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
  },
  infoSection: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  infoText: {
    fontSize: 14,
    color: "#4b5563",
    marginBottom: 8,
    lineHeight: 20,
  },
});
