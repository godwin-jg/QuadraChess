import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { stepHistory, returnToLive, selectIsViewingHistory } from "../../../state/gameSlice";
import { hapticsService } from "../../../services/hapticsService";
import { sw, sh, sf, isCompact } from "../../utils/responsive";

interface HistoryControlsProps {
  textScale?: number;
}

export default function HistoryControls({ textScale = 1 }: HistoryControlsProps) {
  const dispatch = useDispatch();
  const { history, viewingHistoryIndex } = useSelector((state: RootState) => state.game);
  const isViewingHistory = useSelector(selectIsViewingHistory);
  const clampedTextScale = Math.min(1.15, Math.max(1, textScale));
  const moveCounterSize = sf(c ? 12 : 13) * clampedTextScale;
  const buttonTextSize = sf(c ? 11 : 13) * clampedTextScale;
  const labelTextSize = sf(c ? 6 : 7) * clampedTextScale;
  const totalMoves = Math.max(0, history.length);
  const currentMoveNumber = isViewingHistory ? (viewingHistoryIndex || 0) + 1 : totalMoves;

  // Can only navigate up to n-1 (not the current live position)
  // User must click "Live" to return to current state
  const canStepBack = history.length > 0;
  const canStepPrevious = viewingHistoryIndex === null ? history.length > 0 : viewingHistoryIndex > 0;
  const canStepForward = viewingHistoryIndex !== null && viewingHistoryIndex < history.length - 2;
  const canReturnToLive = viewingHistoryIndex !== null;

  const buttons = [
    { label: "Start", symbol: "«", enabled: canStepBack, action: () => dispatch(stepHistory("back")) },
    { label: "Prev", symbol: "◀", enabled: canStepPrevious, action: () => dispatch(stepHistory("previous")) },
    { label: "Next", symbol: "▶", enabled: canStepForward, action: () => dispatch(stepHistory("forward")) },
    { label: "Live", symbol: "»", enabled: canReturnToLive, action: () => dispatch(returnToLive()) },
  ];

  return (
    <View style={styles.container}>
      <Text style={[styles.moveCounter, { fontSize: moveCounterSize }]}>
        Move {currentMoveNumber} of {totalMoves}
      </Text>
      <View style={styles.buttonsRow}>
        {buttons.map(({ label, symbol, enabled, action }) => (
          <TouchableOpacity
            key={label}
            style={[styles.button, enabled ? styles.buttonEnabled : styles.buttonDisabled]}
            onPress={() => { if (enabled) { hapticsService.selection(); action(); } }}
            activeOpacity={enabled ? 0.7 : 1}
            disabled={!enabled}
            hitSlop={{
              top: CONTROL_HIT_SLOP,
              bottom: CONTROL_HIT_SLOP,
              left: CONTROL_HIT_SLOP,
              right: CONTROL_HIT_SLOP,
            }}
          >
            <Text style={[styles.buttonText, { fontSize: buttonTextSize }, enabled ? styles.textEnabled : styles.textDisabled]}>
              {symbol}
            </Text>
            <Text style={[styles.labelText, { fontSize: labelTextSize }, enabled ? styles.textEnabled : styles.textDisabled]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const c = isCompact;
const CONTROL_BUTTON_SIZE = Math.min(Math.max(sw(c ? 32 : 36), 24), 40);
const CONTROL_BUTTON_RADIUS = Math.min(Math.max(sw(c ? 6 : 8), 5), 10);
const CONTROL_HIT_SLOP = c ? 6 : 8;

const styles = StyleSheet.create({
  container: { 
    alignItems: 'center',
    width: '100%',
    gap: sh(c ? 6 : 8),
  },
  moveCounter: { 
    fontSize: sf(c ? 12 : 13), 
    color: '#D1D5DB', 
    fontWeight: '500', 
    textAlign: 'center',
  },
  buttonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    gap: sw(c ? 2 : 4),
    width: '100%',
  },
  button: { 
    width: CONTROL_BUTTON_SIZE, 
    height: CONTROL_BUTTON_SIZE, 
    borderRadius: CONTROL_BUTTON_RADIUS, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  buttonEnabled: { backgroundColor: '#374151' },
  buttonDisabled: { backgroundColor: '#4B5563' },
  buttonText: { 
    fontSize: sf(c ? 11 : 13), 
    fontWeight: '700',
    marginBottom: sh(c ? 0 : 1),
  },
  labelText: {
    fontSize: sf(c ? 6 : 7),
    fontWeight: '600',
  },
  textEnabled: { color: '#FFFFFF' },
  textDisabled: { color: '#9CA3AF' },
});
