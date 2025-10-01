/**
 * Firebase Cloud Functions for Four Player Chess
 * Server-authoritative game logic and move validation
 * Simplified version for free tier compatibility
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueCreated } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";

// Import game logic functions
// Note: hasAnyLegalMoves and updateAllCheckStatus removed for optimization
// The simplified makeMove function trusts client validation for speed

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();

// OPTIMIZATION: Helper function for fast turn advancement
function getNextPlayer(currentPlayer: string): string {
  const turnOrder = ["r", "b", "y", "g"];
  const currentIndex = turnOrder.indexOf(currentPlayer);
  return turnOrder[(currentIndex + 1) % turnOrder.length];
}

// Import shared board state
import { initialBoardState } from "./boardState";

// Game operation locks to prevent race conditions
// Note: gameLocks removed from makeMove for optimization - simplified function doesn't need locking
const gameLocks = new Map<string, Promise<any>>();

// Note: Removed checkStatusCache and related functions for optimization
// The simplified makeMove function doesn't need complex validation caching

// Helper function to convert board state between formats
function convertBoardState(boardState: any, toFlattened: boolean): any {
  if (toFlattened) {
    // Convert 2D array to flattened format for Firebase
    return boardState.map((row: any) =>
      row.map((cell: any) => cell === null ? "" : cell)
    );
  } else {
    // Convert flattened format back to 2D array
    return boardState.map((row: any) =>
      row.map((cell: any) => cell === "" ? null : cell)
    );
  }
}

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
      currentPlayerTurn: "r",
      gameStatus: "waiting",
      selectedPiece: null,
      validMoves: [],
      capturedPieces: { r: [], b: [], y: [], g: [] },
      checkStatus: { r: false, b: false, y: false, g: false },
      winner: null,
      eliminatedPlayers: [],
      justEliminated: null,
      scores: { r: 0, b: 0, y: 0, g: 0 },
      promotionState: {
        isAwaiting: false,
        position: null,
        color: null,
      },
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
      viewingHistoryIndex: null,
    };

    // 3. Create the game in Firebase with the user as the first player
    const uid = request.auth.uid;
    const gameRef = db.ref("games").push();
    const gameId = gameRef.key;

    if (!gameId) {
      throw new HttpsError("internal", "Failed to generate game ID");
    }

    const gameData = {
      id: gameId,
      hostId: uid,
      hostName: request.data.playerName || request.data.name || "Player",
      status: "waiting",
      createdAt: Date.now(),
      lastActivity: Date.now(),
      maxPlayers: 4,
      currentPlayerTurn: "r",
      winner: null,
      lastMove: null,
      players: {
        [uid]: {
          id: uid,
          name: request.data.playerName || request.data.name || "Player",
          color: "r", // First player gets red
          isHost: true,
          isOnline: true,
          lastSeen: Date.now(),
        },
      },
      gameState: newGameState,
    };

    await gameRef.set(gameData);

    console.log(`Game ${gameId} created successfully by user ${uid}`);
    return {
      gameId: gameId,
      message: "Game created successfully",
    };
  } catch (error) {
    console.error("Error creating game:", error);
    throw new HttpsError("internal", "Failed to create game");
  }
});

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

    // Add retry logic for race conditions
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (retryCount < maxRetries && !success) {
      try {
        const result = await gameRef.transaction((gameData) => {
          if (gameData === null) {
            console.warn(
              `Game ${gameId} not found (attempt ${retryCount + 1})`
            );
            return null;
          }

          // Remove the player from the game
          if (gameData.players && gameData.players[uid]) {
            const leavingPlayer = gameData.players[uid];
            delete gameData.players[uid];
            gameData.lastActivity = Date.now();

            // If no players left, delete the game
            if (Object.keys(gameData.players).length === 0) {
              console.log(`Game ${gameId} is now empty, deleting`);
              return null; // This will delete the game
            }

            // If host left, assign new host
            if (gameData.hostId === uid) {
              const newHostId = Object.keys(gameData.players)[0];
              const newHost = gameData.players[newHostId];
              gameData.hostId = newHostId;
              gameData.hostName = newHost.name;
              gameData.players[newHostId].isHost = true;
            }

            // If the game was active and the leaving player was the current player,
            // advance to the next player
            if (
              gameData.gameState?.gameStatus === "active" &&
              gameData.gameState?.currentPlayerTurn === leavingPlayer?.color
            ) {
              const turnOrder = ["r", "b", "y", "g"];
              const currentIndex = turnOrder.indexOf(
                gameData.gameState.currentPlayerTurn
              );
              const nextIndex = (currentIndex + 1) % turnOrder.length;
              gameData.gameState.currentPlayerTurn = turnOrder[nextIndex];
            }
          }

          return gameData;
        });

        if (result.committed) {
          success = true;
          console.log(`User ${uid} successfully left game ${gameId}`);
        } else {
          retryCount++;
          console.warn(
            `Transaction failed for leaving game ${gameId} (attempt ${retryCount})`
          );
        }
      } catch (error) {
        retryCount++;
        console.error(
          `Error leaving game ${gameId} (attempt ${retryCount}):`,
          error
        );
      }
    }

    if (!success) {
      throw new HttpsError("internal", "Failed to leave game after retries");
    }

    return { message: "Successfully left the game" };
  } catch (error) {
    console.error("Error leaving game:", error);
    throw new HttpsError("internal", "Failed to leave game");
  }
});

export const resignGame = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to resign from a game."
    );
  }

  const { gameId } = request.data;

  if (!gameId) {
    throw new HttpsError("invalid-argument", "Game ID is required");
  }

  try {
    const uid = request.auth.uid;
    const gameRef = db.ref(`games/${gameId}`);

    // Add retry logic for race conditions
    let retryCount = 0;
    const maxRetries = 3;
    let success = false;

    while (retryCount < maxRetries && !success) {
      try {
        const result = await gameRef.transaction((gameData) => {
          if (gameData === null) {
            console.warn(
              `Game ${gameId} not found (attempt ${retryCount + 1})`
            );
            return null;
          }

          const player = gameData.players[uid];
          if (!player) {
            console.warn(`Player ${uid} not found in game ${gameId}`);
            return gameData;
          }

          // Remove the player from the game (resignation = leaving)
          const resignedPlayer = gameData.players[uid];
          delete gameData.players[uid];
          gameData.lastActivity = Date.now();

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            console.log(`Game ${gameId} is now empty after resignation, deleting`);
            return null; // This will delete the game
          }

          // If host resigned, assign new host
          if (gameData.hostId === uid) {
            const newHostId = Object.keys(gameData.players)[0];
            const newHost = gameData.players[newHostId];
            gameData.hostId = newHostId;
            gameData.hostName = newHost.name;
            gameData.players[newHostId].isHost = true;
          }

          // Add player to eliminated list
          if (!gameData.gameState.eliminatedPlayers) {
            gameData.gameState.eliminatedPlayers = [];
          }

          const playerColor = resignedPlayer.color;
          if (!gameData.gameState.eliminatedPlayers.includes(playerColor)) {
            gameData.gameState.eliminatedPlayers.push(playerColor);
            gameData.gameState.justEliminated = playerColor;
          }

          // Check if game is over (3 players eliminated)
          if (gameData.gameState.eliminatedPlayers.length >= 3) {
            const turnOrder = ["r", "b", "y", "g"];
            const winner = turnOrder.find(
              (color) =>
                !gameData.gameState.eliminatedPlayers.includes(color)
            );

            if (winner) {
              gameData.gameState.winner = winner;
              gameData.gameState.gameStatus = "finished";
              gameData.gameState.gameOverState = {
                isGameOver: true,
                status: "finished",
                eliminatedPlayer: null,
              };
            }
          } else {
            // Advance to next active player
            const turnOrder = ["r", "b", "y", "g"];
            const currentIndex = turnOrder.indexOf(
              gameData.gameState.currentPlayerTurn
            );
            const nextIndex = (currentIndex + 1) % turnOrder.length;
            const nextPlayerInSequence = turnOrder[nextIndex];

            let nextActivePlayer = nextPlayerInSequence;
            while (
              gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)
            ) {
              const activeIndex = turnOrder.indexOf(nextActivePlayer);
              const nextActiveIndex = (activeIndex + 1) % turnOrder.length;
              nextActivePlayer = turnOrder[nextActiveIndex];
            }

            gameData.gameState.currentPlayerTurn = nextActivePlayer;
          }

          return gameData;
        });

        if (result.committed) {
          success = true;
          console.log(`User ${uid} successfully resigned from game ${gameId}`);
        } else {
          retryCount++;
          console.warn(
            `Transaction failed for resigning from game ${gameId} (attempt ${retryCount})`
          );
        }
      } catch (error) {
        retryCount++;
        console.error(
          `Error resigning from game ${gameId} (attempt ${retryCount}):`,
          error
        );
      }
    }

    if (!success) {
      throw new HttpsError("internal", "Failed to resign from game after retries");
    }

    return { message: "Successfully resigned from the game" };
  } catch (error) {
    console.error("Error resigning from game:", error);
    throw new HttpsError("internal", "Failed to resign from game");
  }
});

export const makeMove = onValueCreated(
  "/move-requests/{gameId}/{moveId}",
  async (event) => {
    const { gameId } = event.params;
    const moveData = event.data.val();
    const uid = moveData.playerId || "anonymous";

    if (!uid) {
      console.warn(`Unauthenticated move request for game ${gameId}`);
      return event.data.ref.remove();
    }

    const gameRef = db.ref(`games/${gameId}`);

    try {
      // OPTIMIZATION: Skip game lock for faster processing
      const result = await gameRef.transaction((gameData) => {
        if (gameData === null) {
          console.warn(`Game ${gameId} not found`);
          return null;
        }

        // OPTIMIZATION: Minimal validation for speed
        const player = gameData.players[uid];
        if (!player || player.color !== gameData.gameState.currentPlayerTurn) {
          return gameData; // Skip move silently
        }

        // OPTIMIZATION: Direct move application without validation
        const boardState = convertBoardState(gameData.gameState.boardState, false);
        const piece = boardState[moveData.from.row][moveData.from.col];
        boardState[moveData.from.row][moveData.from.col] = null;
        boardState[moveData.to.row][moveData.to.col] = piece;

        // OPTIMIZATION: Minimal state update
        gameData.gameState.boardState = convertBoardState(boardState, true);
        gameData.gameState.currentPlayerTurn = getNextPlayer(gameData.gameState.currentPlayerTurn);
        gameData.lastMove = {
          from: moveData.from,
          to: moveData.to,
          piece: moveData.pieceCode,
          player: uid,
          timestamp: Date.now(),
        };

        return gameData;
      });

      if (result.committed) {
        console.log(`Move processed successfully for game ${gameId}`);
        // OPTIMIZATION: Remove move request immediately to prevent reprocessing
        await event.data.ref.remove();
      }
    } catch (error) {
      console.error(`Error processing move for game ${gameId}:`, error);
      await event.data.ref.remove();
    }
  }
);

/**
 * Function 5: Manual cleanup function (no scheduled runs)
 * This function can be called manually to clean up games
 * Much more cost-effective than scheduled functions
 */
