# Four Player Chess - Local Multiplayer Setup

This guide explains how to set up and run the local multiplayer version of Four Player Chess.

## Prerequisites

- Node.js (v14 or higher)
- Expo CLI
- All devices must be on the same Wi-Fi network

## Server Setup

1. **Install server dependencies:**

   ```bash
   cd FourPlayerChess
   npm install express socket.io@2.5.0 cors
   npm install -D nodemon
   ```

2. **Start the server:**

   ```bash
   node server.js
   ```

   Or for development with auto-restart:

   ```bash
   npx nodemon server.js
   ```

3. **Find your server IP:**
   - On Windows: `ipconfig`
   - On Mac/Linux: `ifconfig` or `ip addr`
   - Look for your Wi-Fi adapter's IP address (usually starts with 192.168.x.x)

## Client Setup

1. **Install client dependencies:**

   ```bash
   npx expo install socket.io-client@2.5.0
   ```

2. **Start the Expo development server:**

   ```bash
   npx expo start
   ```

3. **Connect devices:**
   - Scan the QR code with Expo Go app on your phone
   - Or use the web version in your browser

## How to Play Multiplayer

1. **Host a Game:**
   - Open the app on the first device
   - Go to the Lobby screen
   - Enter your name and server IP
   - Click "Connect"
   - Click "Create Room"
   - Share the Room ID with other players

2. **Join a Game:**
   - Open the app on other devices
   - Go to the Lobby screen
   - Enter your name and the same server IP
   - Click "Connect"
   - Enter the Room ID from the host
   - Click "Join Room"

3. **Start the Game:**
   - Once all players have joined (2-4 players)
   - The host clicks "Start Game"
   - All players will be taken to the game screen
   - Players take turns making moves
   - Moves are synchronized across all devices

## Features

- **Real-time synchronization** - All moves are instantly shared
- **Player management** - Automatic color assignment and turn tracking
- **Room system** - Private rooms for each game
- **Host controls** - Only the host can start the game
- **Disconnection handling** - Graceful handling of player disconnections

## Troubleshooting

**Can't connect to server:**

- Make sure all devices are on the same Wi-Fi network
- Check that the server IP address is correct
- Ensure the server is running and accessible

**Moves not syncing:**

- Check that all devices are connected to the same room
- Verify the server is running
- Try disconnecting and reconnecting

**Game not starting:**

- Make sure at least 2 players have joined
- Only the host can start the game
- Check that all players are connected

## Server Configuration

The server runs on port 3000 by default. To change this:

1. Set the `PORT` environment variable:

   ```bash
   PORT=8080 node server.js
   ```

2. Update the client to use the new port:
   - Change the port in the Lobby screen
   - Or modify the default in `networkService.ts`

## Development

To modify the server:

1. Edit `server.js` for server-side changes
2. Edit `app/services/networkService.ts` for client-side network logic
3. Edit `app/screens/LobbyScreen.tsx` for the lobby interface

The server handles:

- Room creation and management
- Player connections and disconnections
- Move broadcasting
- Game state synchronization

The client handles:

- Connection to server
- UI for lobby and game
- Move validation and sending
- State synchronization
