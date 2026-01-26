import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../../state";
import HistoryControls from "./HistoryControls";
import ResignButton from "./ResignButton";
import EndgameButton from "./EndgameButton";

export default function GameUtilityPanel() {
  const { gameMode } = useSelector((state: RootState) => state.game);
  const isSinglePlayerMode = gameMode === "solo" || gameMode === "single";

  return (
    <View style={styles.panel}>
      <View style={styles.utilitiesContainer}>
        {/* History Section */}
        <View style={styles.utilitySection}>
          <Text style={styles.utilityLabel}>History</Text>
          <HistoryControls />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions Section */}
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
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopWidth: 0,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 12,
    marginTop: 0,
  },
  utilitiesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  utilitySection: {
    flex: 1,
    alignItems: 'center',
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'stretch',
    marginHorizontal: 12,
  },
  utilityLabel: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1.0,
    color: '#9CA3AF',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  actionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    minHeight: 80,
  },
});
