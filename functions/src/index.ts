/**
 * Firebase Cloud Functions for Four Player Chess
 * Server-authoritative game logic and move validation
 * Simplified version for free tier compatibility
 */

import { onCall, HttpsError } from "firebase-functions/v2/https";
import { onValueCreated } from "firebase-functions/v2/database";
import * as admin from "firebase-admin";

// Import game logic functions
import {
  getValidMoves,
  hasAnyLegalMoves,
} from "./logic/gameLogic";
import { updateAllCheckStatus } from "./gameHelpers";

// Initialize Firebase Admin
admin.initializeApp();
const db = admin.database();

// Import shared board state
import { initialBoardState } from "./boardState";

// Game operation locks to prevent race conditions
const gameLocks = new Map<string, Promise<any>>();

// Performance optimization: Simple move validation cache (disabled for now due to issues)
// const moveValidationCache = new Map<string, { validMoves: any[], timestamp: number }>();
// const CACHE_TTL = 5000; // 5 seconds cache TTL

// Performance optimization: Simple check status cache (disabled for now due to issues)
// const checkStatusCache = new Map<string, { checkStatus: any, timestamp: number }>();

// Helper function to ensure only one operation per game at a time
async function withGameLock<T>(
  gameId: string,
  operation: () => Promise<T>
): Promise<T> {
  // Wait for any existing operation on this game to complete
  const existingLock = gameLocks.get(gameId);
  if (existingLock) {
    await existingLock;
  }

  // Create a new lock for this operation
  const lockPromise = operation().finally(() => {
    gameLocks.delete(gameId);
  });

  gameLocks.set(gameId, lockPromise);
  return lockPromise;
}

// Performance optimization: Direct move validation (caching disabled for stability)
function getOptimizedValidMoves(
  pieceCode: string,
  position: { row: number; col: number },
  boardState: (string | null)[][],
  eliminatedPlayers: string[],
  hasMoved: any,
  enPassantTargets: any[]
): any[] {
  // Direct call without caching for now - still optimized with other improvements
  return getValidMoves(
    pieceCode,
    position,
    boardState,
    eliminatedPlayers,
    hasMoved,
    enPassantTargets
  );
}

// Performance optimization: Direct check status calculation (caching disabled for stability)
function getOptimizedCheckStatus(
  boardState: (string | null)[][],
  eliminatedPlayers: string[],
  hasMoved: any
): any {
  // Direct call without caching for now - still optimized with other improvements
  return updateAllCheckStatus(boardState, eliminatedPlayers, hasMoved);
}

