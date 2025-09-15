import React from "react";
import { View, useWindowDimensions } from "react-native";
import { useSelector, useDispatch } from "react-redux";
import { RootState } from "../../state/store";
import { selectPiece, makeMove } from "../../state/gameSlice";
import { MoveInfo } from "../../logic";
import Square from "./Square";

// 4-player chess piece codes:
// y = yellow, r = red, b = blue, g = green
// R = Rook, N = Knight, B = Bishop, Q = Queen, K = King, P = Pawn

export default function Board() {
  const { width } = useWindowDimensions();
  const boardSize = Math.min(width * 0.98, 600); // Max 600px or 98% of screen width
  const squareSize = boardSize / 14;

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
  const handleSquarePress = (row: number, col: number) => {
    const isAValidMove = validMoves.some(
      (move) => move.row === row && move.col === col
    );

    // Check if the pressed square is the currently selected piece
    const isSelectedPiece =
      selectedPiece && selectedPiece.row === row && selectedPiece.col === col;

    // If pressing the same selected piece again, deselect it
    if (isSelectedPiece) {
      dispatch(selectPiece({ row, col })); // This will deselect since it's the same piece
      return;
    }

    // If a piece is selected AND the pressed square is a valid move
    if (selectedPiece && isAValidMove) {
      dispatch(makeMove({ row, col }));
    } else {
      // Otherwise, just try to select the piece on the pressed square
      dispatch(selectPiece({ row, col }));
    }
  };

  return (
    <View
      style={{
        width: boardSize,
        height: boardSize,
        alignSelf: "center",
        marginTop: 20,
      }}
    >
      {boardState.map((row, rowIndex) => (
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
      ))}
    </View>
  );
}
