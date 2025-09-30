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
import { hapticsService } from '@/services/hapticsService';
import { HapticsTestService } from '@/services/hapticsTestService';
import soundService from '@/services/soundService';
import * as Haptics from 'expo-haptics';
import { useSettings } from "../../../context/SettingsContext";
import { getBoardTheme } from "../board/BoardThemeConfig";
import Piece from "../board/Piece";
import { generateRandomName } from "../../utils/nameGenerator";

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
        onPress={async () => {
          await hapticsService.selection();
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
        onPress={async () => {
          await hapticsService.selection();
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

      {/* Scrollable Content */}
      <ScrollView className="flex-1 pt-8" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="bg-gray-900 rounded-xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">👤 Profile</Text>
          <View className="mb-2">
            <Text className="text-base font-semibold text-gray-300 mb-3">Player Name</Text>
            <View className="flex-row items-center">
              <TextInput
                className="flex-1 px-0 py-4 text-xl text-white bg-transparent font-medium"
                value={settings.profile.name}
                onChangeText={(text) => updateProfile({ name: text })}
                placeholder="Enter your name or roll a dice"
                placeholderTextColor="#6B7280"
              />
              <TouchableOpacity
                className="ml-3 px-4 py-2 bg-blue-600 rounded-lg"
                onPress={async () => {
                  await hapticsService.selection();
                  const randomName = generateRandomName();
                  updateProfile({ name: randomName });
                }}
                activeOpacity={0.7}
              >
                <Text className="text-white font-semibold text-sm">🎲</Text>
              </TouchableOpacity>
            </View>
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
                onPress={async () => {
                  await hapticsService.selection();
                  updatePieces({ size: size.key as "small" | "medium" | "large" });
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
                onValueChange={async (value) => {
                  console.log('🔍 Sound switch toggled to:', value);
                  console.log('🔍 Current haptics setting:', settings.game.hapticsEnabled);
                  
                  // Try VERY strong haptic patterns
                  try {
                    console.log('🎯 Trying TRIPLE Heavy haptics...');
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                    console.log('✅ Triple Heavy haptics successful');
                  } catch (error) {
                    console.log('❌ Triple Heavy haptics failed:', error);
                  }
                  
                  setTimeout(async () => {
                    try {
                      console.log('🎯 Trying Notification haptic...');
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                      console.log('✅ Notification haptic successful');
                    } catch (error) {
                      console.log('❌ Notification haptic failed:', error);
                    }
                  }, 500);
                  
                  setTimeout(async () => {
                    try {
                      console.log('🎯 Trying Error notification haptic...');
                      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                      console.log('✅ Error notification haptic successful');
                    } catch (error) {
                      console.log('❌ Error notification haptic failed:', error);
                    }
                  }, 1000);
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
                onValueChange={async (value) => {
                  await hapticsService.toggle();
                  soundService.playToggleSound();
                  updateGame({ animationsEnabled: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.game.animationsEnabled ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-gray-700">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Move Hints</Text>
              <Switch
                value={settings.game.showMoveHints}
                onValueChange={async (value) => {
                  await hapticsService.toggle();
                  updateGame({ showMoveHints: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.showMoveHints ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-gray-700">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Haptic Feedback</Text>
              <Switch
                value={settings.game.hapticsEnabled}
                onValueChange={(value) => {
                  // Don't trigger haptic feedback when toggling haptics setting
                  updateGame({ hapticsEnabled: value });
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.hapticsEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View className="py-4">
              <TouchableOpacity
                className="bg-blue-600 rounded-lg py-3 px-4 items-center"
                onPress={async () => {
                  console.log('🧪 Testing haptics...');
                  await HapticsTestService.testHaptics();
                  await HapticsTestService.testHapticsService();
                }}
              >
                <Text className="text-white font-semibold">🧪 Test Haptics</Text>
              </TouchableOpacity>
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
                onValueChange={async (value) => {
                  await hapticsService.toggle();
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
                onValueChange={async (value) => {
                  await hapticsService.toggle();
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
                onValueChange={async (value) => {
                  await hapticsService.toggle();
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
                onValueChange={async (value) => {
                  await hapticsService.toggle();
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
        <View className="absolute bottom-0 left-0 right-0 p-4 bg-black/60 border-t border-gray-600">
          <Text className="text-sm text-amber-500 text-center mb-3 font-medium">
            You have unsaved changes
          </Text>
          <View className="flex-row gap-3">
            <TouchableOpacity
              className={`flex-1 bg-emerald-600 rounded-lg py-3 px-5 items-center ${
                isSaving ? 'bg-gray-700 border border-gray-600 opacity-60' : ''
              }`}
              onPress={async () => {
                await hapticsService.selection();
                handleSaveSettings();
              }}
              disabled={isSaving}
            >
              <Text className="text-base font-semibold text-white">
                {isSaving ? "Saving..." : "Save Changes"}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className="flex-1 bg-gray-600 rounded-lg py-3 px-5 items-center"
              onPress={async () => {
                await hapticsService.selection();
                handleDiscardChanges();
              }}
            >
              <Text className="text-base font-semibold text-white">Discard</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

