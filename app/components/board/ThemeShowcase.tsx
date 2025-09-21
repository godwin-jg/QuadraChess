import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from "react-native";
import { settingsService } from "../../../services/settingsService";
import { getBoardTheme } from "./BoardThemeConfig";
import Piece from "./Piece";

/**
 * Showcase the new board themes and piece styles
 */
export default function ThemeShowcase() {
  const [settings, setSettings] = useState(settingsService.getSettings());

  useEffect(() => {
    const loadSettings = async () => {
      const loadedSettings = await settingsService.loadSettings();
      setSettings(loadedSettings);
    };
    loadSettings();
  }, []);

  const boardThemes = [
    { key: "brown", name: "Brown", description: "Classic wooden board" },
    {
      key: "grey-white",
      name: "Grey & White",
      description: "Chess.com classic",
    },
    {
      key: "green-ivory",
      name: "Green & Ivory",
      description: "Chess.com modern",
    },
  ];

  const pieceStyles = [
    { key: "solid", name: "Solid", description: "No borders" },
    {
      key: "white-bordered",
      name: "White Bordered",
      description: "White outline",
    },
    {
      key: "black-bordered",
      name: "Black Bordered",
      description: "Black outline",
    },
    {
      key: "colored-bordered",
      name: "Colored Bordered",
      description: "Darker colored outline",
    },
    {
      key: "wooden",
      name: "Wooden",
      description: "Classic wood (blue/green only)",
    },
  ];

  const testPieces = [
    { code: "rK", name: "Red King" },
    { code: "yQ", name: "Purple Queen" },
    { code: "bR", name: "Blue Rook" },
    { code: "gB", name: "Green Bishop" },
  ];

  const renderBoardPreview = (theme: any) => {
    const boardTheme = getBoardTheme({
      ...settings,
      board: { theme: theme.key },
    });

    return (
      <View style={styles.boardPreview}>
        <View
          style={[styles.board, { backgroundColor: boardTheme.borderColor }]}
        >
          {[0, 1, 2, 3].map((row) => (
            <View key={row} style={styles.boardRow}>
              {[0, 1, 2, 3].map((col) => (
                <View
                  key={col}
                  style={[
                    styles.square,
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
        <Text style={styles.themeName}>{theme.name}</Text>
        <Text style={styles.themeDescription}>{theme.description}</Text>
      </View>
    );
  };

  const renderPiecePreview = (style: any) => {
    return (
      <View style={styles.piecePreview}>
        <View style={styles.piecesGrid}>
          {testPieces.map((piece, index) => (
            <View key={index} style={styles.pieceContainer}>
              <View
                style={[styles.pieceSquare, { backgroundColor: "#f0d9b5" }]}
              >
                <Piece piece={piece.code} size={30} useSVG={true} />
              </View>
            </View>
          ))}
        </View>
        <Text style={styles.styleName}>{style.name}</Text>
        <Text style={styles.styleDescription}>{style.description}</Text>
      </View>
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.title}>🎨 Theme & Style Showcase</Text>
      <Text style={styles.subtitle}>New board themes and piece styles</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🏁 Board Themes</Text>
        <View style={styles.themesGrid}>
          {boardThemes.map((theme) => (
            <View key={theme.key} style={styles.themeCard}>
              {renderBoardPreview(theme)}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>♟️ Piece Styles</Text>
        <View style={styles.stylesGrid}>
          {pieceStyles.map((style) => (
            <View key={style.key} style={styles.styleCard}>
              {renderPiecePreview(style)}
            </View>
          ))}
        </View>
      </View>

      <View style={styles.currentSection}>
        <Text style={styles.currentTitle}>⚙️ Current Settings</Text>
        <Text style={styles.currentText}>
          Board: {settings.board.theme} | Pieces: {settings.pieces.style}
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
  section: {
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginBottom: 15,
    color: "#1f2937",
  },
  themesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  themeCard: {
    width: "30%",
    marginBottom: 20,
  },
  boardPreview: {
    alignItems: "center",
  },
  board: {
    padding: 4,
    borderRadius: 8,
    marginBottom: 8,
  },
  boardRow: {
    flexDirection: "row",
  },
  square: {
    width: 20,
    height: 20,
  },
  themeName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
  },
  themeDescription: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  stylesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-around",
  },
  styleCard: {
    width: "30%",
    marginBottom: 20,
  },
  piecePreview: {
    alignItems: "center",
  },
  piecesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginBottom: 8,
  },
  pieceContainer: {
    margin: 2,
  },
  pieceSquare: {
    width: 40,
    height: 40,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 4,
  },
  styleName: {
    fontSize: 14,
    fontWeight: "bold",
    color: "#374151",
    marginBottom: 2,
  },
  styleDescription: {
    fontSize: 12,
    color: "#6b7280",
    textAlign: "center",
  },
  currentSection: {
    backgroundColor: "#f0f9ff",
    margin: 20,
    padding: 20,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#3b82f6",
  },
  currentTitle: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 10,
    color: "#1f2937",
  },
  currentText: {
    fontSize: 14,
    color: "#4b5563",
  },
});

