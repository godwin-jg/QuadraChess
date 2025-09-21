import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
} from "react-native";

// Import all test components
import ColorVerification from "./ColorVerification";
import OutlineComparison from "./OutlineComparison";
import ColorReplacementTest from "./ColorReplacementTest";
import AlternativeColorOptions from "./AlternativeColorOptions";
import EnhancedPieceStyling from "./EnhancedPieceStyling";
import StylingComparison from "./StylingComparison";
import FinalOutlineTest from "./FinalOutlineTest";
import DebugColors from "./DebugColors";
import ColorTest from "./ColorTest";
import ShadowTest from "./ShadowTest";
import ColorComparison from "./ColorComparison";
import EnhancedPieceTest from "./EnhancedPieceTest";
import PieceTest from "./PieceTest";
import MixedStyleTest from "./MixedStyleTest";
import MixedStyleImplementation from "./MixedStyleImplementation";
import WhiteOutlineComparison from "./WhiteOutlineComparison";
import WoodColorComparison from "./WoodColorComparison";
import ColorDebugTest from "./ColorDebugTest";
import SettingsTest from "./SettingsTest";
import SettingsQuickTest from "./SettingsQuickTest";
import AsyncStorageTest from "./AsyncStorageTest";
import ThemeShowcase from "./ThemeShowcase";
import SettingsVerification from "./SettingsVerification";
import PersistenceTest from "./PersistenceTest";
import BoardThemeTest from "./BoardThemeTest";
import ComprehensiveSettingsTest from "./ComprehensiveSettingsTest";
import SettingsVerificationScript from "./SettingsVerificationScript";
import SaveChangesTest from "./SaveChangesTest";

/**
 * Test Gallery - Easy access to all test components
 */
