import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../state";
import { stepHistory, returnToLive } from "../../state/gameSlice";

export default function HistoryControls() {
  const dispatch = useDispatch();
  const { history, historyIndex } = useSelector(
    (state: RootState) => state.game
  );

  const isViewingHistory = historyIndex < history.length - 1;

  const handleStepBack = () => {
    if (historyIndex > 0) {
      dispatch(stepHistory("back"));
    }
  };

  const handleStepForward = () => {
    if (historyIndex < history.length - 1) {
      dispatch(stepHistory("forward"));
    }
  };

  const handleReturnToLive = () => {
    if (historyIndex < history.length - 1) {
      dispatch(returnToLive());
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.button}
          onPress={handleStepBack}
          activeOpacity={1}
        >
          <Text style={styles.buttonText}>←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleStepForward}
          activeOpacity={1}
        >
          <Text style={styles.buttonText}>→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.button}
          onPress={handleReturnToLive}
          activeOpacity={1}
        >
          <Text style={styles.buttonText}>»</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.historyInfo}>
        Move {historyIndex + 1} of {history.length}
        {isViewingHistory && (
          <Text style={styles.historyModeText}> • VIEWING HISTORY</Text>
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    borderRadius: 12,
    padding: 12,
    margin: 16,
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  button: {
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    borderRadius: 20,
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  buttonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "normal",
  },
  historyInfo: {
    color: "#D1D5DB",
    fontSize: 12,
    marginTop: 8,
    fontWeight: "500",
  },
  historyModeText: {
    color: "#F59E0B",
    fontWeight: "bold",
  },
});
