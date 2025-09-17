const express = require("express");
const https = require("https");
const socketIo = require("socket.io");
const cors = require("cors");
const fs = require("fs");

const app = express();

// Create self-signed certificate for development
const options = {
  key: fs.readFileSync("server-key.pem"),
  cert: fs.readFileSync("server-cert.pem"),
};

const server = https.createServer(options, app);

// Configure CORS for React Native
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Store active rooms and players
const rooms = new Map();
const players = new Map();

// Utility functions
function generateRoomId() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function getRoomInfo(roomId) {
  return rooms.get(roomId) || null;
}

// Socket.io connection handling
io.on("connection", (socket) => {
  console.log(`Player connected: ${socket.id}`);
  console.log(`Connection from: ${socket.handshake.address}`);
  console.log(`Headers:`, socket.handshake.headers);

  // Create a new room
  socket.on("create-room", (playerData) => {
    try {
      const roomId = generateRoomId();
      const playerId = socket.id;

      // Create room
      const room = {
        id: roomId,
        host: playerId,
        players: new Map(),
        gameStarted: false,
        gameState: null,
      };

      // Add host to room
      room.players.set(playerId, {
        id: playerId,
        name: playerData.name,
        color: playerData.color || "r", // Default to red
        isHost: true,
        socketId: socket.id,
      });

      // Store room and player
      rooms.set(roomId, room);
      players.set(playerId, { roomId, socketId: socket.id });

      // Join socket to room
      socket.join(roomId);

      console.log(`Room created: ${roomId} by ${playerData.name}`);

      // Send room info back to client
      socket.emit("room-created", {
        roomId,
        playerId,
        players: Array.from(room.players.values()),
      });

      // Broadcast player list update
      socket.to(roomId).emit("update-players", {
        players: Array.from(room.players.values()),
      });
    } catch (error) {
      console.error("Error creating room:", error);
      socket.emit("room-error", { message: "Failed to create room" });
    }
  });

  // Join an existing room
  socket.on("join-room", (data) => {
    try {
      const { roomId, playerData } = data;
      const playerId = socket.id;

      const room = getRoomInfo(roomId);
      if (!room) {
        socket.emit("room-error", { message: "Room not found" });
        return;
      }

      if (room.players.size >= 4) {
        socket.emit("room-error", { message: "Room is full" });
        return;
      }

      if (room.gameStarted) {
        socket.emit("room-error", { message: "Game has already started" });
        return;
      }

      // Assign color based on current players
      const usedColors = Array.from(room.players.values()).map((p) => p.color);
      const availableColors = ["r", "b", "y", "g"].filter(
        (c) => !usedColors.includes(c)
      );
      const assignedColor = availableColors[0];

      // Add player to room
      room.players.set(playerId, {
        id: playerId,
        name: playerData.name,
        color: assignedColor,
        isHost: false,
        socketId: socket.id,
      });

      // Store player info
      players.set(playerId, { roomId, socketId: socket.id });

      // Join socket to room
      socket.join(roomId);

      console.log(
        `Player ${playerData.name} joined room ${roomId} as ${assignedColor}`
      );

      // Send room info back to client
      socket.emit("room-joined", {
        roomId,
        playerId,
        color: assignedColor,
        players: Array.from(room.players.values()),
      });

      // Broadcast player list update to all players in room
      io.to(roomId).emit("update-players", {
        players: Array.from(room.players.values()),
      });
    } catch (error) {
      console.error("Error joining room:", error);
      socket.emit("room-error", { message: "Failed to join room" });
    }
  });

  // Start the game (host only)
  socket.on("start-game", () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = getRoomInfo(player.roomId);
      if (!room || room.host !== socket.id) {
        socket.emit("error", { message: "Only the host can start the game" });
        return;
      }

      if (room.players.size < 2) {
        socket.emit("error", { message: "Need at least 2 players to start" });
        return;
      }

      room.gameStarted = true;
      console.log(`Game started in room ${room.id}`);

      // Broadcast game started to all players
      io.to(room.id).emit("game-started");
    } catch (error) {
      console.error("Error starting game:", error);
      socket.emit("error", { message: "Failed to start game" });
    }
  });

  // Handle move made
  socket.on("make-move", (moveData) => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = getRoomInfo(player.roomId);
      if (!room || !room.gameStarted) return;

      console.log(`Move made in room ${room.id}:`, moveData);

      // Broadcast move to all other players in the room
      socket.to(room.id).emit("move-made", { move: moveData });
    } catch (error) {
      console.error("Error handling move:", error);
    }
  });

  // Handle game state updates
  socket.on("update-game-state", (gameState) => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = getRoomInfo(player.roomId);
      if (!room || !room.gameStarted) return;

      // Store the game state
      room.gameState = gameState;

      // Broadcast updated game state to all other players
      socket.to(room.id).emit("game-state-updated", { gameState });
    } catch (error) {
      console.error("Error updating game state:", error);
    }
  });

  // Handle disconnection
  socket.on("disconnect", () => {
    try {
      const player = players.get(socket.id);
      if (!player) return;

      const room = getRoomInfo(player.roomId);
      if (!room) return;

      console.log(`Player disconnected from room ${room.id}`);

      // Remove player from room
      room.players.delete(socket.id);
      players.delete(socket.id);

      // If room is empty, delete it
      if (room.players.size === 0) {
        rooms.delete(room.id);
        console.log(`Room ${room.id} deleted (empty)`);
      } else {
        // If host left, assign new host
        if (room.host === socket.id) {
          const newHost = room.players.keys().next().value;
          room.host = newHost;
          room.players.get(newHost).isHost = true;
        }

        // Broadcast updated player list
        io.to(room.id).emit("update-players", {
          players: Array.from(room.players.values()),
        });
      }
    } catch (error) {
      console.error("Error handling disconnect:", error);
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`HTTPS Server running on port ${PORT}`);
  console.log(`Connect to: https://localhost:${PORT}`);
  console.log(`Network access: https://192.168.31.217:${PORT}`);
});

