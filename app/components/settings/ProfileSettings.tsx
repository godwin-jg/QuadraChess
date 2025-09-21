import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from "react-native";
import { useSettings } from "../../../hooks/useSettings";
import { getBoardTheme } from "../board/BoardThemeConfig";
import Piece from "../board/Piece";

interface ProfileSettingsProps {
  onClose?: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const {
    settings,
    isLoading,
    hasUnsavedChanges,
    isSaving,
    updateProfile,
    updateBoard,
    updatePieces,
    updateGame,
    updateAccessibility,
    saveSettings,
    discardChanges,
    resetToDefaults,
  } = useSettings();

  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleSaveSettings = async () => {
    try {
      await saveSettings();
      Alert.alert("Success", "Settings saved successfully!");
    } catch (error) {
      Alert.alert("Error", "Failed to save settings. Please try again.");
    }
  };

  const handleDiscardChanges = () => {
    Alert.alert(
      "Discard Changes",
      "Are you sure you want to discard all unsaved changes?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Discard",
          style: "destructive",
          onPress: discardChanges,
        },
      ]
    );
  };

  const handleResetToDefaults = () => {
    Alert.alert(
      "Reset Settings",
      "Are you sure you want to reset all settings to defaults? This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reset",
          style: "destructive",
          onPress: async () => {
            await resetToDefaults();
            setShowResetConfirm(false);
          },
        },
      ]
    );
  };

  const renderBoardThemeOption = (theme: any) => {
    const boardTheme = getBoardTheme({
      ...settings,
      board: { theme: theme.key },
    });
    const isSelected = settings.board.theme === theme.key;

    return (
      <TouchableOpacity
        key={theme.key}
        style={[styles.horizontalOption, isSelected && styles.horizontalOptionSelected]}
        onPress={() => updateBoard({ theme: theme.key })}
      >
        <View style={styles.themePreview}>
          <View
            style={[
              styles.miniBoard,
              { backgroundColor: boardTheme.borderColor },
            ]}
          >
            {[0, 1, 2, 3].map((row) => (
              <View key={row} style={styles.miniBoardRow}>
                {[0, 1, 2, 3].map((col) => (
                  <View
                    key={col}
                    style={[
                      styles.miniSquare,
                      {
                        backgroundColor:
                          (row + col) % 2 === 0
                            ? boardTheme.lightSquare
                            : boardTheme.darkSquare,
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
        <View style={styles.horizontalInfo}>
          <Text
            style={[styles.horizontalName, isSelected && styles.horizontalNameSelected]}
          >
            {theme.name}
          </Text>
          <Text style={styles.horizontalDescription}>{theme.description}</Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  const renderPieceStyleOption = (style: any) => {
    const isSelected = settings.pieces.style === style.key;
    // Create temporary settings with this style to get accurate preview
    const tempSettings = {
      ...settings,
      pieces: { ...settings.pieces, style: style.key }
    };

    return (
      <TouchableOpacity
        key={style.key}
        style={[styles.horizontalOption, isSelected && styles.horizontalOptionSelected]}
        onPress={() => updatePieces({ style: style.key })}
      >
        <View style={styles.stylePreview}>
          <View style={styles.singlePieceContainer}>
            <View style={styles.singlePieceSquare}>
              <Piece 
                piece="rK" 
                size={32} 
                useSVG={true}
                // Pass the temp settings to get accurate styling
                settings={tempSettings}
              />
            </View>
          </View>
        </View>
        <View style={styles.horizontalInfo}>
          <Text
            style={[styles.horizontalName, isSelected && styles.horizontalNameSelected]}
          >
            {style.name}
          </Text>
        </View>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  const renderSizeOption = (size: any) => {
    const isSelected = settings.pieces.size === size.key;

    return (
      <TouchableOpacity
        key={size.key}
        style={[styles.horizontalOption, isSelected && styles.horizontalOptionSelected]}
        onPress={() => updatePieces({ size: size.key })}
      >
        <Text style={[styles.horizontalName, isSelected && styles.horizontalNameSelected]}>
          {size.name}
        </Text>
        {isSelected && <Text style={styles.checkmark}>✓</Text>}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            console.log("Back button pressed");
            if (hasUnsavedChanges) {
              Alert.alert(
                "Unsaved Changes",
                "You have unsaved changes. Do you want to save them before leaving?",
                [
                  { text: "Cancel", style: "cancel" },
                  {
                    text: "Discard",
                    style: "destructive",
                    onPress: () => {
                      if (onClose) onClose();
                    },
                  },
                  {
                    text: "Save",
                    onPress: async () => {
                      try {
                        await saveSettings();
                        if (onClose) onClose();
                      } catch (error) {
                        Alert.alert(
                          "Error",
                          "Failed to save settings. Please try again."
                        );
                      }
                    },
                  },
                ]
              );
            } else {
              if (onClose) {
                onClose();
              }
            }
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={styles.title}>⚙️ Profile Settings</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Profile</Text>
          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Player Name</Text>
            <TextInput
              style={styles.textInput}
              value={settings.profile.name}
              onChangeText={(text) => updateProfile({ name: text })}
              placeholder="Enter your name"
              placeholderTextColor="#6B7280"
            />
          </View>
        </View>

        {/* Board Theme Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎨 Board Theme</Text>
          <View style={styles.horizontalContainer}>
            {[
              {
                key: "brown",
                name: "Brown",
                description: "Classic",
              },
              {
                key: "grey-white",
                name: "Grey",
                description: "Modern",
              },
              {
                key: "green-ivory",
                name: "Green",
                description: "Elegant",
              },
            ].map(renderBoardThemeOption)}
          </View>
        </View>

        {/* Piece Style Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>♟️ Piece Style</Text>
          <View style={styles.horizontalContainer}>
            {[
              { key: "solid", name: "Solid" },
              { key: "white-bordered", name: "White" },
              { key: "black-bordered", name: "Black" },
              { key: "colored-bordered", name: "Colored" },
              { key: "wooden", name: "Wood" },
            ].map(renderPieceStyleOption)}
          </View>
        </View>

        {/* Piece Size Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📏 Size</Text>
          <View style={styles.horizontalContainer}>
            {[
              { key: "small", name: "Small" },
              { key: "medium", name: "Medium" },
              { key: "large", name: "Large" },
            ].map(renderSizeOption)}
          </View>
        </View>

        {/* Game Settings Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🎮 Game Settings</Text>
          <View style={styles.switchGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Sound Effects</Text>
              <Switch
                value={settings.game.soundEnabled}
                onValueChange={(value) => updateGame({ soundEnabled: value })}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.soundEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Animations</Text>
              <Switch
                value={settings.game.animationsEnabled}
                onValueChange={(value) =>
                  updateGame({ animationsEnabled: value })
                }
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.game.animationsEnabled ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Move Hints</Text>
              <Switch
                value={settings.game.showMoveHints}
                onValueChange={(value) => updateGame({ showMoveHints: value })}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.showMoveHints ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
          </View>
        </View>

        {/* Accessibility Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>♿ Accessibility</Text>
          <View style={styles.switchGroup}>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>High Contrast</Text>
              <Switch
                value={settings.accessibility.highContrast}
                onValueChange={(value) =>
                  updateAccessibility({ highContrast: value })
                }
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.accessibility.highContrast ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Large Text</Text>
              <Switch
                value={settings.accessibility.largeText}
                onValueChange={(value) =>
                  updateAccessibility({ largeText: value })
                }
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.accessibility.largeText ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View style={styles.switchRow}>
              <Text style={styles.switchLabel}>Reduced Motion</Text>
              <Switch
                value={settings.accessibility.reducedMotion}
                onValueChange={(value) =>
                  updateAccessibility({ reducedMotion: value })
                }
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.accessibility.reducedMotion ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
          </View>
        </View>

        {/* Save/Discard Section */}
        {hasUnsavedChanges && (
          <View style={styles.section}>
            <Text style={styles.unsavedChangesText}>
              ⚠️ You have unsaved changes
            </Text>
            <View style={styles.saveDiscardContainer}>
              <TouchableOpacity
                style={[
                  styles.saveButton,
                  isSaving && styles.saveButtonDisabled,
                ]}
                onPress={handleSaveSettings}
                disabled={isSaving}
              >
                <Text style={styles.saveButtonText}>
                  {isSaving ? "💾 Saving..." : "💾 Save Changes"}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.discardButton}
                onPress={handleDiscardChanges}
              >
                <Text style={styles.discardButtonText}>🗑️ Discard</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Reset Section */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => setShowResetConfirm(true)}
          >
            <Text style={styles.resetButtonText}>🔄 Reset to Defaults</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000000",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000000",
  },
  loadingText: {
    fontSize: 16,
    color: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    backgroundColor: "#000000",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#FFFFFF",
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#374151",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#4B5563",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  backButtonText: {
    fontSize: 20,
    color: "#FFFFFF",
    fontWeight: "600",
  },
  headerSpacer: {
    width: 40, // Same width as back button to center the title
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: 16,
    paddingHorizontal: 20,
    paddingVertical: 4,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#FFFFFF",
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  inputGroup: {
    marginBottom: 8,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: "600",
    color: "#D1D5DB",
    marginBottom: 12,
  },
  textInput: {
    borderBottomWidth: 2,
    borderBottomColor: "#FFFFFF",
    paddingHorizontal: 0,
    paddingVertical: 16,
    fontSize: 20,
    color: "#FFFFFF",
    backgroundColor: "transparent",
    fontWeight: "500",
  },
  optionsContainer: {
    gap: 0,
  },
  horizontalContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  horizontalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    minWidth: 120,
    flex: 1,
  },
  horizontalOptionSelected: {
    backgroundColor: "#2A2A2A",
    borderColor: "#FFFFFF",
  },
  horizontalInfo: {
    flex: 1,
    alignItems: "center",
  },
  horizontalName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#D1D5DB",
    textAlign: "center",
  },
  horizontalNameSelected: {
    color: "#FFFFFF",
  },
  horizontalDescription: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
    marginTop: 2,
  },
  themeOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  themeOptionSelected: {
    backgroundColor: "transparent",
    borderBottomColor: "#FFFFFF",
  },
  themePreview: {
    marginRight: 12,
  },
  miniBoard: {
    padding: 2,
    borderRadius: 4,
  },
  miniBoardRow: {
    flexDirection: "row",
  },
  miniSquare: {
    width: 8,
    height: 8,
  },
  themeInfo: {
    flex: 1,
  },
  themeName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#D1D5DB",
    marginBottom: 2,
  },
  themeNameSelected: {
    color: "#FFFFFF",
  },
  themeDescription: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  styleOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  styleOptionSelected: {
    backgroundColor: "transparent",
    borderBottomColor: "#FFFFFF",
  },
  stylePreview: {
    marginRight: 12,
  },
  singlePieceContainer: {
    width: 48,
    height: 48,
    justifyContent: "center",
    alignItems: "center",
  },
  singlePieceSquare: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0d9b5",
    borderRadius: 6,
  },
  pieceGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    width: 60,
  },
  pieceContainer: {
    margin: 1,
  },
  pieceSquare: {
    width: 28,
    height: 28,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  styleInfo: {
    flex: 1,
  },
  styleName: {
    fontSize: 16,
    fontWeight: "500",
    color: "#D1D5DB",
    marginBottom: 2,
  },
  styleNameSelected: {
    color: "#FFFFFF",
  },
  styleDescription: {
    fontSize: 14,
    color: "#9CA3AF",
  },
  sizeContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 0,
  },
  sizeOption: {
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
    flex: 1,
  },
  sizeOptionSelected: {
    backgroundColor: "transparent",
    borderBottomColor: "#FFFFFF",
  },
  sizePreview: {
    marginBottom: 8,
    padding: 8,
    backgroundColor: "#F0D9B5",
    borderRadius: 8,
  },
  sizeName: {
    fontSize: 14,
    fontWeight: "500",
    color: "#D1D5DB",
  },
  sizeNameSelected: {
    color: "#FFFFFF",
  },
  switchGroup: {
    gap: 0,
  },
  switchRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#333333",
  },
  switchLabel: {
    fontSize: 18,
    fontWeight: "600",
    color: "#D1D5DB",
    flex: 1,
  },
  unsavedChangesText: {
    fontSize: 16,
    color: "#F59E0B",
    textAlign: "center",
    marginBottom: 16,
    fontWeight: "500",
  },
  saveDiscardContainer: {
    flexDirection: "row",
    gap: 12,
  },
  saveButton: {
    flex: 1,
    backgroundColor: "#059669",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  saveButtonDisabled: {
    backgroundColor: "#374151",
    borderColor: "#6B7280",
    opacity: 0.6,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  discardButton: {
    flex: 1,
    backgroundColor: "#7F1D1D",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  discardButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFFFFF",
  },
  resetButton: {
    backgroundColor: "#7F1D1D",
    borderRadius: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#FFFFFF",
  },
  checkmark: {
    fontSize: 18,
    color: "#10B981",
    fontWeight: "bold",
  },
  bottomSpacer: {
    height: 40,
  },
});