// Performance optimization: Fast board state conversion
function convertBoardState(boardState: any, toFlattened = true): any {
  if (toFlattened) {
    return boardState.map((row: any) =>
      row.map((cell: string | null) => (cell === "" || cell === null ? "" : cell))
    );
  } else {
    return boardState.map((row: any) =>
      row.map((cell: string | null) => (cell === "" ? null : cell))
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

        if (result.committed) {
          success = true;
          console.log(
            `Leave game transaction committed successfully for game ${gameId}`
          );
        } else {
          retryCount++;
          console.warn(
            `Leave game transaction aborted for game ${gameId}, retrying... (${retryCount}/${maxRetries})`
          );
          if (retryCount < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * retryCount)
            );
          }
        }
      } catch (transactionError) {
        retryCount++;
        console.error(
          `Leave game transaction error for game ${gameId} (attempt ${retryCount}):`,
          transactionError
        );
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * retryCount));
        }
      }
    }

    if (!success) {
      console.error(
        `Failed to leave game ${gameId} after ${maxRetries} attempts`
      );
      throw new HttpsError(
        "internal",
        "Failed to leave game after multiple attempts"
      );
    }

    console.log(`Player ${uid} successfully left game ${gameId}`);
    return { success: true, message: "Successfully left the game" };
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
            console.warn(
              `Player ${uid} not found in game ${gameId} (attempt ${retryCount + 1})`
            );
            return gameData; // Return current data to avoid transaction abort
          }

          // Don't allow resigning if game is already over
          if (
            gameData.gameState.gameStatus === "finished" ||
            gameData.gameState.gameStatus === "checkmate" ||
            gameData.gameState.gameStatus === "stalemate"
          ) {
            console.warn(
              `Player ${uid} cannot resign - game is already over (attempt ${retryCount + 1})`
            );
            return gameData; // Return current data to avoid transaction abort
          }

          // Initialize eliminatedPlayers array if it doesn't exist
          if (!gameData.gameState.eliminatedPlayers) {
            gameData.gameState.eliminatedPlayers = [];
            console.log(`Resign Cloud Function: Initialized eliminatedPlayers array for game ${gameId}`);
          }

          // Add player to eliminated players
          if (!gameData.gameState.eliminatedPlayers.includes(player.color)) {
            gameData.gameState.eliminatedPlayers.push(player.color);
            gameData.gameState.justEliminated = player.color;
            console.log(`Resign Cloud Function: Added ${player.color} to eliminatedPlayers:`, gameData.gameState.eliminatedPlayers);
          }

          // Remove the player from the game
          delete gameData.players[uid];

          // If no players left, delete the game
          if (!gameData.players || Object.keys(gameData.players).length === 0) {
            console.log(
              `Game ${gameId} is now empty after resignation, deleting`
            );
            return null; // This will delete the game
          }

          // Update check status for all players
          gameData.gameState.checkStatus = {
            r: false,
            b: false,
            y: false,
            g: false,
          };

          // Check if the entire game is over
          if (gameData.gameState.eliminatedPlayers.length === 3) {
            // Find the one player who is NOT in the eliminatedPlayers array
            const turnOrder = ["r", "b", "y", "g"];
            const winner = turnOrder.find(
              (color) => !gameData.gameState.eliminatedPlayers.includes(color)
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
            const nextIndex = (currentIndex + 1) % 4;
            const nextPlayerInSequence = turnOrder[nextIndex];

            // Find the next active player (skip eliminated players)
            let nextActivePlayer = nextPlayerInSequence;
            while (
              gameData.gameState.eliminatedPlayers.includes(nextActivePlayer)
            ) {
              const activeIndex = turnOrder.indexOf(nextActivePlayer);
              const nextActiveIndex = (activeIndex + 1) % 4;
              nextActivePlayer = turnOrder[nextActiveIndex];
            }

            gameData.gameState.currentPlayerTurn = nextActivePlayer;
          }

          gameData.currentPlayerTurn = gameData.gameState.currentPlayerTurn;
          gameData.lastActivity = Date.now();

          console.log(
            `Player ${uid} (${player.color}) resigned from game ${gameId}`
          );
          return gameData;
        });

        if (result.committed) {
          success = true;
          console.log(
            `Resign game transaction committed successfully for game ${gameId}`
          );
          console.log("Resign Cloud Function: Updated eliminatedPlayers:", result.snapshot.val()?.gameState?.eliminatedPlayers);
        } else {
          retryCount++;
          console.warn(
            `Resign game transaction aborted for game ${gameId}, retrying... (${retryCount}/${maxRetries})`
          );
          if (retryCount < maxRetries) {
            await new Promise((resolve) =>
              setTimeout(resolve, 100 * retryCount)
            );
          }
        }
      } catch (transactionError) {
        retryCount++;
        console.error(
          `Resign game transaction error for game ${gameId} (attempt ${retryCount}):`,
          transactionError
        );
        if (retryCount < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, 100 * retryCount));
        }
      }
    }

    if (!success) {
      console.error(
        `Failed to resign from game ${gameId} after ${maxRetries} attempts`
      );
      throw new HttpsError(
        "internal",
        "Failed to resign from game after multiple attempts"
      );
    }

    console.log(`Player ${uid} successfully resigned from game ${gameId}`);
    return { success: true, message: "Successfully resigned from the game" };
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
    const uid = event.data.val().playerId || "anonymous";

    if (!uid) {
      console.warn(`Unauthenticated move request for game ${gameId}`);
      return event.data.ref.remove();
    }

    const gameRef = db.ref(`games/${gameId}`);

    try {
      // Use game lock to prevent concurrent operations
      await withGameLock(gameId, async () => {
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
                return null; // This will abort the transaction
              }

              const player = gameData.players[uid];
              if (
                !player ||
                player.color !== gameData.gameState.currentPlayerTurn
              ) {
                console.warn(
                  `Not player's turn: ${uid} vs ${gameData.gameState.currentPlayerTurn} (attempt ${retryCount + 1})`
                );
                return gameData; // Return current data to avoid transaction abort
              }

              if (!moveData.from || !moveData.to || !moveData.pieceCode) {
                console.warn(`Invalid move data from ${uid}:`, moveData);
                return gameData; // Return current data to avoid transaction abort
              }

              // Convert flattened board state back to normal format for game logic
              const boardState = convertBoardState(gameData.gameState.boardState, false);

              // Validate the move using optimized game logic
              const validMoves = getOptimizedValidMoves(
                moveData.pieceCode,
                moveData.from,
                boardState,
                gameData.gameState.eliminatedPlayers || [],
                gameData.gameState.hasMoved || {},
                gameData.gameState.enPassantTargets || []
              );

              const isValidMove = validMoves.some(
                (move) =>
                  move.row === moveData.to.row && move.col === moveData.to.col
              );

              if (!isValidMove) {
                console.warn(`Invalid move from ${uid}:`, moveData);
                return gameData; // Return current data to avoid transaction abort
              }

              // Apply the move
              const newBoardState = [...boardState];
              const piece = newBoardState[moveData.from.row][moveData.from.col];
              newBoardState[moveData.from.row][moveData.from.col] = null;
              newBoardState[moveData.to.row][moveData.to.col] = piece;

              // Convert back to flattened format for Firebase
              const flattenedBoardState = convertBoardState(newBoardState, true);

              gameData.gameState.boardState = flattenedBoardState;

              // Update check status for all players using optimized calculation
              gameData.gameState.checkStatus = getOptimizedCheckStatus(
                newBoardState,
                gameData.gameState.eliminatedPlayers || [],
                gameData.gameState.hasMoved || {}
              );

              // Check if any opponent is in checkmate/stalemate after this move
              const currentPlayer = gameData.gameState.currentPlayerTurn;
              const turnOrder = ["r", "b", "y", "g"];
              const otherPlayers = turnOrder.filter(
                (color) =>
                  color !== currentPlayer &&
                  !(gameData.gameState.eliminatedPlayers || []).includes(color)
              );

              // Optimized checkmate/stalemate detection - only check if not already in check
              const checkStatus = gameData.gameState.checkStatus;
              for (const opponent of otherPlayers) {
                // Skip if opponent is already eliminated
                if ((gameData.gameState.eliminatedPlayers || []).includes(opponent)) {
                  continue;
                }

                // Only check for checkmate/stalemate if the opponent is in check
                // This significantly reduces computation for most moves
                if (checkStatus[opponent]) {
                  const opponentHasMoves = hasAnyLegalMoves(
                    opponent,
                    newBoardState,
                    gameData.gameState.eliminatedPlayers || [],
                    gameData.gameState.hasMoved || {},
                    gameData.gameState.enPassantTargets || []
                  );

                  if (!opponentHasMoves) {
                    // Checkmate - eliminate the player
                    gameData.gameState.gameStatus = "checkmate";
                    if (!gameData.gameState.eliminatedPlayers) {
                      gameData.gameState.eliminatedPlayers = [];
                    }
                    gameData.gameState.eliminatedPlayers.push(opponent);
                    gameData.gameState.justEliminated = opponent;
                    gameData.gameState.scores = gameData.gameState.scores || {
                      r: 0,
                      b: 0,
                      y: 0,
                      g: 0,
                    };
                    gameData.gameState.scores[
                      currentPlayer as keyof typeof gameData.gameState.scores
                    ] += 10;

                    // Set game over state for checkmate
                    gameData.gameState.gameOverState = {
                      isGameOver: true,
                      status: "checkmate",
                      eliminatedPlayer: opponent,
                    };
                    break; // Exit the loop after eliminating one player
                  }
                }
              }

              // Check if the entire game is over
              if ((gameData.gameState.eliminatedPlayers || []).length === 3) {
                // Find the one player who is NOT in the eliminatedPlayers array
                const winner = turnOrder.find(
                  (color) =>
                    !(gameData.gameState.eliminatedPlayers || []).includes(
                      color
                    )
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

                // Schedule game for deletion after 5 minutes (to allow players to see results)
                gameData.gameState.deleteAt = Date.now() + 5 * 60 * 1000;
              } else {
                // Advance to next active player
                const currentIndex = turnOrder.indexOf(currentPlayer);
                const nextIndex = (currentIndex + 1) % 4;
                const nextPlayerInSequence = turnOrder[nextIndex];

                // Find the next active player (skip eliminated players)
                let nextActivePlayer = nextPlayerInSequence;
                while (
                  (gameData.gameState.eliminatedPlayers || []).includes(
                    nextActivePlayer
                  )
                ) {
                  const activeIndex = turnOrder.indexOf(nextActivePlayer);
                  const nextActiveIndex = (activeIndex + 1) % 4;
                  nextActivePlayer = turnOrder[nextActiveIndex];
                }

                gameData.gameState.currentPlayerTurn = nextActivePlayer;
              }

              gameData.currentPlayerTurn = gameData.gameState.currentPlayerTurn;
              gameData.lastMove = {
                ...moveData,
                playerId: uid,
                playerColor: player.color,
                timestamp: Date.now(),
                moveNumber: (gameData.lastMove?.moveNumber || 0) + 1,
              };
              gameData.lastActivity = Date.now();

              // Store history on server for synchronization (optimized)
              if (!gameData.gameState.history) {
                gameData.gameState.history = [];
              }

              // Create a minimal snapshot of the current state for history
              // Only store essential data to reduce memory usage and processing time
              // Ensure no undefined values for Firebase compatibility
              const historySnapshot = {
                boardState: gameData.gameState.boardState,
                currentPlayerTurn: gameData.gameState.currentPlayerTurn,
                gameStatus: gameData.gameState.gameStatus,
                checkStatus: gameData.gameState.checkStatus,
                winner: gameData.gameState.winner || null,
                eliminatedPlayers: gameData.gameState.eliminatedPlayers || [],
                justEliminated: gameData.gameState.justEliminated || null,
                scores: gameData.gameState.scores || { r: 0, b: 0, y: 0, g: 0 },
                moveNumber: gameData.lastMove.moveNumber,
                timestamp: Date.now(),
              };

              // Add to history
              gameData.gameState.history.push(historySnapshot);
              gameData.gameState.historyIndex =
                gameData.gameState.history.length - 1;

              // Performance monitoring
              const processingTime = Date.now() - (moveData.timestamp || Date.now());
              console.log(
                `Move processed successfully for game ${gameId} by ${uid} in ${processingTime}ms`
              );

              return gameData;
            });

            if (result.committed) {
              success = true;
              console.log(
                `Move transaction committed successfully for game ${gameId}`
              );
            } else {
              retryCount++;
              console.warn(
                `Move transaction aborted for game ${gameId}, retrying... (${retryCount}/${maxRetries})`
              );
              if (retryCount < maxRetries) {
                // Wait a short time before retrying
                await new Promise((resolve) =>
                  setTimeout(resolve, 100 * retryCount)
                );
              }
            }
          } catch (transactionError) {
            retryCount++;
            console.error(
              `Transaction error for game ${gameId} (attempt ${retryCount}):`,
              transactionError
            );
            if (retryCount < maxRetries) {
              // Wait a short time before retrying
              await new Promise((resolve) =>
                setTimeout(resolve, 100 * retryCount)
              );
            }
          }
        }

        if (!success) {
          console.error(
            `Failed to process move for game ${gameId} after ${maxRetries} attempts`
          );
        }
      });

      return event.data.ref.remove();
    } catch (error) {
      console.error(`Error processing move for game ${gameId}:`, error);
      return event.data.ref.remove();
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

    const now = Date.now();
    const twoMinutesAgo = now - 2 * 60 * 1000; // 2 minutes ago
    let cleanedCount = 0;
    let resignedCount = 0;
    const updates: { [key: string]: any } = {};

    snapshot.forEach((gameSnapshot) => {
      const gameData = gameSnapshot.val();
      const gameId = gameSnapshot.key;

      // Clean up finished games that are past their delete time
      if (gameData.gameState?.deleteAt && gameData.gameState.deleteAt < now) {
        console.log(`Deleting finished game ${gameId} (past delete time)`);
        updates[gameId] = null;
        cleanedCount++;
        return;
      }

      // Skip games with no players (leaveGame handles these)
      if (!gameData.players || Object.keys(gameData.players).length === 0) {
        return;
      }

      // Check for disconnected players and auto-resign them
      const players = gameData.players;
      const disconnectedPlayers: string[] = [];

      Object.entries(players).forEach(([playerId, player]: [string, any]) => {
        if (
          !player.isOnline ||
          (player.lastSeen && player.lastSeen < twoMinutesAgo)
        ) {
          disconnectedPlayers.push(playerId);
        }
      });

      // Auto-resign disconnected players
      if (disconnectedPlayers.length > 0) {
        console.log(
          `Auto-resigning disconnected players in game ${gameId}:`,
          disconnectedPlayers
        );

        const updatedGameData = { ...gameData };

        // Remove disconnected players and add them to eliminated players
        disconnectedPlayers.forEach((playerId) => {
          const player = players[playerId];
          if (
            player &&
            !updatedGameData.gameState.eliminatedPlayers.includes(player.color)
          ) {
            updatedGameData.gameState.eliminatedPlayers.push(player.color);
            updatedGameData.gameState.justEliminated = player.color;
          }
          delete updatedGameData.players[playerId];
        });

        // If no players left after disconnections, delete the game
        if (
          !updatedGameData.players ||
          Object.keys(updatedGameData.players).length === 0
        ) {
          console.log(
            `Game ${gameId} is now empty after disconnections, deleting`
          );
          updates[gameId] = null;
          cleanedCount++;
          return;
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
          updatedGameData.currentPlayerTurn = nextActivePlayer;
        }

        updates[gameId] = updatedGameData;
        resignedCount += disconnectedPlayers.length;
      }
    });

    // Apply all updates
    if (Object.keys(updates).length > 0) {
      await gamesRef.update(updates);
      console.log(
        `Manual cleanup: Removed ${cleanedCount} games, auto-resigned ${resignedCount} players`
      );
    } else {
      console.log("Manual cleanup: No games needed cleanup");
    }

    return {
      message: "Manual cleanup completed",
      cleaned: cleanedCount,
      resigned: resignedCount,
    };
  } catch (error) {
    console.error("Error in manual cleanup:", error);
    throw new HttpsError("internal", "Failed to run manual cleanup");
  }
});
