const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

const app = express();
const server = http.createServer(app);

const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"],
});

// Store active games and peer connections
const activeGames = new Map();
const peerConnections = new Map();

// Game discovery endpoint
app.get("/api/games", (req, res) => {
  const games = Array.from(activeGames.values()).map((game) => ({
    id: game.id,
    hostName: game.hostName,
    playerCount: game.players.size,
    maxPlayers: 4,
    status: game.status,
    createdAt: game.createdAt,
  }));
  res.json(games);
});

io.on("connection", (socket) => {
  console.log(`Signaling: Peer connected: ${socket.id}`);

  // Register peer
  socket.on("register-peer", (data) => {
    const { peerId, gameId, isHost } = data;
    peerConnections.set(socket.id, {
      peerId,
      gameId,
      isHost,
      socket,
    });

    if (isHost && gameId) {
      // Register game
      activeGames.set(gameId, {
        id: gameId,
        hostId: peerId,
        hostName: data.hostName || "Unknown",
        players: new Map([
          [peerId, { id: peerId, name: data.hostName, isHost: true }],
        ]),
        status: "waiting",
        createdAt: Date.now(),
      });
    }

    console.log(`Signaling: Peer registered: ${peerId} in game: ${gameId}`);
  });

  // Handle offer/answer exchange
  socket.on("offer", (data) => {
    const { targetPeerId, offer } = data;
    const targetConnection = findPeerConnection(targetPeerId);

    if (targetConnection) {
      targetConnection.socket.emit("offer", {
        fromPeerId: peerConnections.get(socket.id)?.peerId,
        offer,
      });
    }
  });

  socket.on("answer", (data) => {
    const { targetPeerId, answer } = data;
    const targetConnection = findPeerConnection(targetPeerId);

    if (targetConnection) {
      targetConnection.socket.emit("answer", {
        fromPeerId: peerConnections.get(socket.id)?.peerId,
        answer,
      });
    }
  });

  // Handle ICE candidates
  socket.on("ice-candidate", (data) => {
    const { targetPeerId, candidate } = data;
    const targetConnection = findPeerConnection(targetPeerId);

    if (targetConnection) {
      targetConnection.socket.emit("ice-candidate", {
        fromPeerId: peerConnections.get(socket.id)?.peerId,
        candidate,
      });
    }
  });

  // Handle game discovery
  socket.on("discover-games", () => {
    const games = Array.from(activeGames.values()).map((game) => ({
      id: game.id,
      hostName: game.hostName,
      playerCount: game.players.size,
      maxPlayers: 4,
      status: game.status,
    }));
    socket.emit("games-list", games);
  });

  // Handle join game request
  socket.on("join-game", (data) => {
    const { gameId, playerName } = data;
    const game = activeGames.get(gameId);

    if (!game) {
      socket.emit("join-error", { message: "Game not found" });
      return;
    }

    if (game.players.size >= 4) {
      socket.emit("join-error", { message: "Game is full" });
      return;
    }

    // Add player to game
    const peerId = peerConnections.get(socket.id)?.peerId;
    if (peerId) {
      game.players.set(peerId, {
        id: peerId,
        name: playerName,
        isHost: false,
      });

      // Notify all players in the game
      game.players.forEach((player, playerId) => {
        const playerConnection = findPeerConnection(playerId);
        if (playerConnection) {
          playerConnection.socket.emit("player-joined", {
            playerId,
            playerName,
            players: Array.from(game.players.values()),
          });
        }
      });
    }
  });

  // Handle disconnect
  socket.on("disconnect", () => {
    const connection = peerConnections.get(socket.id);
    if (connection) {
      const { peerId, gameId, isHost } = connection;

      if (isHost && gameId) {
        // Host disconnected, remove game
        activeGames.delete(gameId);
        console.log(`Signaling: Game removed: ${gameId}`);
      } else if (gameId) {
        // Player disconnected, remove from game
        const game = activeGames.get(gameId);
        if (game) {
          game.players.delete(peerId);

          // Notify remaining players
          game.players.forEach((player, playerId) => {
            const playerConnection = findPeerConnection(playerId);
            if (playerConnection) {
              playerConnection.socket.emit("player-left", {
                playerId,
                players: Array.from(game.players.values()),
              });
            }
          });
        }
      }

      peerConnections.delete(socket.id);
    }

    console.log(`Signaling: Peer disconnected: ${socket.id}`);
  });
});

// Helper function to find peer connection by peer ID
function findPeerConnection(peerId) {
  for (const [socketId, connection] of peerConnections) {
    if (connection.peerId === peerId) {
      return connection;
    }
  }
  return null;
}

const PORT = process.env.PORT || 3002;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Signaling server running on port ${PORT}`);
  console.log(`Local: http://localhost:${PORT}`);
  console.log(`Network: http://192.168.1.9:${PORT}`);
});

server.on("error", (error) => {
  console.error("Signaling server error:", error);
});

io.engine.on("connection_error", (err) => {
  console.error("Signaling server connection error:", err);
});


