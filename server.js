const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins for development
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const rooms = new Map();
const players = new Map();
const availableGames = new Map(); // Simple game list for discovery

function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomInfo(roomId) {
  const room = rooms.get(roomId);
  if (!room) return null;

  return {
    id: roomId,
    host: room.host,
    players: Array.from(room.players.values()),
    gameState: room.gameState,
    isGameStarted: room.isGameStarted,
  };
}

// Simple endpoint to get available games
app.get("/api/games", (req, res) => {
  const games = Array.from(availableGames.values()).map((game) => ({
    id: game.id,
    name: game.name,
    host: game.host,
    playerCount: game.playerCount,
    maxPlayers: 4,
    status: game.status,
  }));
  res.json(games);
});

io.on("connection", (socket) => {
  socket.on("create-room", (playerData) => {
    const roomId = generateRoomId();
    const room = {
      id: roomId,
      host: socket.id,
      players: new Map(),
      gameState: null,
      isGameStarted: false,
    };

    // Assign the first color (red) to the host
    const hostColor = "r";

    room.players.set(socket.id, {
      id: socket.id,
      name: playerData.name,
      color: hostColor,
      isHost: true,
    });

    rooms.set(roomId, room);
    players.set(socket.id, { roomId, isHost: true });

    // Add to available games list
    availableGames.set(roomId, {
      id: roomId,
      name: `${playerData.name}'s Game`,
      host: playerData.name,
      playerCount: 1,
      status: "waiting",
    });

    socket.join(roomId);
    socket.emit("room-created", {
      roomId,
      playerId: socket.id,
      color: hostColor,
      players: Array.from(room.players.values()),
    });
    socket.emit("update-players", {
      players: Array.from(room.players.values()),
    });
  });

  socket.on("join-room", (data) => {
    const { roomId, playerData } = data;
    const room = rooms.get(roomId);

    if (!room) {
      socket.emit("room-error", { message: "Room not found" });
      return;
    }

    if (room.players.size >= 4) {
      socket.emit("room-error", { message: "Room is full" });
      return;
    }

    const colors = ["r", "b", "y", "g"];
    const usedColors = Array.from(room.players.values()).map((p) => p.color);
    const availableColors = colors.filter(
      (color) => !usedColors.includes(color)
    );
    const playerColor = availableColors[0];

    if (!playerColor) {
      socket.emit("room-error", { message: "No available colors" });
      return;
    }

    room.players.set(socket.id, {
      id: socket.id,
      name: playerData.name,
      color: playerColor,
      isHost: false,
    });

    players.set(socket.id, { roomId, isHost: false });

    // Update available games player count
    if (availableGames.has(roomId)) {
      const game = availableGames.get(roomId);
      game.playerCount = room.players.size;
      availableGames.set(roomId, game);
    }

    socket.join(roomId);
    socket.emit("room-joined", {
      roomId,
      playerId: socket.id,
      color: playerColor,
      players: Array.from(room.players.values()),
    });

    socket.to(roomId).emit("update-players", {
      players: Array.from(room.players.values()),
    });
  });

  socket.on("start-game", () => {
    const player = players.get(socket.id);
    if (!player || !player.isHost) {
      socket.emit("error", { message: "Only host can start the game" });
      return;
    }

    const room = rooms.get(player.roomId);
    if (!room || room.players.size < 2) {
      socket.emit("error", { message: "Need at least 2 players to start" });
      return;
    }

    // Initialize game state with current player turn
    room.gameState = {
      currentPlayerTurn: "r", // Start with red player
    };
    room.isGameStarted = true;

    // Remove from available games when started
    availableGames.delete(player.roomId);

    io.to(player.roomId).emit("game-started");
  });

  socket.on("make-move", (moveData) => {
    const player = players.get(socket.id);
    if (!player) return; // Player not found

    const room = rooms.get(player.roomId);
    if (!room || !room.isGameStarted) return; // Room not found or game not started

    const playerInfo = room.players.get(socket.id);
    const serverCurrentTurn = room.gameState.currentPlayerTurn;
    if (!playerInfo || playerInfo.color !== serverCurrentTurn) {
      // If it's not their turn, reject the move and do nothing else.

      // Send rejection response to the specific player
      socket.emit("move-rejected", {
        reason: "Not your turn",
        currentTurn: serverCurrentTurn,
        yourColor: playerInfo?.color,
      });
      return;
    }

    const turnOrder = ["r", "b", "y", "g"]; // This must match your client's turn order
    const currentIndex = turnOrder.indexOf(serverCurrentTurn);

    const nextIndex = (currentIndex + 1) % turnOrder.length;
    room.gameState.currentPlayerTurn = turnOrder[nextIndex];

    io.to(player.roomId).emit("move-made", {
      move: moveData,
      playerId: socket.id,
      gameState: room.gameState, // Send the updated game state including current turn
    });
  });

  socket.on("update-game-state", (gameState) => {
    const player = players.get(socket.id);
    if (!player) return;

    const room = rooms.get(player.roomId);
    if (room) {
      room.gameState = gameState;
      socket.to(player.roomId).emit("game-state-updated", { gameState });
    }
  });

  socket.on("leave-game", () => {
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.roomId);
      if (room) {
        const wasHost = player.isHost;
        const roomId = player.roomId;

        room.players.delete(socket.id);
        players.delete(socket.id);

        if (room.players.size === 0) {
          // Room is empty, destroy it completely
          rooms.delete(roomId);
          availableGames.delete(roomId);
        } else if (wasHost) {
          // Host left, destroy the game and notify remaining players
          rooms.delete(roomId);
          availableGames.delete(roomId);

          // Notify remaining players that the game was destroyed
          socket.to(roomId).emit("game-destroyed", {
            reason: "Host left the game",
          });
        } else {
          // Regular player left, update the room

          // Update available games player count
          if (availableGames.has(roomId)) {
            const game = availableGames.get(roomId);
            game.playerCount = room.players.size;
            availableGames.set(roomId, game);
          }

          // Notify remaining players
          socket.to(roomId).emit("update-players", {
            players: Array.from(room.players.values()),
          });
        }
      }
    }
  });

  socket.on("disconnect", () => {
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.roomId);
      if (room) {
        const wasHost = player.isHost;
        const roomId = player.roomId;

        room.players.delete(socket.id);
        players.delete(socket.id);

        if (room.players.size === 0) {
          // Room is empty, destroy it completely
          rooms.delete(roomId);
          availableGames.delete(roomId);
        } else if (wasHost) {
          // Host left, destroy the game and notify remaining players
          rooms.delete(roomId);
          availableGames.delete(roomId);

          // Notify remaining players that the game was destroyed
          socket.to(roomId).emit("game-destroyed", {
            reason: "Host left the game",
          });
        } else {
          // Regular player left, update the room

          // Update available games player count
          if (availableGames.has(roomId)) {
            const game = availableGames.get(roomId);
            game.playerCount = room.players.size;
            availableGames.set(roomId, game);
          }

          // Notify remaining players
          socket.to(roomId).emit("update-players", {
            players: Array.from(room.players.values()),
          });
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.1.9:${PORT}`);
});

server.on("error", (error) => {
  console.error("Server error:", error);
});

io.engine.on("connection_error", (err) => {
  console.error("Socket.IO connection error:", err);
});
