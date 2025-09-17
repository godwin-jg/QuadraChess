const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: [
      "http://localhost:8081",
      "http://localhost:8082",
      "http://192.168.1.9:3001",
    ],
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

const rooms = new Map();
const players = new Map();

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

io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);

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

    console.log(`Room created:`, {
      roomId,
      host: {
        socketId: socket.id,
        name: playerData.name,
        color: hostColor,
      },
    });

    socket.join(roomId);
    socket.emit("room-created", {
      roomId,
      playerId: socket.id,
      color: hostColor, // Send the assigned color back to the client
    });
    socket.emit("update-players", {
      players: Array.from(room.players.values()),
    });
  });

  socket.on("join-room", (data) => {
    const { roomId, playerData } = data;
    const room = rooms.get(roomId);

    console.log(`Join room attempt:`, {
      socketId: socket.id,
      roomId,
      playerData,
      roomExists: !!room,
      roomPlayers: room ? Array.from(room.players.entries()) : null,
    });

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

    console.log(`Color assignment:`, {
      usedColors,
      availableColors,
      assignedColor: playerColor,
    });

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
    io.to(player.roomId).emit("game-started");
  });

  socket.on("make-move", (moveData) => {
    const player = players.get(socket.id);
    if (!player) return; // Player not found

    const room = rooms.get(player.roomId);
    if (!room || !room.isGameStarted) return; // Room not found or game not started

    // --- START: NEW TURN VALIDATION LOGIC ---

    // 1. Get the player's info (like their color) and the server's official current turn
    const playerInfo = room.players.get(socket.id);
    const serverCurrentTurn = room.gameState.currentPlayerTurn;

    // Debug logging
    console.log(`Move attempt by player:`, {
      socketId: socket.id,
      playerInfo,
      serverCurrentTurn,
      roomPlayers: Array.from(room.players.entries()),
    });

    // 2. VALIDATION CHECK: Is it this player's turn?
    if (!playerInfo || playerInfo.color !== serverCurrentTurn) {
      // If it's not their turn, reject the move and do nothing else.
      console.log(
        `REJECTED: Player ${playerInfo?.name || "Unknown"} (${playerInfo?.color || "undefined"}) tried to move on ${serverCurrentTurn}'s turn.`
      );

      // Send rejection response to the specific player
      socket.emit("move-rejected", {
        reason: "Not your turn",
        currentTurn: serverCurrentTurn,
        yourColor: playerInfo?.color,
      });
      return;
    }

    // 3. If the move is valid, update the server's state to the next player.
    const turnOrder = ["r", "b", "y", "g"]; // This must match your client's turn order
    const currentIndex = turnOrder.indexOf(serverCurrentTurn);

    // This simple logic finds the next player in the sequence.
    // A more advanced version would skip over eliminated players.
    const nextIndex = (currentIndex + 1) % turnOrder.length;
    room.gameState.currentPlayerTurn = turnOrder[nextIndex];

    // --- END: NEW TURN VALIDATION LOGIC ---

    // 4. If the move was from the correct player, broadcast it to ALL players in the room.
    // Using io.to() sends it to everyone, including the original sender.
    // This ensures every player's game state is updated based on the server's decision.
    io.to(player.roomId).emit("move-made", {
      move: moveData,
      playerId: socket.id,
      gameState: room.gameState, // Send the updated game state including current turn
    });

    console.log(
      `Move VALIDATED and broadcast for player ${playerInfo.name} in room ${player.roomId}`
    );
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

  socket.on("disconnect", () => {
    console.log(`Player disconnected: ${socket.id}`);
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.roomId);
      if (room) {
        room.players.delete(socket.id);
        players.delete(socket.id);

        if (room.players.size === 0) {
          rooms.delete(player.roomId);
        } else {
          if (player.isHost) {
            const newHost = room.players.values().next().value;
            if (newHost) {
              newHost.isHost = true;
              room.host = newHost.id;
            }
          }
          socket.to(player.roomId).emit("update-players", {
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