export default function TestGallery({ onBack }: { onBack?: () => void }) {
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const testComponents = [
    {
      id: "color-verification",
      name: "Color Verification",
      description: "Verify enhanced colors are working",
      component: ColorVerification,
    },
    {
      id: "outline-comparison",
      name: "Outline Comparison",
      description: "Compare different outline styles",
      component: OutlineComparison,
    },
    {
      id: "color-replacement",
      name: "Color Replacement",
      description: "Yellow → Purple color change",
      component: ColorReplacementTest,
    },
    {
      id: "alternative-colors",
      name: "Alternative Colors",
      description: "Other color options instead of yellow",
      component: AlternativeColorOptions,
    },
    {
      id: "enhanced-styling",
      name: "Enhanced Styling",
      description: "Different piece styling approaches",
      component: EnhancedPieceStyling,
    },
    {
      id: "styling-comparison",
      name: "Styling Comparison",
      description: "Side-by-side styling comparison",
      component: StylingComparison,
    },
    {
      id: "final-outline",
      name: "Final Outline Test",
      description: "Dark gray outline showcase",
      component: FinalOutlineTest,
    },
    {
      id: "debug-colors",
      name: "Debug Colors",
      description: "Debug current color values",
      component: DebugColors,
    },
    {
      id: "color-test",
      name: "Color Test",
      description: "Simple color test",
      component: ColorTest,
    },
    {
      id: "shadow-test",
      name: "Shadow Test",
      description: "3D drop shadow effects",
      component: ShadowTest,
    },
    {
      id: "color-comparison",
      name: "Color Comparison",
      description: "Original vs enhanced colors",
      component: ColorComparison,
    },
    {
      id: "enhanced-piece-test",
      name: "Enhanced Piece Test",
      description: "All enhanced features showcase",
      component: EnhancedPieceTest,
    },
    {
      id: "piece-test",
      name: "Piece Test",
      description: "Basic piece rendering test",
      component: PieceTest,
    },
    {
      id: "mixed-style-test",
      name: "Mixed Style Test",
      description: "White outline + Classic wood styling",
      component: MixedStyleTest,
    },
    {
      id: "mixed-style-implementation",
      name: "Implementation Guide",
      description: "How to implement mixed styling",
      component: MixedStyleImplementation,
    },
    {
      id: "white-outline-comparison",
      name: "White Outline Comparison",
      description: "Correct vs incorrect white outline",
      component: WhiteOutlineComparison,
    },
    {
      id: "wood-color-comparison",
      name: "Wood Color Comparison",
      description: "Lighter colors for wood pieces",
      component: WoodColorComparison,
    },
    {
      id: "color-debug-test",
      name: "Color Debug Test",
      description: "Debug piece color detection",
      component: ColorDebugTest,
    },
    {
      id: "settings-test",
      name: "Settings Test",
      description: "Test profile settings and piece styling",
      component: SettingsTest,
    },
    {
      id: "settings-quick-test",
      name: "Settings Quick Test",
      description: "Quick test of settings service",
      component: SettingsQuickTest,
    },
    {
      id: "async-storage-test",
      name: "AsyncStorage Test",
      description: "Test in-memory storage fallback",
      component: AsyncStorageTest,
    },
    {
      id: "theme-showcase",
      name: "Theme Showcase",
      description: "Showcase new board themes and piece styles",
      component: ThemeShowcase,
    },
    {
      id: "settings-verification",
      name: "Settings Verification",
      description: "Verify that settings are working correctly",
      component: SettingsVerification,
    },
    {
      id: "persistence-test",
      name: "Persistence Test",
      description: "Test that settings persist to AsyncStorage",
      component: PersistenceTest,
    },
    {
      id: "board-theme-test",
      name: "Board Theme Test",
      description: "Test that board theme changes are reflected in the board",
      component: BoardThemeTest,
    },
    {
      id: "comprehensive-settings-test",
      name: "Comprehensive Settings Test",
      description: "Complete test of all settings functionality",
      component: ComprehensiveSettingsTest,
    },
    {
      id: "settings-verification-script",
      name: "Settings Verification Script",
      description: "Automated verification of all settings",
      component: SettingsVerificationScript,
    },
    {
      id: "save-changes-test",
      name: "Save Changes Test",
      description: "Test the new save/discard functionality",
      component: SaveChangesTest,
    },
  ];

  const renderTestComponent = () => {
    const test = testComponents.find((t) => t.id === selectedTest);
    if (!test) return null;

    const TestComponent = test.component;
    return <TestComponent />;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity style={styles.backButton} onPress={onBack}>
            <Text style={styles.backButtonText}>← Back</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>🧪 Test Gallery</Text>
        <Text style={styles.subtitle}>
          All test components for chess piece enhancements
        </Text>
      </View>

      <ScrollView style={styles.testList}>
        {testComponents.map((test) => (
          <TouchableOpacity
            key={test.id}
            style={styles.testCard}
            onPress={() => setSelectedTest(test.id)}
          >
            <Text style={styles.testName}>{test.name}</Text>
            <Text style={styles.testDescription}>{test.description}</Text>
            <Text style={styles.testId}>ID: {test.id}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={selectedTest !== null}
        animationType="slide"
        presentationStyle="fullScreen"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setSelectedTest(null)}
            >
              <Text style={styles.closeButtonText}>✕ Close</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {testComponents.find((t) => t.id === selectedTest)?.name}
            </Text>
          </View>
          <ScrollView style={styles.modalContent}>
            {renderTestComponent()}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  header: {
    paddingTop: 20,
  },
  backButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginLeft: 20,
    marginBottom: 20,
  },
  backButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  title: {
    fontSize: 28,
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
    paddingHorizontal: 20,
  },
  testList: {
    flex: 1,
    paddingHorizontal: 20,
  },
  testCard: {
    backgroundColor: "white",
    padding: 20,
    marginBottom: 15,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  testName: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#1f2937",
    marginBottom: 8,
  },
  testDescription: {
    fontSize: 14,
    color: "#6b7280",
    marginBottom: 8,
    lineHeight: 20,
  },
  testId: {
    fontSize: 12,
    color: "#9ca3af",
    fontFamily: "monospace",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "#f8f9fa",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    backgroundColor: "white",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
  },
  closeButton: {
    backgroundColor: "#ef4444",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    marginRight: 15,
  },
  closeButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "bold",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#1f2937",
    flex: 1,
  },
  modalContent: {
    flex: 1,
  },
});
