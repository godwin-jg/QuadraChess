import React, { useRef, useState } from "react";
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
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { hapticsService } from '@/services/hapticsService';
import soundService from '@/services/soundService';
import * as Haptics from 'expo-haptics';
import { useSettings } from "../../../context/SettingsContext";
import { getBoardTheme } from "../board/BoardThemeConfig";
import Piece from "../board/Piece";
import GridBackground from "../ui/GridBackground";
import { generateRandomName } from "../../utils/nameGenerator";
import type { BotDifficulty } from "../../../config/gameConfig";

interface ProfileSettingsProps {
  onClose?: () => void;
}

const BOT_DIFFICULTY_OPTIONS: { key: BotDifficulty; label: string }[] = [
  { key: "easy", label: "Easy" },
  { key: "medium", label: "Medium" },
  { key: "hard", label: "Hard" },
  { key: "superHard", label: "Super Hard" },
];

const BOT_DIFFICULTY_DESCRIPTIONS: Record<BotDifficulty, string> = {
  easy: "Easy: depth 1 — bots play independently",
  medium: "Medium: depth 2 — bots play independently",
  hard: "Hard: depth 3 — bots play independently",
  superHard: "Super Hard: depth 3 — all bots play against you",
};

export default function ProfileSettings({ onClose }: ProfileSettingsProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const footerSpacer = 96 + insets.bottom;
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

  const developerTapStateRef = useRef({ count: 0, lastTapAt: 0 });
  const developerTapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const developerTapWindowMs = 1500;
  const selectedBotDifficulty = (settings.game.botDifficulty || "easy") as BotDifficulty;
  const botDifficultyDescription =
    BOT_DIFFICULTY_DESCRIPTIONS[selectedBotDifficulty] ??
    "Easy: depth 1 — bots play independently";

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
          },
        },
      ]
    );
  };

  const resolveMoveInputSettings = (
    nextTap: boolean,
    nextDrag: boolean,
    changed: "tap" | "drag"
  ) => {
    if (nextTap || nextDrag) {
      return { tapToMoveEnabled: nextTap, dragToMoveEnabled: nextDrag, forcedLabel: null };
    }
    return changed === "tap"
      ? { tapToMoveEnabled: false, dragToMoveEnabled: true, forcedLabel: "Drag to Move" }
      : { tapToMoveEnabled: true, dragToMoveEnabled: false, forcedLabel: "Tap to Move" };
  };

  const applyMoveInputToggle = async (changed: "tap" | "drag", value: boolean) => {
    await hapticsService.toggle();
    const nextTap = changed === "tap" ? value : settings.game.tapToMoveEnabled;
    const nextDrag = changed === "drag" ? value : settings.game.dragToMoveEnabled;
    const resolved = resolveMoveInputSettings(nextTap, nextDrag, changed);

    updateGame({
      tapToMoveEnabled: resolved.tapToMoveEnabled,
      dragToMoveEnabled: resolved.dragToMoveEnabled,
    });

    if (resolved.forcedLabel) {
      Alert.alert(
        "Keep One Input Enabled",
        `${resolved.forcedLabel} has been turned on so you can still move pieces.`
      );
    }

    const label = changed === "tap" ? "Tap to move" : "Drag to move";
    try {
      await saveSettings();
      console.log(`✅ ${label} setting auto-saved successfully`);
    } catch (error) {
      console.error(`❌ Failed to auto-save ${label.toLowerCase()} setting:`, error);
    }
  };

  const handleDeveloperTitleTap = () => {
    const now = Date.now();
    const { count, lastTapAt } = developerTapStateRef.current;
    const isContinuousTap = now - lastTapAt < developerTapWindowMs;
    const nextCount = isContinuousTap ? count + 1 : 1;

    developerTapStateRef.current = { count: nextCount, lastTapAt: now };

    if (developerTapTimeoutRef.current) {
      clearTimeout(developerTapTimeoutRef.current);
    }

    developerTapTimeoutRef.current = setTimeout(() => {
      developerTapStateRef.current = { count: 0, lastTapAt: 0 };
      developerTapTimeoutRef.current = null;
    }, developerTapWindowMs);

    if (nextCount >= 9) {
      developerTapStateRef.current = { count: 0, lastTapAt: 0 };
      if (developerTapTimeoutRef.current) {
        clearTimeout(developerTapTimeoutRef.current);
        developerTapTimeoutRef.current = null;
      }
      Alert.alert("click OK if you’re gay");
    }
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
        className={`flex-row items-center py-4 px-5 rounded-xl border min-w-[120px] flex-1 ${
          isSelected ? 'bg-white/20 border-blue-400' : 'bg-white/10 border-white/10'
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
        className={`flex-row items-center py-4 px-5 rounded-xl border min-w-[120px] flex-1 ${
          isSelected ? 'bg-white/20 border-blue-400' : 'bg-white/10 border-white/10'
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
        className={`flex-row items-center py-4 px-5 rounded-xl border min-w-[120px] flex-1 ${
          isSelected ? 'bg-white/20 border-blue-400' : 'bg-white/10 border-white/10'
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
      <SafeAreaView style={{ flex: 1 }} className="bg-black">
        <GridBackground />
        <View className="flex-1 justify-center items-center" style={{ zIndex: 1 }}>
          <Text className="text-base text-white">Loading settings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-black">
      <GridBackground />
      <View className="flex-1" style={{ zIndex: 1 }}>
        {/* Header with Back Button */}
        <View className="flex-row items-center justify-between px-6 pt-4 pb-3">
          <TouchableOpacity
            className="w-10 h-10 rounded-full bg-white/10 justify-center items-center border border-white/20"
            onPress={async () => {
              await hapticsService.selection();
              if (onClose) {
                onClose();
              } else {
                router.back();
              }
            }}
          >
            <Text className="text-xl text-white">←</Text>
          </TouchableOpacity>
          <Text className="text-lg font-bold text-white tracking-wide">Settings</Text>
          <View className="w-10" />
        </View>

        {/* Scrollable Content */}
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        {/* Profile Section */}
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">👤 Profile</Text>
          <View className="mb-2">
            <Text className="text-base font-semibold text-gray-300 mb-3">Player Name</Text>
            <View className="flex-row items-center bg-white/10 border border-white/20 rounded-xl px-3 py-1">
              <TextInput
                className="flex-1 py-3 text-lg text-white font-medium"
                value={settings.profile.name}
                onChangeText={(text) => updateProfile({ name: text })}
                placeholder="Enter your name or roll a dice"
                placeholderTextColor="#94A3B8"
              />
              <TouchableOpacity
                className="ml-2 px-3 py-2 rounded-lg border border-blue-400/40 bg-blue-500/80"
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
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">Board Theme</Text>
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
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">Piece Style</Text>
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
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">Size</Text>
          {/* Segmented Control */}
          <View className="flex-row bg-white/10 border border-white/20 rounded-xl p-1 mt-4">
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
                className={`flex-1 items-center py-2 rounded-lg border ${
                  settings.pieces.size === size.key ? 'bg-blue-500/30 border-blue-400' : 'border-transparent'
                }`}
              >
                <Text className={`font-bold ${
                  settings.pieces.size === size.key ? 'text-white' : 'text-gray-300'
                }`}>
                  {size.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Game Settings Section */}
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">🎮 Game Settings</Text>
          <View>
            <View className="py-4 border-b border-white/10">
              <Text className="text-lg font-semibold text-gray-300">AI Difficulty</Text>
              <Text className="text-sm text-gray-400 mt-1">
                Applies to single player bots
              </Text>
              <View className="flex-row bg-white/10 border border-white/20 rounded-xl p-1 mt-4">
                {BOT_DIFFICULTY_OPTIONS.map((level) => (
                  <TouchableOpacity
                    key={level.key}
                    onPress={async () => {
                      await hapticsService.selection();
                      updateGame({
                        botDifficulty: level.key,
                        botTeamMode: level.key === "superHard",
                      });
                      try {
                        await saveSettings();
                        console.log("✅ Bot difficulty auto-saved successfully");
                      } catch (error) {
                        console.error("❌ Failed to auto-save bot difficulty:", error);
                      }
                    }}
                    className={`flex-1 items-center px-1 py-2 rounded-lg border ${
                      settings.game.botDifficulty === level.key
                        ? "bg-blue-500/30 border-blue-400"
                        : "border-transparent"
                    }`}
                  >
                    <Text
                      className={`font-bold ${
                        settings.game.botDifficulty === level.key
                          ? "text-white"
                          : "text-gray-300"
                      }`}
                      numberOfLines={1}
                    >
                      {level.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-xs text-gray-500 mt-2">
                {botDifficultyDescription}
              </Text>
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Sound Effects</Text>
              <Switch
                value={settings.game.soundEnabled}
                onValueChange={async (value) => {
                  
                  // ✅ CRITICAL FIX: Auto-save sound setting immediately for instant effect
                  updateGame({ soundEnabled: value });
                  
                  // ✅ CRITICAL FIX: Only test haptics if haptics are enabled
                  if (settings.game.hapticsEnabled) {
                    // Try VERY strong haptic patterns
                    try {
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
                      console.log('✅ Triple Heavy haptics successful');
                    } catch (error) {
                      console.log('❌ Triple Heavy haptics failed:', error);
                    }
                    
                    setTimeout(async () => {
                      try {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                        console.log('✅ Notification haptic successful');
                      } catch (error) {
                        console.log('❌ Notification haptic failed:', error);
                      }
                    }, 500);
                    
                    setTimeout(async () => {
                      try {
                        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
                        console.log('✅ Error notification haptic successful');
                      } catch (error) {
                        console.log('❌ Error notification haptic failed:', error);
                      }
                    }, 1000);
                  } else {
                  }
                  
                  // ✅ CRITICAL FIX: Auto-save the setting immediately
                  try {
                    await saveSettings();
                    console.log('✅ Sound setting auto-saved successfully');
                  } catch (error) {
                    console.error('❌ Failed to auto-save sound setting:', error);
                  }
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.soundEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
              <View className="flex-1 pr-4">
                <Text className="text-lg font-semibold text-gray-300">Animations</Text>
                <Text className="text-sm text-gray-400 mt-1">
                  Disable this if you experience animation issues
                </Text>
              </View>
              <Switch
                value={settings.game.animationsEnabled}
                onValueChange={async (value) => {
                  await hapticsService.toggle();
                  soundService.playToggleSound();
                  updateGame({ animationsEnabled: value });
                  
                  // ✅ CRITICAL FIX: Auto-save animations setting immediately for instant effect
                  try {
                    await saveSettings();
                    console.log('✅ Animations setting auto-saved successfully');
                  } catch (error) {
                    console.error('❌ Failed to auto-save animations setting:', error);
                  }
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={
                  settings.game.animationsEnabled ? "#FFFFFF" : "#9CA3AF"
                }
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Tap to Move</Text>
              <Switch
                value={settings.game.tapToMoveEnabled}
                onValueChange={async (value) => {
                  await applyMoveInputToggle("tap", value);
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.tapToMoveEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Drag to Move</Text>
              <Switch
                value={settings.game.dragToMoveEnabled}
                onValueChange={async (value) => {
                  await applyMoveInputToggle("drag", value);
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.dragToMoveEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
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
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
              <Text className="text-lg font-semibold text-gray-300 flex-1">Haptic Feedback</Text>
              <Switch
                value={settings.game.hapticsEnabled}
                onValueChange={async (value) => {
                  // Don't trigger haptic feedback when toggling haptics setting
                  updateGame({ hapticsEnabled: value });
                  
                  // ✅ CRITICAL FIX: Auto-save haptics setting immediately for instant effect
                  try {
                    await saveSettings();
                    console.log('✅ Haptics setting auto-saved successfully');
                  } catch (error) {
                    console.error('❌ Failed to auto-save haptics setting:', error);
                  }
                }}
                trackColor={{ false: "#E5E7EB", true: "#3B82F6" }}
                thumbColor={settings.game.hapticsEnabled ? "#FFFFFF" : "#9CA3AF"}
              />
            </View>
          </View>
        </View>

        {/* Accessibility Section */}
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <Text className="text-xl font-bold text-white mb-4 tracking-wide">♿ Accessibility</Text>
          <View>
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
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
            <View className="flex-row justify-between items-center py-4 border-b border-white/10">
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
        <View className="bg-white/5 border border-white/10 rounded-2xl p-4 mx-4 my-2">
          <TouchableOpacity
            onPress={handleDeveloperTitleTap}
            activeOpacity={0.8}
          >
            <Text className="text-xl font-bold text-white mb-4 tracking-wide">
              🛠️ Developer
            </Text>
          </TouchableOpacity>
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
        <View className="bg-red-500/10 border border-red-500/20 rounded-2xl p-4 mx-4 my-2">
          <TouchableOpacity className="py-2" onPress={handleResetToDefaults}>
            <Text className="text-base font-medium text-red-300 text-center">
              Reset all settings to default
            </Text>
          </TouchableOpacity>
        </View>

        {/* Made by Footer */}
        <View className="py-6 mt-4">
          <Text 
            className="text-center text-sm"
            style={{ color: 'rgba(255,255,255,0.3)' }}
          >
            Made with ❤️ by JG
          </Text>
        </View>

        {/* Add padding to prevent content from hiding behind the footer */}
        <View style={{ height: footerSpacer }} />
        </ScrollView>

        {/* Auto-save status */}
        {isSaving && (
          <View
            className="absolute bottom-0 left-0 right-0 p-4 bg-black/70 border-t border-white/10"
            style={{ paddingBottom: insets.bottom + 12 }}
          >
            <Text className="text-sm text-gray-300 text-center font-medium">
              Saving changes...
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

