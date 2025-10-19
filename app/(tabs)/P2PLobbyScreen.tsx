import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useDispatch, useSelector } from "react-redux";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { RootState } from "../../state/store";
import { 
  resetGame, 
  setCurrentGame, 
  setDiscoveredGames, 
  setIsLoading, 
  setIsConnected, 
  setConnectionError, 
  setIsEditingName, 
  setTempName,
  syncP2PGameState,
  setPlayers,
  setIsHost,
  setCanStartGame,
  setBotPlayers
} from "../../state/gameSlice";
import { useSettings } from "../../context/SettingsContext";
import p2pService, { P2PGame, P2PPlayer } from "../../services/p2pService";
import networkDiscoveryService from "../../services/networkDiscoveryService";
import GridBackground from "../components/ui/GridBackground";
import AnimatedButton from "../components/ui/AnimatedButton";
import { hapticsService } from "../../services/hapticsService";

const P2PLobbyScreen: React.FC = () => {
  const dispatch = useDispatch();
  const router = useRouter();
  const { settings, updateProfile } = useSettings();
  const insets = useSafeAreaInsets();
  
  // Track if this screen is actually focused/visible
  const [isFocused, setIsFocused] = useState(false);
  
  // Only log when actually focused
  if (isFocused) {
  }

  // ✅ All state now comes from Redux
  const {
    players,
    isHost,
    canStartGame,
    currentGame,
    discoveredGames,
    isLoading,
    isConnected,
    connectionError,
    isEditingName,
    tempName,
    botPlayers,
  } = useSelector((state: RootState) => state.game);

  // ✅ No more event listeners! All state comes from Redux
  // The P2P service now directly updates Redux state
  
  // Handle navigation when game starts - only when focused
  useEffect(() => {
    if (!isFocused) return; // Only run when screen is actually focused
    
    if (currentGame && currentGame.status === 'playing' && !isHost) {
      try {
        router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=p2p`);
      } catch (navError) {
        // Navigation error handled silently
      }
    }
  }, [currentGame, isHost, router, isFocused]);

  // Auto-discover games on mount - only when focused
  useEffect(() => {
    if (!isFocused) return; // Only run when screen is actually focused
    
    // Start real-time discovery - P2P service handles updates automatically
    p2pService.discoverGames().catch(error => {
      console.error("Error starting discovery:", error);
    });

    // Cleanup: Stop discovery when component unmounts or loses focus
    return () => {
      try {
        networkDiscoveryService.stopDiscovery();
        p2pService.stopDiscovery();
      } catch (error) {
        console.error("Error stopping discovery:", error);
      }
    };
  }, [isFocused]);

  // Handle discovery when screen gains/loses focus
  useFocusEffect(
    React.useCallback(() => {
      // Screen is focused - set focus state and start discovery
      setIsFocused(true);
      
      try {
        p2pService.discoverGames().catch(error => {
          console.error("Error restarting discovery on focus:", error);
        });
      } catch (error) {
        console.error("Error starting discovery on focus:", error);
      }

      // Set up periodic refresh every 5 seconds while screen is focused
      const refreshInterval = setInterval(() => {
        p2pService.discoverGames().catch(error => {
          console.error("Error in periodic discovery:", error);
        });
      }, 5000);
      
      // Return cleanup function when screen loses focus
      return () => {
        setIsFocused(false);
        clearInterval(refreshInterval);
        try {
          networkDiscoveryService.stopDiscovery();
          p2pService.stopDiscovery();
        } catch (error) {
          console.error("Error stopping discovery on focus loss:", error);
        }
      };
    }, [])
  );

  // Name editing functions
  const startEditingName = () => {
    dispatch(setTempName(settings.profile.name));
    dispatch(setIsEditingName(true));
  };

  const saveName = () => {
    if (tempName.trim()) {
      updateProfile({ name: tempName.trim() });
    }
    dispatch(setIsEditingName(false));
  };

  // Toggle bot status for a player color (host only)
  const toggleBotPlayer = (color: string) => {
    if (!isHost) {
      return;
    }
    
    const newBotPlayers = botPlayers.includes(color)
      ? botPlayers.filter(c => c !== color)
      : [...botPlayers, color];
    
    dispatch(setBotPlayers(newBotPlayers));
  };

  // Create a new P2P game
  const createGame = async () => {
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    dispatch(setIsLoading(true));
    dispatch(setConnectionError(null));
    try {
      dispatch(resetGame());
      
      const game = await p2pService.createGame(settings.profile.name.trim());
      // ✅ P2P service now updates Redux directly, no need to set local state
      
      // 🔊 Play success sound for creating game
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playSuccessSound();
      } catch (error) {
      }
      
      console.log("P2P Game created:", game);
    } catch (error) {
      console.error("Error creating P2P game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to create game";
      dispatch(setConnectionError(errorMessage));
      Alert.alert("Error", errorMessage);
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  // Join a discovered game
  const joinGame = async (gameId: string) => {
    
    if (!settings.profile.name.trim()) {
      Alert.alert("Error", "Please enter a name");
      return;
    }

    dispatch(setIsLoading(true));
    dispatch(setConnectionError(null));
    try {
      dispatch(resetGame());
      
      // Find the game in discovered games to set currentGame as fallback
      const gameToJoin = discoveredGames.find(game => game.id === gameId);
      if (gameToJoin) {
        console.log("Setting currentGame from discovered games:", gameToJoin);
        dispatch(setCurrentGame({
          id: gameToJoin.id,
          name: gameToJoin.name,
          hostName: gameToJoin.hostName,
          hostId: gameToJoin.hostId,
          hostIP: gameToJoin.hostIP,
          port: gameToJoin.port,
          joinCode: gameToJoin.joinCode,
          playerCount: gameToJoin.playerCount,
          maxPlayers: gameToJoin.maxPlayers,
          status: "waiting",
          createdAt: gameToJoin.createdAt || Date.now(),
          timestamp: Date.now(),
        }));
      }
      
      await p2pService.joinDiscoveredGame(gameId, settings.profile.name.trim());
      
      // 🔊 Play success sound for joining game
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playSuccessSound();
      } catch (error) {
      }
      
      console.log("Joined P2P game:", gameId);
    } catch (error) {
      console.error("Error joining P2P game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to join game";
      dispatch(setConnectionError(errorMessage));
      Alert.alert("Error", errorMessage);
      // Reset currentGame on error
      dispatch(setCurrentGame(null));
    } finally {
      dispatch(setIsLoading(false));
    }
  };


  // Start the game (host only)
  const startGame = async () => {
    if (!isHost || !currentGame) return;
    
    dispatch(setIsLoading(true));
    try {
      // Check if all players are connected before starting
      const allPlayersConnected = players.every(p => p.isHost || p.connectionState === 'connected');
      players.forEach((player: any) => {
      });
      
      // ✅ Include botPlayers in the initial game state
      
      // This will update the host's state and trigger the sync to clients
      p2pService.sendGameStarted(); 
      
      // 🔊 Play game start sound
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playGameStartSound();
      } catch (error) {
      }
      
      // The host navigates itself
      try {
        router.push(`/(tabs)/GameScreen?gameId=${currentGame.id}&mode=p2p`);
      } catch (navError) {
      }
    } catch (error) {
      console.error("Error starting game:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start game";
      Alert.alert("Error", errorMessage);
    } finally {
      dispatch(setIsLoading(false));
    }
  };

  // Leave the game - manual state reset
  const leaveGame = () => {
    console.log("P2PLobbyScreen: Leaving game manually...");
    
    try {
      // 1. Try to disconnect from P2P service (but don't rely on it for state)
      try {
        (p2pService as any).disconnect(false); // Don't notify UI to avoid connection error
        console.log("P2PLobbyScreen: P2P service disconnected");
      } catch (p2pError) {
        console.warn("P2PLobbyScreen: P2P disconnect failed, continuing with manual reset:", p2pError);
      }
      
      // 2. Stop discovery if running
      try {
        p2pService.stopDiscovery();
        console.log("P2PLobbyScreen: Discovery stopped");
      } catch (discoveryError) {
        console.warn("P2PLobbyScreen: Stop discovery failed:", discoveryError);
      }
      
      // 3. Manually reset all Redux state
      console.log("P2PLobbyScreen: Resetting Redux state manually...");
      
      // Clear connection error first to prevent "Connection lost" message
      dispatch(setConnectionError(null));
      
      // Reset game state
      dispatch(resetGame());
      
      // Clear P2P-specific state
      dispatch(setCurrentGame(null));
      dispatch(setPlayers([]));
      dispatch(setIsHost(false));
      dispatch(setCanStartGame(false));
      dispatch(setIsConnected(false));
      dispatch(setConnectionError(null));
      dispatch(setIsLoading(false));
      
      // Clear editing state
      dispatch(setIsEditingName(false));
      dispatch(setTempName(""));
       
      // Clear P2P game state
      dispatch(syncP2PGameState(null));
      
      console.log("P2PLobbyScreen: Manual state reset completed successfully");
      
    } catch (error) {
      console.error("P2PLobbyScreen: Error during manual leave game:", error);
      
      // Even if there's an error, try to reset the critical state
      try {
        dispatch(setConnectionError(null)); // Clear connection error first
        dispatch(resetGame());
        dispatch(setCurrentGame(null));
        dispatch(setPlayers([]));
        dispatch(setIsHost(false));
        dispatch(setIsConnected(false));
        console.log("P2PLobbyScreen: Emergency state reset completed");
      } catch (emergencyError) {
        console.error("P2PLobbyScreen: Emergency state reset failed:", emergencyError);
      }
    }
  };

  // Render discovered game item
  const renderGameItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        className="bg-white/10 p-4 rounded-xl mb-3 border border-white/20"
        onPress={() => joinGame(item.id)}
        disabled={isLoading}
      >
        <View className="flex-row justify-between items-center">
          <View>
            <Text className="text-white text-lg font-bold">
              {item.hostName}'s Game
            </Text>
            <Text className="text-gray-300 text-sm">
              {item.playerCount}/{item.maxPlayers} players
            </Text>
            <Text className="text-gray-400 text-xs">
              Code: {item.joinCode}
            </Text>
          </View>
          <View className="items-end">
            <Text className="text-green-400 text-sm">Available</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  // Show connection error screen
  if (connectionError) {
    return (
      <View className="flex-1 bg-black justify-center items-center p-6">
        <Text className="text-red-400 text-xl font-bold mb-4">Connection Error</Text>
        <Text className="text-white text-lg text-center mb-6">{connectionError}</Text>
        <TouchableOpacity
          className="w-full py-4 px-6 rounded-xl bg-white shadow-lg"
          onPress={() => {
            dispatch(setConnectionError(null));
            dispatch(setIsConnected(true));
          }}
        >
          <Text className="text-black text-xl font-bold text-center">Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // Show loading screen
  if (isLoading) {
    return (
      <View className="flex-1 bg-black justify-center items-center">
        <ActivityIndicator size="large" color="#ffffff" />
        <Text className="text-white text-lg mt-4">
          {isHost ? "Creating game..." : "Joining game..."}
        </Text>
      </View>
    );
  }

  // In-game waiting room
  if (currentGame) {
    return (
      <SafeAreaView style={{ flex: 1 }} className="bg-black p-6">
        {/* Subtle blueprint grid background */}
        <GridBackground />
        
        <View className="items-center mb-8">
          <Text className="text-gray-300 text-sm mb-3">Playing as:</Text>
          {isEditingName ? (
            <TextInput
              className="text-white text-2xl font-bold text-center border-b border-white/30 pb-1"
              value={tempName}
              onChangeText={setTempName}
              onSubmitEditing={saveName}
              onBlur={saveName}
              autoFocus
              placeholder="Enter name"
              placeholderTextColor="#9CA3AF"
            />
          ) : (
            <TouchableOpacity onPress={() => {
              hapticsService.selection();
              startEditingName();
            }}>
              <Text className="text-white text-2xl font-bold">
                {settings.profile.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>

        <View className="bg-white/10 p-6 rounded-xl mb-6 items-center">
          <Text className="text-white text-xl font-bold mb-4 text-center">
            Waiting for Players
          </Text>
          
          <Text className="text-gray-300 text-sm mb-4 text-center">
            Join Code: <Text className="text-white font-bold">{currentGame.joinCode}</Text>
          </Text>

          <View className="space-y-3 w-full">
            <Text className="text-white text-lg font-semibold mb-2 text-center">Players ({players.length + botPlayers.length})</Text>
            {/* ✅ CRITICAL FIX: Show both human players and bot players */}
            {(() => {
              const allPlayers = [
                // Human players
                ...players.map(player => ({ ...player, isBot: false })),
                // Bot players
                ...botPlayers.map(color => ({
                  id: `bot_${color}`,
                  name: `Bot ${color.toUpperCase()}`,
                  color: color,
                  isHost: false,
                  isConnected: true,
                  connectionState: 'bot',
                  isBot: true
                }))
              ];
              
              return allPlayers.length > 0 ? (
                allPlayers.map((player, index) => (
                  <View
                    key={player.id}
                    className="flex-row items-center justify-between"
                  >
                    <Text className="text-white text-lg">
                      {player.name} {player.isHost && "(Host)"} {player.isBot && "🤖"}
                    </Text>
                    <View className="flex-row items-center">
                      <View
                        className={`w-3 h-3 rounded-full mr-2 ${
                          player.color === "r"
                            ? "bg-red-500"
                            : player.color === "b"
                              ? "bg-blue-500"
                              : player.color === "y"
                                ? "bg-purple-500"
                                : player.color === "g"
                                  ? "bg-green-500"
                                  : "bg-gray-500"
                        }`}
                      />
                      <Text className="text-gray-400 text-sm">
                        {player.isBot ? 'Bot' : (player.connectionState || 'connected')}
                      </Text>
                    </View>
                  </View>
                ))
              ) : (
                <Text className="text-gray-400 text-center">No players yet</Text>
              );
            })()}
            
            {/* Bot Configuration Section (Host Only) */}
            {isHost && (
              <View className="mt-4 pt-4 border-t border-white/20">
                <Text className="text-white text-lg font-semibold mb-3 text-center">Bot Configuration</Text>
                <Text className="text-gray-400 text-sm mb-3 text-center">
                  Tap to toggle bot players (host controls all bots)
                </Text>
                <View className="flex-row justify-around">
                  {['r', 'b', 'y', 'g'].map((color) => {
                    const isBot = botPlayers.includes(color);
                    const colorName = color === 'r' ? 'Red' : color === 'b' ? 'Blue' : color === 'y' ? 'Yellow' : 'Green';
                    const colorClass = color === 'r' ? 'bg-red-500' : color === 'b' ? 'bg-blue-500' : color === 'y' ? 'bg-purple-500' : 'bg-green-500';
                    
                    return (
                      <TouchableOpacity
                        key={color}
                        className={`flex-1 mx-1 py-3 px-2 rounded-lg border-2 ${
                          isBot ? 'border-green-400 bg-green-500/20' : 'border-white/30 bg-white/10'
                        }`}
                        onPress={() => {
                          hapticsService.selection();
                          toggleBotPlayer(color);
                        }}
                      >
                        <View className="items-center">
                          <View className={`w-4 h-4 rounded-full mb-1 ${colorClass}`} />
                          <Text className={`text-xs font-semibold ${isBot ? 'text-green-400' : 'text-gray-300'}`}>
                            {colorName}
                          </Text>
                          <Text className={`text-xs ${isBot ? 'text-green-300' : 'text-gray-400'}`}>
                            {isBot ? '🤖 Bot' : '👤 Human'}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        </View>

        {isHost && (
          <View className="items-center gap-4 mb-4">
            {/* ✅ CRITICAL FIX: Check total players (human + bot) instead of just human players */}
            {(() => {
              const totalPlayers = players.length + botPlayers.length;
              return totalPlayers < 4 && (
                <Text className="text-gray-400 text-sm mb-3">
                  Need exactly 4 players to start ({totalPlayers}/4)
                </Text>
              );
            })()}
            <TouchableOpacity
              className="w-full py-3 px-6 rounded-xl shadow-lg overflow-hidden"
              onPress={startGame}
              disabled={(() => {
                const totalPlayers = players.length + botPlayers.length;
                return totalPlayers !== 4 || isLoading;
              })()}
            >
              <LinearGradient
                colors={(() => {
                  const totalPlayers = players.length + botPlayers.length;
                  return totalPlayers !== 4 || isLoading ? ['#6b7280', '#4b5563'] : ['#ffffff', '#f0f0f0'];
                })()}
                style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
              />
              <Text 
                className={`text-lg font-bold text-center ${
                  (() => {
                    const totalPlayers = players.length + botPlayers.length;
                    return totalPlayers !== 4 || isLoading;
                  })()
                    ? "text-gray-300" 
                    : "text-black"
                }`}
                style={{
                  fontWeight: '900',
                  letterSpacing: 1.2,
                  textShadowColor: 'rgba(0,0,0,0.3)',
                  textShadowOffset: {width: 1, height: 1},
                  textShadowRadius: 2,
                  textTransform: 'uppercase',
                }}
              >
                {(() => {
                  const totalPlayers = players.length + botPlayers.length;
                  if (isLoading) return "Starting...";
                  if (totalPlayers !== 4) return "Waiting for players...";
                  return "Start Game";
                })()}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          className="w-full py-3 px-6 rounded-xl overflow-hidden"
          onPress={leaveGame}
          disabled={isLoading}
        >
          <LinearGradient
            colors={['#ef4444', '#dc2626']}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
          />
          <Text 
            className="text-white text-lg font-bold text-center"
            style={{
              fontWeight: '900',
              letterSpacing: 1.2,
              textShadowColor: 'rgba(0,0,0,0.3)',
              textShadowOffset: {width: 1, height: 1},
              textShadowRadius: 2,
              textTransform: 'uppercase',
            }}
          >
            Leave Game
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Main menu
  return (
    <SafeAreaView style={{ flex: 1, marginBottom: 80 }} className="bg-black p-6">
      {/* Subtle blueprint grid background */}
      <GridBackground />
      <View className="items-center mb-8">
        <Text className="text-gray-300 text-sm mb-3">Playing as:</Text>
        {isEditingName ? (
          <TextInput
            className="text-white text-2xl font-bold text-center border-b border-white/30 pb-1"
            value={tempName}
            onChangeText={setTempName}
            onSubmitEditing={saveName}
            onBlur={saveName}
            autoFocus
            placeholder="Enter name"
            placeholderTextColor="#9CA3AF"
          />
        ) : (
          <TouchableOpacity onPress={() => {
            hapticsService.selection();
            startEditingName();
          }}>
            <Text className="text-white text-2xl font-bold">{settings.profile.name}</Text>
          </TouchableOpacity>
        )}
        
        {/* Connection status indicator */}
        <View className="flex-row items-center mt-2">
          <View className={`w-2 h-2 rounded-full mr-2 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <Text className="text-gray-400 text-sm">
            {isConnected ? 'Connected' : 'Disconnected'}
          </Text>
        </View>
      </View>

      <View className="mb-8">
        <AnimatedButton
          icon="🎮"
          title="Create Game"
          subtitle={isLoading ? "Creating..." : "Start a new game"}
          gradientColors={['#ffffff', '#f0f0f0']}
          textColor="black"
          subtitleColor="gray-600"
          onPress={createGame}
          disabled={isLoading}
          delay={0}
        />

        <View style={{ marginTop: 16 }}>
          <AnimatedButton
            icon="🏠"
            title="Back to Home"
            subtitle="Return to main menu"
            gradientColors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
            textColor="white"
            subtitleColor="gray-300"
            onPress={() => {
              try {
                router.back();
              } catch (navError) {
              }
            }}
            disabled={false}
            delay={150}
          />
        </View>
      </View>

      <View className="flex-1 items-center">
        <View className="flex-row items-center justify-between w-full mb-4">
          <Text className="text-white text-xl font-bold text-center flex-1">
            Available Games
          </Text>
          <TouchableOpacity
            onPress={() => {
              p2pService.discoverGames().catch(error => {
                console.error("Error refreshing games:", error);
              });
            }}
            className="bg-blue-500 px-3 py-2 rounded-lg"
          >
            <Text className="text-white text-sm font-semibold">Refresh</Text>
          </TouchableOpacity>
        </View>

        {discoveredGames.length === 0 ? (
          <Text className="text-gray-400 text-center mt-8 pb-4">
            The arena stands empty... Be the first to spill digital blood!
          </Text>
        ) : (
          <View style={{ position: 'relative', width: '100%' }}>
            <FlatList
              data={discoveredGames
                .slice()
                .sort((a, b) => {
                  // Sort by timestamp (newest first), with createdAt as fallback
                  const timestampA = a.timestamp || a.createdAt || 0;
                  const timestampB = b.timestamp || b.createdAt || 0;
                  return timestampB - timestampA;
                })}
              renderItem={renderGameItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              style={{ 
                width: '100%',
                maxHeight: 300, // Constrain height to prevent going behind tab bar
              }}
              contentContainerStyle={{ paddingBottom: 20 }}
            />
            {/* Smooth fade-out gradient overlay */}
            <LinearGradient
              colors={['transparent', 'rgba(0, 0, 0, 0.8)', 'rgba(0, 0, 0, 1)']}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                height: 40,
                pointerEvents: 'none',
              }}
            />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
};

export default P2PLobbyScreen;