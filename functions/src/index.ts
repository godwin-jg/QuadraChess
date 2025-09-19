/**
 * Firebase Cloud Functions for Four Player Chess
 * Server-authoritative game logic and move validation
 * Simplified version for free tier compatibility
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueCreated } from "firebase-functions/v2/database";
import { onSchedule } from "firebase-functions/v2/scheduler";
import * as admin from "firebase-admin";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();

// Complete initial board state for 4-player chess - matches local multiplayer exactly
const initialBoardState = [
  // Row 0: Yellow pieces (top) - King and Queen in correct positions
  [
    null,
    null,
    null,
    "yR",
    "yN",
    "yB",
    "yK",
    "yQ",
    "yB",
    "yN",
    "yR",
    null,
    null,
    null,
  ],
  // Row 1: Yellow pawns
  [
    null,
    null,
    null,
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    "yP",
    null,
    null,
    null,
  ],
  // Row 2: Empty buffer
  [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  // Row 3: Blue pieces (left side) - Rooks and pawns
  [
    "bR",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gR",
  ],
  // Row 4: Blue pieces (left side) - Knights and pawns
  [
    "bN",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gN",
  ],
  // Row 5: Blue pieces (left side) - Bishops and pawns
  [
    "bB",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gB",
  ],
  // Row 6: Blue pieces (left side) - Queen and pawns, Green pieces (right side) - King and pawns
  [
    "bQ",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gK",
  ],
  // Row 7: Blue pieces (left side) - King and pawns, Green pieces (right side) - Queen and pawns
  [
    "bK",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gQ",
  ],
  // Row 8: Blue pieces (left side) - Bishops and pawns
  [
    "bB",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gB",
  ],
  // Row 9: Blue pieces (left side) - Knights and pawns
  [
    "bN",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gN",
  ],
  // Row 10: Blue pieces (left side) - Rooks and pawns
  [
    "bR",
    "bP",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    "gP",
    "gR",
  ],
  // Row 11: Empty buffer
  [
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  // Row 12: Red pieces (bottom) - Pawns
  [
    null,
    null,
    null,
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    "rP",
    null,
    null,
    null,
  ],
  // Row 13: Red pieces (bottom) - King and Queen in correct positions
  [
    null,
    null,
    null,
    "rR",
    "rN",
    "rB",
    "rQ",
    "rK",
    "rB",
    "rN",
    "rR",
    null,
    null,
    null,
  ],
];

/**
 * Function 1: Securely Create Games
 * This function creates a new game with a secure, server-generated
 * initial state
 */
export const createGame = onCall(async (request) => {
  // 1. Ensure the user is authenticated
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to create a game."
    );
  }

  const playerName = request.data.playerName || "Anonymous";
  const uid = request.auth.uid;

  try {
    // 2. Securely generate the initial game state on the server
    // Flatten the board state to prevent Firebase from converting arrays to objects
    const flattenedBoardState = initialBoardState.map((row) =>
      row.map((cell) => (cell === null ? "" : cell))
    );
    console.log(
      "Creating game with flattened board state:",
      JSON.stringify(flattenedBoardState, null, 2)
    );
    const newGameState = {
      boardState: flattenedBoardState,
      currentPlayerTurn: "r", // Red starts first
      gameStatus: "waiting",
      selectedPiece: null,
      validMoves: [],
      capturedPieces: { r: [], b: [], y: [], g: [] },
      checkStatus: { r: false, b: false, y: false, g: false },
      winner: null,
      eliminatedPlayers: [],
      justEliminated: null,
      scores: { r: 0, b: 0, y: 0, g: 0 },
      promotionState: { isAwaiting: false, position: null, color: null },
      hasMoved: {
        rK: false,
        rR1: false,
        rR2: false,
        bK: false,
        bR1: false,
        bR2: false,
        yK: false,
        yR1: false,
        yR2: false,
        gK: false,
        gR1: false,
        gR2: false,
      },
      enPassantTargets: [],
      gameOverState: {
        isGameOver: false,
        status: null,
        eliminatedPlayer: null,
      },
      history: [],
      historyIndex: 0,
      players: [],
      isHost: true,
      canStartGame: false,
    };

    const hostPlayer = {
      id: uid,
      name: playerName,
      color: "r", // Red starts first
      isHost: true,
      isOnline: true,
      lastSeen: Date.now(),
    };

    const gameData = {
      id: "", // Will be set by Firebase
      hostId: uid,
      hostName: playerName,
      players: { [uid]: hostPlayer },
      gameState: newGameState,
      status: "waiting",
      createdAt: admin.database.ServerValue.TIMESTAMP,
      maxPlayers: 4,
      currentPlayerTurn: "r",
      winner: null,
      lastMove: null,
      lastActivity: Date.now(),
    };

    // 3. Push the new game to the database
    const gameRef = await db.ref("games").push(gameData);
    const gameId = gameRef.key as string;

    // Update the game with its ID
    await gameRef.update({ id: gameId });

    console.log(`Game created successfully: ${gameId} by ${playerName}`);

    // 4. Return the new Game ID to the client
    return { gameId };
  } catch (error) {
    console.error("Error creating game:", error);
    throw new HttpsError("internal", "Failed to create game");
  }
});

