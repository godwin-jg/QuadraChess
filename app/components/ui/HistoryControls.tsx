import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { stepHistory, returnToLive, selectIsViewingHistory } from "../../../state/gameSlice";
import { hapticsService } from "../../../services/hapticsService";

export default function HistoryControls() {
  const dispatch = useDispatch();
  const { history, viewingHistoryIndex } = useSelector((state: RootState) => state.game);
  const isViewingHistory = useSelector(selectIsViewingHistory);
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
      <Text style={styles.moveCounter}>Move {currentMoveNumber} of {totalMoves}</Text>
      <View style={styles.buttonsRow}>
        {buttons.map(({ label, symbol, enabled, action }) => (
          <TouchableOpacity
            key={label}
            style={[styles.button, enabled ? styles.buttonEnabled : styles.buttonDisabled]}
            onPress={() => { if (enabled) { hapticsService.selection(); action(); } }}
            activeOpacity={enabled ? 0.7 : 1}
            disabled={!enabled}
          >
            <Text style={[styles.buttonText, enabled ? styles.textEnabled : styles.textDisabled]}>{symbol}</Text>
            <Text style={[styles.labelText, enabled ? styles.textEnabled : styles.textDisabled]}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    alignItems: 'center',
    gap: 8,
  },
  moveCounter: { 
    fontSize: 13, 
    color: '#D1D5DB', 
    fontWeight: '500', 
    textAlign: 'center',
  },
  buttonsRow: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    gap: 6,
  },
  button: { 
    width: 44, 
    height: 44, 
    borderRadius: 8, 
    justifyContent: 'center', 
    alignItems: 'center',
  },
  buttonEnabled: { backgroundColor: '#374151' },
  buttonDisabled: { backgroundColor: '#4B5563' },
  buttonText: { 
    fontSize: 16, 
    fontWeight: '700',
    marginBottom: 2,
  },
  labelText: {
    fontSize: 9,
    fontWeight: '600',
  },
  textEnabled: { color: '#FFFFFF' },
  textDisabled: { color: '#9CA3AF' },
});
