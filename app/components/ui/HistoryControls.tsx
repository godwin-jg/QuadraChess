import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import {
  stepHistory,
  returnToLive,
  selectIsViewingHistory,
} from "../../../state/gameSlice";
import { useLocalSearchParams } from "expo-router";

export default function HistoryControls() {
  const dispatch = useDispatch();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { history, viewingHistoryIndex } = useSelector(
    (state: RootState) => state.game
  );
  const isViewingHistory = useSelector(selectIsViewingHistory);
  const totalMoves = Math.max(0, history.length - 1); // Subtract 1 because history[0] is initial state
  const currentMoveNumber = isViewingHistory
    ? viewingHistoryIndex || 0
    : totalMoves;

  // Only show history controls in local mode
  if (mode === "online") {
    return null;
  }

  const handleStepBack = () => {
    if (viewingHistoryIndex !== null && viewingHistoryIndex > 0) {
      dispatch(stepHistory("back"));
    }
  };

  const handleStepForward = () => {
    if (
      viewingHistoryIndex === null ||
      viewingHistoryIndex < history.length - 1
    ) {
      dispatch(stepHistory("forward"));
    }
  };

  const handleReturnToLive = () => {
    if (viewingHistoryIndex !== null) {
      dispatch(returnToLive());
    }
  };

  return (
    <View className="bg-black/80 rounded-xl p-3 m-4 items-center">
      <View className="flex-row gap-2">
        <TouchableOpacity
          className="w-10 h-10 bg-gray-700 rounded-lg justify-center items-center"
          onPress={handleStepBack}
          activeOpacity={1}
        >
          <Text className="text-white text-lg font-bold">←</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-10 h-10 bg-gray-700 rounded-lg justify-center items-center"
          onPress={handleStepForward}
          activeOpacity={1}
        >
          <Text className="text-white text-lg font-bold">→</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className="w-10 h-10 bg-gray-700 rounded-lg justify-center items-center"
          onPress={handleReturnToLive}
          activeOpacity={1}
        >
          <Text className="text-white text-lg font-bold">»</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-white text-sm mt-2 text-center">
        Move {currentMoveNumber} of {totalMoves}
        {isViewingHistory && (
          <Text className="text-yellow-400 font-semibold">
            {" "}
            • VIEWING HISTORY
          </Text>
        )}
      </Text>
    </View>
  );
}
