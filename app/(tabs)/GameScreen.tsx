import { View, Text } from "@/components/Themed";
import { useSelector, useDispatch } from "react-redux";
import { RootState, resetGame, completePromotion } from "../state";
import Board from "../components/board/Board";
import GameOverModal from "../components/ui/GameOverModal";
import GameNotification from "../components/ui/GameNotification";
import PlayerInfoPod from "../components/ui/PlayerInfoPod";
import PromotionModal from "../components/ui/PromotionModal";
import HistoryControls from "../components/ui/HistoryControls";
import GameMenu from "../components/ui/GameMenu";

export default function GameScreen() {
  // Get dispatch function
  const dispatch = useDispatch();

  // Get game state from Redux store
  const currentPlayerTurn = useSelector(
    (state: RootState) => state.game.currentPlayerTurn
  );
  const gameStatus = useSelector((state: RootState) => state.game.gameStatus);
  const winner = useSelector((state: RootState) => state.game.winner);
  const capturedPieces = useSelector(
    (state: RootState) => state.game.capturedPieces
  );
  const scores = useSelector((state: RootState) => state.game.scores);
  const promotionState = useSelector(
    (state: RootState) => state.game.promotionState
  );
  const justEliminated = useSelector(
    (state: RootState) => state.game.justEliminated
  );

  // Helper function to get player name
  const getPlayerName = (playerColor: string) => {
    switch (playerColor) {
      case "r":
        return "Red";
      case "b":
        return "Blue";
      case "y":
        return "Yellow";
      case "g":
        return "Green";
      default:
        return "Unknown";
    }
  };

  // Determine notification message
  const getNotificationMessage = () => {
    if (gameStatus === "checkmate" && justEliminated) {
      return `Checkmate! ${getPlayerName(justEliminated)} has been eliminated!`;
    }
    if (gameStatus === "stalemate" && justEliminated) {
      return `Stalemate! ${getPlayerName(justEliminated)} has been eliminated!`;
    }
    return "";
  };

  // Create player data for the pods
  const players = [
    {
      name: getPlayerName("r"),
      color: "r",
      score: scores.r,
      capturedPieces: capturedPieces.r,
      isCurrentTurn: currentPlayerTurn === "r",
    },
    {
      name: getPlayerName("b"),
      color: "b",
      score: scores.b,
      capturedPieces: capturedPieces.b,
      isCurrentTurn: currentPlayerTurn === "b",
    },
    {
      name: getPlayerName("y"),
      color: "y",
      score: scores.y,
      capturedPieces: capturedPieces.y,
      isCurrentTurn: currentPlayerTurn === "y",
    },
    {
      name: getPlayerName("g"),
      color: "g",
      score: scores.g,
      capturedPieces: capturedPieces.g,
      isCurrentTurn: currentPlayerTurn === "g",
    },
  ];

  return (
    <View className="flex-1 bg-gray-800 justify-center items-center">
      {/* History Controls - Top Center */}
      <View className="absolute top-4 z-10">
        <HistoryControls />
      </View>

      {/* Chess Board - Centered */}
      <Board />

      {/* Game Menu - Bottom Center */}
      <View className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
        <GameMenu />
      </View>

      {/* Player Info Pods - Positioned in corners */}

      {/* Top Left - Yellow Player */}
      <View className="absolute top-4 left-4">
        <PlayerInfoPod
          player={players[2]}
          capturedPieces={players[2].capturedPieces}
          isCurrentTurn={players[2].isCurrentTurn}
        />
      </View>

      {/* Top Right - Green Player */}
      <View className="absolute top-4 right-4">
        <PlayerInfoPod
          player={players[3]}
          capturedPieces={players[3].capturedPieces}
          isCurrentTurn={players[3].isCurrentTurn}
        />
      </View>

      {/* Bottom Left - Blue Player */}
      <View className="absolute bottom-4 left-4">
        <PlayerInfoPod
          player={players[1]}
          capturedPieces={players[1].capturedPieces}
          isCurrentTurn={players[1].isCurrentTurn}
        />
      </View>

      {/* Bottom Right - Red Player */}
      <View className="absolute bottom-4 right-4">
        <PlayerInfoPod
          player={players[0]}
          capturedPieces={players[0].capturedPieces}
          isCurrentTurn={players[0].isCurrentTurn}
        />
      </View>

      {/* Game Notification (for eliminations) */}
      <GameNotification
        message={getNotificationMessage()}
        isVisible={gameStatus === "checkmate" || gameStatus === "stalemate"}
        duration={3000}
      />

      {/* Game Over Modal (only for final winner) */}
      {gameStatus === "finished" && (
        <GameOverModal
          status={gameStatus}
          winner={winner}
          eliminatedPlayer={justEliminated}
          onReset={() => dispatch(resetGame())}
        />
      )}

      {/* Promotion Modal */}
      <PromotionModal
        visible={promotionState.isAwaiting}
        playerColor={promotionState.color || ""}
        onSelectPiece={(pieceType) =>
          dispatch(completePromotion({ pieceType }))
        }
      />
    </View>
  );
}

// Styles removed - using NativeWind classes instead
