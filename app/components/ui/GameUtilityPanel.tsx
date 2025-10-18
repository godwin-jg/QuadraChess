import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../../state";
import HistoryControls from "./HistoryControls";
import ResignButton from "./ResignButton";
import EndgameButton from "./EndgameButton";

interface GameUtilityPanelProps {}

export default function GameUtilityPanel({}: GameUtilityPanelProps) {
  const { gameMode } = useSelector((state: RootState) => state.game);
  
  // Determine if this is single player mode
  const isSinglePlayerMode = gameMode === "solo" || gameMode === "single";


  return (
    <View style={[
      styles.panel,
      styles.topPanel
    ]}>
      <View style={styles.utilitiesContainer}>
        {/* Left Side - History Controls */}
        <View style={styles.utilitySection}>
          <Text style={styles.utilityLabel}>History</Text>
          <HistoryControls />
        </View>

        {/* Right Side - Game Actions */}
        <View style={styles.utilitySection}>
          <Text style={styles.utilityLabel}>Actions</Text>
          <View style={styles.actionsContainer}>
            <ResignButton />
            {isSinglePlayerMode && <EndgameButton />}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    paddingHorizontal: 24,
    paddingVertical: 20,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  topPanel: {
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    marginTop: 0,
  },
  utilitiesContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 24,
  },
  utilitySection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  utilityLabel: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'SpaceMono-Regular',
    letterSpacing: 1.0,
    color: '#D1D5DB',
    marginBottom: 12,
  },
  actionsContainer: {
    alignItems: 'center',
    width: '100%',
  },
});
