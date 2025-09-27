import React, { useState } from "react";
import {
  Alert,
  ScrollView,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from 'expo-haptics';

// Helper function to safely trigger haptic feedback
const triggerHaptic = async (style: Haptics.ImpactFeedbackStyle) => {
  try {
    await Haptics.impactAsync(style);
  } catch (error) {
    // Silently fail if haptics are not available (e.g., on Android without proper linking)
    console.log('Haptic feedback not available:', error);
  }
};
import { useSettings } from "../../../context/SettingsContext";
import { getBoardTheme } from "../board/BoardThemeConfig";
import Piece from "../board/Piece";

interface ProfileSettingsProps {
  onClose?: () => void;
}

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const router = useRouter();
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
    updateDeveloper,
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
        className={`flex-row items-center py-4 px-5 bg-gray-900 rounded-xl border-2 min-w-[120px] flex-1 ${
          isSelected ? 'bg-gray-800 border-white' : 'border-transparent'
        }`}
        onPress={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          updateBoard({ theme: theme.key });
        }}
      >
        <View className="mr-3">
          <View
            className="p-0.5 rounded"
            style={{ backgroundColor: boardTheme.borderColor }}
          >
            {[0, 1, 2, 3].map((row) => (
              <View key={row} className="flex-row">
                {[0, 1, 2, 3].map((col) => (
                  <View
                    key={col}
                    className="w-2 h-2"
                    style={{
                      backgroundColor:
                        (row + col) % 2 === 0
                          ? boardTheme.lightSquare
                          : boardTheme.darkSquare,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </View>
        <View className="flex-1 items-center">
          <Text
            className={`text-base font-semibold text-center ${
              isSelected ? 'text-white' : 'text-gray-300'
            }`}
          >
            {theme.name}
          </Text>
          <Text className="text-xs text-gray-400 text-center mt-0.5">{theme.description}</Text>
        </View>
        {isSelected && <Text className="text-lg text-emerald-500 font-bold">✓</Text>}
      </TouchableOpacity>
    );
  };

  const renderPieceStyleOption = (style: any) => {
    const isSelected = settings.pieces.style === style.key;

    return (
      <TouchableOpacity
        key={style.key}
        className={`flex-row items-center py-4 px-5 bg-gray-900 rounded-xl border-2 min-w-[120px] flex-1 ${
          isSelected ? 'bg-gray-800 border-white' : 'border-transparent'
        }`}
        onPress={() => {
          triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
          updatePieces({ style: style.key });
        }}
      >
        <View className="mr-3">
          <View className="w-12 h-12 justify-center items-center">
            <View className="w-10 h-10 justify-center items-center bg-[#f0d9b5] rounded-md">
              <Piece
                piece="rK"
                size={32}
                useSVG={true}
                previewStyle={style.key}
              />
            </View>
          </View>
        </View>
        <View className="flex-1 items-center">
          <Text
            className={`text-base font-semibold text-center ${
              isSelected ? 'text-white' : 'text-gray-300'
            }`}
          >
            {style.name}
          </Text>
        </View>
        {isSelected && <Text className="text-lg text-emerald-500 font-bold">✓</Text>}
      </TouchableOpacity>
    );
  };

  const renderSizeOption = (size: any) => {
    const isSelected = settings.pieces.size === size.key;

    return (
      <TouchableOpacity
        key={size.key}
        className={`flex-row items-center py-4 px-5 bg-gray-900 rounded-xl border-2 min-w-[120px] flex-1 ${
          isSelected ? 'bg-gray-800 border-white' : 'border-transparent'
        }`}
        onPress={() => updatePieces({ size: size.key })}
      >
        <Text
          className={`text-base font-semibold text-center flex-1 ${
            isSelected ? 'text-white' : 'text-gray-300'
          }`}
        >
          {size.name}
        </Text>
        {isSelected && <Text className="text-lg text-emerald-500 font-bold">✓</Text>}
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-black">
        <Text className="text-base text-white">Loading settings...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-black">
      {/* Sticky Header */}
      <View className="flex-row justify-between items-center px-5 py-4 bg-black border-b border-gray-800">
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-gray-700 justify-center items-center border border-gray-600 shadow-lg"
          onPress={() => {
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
                      // FIX: Actually discard the changes first
                      discardChanges();
                      if (onClose) {
                        onClose();
                      } else {
                        router.back();
                      }
                    },
                  },
                  {
                    text: "Save",
                    onPress: async () => {
                      try {
                        await saveSettings();
                        if (onClose) {
                          onClose();
                        } else {
                          router.back();
                        }
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
              } else {
                // Navigate back to home screen
                router.back();
              }
            }
          }}
          activeOpacity={0.7}
        >
          <Text className="text-xl text-white font-semibold">←</Text>
        </TouchableOpacity>
        <Text className="text-2xl font-bold text-white">⚙️ Profile Settings</Text>
        <View className="w-10" />
      </View>

      {/* Scrollable Content */}
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">👤 Profile</Text>
          <View className="mb-2">
            <Text className="text-base font-semibold text-gray-300 mb-3">Player Name</Text>
            <TextInput
              className="border-b-2 border-white px-0 py-4 text-xl text-white bg-transparent font-medium"
              value={settings.profile.name}
              onChangeText={(text) => updateProfile({ name: text })}
              placeholder="Enter your name"
              placeholderTextColor="#6B7280"
            />
          </View>
        </View>

        {/* Board Theme Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">🎨 Board Theme</Text>
          <View className="flex-row flex-wrap gap-3">
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
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">♟️ Piece Style</Text>
          <View className="flex-row flex-wrap gap-3">
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
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">📏 Size</Text>
          {/* Segmented Control */}
          <View className="flex-row bg-gray-800 rounded-lg p-1 mt-4">
            {[
              { key: "small", name: "S" },
              { key: "medium", name: "M" },
              { key: "large", name: "L" },
            ].map((size, index) => (
              <TouchableOpacity
                key={size.key}
                onPress={() => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                  updatePieces({ size: size.key });
                }}
                className={`flex-1 items-center py-2 rounded-md ${
                  settings.pieces.size === size.key ? 'bg-blue-600' : 'bg-transparent'
                }`}
              >
                <Text className={`font-bold ${
                  settings.pieces.size === size.key ? 'text-white' : 'text-gray-400'
                }`}>
                  {size.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Game Settings Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">🎮 Game Settings</Text>
          <View>
            <View className="flex-row justify-between items-center py-4 border-b border-gray-700">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Sound Effects</Text>
              <Switch
                value={settings.game.soundEnabled}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateGame({ soundEnabled: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.soundEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-gray-700">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Animations</Text>
              <Switch
                value={settings.game.animationsEnabled}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateGame({ animationsEnabled: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.game.animationsEnabled ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View className="flex-row justify-between items-center py-4">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Move Hints</Text>
              <Switch
                value={settings.game.showMoveHints}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateGame({ showMoveHints: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.showMoveHints ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
          </View>
        </View>

        {/* Accessibility Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">♿ Accessibility</Text>
          <View>
            <View className="flex-row justify-between items-center py-4 border-b border-gray-700">
              <Text className="text-lg font-semibold text-gray-300 flex-1">High Contrast</Text>
              <Switch
                value={settings.accessibility.highContrast}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateAccessibility({ highContrast: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.accessibility.highContrast ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-gray-700">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Large Text</Text>
              <Switch
                value={settings.accessibility.largeText}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateAccessibility({ largeText: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.accessibility.largeText ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View className="flex-row justify-between items-center py-4">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Reduced Motion</Text>
              <Switch
                value={settings.accessibility.reducedMotion}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateAccessibility({ reducedMotion: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.accessibility.reducedMotion ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
          </View>
        </View>

        {/* Developer Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">
            🛠️ Developer (will be removed in release)
          </Text>
          <View>
            <View className="flex-row justify-between items-center py-4">
              <View className="flex-1">
                <Text className="text-lg font-semibold text-gray-300">Solo Mode</Text>
                <Text className="text-sm text-gray-400 mt-0.5">
                  Disable turn validation for analysis
                </Text>
              </View>
              <Switch
                value={settings.developer.soloMode}
                onValueChange={(value) => {
                  triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
                  updateDeveloper({ soloMode: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#EF4444" }}
                thumbColor={settings.developer.soloMode ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
          </View>
        </View>


        {/* Reset Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <TouchableOpacity
            className="py-2"
            onPress={() => setShowResetConfirm(true)}
          >
            <Text className="text-base font-medium text-red-500 text-center">
              Reset all settings to default
            </Text>
          </TouchableOpacity>
        </View>

        {/* Add padding to prevent content from hiding behind the footer */}
        <View className="h-24" />
      </ScrollView>

      {/* Sticky Footer */}
      {hasUnsavedChanges && (
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-black/90 border-t border-gray-700">
          <Text className="text-sm text-amber-500 text-center mb-3 font-medium">
            ⚠️ You have unsaved changes
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 bg-emerald-600 rounded-lg py-3 px-5 items-center ${
                isSaving ? 'bg-gray-700 border border-gray-600 opacity-60' : ''
              }`}
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                handleSaveSettings();
              }}
              disabled={isSaving}
            >
              <Text className="text-base font-semibold text-white">
                {isSaving ? "💾 Saving..." : "💾 Save Changes"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-red-900 rounded-lg py-3 px-5 items-center"
              onPress={() => {
                triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
                handleDiscardChanges();
              }}
            >
              <Text className="text-base font-semibold text-white">🗑️ Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

