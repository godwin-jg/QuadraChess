import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSelector } from "react-redux";
import { RootState } from "../../../state";
import HistoryControls from "./HistoryControls";
import ResignButton from "./ResignButton";
import EndgameButton from "./EndgameButton";
import { sw, sh, sf, isCompact } from "../../utils/responsive";

interface GameUtilityPanelProps {
  textScale?: number;
}

export default function GameUtilityPanel({ textScale = 1 }: GameUtilityPanelProps) {
  const { gameMode } = useSelector((state: RootState) => state.game);
  const isSinglePlayerMode = gameMode === "solo" || gameMode === "single";
  const clampedTextScale = Math.min(1.2, Math.max(1, textScale));
  const labelFontSize = sf(isCompact ? 11 : 13) * clampedTextScale;

  return (
    <View style={styles.panel}>
      <View style={styles.utilitiesContainer}>
        {/* History Section */}
        <View style={styles.utilitySection}>
          <Text style={[styles.utilityLabel, { fontSize: labelFontSize }]}>History</Text>
          <HistoryControls textScale={clampedTextScale} />
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Actions Section */}
        <View style={styles.utilitySection}>
          <Text style={[styles.utilityLabel, { fontSize: labelFontSize }]}>Actions</Text>
          <View style={styles.actionsContainer}>
            <ResignButton textScale={clampedTextScale} />
            {isSinglePlayerMode && <EndgameButton textScale={clampedTextScale} />}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderTopWidth: 0,
    borderBottomLeftRadius: sw(isCompact ? 12 : 16),
    borderBottomRightRadius: sw(isCompact ? 12 : 16),
    paddingHorizontal: sw(isCompact ? 10 : 16),
    paddingVertical: sh(isCompact ? 10 : 12),
    marginHorizontal: sw(isCompact ? 8 : 12),
    marginTop: 0,
    flexShrink: 1,
    maxHeight: "100%",
  },
  utilitiesContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  utilitySection: {
    flex: 1,
    alignItems: 'center',
    minWidth: 0,
  },
  divider: {
    width: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignSelf: 'stretch',
    marginHorizontal: sw(isCompact ? 6 : 10),
  },
  utilityLabel: {
    fontSize: sf(isCompact ? 11 : 13),
    fontWeight: '600',
    letterSpacing: isCompact ? 0.8 : 1.0,
    color: '#9CA3AF',
    marginBottom: sh(isCompact ? 4 : 6),
    textTransform: 'uppercase',
  },
  actionsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: sh(isCompact ? 6 : 10),
    minHeight: sh(isCompact ? 58 : 68),
  },
});