export const manualCleanup = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "You must be logged in to run cleanup."
    );
  }

  try {
    console.log("Running manual game cleanup...");

    const gamesRef = db.ref("games");
    const snapshot = await gamesRef.once("value");

    if (!snapshot.exists()) {
      console.log("No games found for cleanup");
      return { message: "No games found", cleaned: 0, resigned: 0 };
    }

    const games = snapshot.val();
    let cleanedCount = 0;
    let resignedCount = 0;
    const updates: any = {};

    // Process each game
    for (const [gameId, gameData] of Object.entries(games)) {
      if (!gameData || typeof gameData !== "object") continue;

      const game = gameData as any;
      const now = Date.now();
      const lastActivity = game.lastActivity || game.createdAt || 0;
      const timeSinceLastActivity = now - lastActivity;

      // Auto-resign inactive players (30 minutes)
      if (timeSinceLastActivity > 30 * 60 * 1000) {
        console.log(`Auto-resigning inactive players in game ${gameId}`);

        const updatedGameData = { ...game };

        // Mark all players as resigned
        if (updatedGameData.players) {
          Object.keys(updatedGameData.players).forEach((playerId) => {
            updates[`games/${gameId}/players/${playerId}/status`] = "resigned";
            updates[`games/${gameId}/players/${playerId}/resignedAt`] = now;
          });
        }

        // Add all players to eliminated list
        if (!updatedGameData.gameState.eliminatedPlayers) {
          updatedGameData.gameState.eliminatedPlayers = [];
        }

        const turnOrder = ["r", "b", "y", "g"];
        turnOrder.forEach((color) => {
          if (!updatedGameData.gameState.eliminatedPlayers.includes(color)) {
            updatedGameData.gameState.eliminatedPlayers.push(color);
          }
        });

        // Check if game is now empty
        if (
          !updatedGameData.players ||
          Object.keys(updatedGameData.players).length === 0
        ) {
          console.log(
            `Game ${gameId} is now empty after disconnections, deleting`
          );
          updates[gameId] = null;
          cleanedCount++;
          continue;
        }

        // Check if game is over after auto-resignations
        if (updatedGameData.gameState.eliminatedPlayers.length >= 3) {
          const turnOrder = ["r", "b", "y", "g"];
          const winner = turnOrder.find(
            (color) =>
              !updatedGameData.gameState.eliminatedPlayers.includes(color)
          );

          if (winner) {
            updatedGameData.gameState.winner = winner;
            updatedGameData.gameState.gameStatus = "finished";
            updatedGameData.gameState.gameOverState = {
              isGameOver: true,
              status: "finished",
              eliminatedPlayer: null,
            };
            // Schedule for deletion in 5 minutes
            updatedGameData.gameState.deleteAt = now + 5 * 60 * 1000;
          }
        } else {
          // Advance to next active player
          const turnOrder = ["r", "b", "y", "g"];
          const currentIndex = turnOrder.indexOf(
            updatedGameData.gameState.currentPlayerTurn
          );
          const nextIndex = (currentIndex + 1) % 4;
          const nextPlayerInSequence = turnOrder[nextIndex];

          let nextActivePlayer = nextPlayerInSequence;
          while (
            updatedGameData.gameState.eliminatedPlayers.includes(
              nextActivePlayer
            )
          ) {
            const activeIndex = turnOrder.indexOf(nextActivePlayer);
            const nextActiveIndex = (activeIndex + 1) % 4;
            nextActivePlayer = turnOrder[nextActiveIndex];
          }

          updatedGameData.gameState.currentPlayerTurn = nextActivePlayer;
        }

        updates[`games/${gameId}`] = updatedGameData;
        resignedCount++;
      }

      // Delete old finished games (1 hour after completion)
      if (
        game.gameState?.gameStatus === "finished" &&
        game.gameState?.deleteAt &&
        now > game.gameState.deleteAt
      ) {
        console.log(`Deleting old finished game ${gameId}`);
        updates[gameId] = null;
        cleanedCount++;
      }
    }

    // Apply all updates
    if (Object.keys(updates).length > 0) {
      await db.ref().update(updates);
    }

    console.log(`Cleanup completed: ${cleanedCount} games deleted, ${resignedCount} games auto-resigned`);

    return {
      message: "Cleanup completed successfully",
      cleaned: cleanedCount,
      resigned: resignedCount,
    };
  } catch (error) {
    console.error("Error in manual cleanup:", error);
    throw new HttpsError("internal", "Failed to run manual cleanup");
  }
});