/**
 * Function 2: The "Referee" for Making Moves
 * This function validates moves and updates game state authoritatively
 * Simplified version that accepts all moves for now
 */
/**
 * Function 6: Handle player leaving a game
 * This function removes a player from a game and cleans up if the game becomes empty
 */
export const leaveGame = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to leave a game."
    );
  }

  const { gameId } = request.data;
  if (!gameId) {
    throw new HttpsError("invalid-argument", "Game ID is required");
  }

  try {
    const uid = request.auth.uid;
    const gameRef = db.ref(`games/${gameId}`);

    await gameRef.transaction((gameData) => {
      if (gameData === null) {
        console.warn(`Game ${gameId} not found`);
        return null;
      }

      // Remove the player from the game
      if (gameData.players && gameData.players[uid]) {
        delete gameData.players[uid];
        console.log(`Player ${uid} removed from game ${gameId}`);
      }

      // If no players left, mark game for deletion
      if (!gameData.players || Object.keys(gameData.players).length === 0) {
        console.log(`Game ${gameId} is now empty, marking for deletion`);
        return null; // This will delete the game
      }

      return gameData;
    });

    console.log(`Player ${uid} successfully left game ${gameId}`);
    return { success: true, message: "Successfully left the game" };
  } catch (error) {
    console.error("Error leaving game:", error);
    throw new HttpsError("internal", "Failed to leave game");
  }
});

export const makeMove = onValueCreated(
  "/move-requests/{gameId}/{moveId}",
  async (event) => {
    const { gameId } = event.params;
    const moveData = event.data.val();
    const uid = event.data.val().playerId || "anonymous";

    if (!uid) {
      console.warn(`Unauthenticated move request for game ${gameId}`);
      return event.data.ref.remove();
    }

    const gameRef = db.ref(`games/${gameId}`);

    try {
      await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }

        const player = gameData.players[uid];
        if (!player || player.color !== gameData.gameState.currentPlayerTurn) {
          console.warn(
            `Not player's turn: ${uid} vs ${gameData.gameState.currentPlayerTurn}`
          );
          return;
        }

        if (!moveData.from || !moveData.to || !moveData.pieceCode) {
          console.warn(`Invalid move data from ${uid}:`, moveData);
          return;
        }

        const newBoardState = [...gameData.gameState.boardState];
        const piece = newBoardState[moveData.from.row][moveData.from.col];
        newBoardState[moveData.from.row][moveData.from.col] = ""; // Use empty string for flattened state
        newBoardState[moveData.to.row][moveData.to.col] = piece;

        gameData.gameState.boardState = newBoardState;

        const turnOrder = ["r", "b", "y", "g"];
        const currentIndex = turnOrder.indexOf(
          gameData.gameState.currentPlayerTurn
        );
        const nextIndex = (currentIndex + 1) % 4;
        gameData.gameState.currentPlayerTurn = turnOrder[nextIndex];

        gameData.currentPlayerTurn = gameData.gameState.currentPlayerTurn;
        gameData.lastMove = {
          ...moveData,
          playerId: uid,
          playerColor: player.color,
          timestamp: Date.now(),
          moveNumber: (gameData.lastMove?.moveNumber || 0) + 1,
        };
        gameData.lastActivity = Date.now();

        console.log(`Move processed successfully for game ${gameId} by ${uid}`);

        return gameData;
      });

      return event.data.ref.remove();
    } catch (error) {
      console.error(`Error processing move for game ${gameId}:`, error);
      return event.data.ref.remove();
    }
  }
);

/**
 * Function 3: Simple test function to verify Cloud Functions are working
 * This is free-tier friendly and helps verify deployment
 */
