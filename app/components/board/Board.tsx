import React from "react";
import { View, useWindowDimensions, Text } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../../state/store";
import {
  selectPiece,
  makeMove,
  sendMoveToServer,
} from "../../../state/gameSlice";
import networkService from "../../services/networkService";
import onlineGameService from "../../../services/onlineGameService";
import { MoveInfo } from "../../../types";
import Square from "./Square";
import { useLocalSearchParams } from "expo-router";

// 4-player chess piece codes:
// y = yellow, r = red, b = blue, g = green
// R = Rook, N = Knight, B = Bishop, Q = Queen, K = King, P = Pawn

export default function Board() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width * 0.98, 600); // Max 600px or 98% of screen width
  const squareSize = boardSize / 14;
  const { mode } = useLocalSearchParams<{ mode?: string }>();

  // Get board state and selection state from Redux store
  const boardState = useSelector((state: RootState) => state.game.boardState);
  const selectedPiece = useSelector(
    (state: RootState) => state.game.selectedPiece
  );
  const validMoves = useSelector((state: RootState) => state.game.validMoves);
  const checkStatus = useSelector((state: RootState) => state.game.checkStatus);
  const eliminatedPlayers = useSelector(
    (state: RootState) => state.game.eliminatedPlayers
  );
  const currentPlayerTurn = useSelector(
    (state: RootState) => state.game.currentPlayerTurn
  );
  const players = useSelector((state: RootState) => state.game.players);

  // Debug logging
  console.log("Board: currentPlayerTurn:", currentPlayerTurn);
  console.log("Board: players:", players);
  console.log(
    "Board: onlineGameService.currentPlayer:",
    onlineGameService.currentPlayer
  );

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

  // Handle square press
  const handleSquarePress = async (row: number, col: number) => {
    console.log("Board: Square pressed at", row, col);
    console.log("Board: Current selectedPiece:", selectedPiece);
    console.log("Board: Current validMoves count:", validMoves.length);
    console.log("Board: Piece at position:", boardState[row]?.[col]);

    const isAValidMove = validMoves.some(
      (move) => move.row === row && move.col === col
    );

    // Check if the pressed square is the currently selected piece
    const isSelectedPiece =
      selectedPiece && selectedPiece.row === row && selectedPiece.col === col;

    console.log("Board: isAValidMove:", isAValidMove);
    console.log("Board: isSelectedPiece:", isSelectedPiece);

    // If pressing the same selected piece again, deselect it
    if (isSelectedPiece) {
      console.log("Board: Deselecting piece");
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
      console.log("Board: Attempting move in mode:", mode);
      console.log(
        "Board: onlineGameService.isConnected:",
        onlineGameService.isConnected
      );
      console.log(
        "Board: onlineGameService.currentGameId:",
        onlineGameService.currentGameId
      );
      console.log("Board: networkService.connected:", networkService.connected);

      if (mode === "online") {
        if (onlineGameService.isConnected && onlineGameService.currentGameId) {
          // Online multiplayer mode
          console.log("Board: Using online service for move");
          try {
            await onlineGameService.makeMove(moveData);
          } catch (error) {
            console.error("Failed to make online move:", error);
          }
        } else {
          console.log(
            "Board: Online service not connected, falling back to local move"
          );
          // Fallback to local move if online service is not connected
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
      // Otherwise, just try to select the piece on the pressed square
      console.log("Board: Attempting to select piece at", row, col);
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
                      (rowIndex + colIndex) % 2 === 0 ? "#f0d9b5" : "#b58863",
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
                />
              );
            })}
          </View>
        );
      })}
    </View>
  );
}
