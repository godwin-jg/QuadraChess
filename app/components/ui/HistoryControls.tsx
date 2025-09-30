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
import { hapticsService } from "../../../services/hapticsService";

export default function HistoryControls() {
  const dispatch = useDispatch();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { history, viewingHistoryIndex } = useSelector(
    (state: RootState) => state.game
  );
  const isViewingHistory = useSelector(selectIsViewingHistory);
  const totalMoves = Math.max(0, history.length); // Total number of moves made
  const currentMoveNumber = isViewingHistory
    ? (viewingHistoryIndex || 0) + 1  // Convert 0-based index to 1-based display
    : totalMoves;

  // Only show history controls in local mode
  if (mode === "online") {
    return null;
  }

  const canStepBack = true; // Always enabled - can go to first move or back to live state
  const canStepPrevious = viewingHistoryIndex === null || (viewingHistoryIndex !== null && viewingHistoryIndex > 0); // Can go back from live state or if not at first move
  const canStepForward = viewingHistoryIndex !== null && viewingHistoryIndex < history.length - 1;
  const canReturnToLive = viewingHistoryIndex !== null;

  // Debug logging
  console.log('HistoryControls Debug:', {
    viewingHistoryIndex,
    isViewingHistory,
    totalMoves,
    currentMoveNumber,
    canStepBack,
    canStepPrevious,
    canStepForward,
    canReturnToLive,
    historyLength: history.length
  });

  const handleStepBack = () => {
    if (canStepBack) {
      hapticsService.selection();
      dispatch(stepHistory("back"));
    }
  };

  const handleStepPrevious = () => {
    if (canStepPrevious) {
      hapticsService.selection();
      dispatch(stepHistory("previous"));
    }
  };

  const handleStepForward = () => {
    if (canStepForward) {
      hapticsService.selection();
      dispatch(stepHistory("forward"));
    }
  };

  const handleReturnToLive = () => {
    if (canReturnToLive) {
      hapticsService.selection();
      dispatch(returnToLive());
    }
  };

  return (
    <View className="items-center">
      <View className="flex-row gap-2">
        <TouchableOpacity
          className={`w-12 h-10 rounded-lg justify-center items-center ${
            canStepBack ? "bg-gray-700" : "bg-gray-500"
          }`}
          onPress={handleStepBack}
          activeOpacity={canStepBack ? 0.7 : 1}
          disabled={!canStepBack}
        >
          <Text className={`text-lg font-bold ${canStepBack ? "text-white" : "text-gray-300"}`}>«</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`w-12 h-10 rounded-lg justify-center items-center ${
            canStepPrevious ? "bg-gray-700" : "bg-gray-500"
          }`}
          onPress={handleStepPrevious}
          activeOpacity={canStepPrevious ? 0.7 : 1}
          disabled={!canStepPrevious}
        >
          <Text className={`text-lg font-bold ${canStepPrevious ? "text-white" : "text-gray-300"}`}>◀</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`w-12 h-10 rounded-lg justify-center items-center ${
            canStepForward ? "bg-gray-700" : "bg-gray-500"
          }`}
          onPress={handleStepForward}
          activeOpacity={canStepForward ? 0.7 : 1}
          disabled={!canStepForward}
        >
          <Text className={`text-lg font-bold ${canStepForward ? "text-white" : "text-gray-300"}`}>▶</Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`w-12 h-10 rounded-lg justify-center items-center ${
            canReturnToLive ? "bg-gray-700" : "bg-gray-500"
          }`}
          onPress={handleReturnToLive}
          activeOpacity={canReturnToLive ? 0.7 : 1}
          disabled={!canReturnToLive}
        >
          <Text className={`text-lg font-bold ${canReturnToLive ? "text-white" : "text-gray-300"}`}>»</Text>
        </TouchableOpacity>
      </View>
      
      <View className="flex-row gap-2 mt-1">
        <Text className="text-xs text-gray-400 w-12 text-center">Start</Text>
        <Text className="text-xs text-gray-400 w-12 text-center">Back</Text>
        <Text className="text-xs text-gray-400 w-12 text-center">Forward</Text>
        <Text className="text-xs text-gray-400 w-12 text-center">Live</Text>
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