export const testFunction = onCall(async (request) => {
  return {
    message: "Firebase Cloud Functions are working!",
    timestamp: new Date().toISOString(),
    userId: request.auth?.uid || "anonymous",
    version: "1.0.0",
  };
});

/**
 * Function 3: Fix Board State for Existing Games
 * This function updates the board state of an existing game to the correct layout
 */
export const fixBoardState = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to fix board state."
    );
  }

  const { gameId } = request.data;
  if (!gameId) {
    throw new HttpsError("invalid-argument", "Game ID is required");
  }

  try {
    const gameRef = db.ref(`games/${gameId}`);
    const gameSnapshot = await gameRef.once("value");

    if (!gameSnapshot.exists()) {
      throw new HttpsError("not-found", "Game not found");
    }

    // const gameData = gameSnapshot.val(); // Not needed for this operation

    // Update the board state to the correct layout
    await gameRef.update({
      "gameState/boardState": initialBoardState,
      "gameState/history": [],
      "gameState/historyIndex": 0,
      "gameState/currentPlayerTurn": "r",
      "gameState/gameStatus": "waiting",
    });

    console.log(`Board state fixed for game ${gameId}`);
    return { success: true, message: "Board state updated successfully" };
  } catch (error) {
    console.error("Error fixing board state:", error);
    throw new HttpsError("internal", "Failed to fix board state");
  }
});

/**
 * Function 4: Clean up empty games
 * This function removes games that have no players
 */
export const cleanupEmptyGames = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to cleanup games."
    );
  }

  try {
    const gamesRef = db.ref("games");
    const snapshot = await gamesRef.once("value");

    if (!snapshot.exists()) {
      return { message: "No games found", cleaned: 0 };
    }

    let cleanedCount = 0;
    const updates: { [key: string]: null } = {};

    snapshot.forEach((gameSnapshot) => {
      const gameData = gameSnapshot.val();
      const gameId = gameSnapshot.key;

      // Check if game has no players or empty players object
      if (!gameData.players || Object.keys(gameData.players).length === 0) {
        console.log(`Removing empty game: ${gameId}`);
        updates[gameId] = null;
        cleanedCount++;
      }
    });

    // Remove empty games in batch
    if (cleanedCount > 0) {
      await gamesRef.update(updates);
      console.log(`Cleaned up ${cleanedCount} empty games`);
    }

    return {
      message: `Cleaned up ${cleanedCount} empty games`,
      cleaned: cleanedCount,
    };
  } catch (error) {
    console.error("Error cleaning up empty games:", error);
    throw new HttpsError("internal", "Failed to cleanup empty games");
  }
});

/**
 * Function 5: Scheduled cleanup of abandoned games
 * This runs periodically to clean up games with no active players
 */
export const scheduledCleanup = onSchedule("every 5 minutes", async (event) => {
  try {
    console.log("Running scheduled game cleanup...");

    const gamesRef = db.ref("games");
    const snapshot = await gamesRef.once("value");

    if (!snapshot.exists()) {
      console.log("No games found for cleanup");
      return;
    }

    const now = Date.now();
    const fiveMinutesAgo = now - 5 * 60 * 1000; // 5 minutes ago
    let cleanedCount = 0;
    const updates: { [key: string]: null } = {};

    snapshot.forEach((gameSnapshot) => {
      const gameData = gameSnapshot.val();
      const gameId = gameSnapshot.key;

      // Check if game has no players
      if (!gameData.players || Object.keys(gameData.players).length === 0) {
        console.log(`Scheduled cleanup: Removing empty game ${gameId}`);
        updates[gameId] = null;
        cleanedCount++;
        return;
      }

      // Check if all players have been offline for more than 5 minutes
      const players = gameData.players;
      const allPlayersOffline = Object.values(players).every((player: any) => {
        return (
          !player.isOnline ||
          (player.lastSeen && player.lastSeen < fiveMinutesAgo)
        );
      });

      if (allPlayersOffline) {
        console.log(`Scheduled cleanup: Removing abandoned game ${gameId}`);
        updates[gameId] = null;
        cleanedCount++;
      }
    });

    // Remove abandoned games in batch
    if (cleanedCount > 0) {
      await gamesRef.update(updates);
      console.log(`Scheduled cleanup: Removed ${cleanedCount} games`);
    } else {
      console.log("Scheduled cleanup: No games needed cleanup");
    }
  } catch (error) {
    console.error("Error in scheduled cleanup:", error);
  }
});
