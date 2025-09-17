import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state";
import { stepHistory, returnToLive } from "../../../state/gameSlice";

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
        Move {historyIndex + 1} of {history.length}
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
