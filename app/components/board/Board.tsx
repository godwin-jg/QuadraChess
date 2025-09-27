import { useLocalSearchParams } from "expo-router";
import React, { useMemo } from "react";
import { Alert, Text, View, useWindowDimensions } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { useSettings } from "../../../context/SettingsContext";
import onlineGameService from "../../../services/onlineGameService";
import p2pGameService from "../../../services/p2pGameService";
import {
  deselectPiece,
  makeMove,
  selectPiece,
  sendMoveToServer,
} from "../../../state/gameSlice";
import { RootState } from "../../../state/store";
import networkService from "../../services/networkService";
import { getBoardTheme } from "./BoardThemeConfig";
import Square from "./Square";

// 4-player chess piece codes:
// y = yellow, r = red, b = blue, g = green
// R = Rook, N = Knight, B = Bishop, Q = Queen, K = King, P = Pawn

export default function Board() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width * 0.98, 600); // Max 600px or 98% of screen width
  const squareSize = boardSize / 14;
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { settings } = useSettings();
  const boardTheme = getBoardTheme(settings);
  
  // Use solo mode from settings if enabled, otherwise use the route mode
  const effectiveMode = settings.developer.soloMode ? "solo" : mode;

  // Get granular pieces of state - only re-render when specific data changes
  const history = useSelector((state: RootState) => state.game.history);
  const viewingHistoryIndex = useSelector((state: RootState) => state.game.viewingHistoryIndex);
  const boardState = useSelector((state: RootState) => state.game.boardState);
  const selectedPiece = useSelector((state: RootState) => state.game.selectedPiece);
  const validMoves = useSelector((state: RootState) => state.game.validMoves);
  const checkStatus = useSelector((state: RootState) => state.game.checkStatus);
  const eliminatedPlayers = useSelector((state: RootState) => state.game.eliminatedPlayers);
  const currentPlayerTurn = useSelector((state: RootState) => state.game.currentPlayerTurn);
  const players = useSelector((state: RootState) => state.game.players);

  // Create displayed game state (either live or historical)
  const displayedGameState = useMemo(() => {
    // If we are in "review mode" and the index is valid...
    if (viewingHistoryIndex !== null && viewingHistoryIndex < history.length && history[viewingHistoryIndex]) {
      return history[viewingHistoryIndex]; // ...show the historical state.
    }
    // ...otherwise, show the live game state composed from individual selectors
    return {
      boardState,
      selectedPiece,
      validMoves,
      checkStatus,
      eliminatedPlayers,
      currentPlayerTurn,
      players,
      history,
      viewingHistoryIndex
    };
  }, [history, viewingHistoryIndex, boardState, selectedPiece, validMoves, checkStatus, eliminatedPlayers, currentPlayerTurn, players]);

  // Get dispatch function
  const dispatch = useDispatch();

  // Helper function to get move type for a square
  const getMoveType = (row: number, col: number): "move" | "capture" | null => {
    const move = validMoves.find(
      (move) => move.row === row && move.col === col
    );
    if (!move) return null;
    return move.isCapture ? "capture" : "move";
  };

  // Get the selected piece color for capture highlighting
  const getSelectedPieceColor = () => {
    if (!selectedPiece) return null;
    const piece = boardState[selectedPiece.row][selectedPiece.col];
    return piece ? piece[0] : null;
  };

  // Check if a piece belongs to an eliminated player
  const isPieceEliminated = (piece: string | null) => {
    if (!piece) return false;
    const pieceColor = piece[0];
    return eliminatedPlayers.includes(pieceColor);
  };

  // Check if we're viewing history (not at the live game state)
  const isViewingHistory = viewingHistoryIndex !== null && viewingHistoryIndex < history.length - 1;

  // Handle square press
  const handleSquarePress = async (row: number, col: number) => {
    // If we're viewing history, don't allow any moves
    if (isViewingHistory) {
      console.log("Cannot make moves while viewing history");
      return;
    }

    const pieceCode = boardState[row][col];
    const isAValidMove = validMoves.some(
      (move) => move.row === row && move.col === col
    );

    // Check if the pressed square is the currently selected piece
    const isSelectedPiece =
      selectedPiece && selectedPiece.row === row && selectedPiece.col === col;

    // If pressing the same selected piece again, deselect it (handled in Redux reducer)
    if (isSelectedPiece) {
      dispatch(selectPiece({ row, col })); // This will deselect since it's the same piece
      return;
    }

    // If a piece is selected AND the pressed square is a valid move
    if (selectedPiece && isAValidMove) {
      const pieceToMove = boardState[selectedPiece.row][selectedPiece.col];
      const pieceColor = pieceToMove?.charAt(0);

      const moveData = {
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col },
        pieceCode: pieceToMove!,
        playerColor: pieceColor!,
      };

      // Handle different game modes

      if (effectiveMode === "online") {
        console.log(
          "Board: Online mode - isConnected:",
          onlineGameService.isConnected,
          "currentGameId:",
          onlineGameService.currentGameId
        );
        if (onlineGameService.isConnected && onlineGameService.currentGameId) {
          // Online multiplayer mode
          try {
            console.log("Board: Sending move to online service:", moveData);
            await onlineGameService.makeMove(moveData);
          } catch (error) {
            console.error("Failed to make online move:", error);
            // FIX: Inform the user about the failed move
            Alert.alert(
              "Move Failed",
              "Your move could not be sent to the server. Please check your connection and try again."
            );
          }
        } else {
          console.log(
            "Board: Online service not connected, falling back to local move"
          );
          // Fallback to local move if online service is not connected
          dispatch(makeMove({ row, col }));
        }
      } else if (effectiveMode === "p2p") {
        console.log(
          "Board: P2P mode - isConnected:",
          p2pGameService.isConnected,
          "currentGameId:",
          p2pGameService.currentGameId
        );
        if (p2pGameService.isConnected && p2pGameService.currentGameId) {
          // P2P multiplayer mode
          try {
            console.log("Board: Sending move to P2P service:", moveData);
            await p2pGameService.makeMove(moveData);
          } catch (error) {
            console.error("Failed to make P2P move:", error);
            // FIX: Inform the user about the failed move
            Alert.alert(
              "Move Failed",
              "Your move could not be sent to the other player. Please check your connection and try again."
            );
          }
        } else {
          console.log(
            "Board: P2P service not connected, falling back to local move"
          );
          // Fallback to local move if P2P service is not connected
          dispatch(makeMove({ row, col }));
        }
      } else if (networkService.connected && networkService.roomId) {
        // Local multiplayer mode
        dispatch(sendMoveToServer({ row, col }));
      } else {
        // Single player mode
        dispatch(makeMove({ row, col }));
      }
    } else {
      // If clicking on empty square and a piece is selected, deselect it
      if (!pieceCode && selectedPiece) {
        dispatch(deselectPiece());
        return;
      }

      // Otherwise, just try to select the piece on the pressed square
      dispatch(selectPiece({ row, col }));
    }
  };

  // Safety check for null boardState
  if (!boardState || !Array.isArray(boardState)) {
    return (
      <View
        style={{
          width: boardSize,
          height: boardSize,
          alignSelf: "center",
          marginTop: 20,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <Text className="text-white text-lg">Loading game...</Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: boardSize,
        height: boardSize,
        alignSelf: "center",
        marginTop: 20,
      }}
    >
      {boardState.map((row, rowIndex) => {
        // Skip null rows (buffer rows in 4-player chess)
        if (!row || !Array.isArray(row)) {
          return (
            <View
              key={rowIndex}
              style={{ flexDirection: "row", height: squareSize }}
            >
              {Array.from({ length: 14 }, (_, colIndex) => (
                <View
                  key={`${rowIndex}-${colIndex}`}
                  style={{
                    width: squareSize,
                    height: squareSize,
                    backgroundColor:
                      (rowIndex + colIndex) % 2 === 0
                        ? boardTheme.lightSquare
                        : boardTheme.darkSquare,
                  }}
                />
              ))}
            </View>
          );
        }

        return (
          <View key={rowIndex} style={{ flexDirection: "row" }}>
            {row.map((piece, colIndex) => {
              const isLight = (rowIndex + colIndex) % 2 === 0;
              return (
                <Square
                  key={`${rowIndex}-${colIndex}`}
                  piece={piece}
                  color={isLight ? "light" : "dark"}
                  size={squareSize}
                  row={rowIndex}
                  col={colIndex}
                  onPress={() => handleSquarePress(rowIndex, colIndex)}
                  isSelected={
                    selectedPiece?.row === rowIndex &&
                    selectedPiece?.col === colIndex
                  }
                  moveType={getMoveType(rowIndex, colIndex)}
                  capturingPieceColor={getSelectedPieceColor() || undefined}
                  isInCheck={
                    !!(
                      piece &&
                      piece[1] === "K" &&
                      checkStatus[piece[0] as keyof typeof checkStatus]
                    )
                  }
                  isEliminated={isPieceEliminated(piece)}
                  boardTheme={boardTheme}
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
