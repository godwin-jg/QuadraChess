# Four Player Chess - P2P Multiplayer Setup

This guide explains how to set up and use the peer-to-peer (P2P) multiplayer version of Four Player Chess.

## Overview

The P2P implementation allows players to connect directly to each other without requiring a centralized server for game logic. This reduces latency and eliminates the need for a dedicated server, but requires a signaling server for initial connection establishment.

## Architecture

### Components

1. **P2P Service** (`services/p2pService.ts`) - Core WebRTC peer-to-peer communication
2. **Signaling Service** (`services/p2pSignalingService.ts`) - Handles initial connection setup
3. **Signaling Server** (`signaling-server.js`) - Central server for peer discovery and connection setup
4. **P2P Game Service** (`services/p2pGameService.ts`) - Integrates P2P with game logic
5. **P2P Lobby Screen** (`app/(tabs)/P2PLobbyScreen.tsx`) - UI for P2P game management

### How It Works

1. **Game Discovery**: Players discover available games through the signaling server
2. **Connection Setup**: WebRTC connections are established between peers using STUN servers
3. **Game State Sync**: Game state is synchronized directly between peers
4. **Move Broadcasting**: Moves are broadcast to all connected peers

## Prerequisites

- Node.js (v14 or higher)
- Expo CLI
- All devices must be on the same network (or have internet access for STUN servers)

## Setup Instructions

### 1. Install Dependencies

```bash
cd FourPlayerChess
npm install
```

### 2. Start the Signaling Server

The signaling server is required for initial peer discovery and connection setup:

```bash
npm run signaling-server
```

The signaling server will run on port 3002 by default.

### 3. Start the App

```bash
npm start
```

### 4. Configure P2P Settings

1. Open the app and go to the "P2P" tab
2. If needed, update the signaling server URL in the settings
3. The default server URL is `http://localhost:3002`

## How to Play P2P Multiplayer

### Creating a Game

1. **Open P2P Lobby**: Go to the "P2P" tab in the app
2. **Enter Name**: Enter your player name (or use the generated random name)
3. **Create Game**: Tap "Create P2P Game"
4. **Share Game**: Other players can now discover and join your game

### Joining a Game

1. **Open P2P Lobby**: Go to the "P2P" tab in the app
2. **Enter Name**: Enter your player name
3. **Join Game**: Tap "Join P2P Game" to see available games
4. **Select Game**: Choose a game from the list and tap to join

### Playing the Game

1. **Wait for Players**: The host can start the game when 2+ players have joined
2. **Start Game**: Host taps "Start Game" to begin
3. **Make Moves**: Players take turns making moves (same as other modes)
4. **Real-time Sync**: All moves are synchronized in real-time between peers

## Features

### P2P-Specific Features

- **Direct Peer Connections**: No centralized game server required
- **Low Latency**: Direct communication between players
- **Auto-Discovery**: Automatic discovery of available games
- **Connection Status**: Real-time connection status indicators
- **Peer ID Display**: Shows unique peer identifiers

### Game Features

- **Real-time Synchronization**: All moves are instantly shared
- **Player Management**: Automatic color assignment and turn tracking
- **Connection Monitoring**: Automatic detection of peer disconnections
- **Fallback Handling**: Graceful handling of connection failures

## Technical Details

### WebRTC Configuration

- **STUN Servers**: Google's public STUN servers for NAT traversal
- **Data Channels**: Reliable data channels for game communication
- **ICE Candidates**: Automatic ICE candidate exchange for connection establishment

### Message Types

- `join` - Player joining a game
- `leave` - Player leaving a game
- `move` - Game move data
- `gameState` - Complete game state synchronization
- `ping/pong` - Connection health monitoring
- `error` - Error messages

### Security Considerations

- **No Encryption**: Currently, messages are not encrypted (for development)
- **Peer Validation**: Basic validation of move data
- **Connection Limits**: Maximum 4 players per game

## Troubleshooting

### Common Issues

**Can't discover games:**

- Ensure the signaling server is running
- Check that all devices are on the same network
- Verify the signaling server URL is correct

**Can't connect to peers:**

- Check firewall settings
- Ensure STUN servers are accessible
- Try restarting the app

**Moves not syncing:**

- Check peer connection status
- Verify all players are connected
- Try reconnecting to the game

**Game not starting:**

- Ensure at least 2 players have joined
- Check that the host is connected
- Verify all players are in the same game

### Debug Information

- **Peer ID**: Each player has a unique peer identifier
- **Connection Status**: Shows real-time connection status
- **Signaling Server**: Displays current signaling server URL

## Development

### Adding New Features

1. **Message Types**: Add new message types in `p2pService.ts`
2. **Game Logic**: Extend `p2pGameService.ts` for new game features
3. **UI Components**: Update `P2PLobbyScreen.tsx` for new UI elements

### Testing

1. **Local Testing**: Use multiple devices on the same network
2. **Network Testing**: Test across different networks using STUN servers
3. **Connection Testing**: Test connection failures and recovery

## Limitations

### Current Limitations

- **No Encryption**: Messages are not encrypted
- **No TURN Servers**: May not work behind restrictive NATs
- **No Reconnection**: No automatic reconnection on connection loss
- **No Conflict Resolution**: Basic conflict resolution for concurrent moves

### Future Improvements

- **End-to-End Encryption**: Encrypt all P2P communications
- **TURN Server Support**: Add TURN servers for better NAT traversal
- **Automatic Reconnection**: Implement reconnection logic
- **Advanced Conflict Resolution**: Better handling of concurrent moves
- **Connection Quality Monitoring**: Monitor and display connection quality

## Comparison with Other Modes

| Feature           | P2P            | Local Server | Online |
| ----------------- | -------------- | ------------ | ------ |
| Setup Complexity  | Medium         | Low          | Low    |
| Latency           | Low            | Medium       | High   |
| Reliability       | Medium         | High         | High   |
| Server Required   | Signaling Only | Yes          | Yes    |
| Internet Required | For STUN       | No           | Yes    |
| Scalability       | Limited        | Medium       | High   |

## Support

For issues or questions about the P2P implementation:

1. Check the troubleshooting section above
2. Review the console logs for error messages
3. Verify network connectivity and firewall settings
4. Test with different devices and networks

The P2P implementation provides a unique gaming experience with low latency and minimal server requirements, making it ideal for local multiplayer games.


