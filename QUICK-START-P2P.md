# Quick Start Guide - P2P Multiplayer

## 🚀 Getting Started

The P2P implementation is now ready! Here's how to test it:

### 1. Start the Signaling Server

```bash
# In Terminal 1
cd /home/jg/Documents/jg_codes/Play/FourPlayerChess
npm run signaling-server
```

You should see:

```
Signaling server running on port 3002
Local: http://localhost:3002
Network: http://192.168.1.9:3002
```

### 2. Start the App

```bash
# In Terminal 2
cd /home/jg/Documents/jg_codes/Play/FourPlayerChess
npm start
```

### 3. Test P2P Multiplayer

1. **Open the app** on your device/emulator
2. **Go to the "P2P" tab** (new tab in the bottom navigation)
3. **Create a game:**
   - Enter your name
   - Tap "Create P2P Game"
   - You'll see "Game Created!" message
4. **Join from another device:**
   - Open the app on another device
   - Go to "P2P" tab
   - Tap "Join P2P Game"
   - Select the game you created
   - Enter your name and join

### 4. Play the Game

- Once 2+ players have joined, the host can tap "Start Game"
- All players will be taken to the game screen
- Make moves normally - they'll sync in real-time between all players!

## 🔧 Troubleshooting

### If you can't see the P2P tab:

- Make sure you've restarted the app after installing dependencies
- Check that the app built successfully

### If you can't connect:

- Ensure the signaling server is running (Terminal 1)
- Check that both devices are on the same network
- Try restarting the app

### If moves don't sync:

- Check the connection status indicators in the P2P lobby
- Try leaving and rejoining the game
- Restart the signaling server if needed

## 🎯 What's Different from Local Server Mode

| Feature             | Local Server          | P2P                            |
| ------------------- | --------------------- | ------------------------------ |
| **Setup**           | Run `node server.js`  | Run `npm run signaling-server` |
| **Latency**         | Medium (via server)   | Low (direct connection)        |
| **Server Required** | Laptop running server | Only signaling server          |
| **Connection**      | All players → Server  | Players ↔ Players              |
| **Reliability**     | High                  | Medium                         |

## 🧪 Testing the Implementation

### Test the Signaling Server:

```bash
node test-p2p.js
```

### Test Multiple Devices:

1. Start signaling server
2. Open app on Device 1 → Create P2P game
3. Open app on Device 2 → Join P2P game
4. Play and verify moves sync in real-time

## 📱 Features to Try

- **Game Discovery**: See available games automatically
- **Real-time Connection**: Watch connection status indicators
- **Direct Communication**: Experience lower latency moves
- **Peer Management**: See all connected players
- **Automatic Reconnection**: Handles connection issues gracefully

## 🎉 Success!

If everything works, you now have a fully functional P2P multiplayer chess game! Players can connect directly to each other without needing a laptop running the game server.

The P2P implementation provides:

- ✅ Lower latency than server-based multiplayer
- ✅ No need for a dedicated game server
- ✅ Real-time synchronization
- ✅ Automatic peer discovery
- ✅ Seamless integration with existing game logic

Enjoy your new P2P multiplayer chess experience! 🎮♟️


