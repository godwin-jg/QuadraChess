# Firebase Setup for Online Multiplayer

## 🔥 Firebase Configuration

This app uses Firebase for online multiplayer functionality. Here's what's been set up:

### 1. **Firebase Project**

- Project ID: `dchess-97670`
- Package Name: `com.jgnsecrets.chess4d`

### 2. **Services Used**

- **Authentication**: Anonymous sign-in for quick play
- **Firestore**: Real-time database for game state and player management
- **Security Rules**: Basic rules for data access control

### 3. **Database Structure**

#### Games Collection (`/games/{gameId}`)

```javascript
{
  id: string,
  hostId: string,
  hostName: string,
  players: Player[],
  gameState: GameState,
  status: 'waiting' | 'playing' | 'finished',
  createdAt: timestamp,
  maxPlayers: 4,
  currentPlayerTurn: string,
  winner: string | null
}
```

#### Moves Collection (`/moves/{gameId}/moves/{moveId}`)

```javascript
{
  playerId: string,
  move: MoveData,
  timestamp: timestamp
}
```

### 4. **Security Rules**

- Games are readable by all authenticated users
- Only players in a game can write to it
- Moves are readable by all authenticated users
- Only authenticated users can create moves

### 5. **Features Implemented**

- ✅ Anonymous authentication
- ✅ Game creation and joining
- ✅ Real-time player updates
- ✅ Game state synchronization
- ✅ Host controls (start game, assign new host on leave)
- ✅ Player management (join, leave, color assignment)

### 6. **Next Steps**

1. Deploy Firestore rules to Firebase Console
2. Test online multiplayer functionality
3. Add move validation and turn management
4. Implement offline support
5. Add error handling and user feedback

## 🚀 Testing

1. Run the app: `npx expo start`
2. Click "Online Multiplayer"
3. Create a game or join an existing one
4. Test real-time updates with multiple devices

## 📱 Firebase Console

Access your Firebase project at: https://console.firebase.google.com/project/dchess-97670


