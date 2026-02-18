import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import React from "react";
import { View, TouchableOpacity, useColorScheme, StyleSheet } from "react-native";
import { BlurView } from "expo-blur";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { hapticsService } from "@/services/hapticsService";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";

const ICON_MAP: Record<string, React.ComponentProps<typeof FontAwesome>["name"]> = {
  HomeScreen: "home",
  P2PLobbyScreen: "users",
  OnlineLobbyScreen: "globe",
  GameScreen: "gamepad",
};

import { store, resetGame } from "../../state";
import { Alert } from "react-native";
import { onlineSessionMachine as onlineGameService } from "../../services/onlineSessionMachine";
import p2pGameService from "../../services/p2pGameService";
import { botService } from "../../services/botService";
import { sendGameFlowEvent } from "../../services/gameFlowService";
import { resetOrchestrationState } from "../components/board/useBoardAnimationOrchestration";
import { resetAnimatorState } from "../components/board/SkiaMoveAnimator";

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();

  const handleTabPress = async (routeName: string, isFocused: boolean) => {
    if (isFocused) return;

    hapticsService.selection();

    const currentRoute = state.routes[state.index];
    const isSpectating =
      currentRoute.name === "GameScreen" &&
      (currentRoute.params as any)?.spectate === "true";

    if (isSpectating) {
      botService.cancelAllBotMoves();
      botService.cleanupBotMemory();
      sendGameFlowEvent({ type: "RESET" });
      resetOrchestrationState();
      resetAnimatorState();
      store.dispatch(resetGame());
      navigation.navigate(routeName);
      return;
    }

    // ✅ Check if game is actually in progress
    // Default state is now "waiting", so "active" means a real game is running
    const gameState = store.getState().game;
    const isInActiveGame = gameState.gameStatus === "active";

    // Only warn for multiplayer games (online/P2P), not for single player
    // Skip warning for GameScreen (that's where the game is - they're going TO it, not leaving it)
    const isMultiplayerGame = gameState.gameMode === "online" || gameState.gameMode === "p2p";
    const isNavigatingToGame = routeName === "GameScreen";
    
    if (isInActiveGame && isMultiplayerGame && !isNavigatingToGame) {
      const modeLabel = gameState.gameMode === "online" ? "online" : "P2P";
      Alert.alert(
        "Leave Game?",
        `You are in an ${modeLabel} game. Leaving will reset the game.`,
        [
          {
            text: "Cancel",
            style: "cancel",
          },
          {
            text: "Leave Anyway",
            style: "destructive",
            onPress: async () => {
              // ✅ Directly disconnect without going through modeSwitchService
              // This avoids any possibility of a second confirmation dialog
              try {
                // Resign/disconnect from online game
                if (onlineGameService.currentGameId && onlineGameService.isConnected) {
                  try {
                    await onlineGameService.resignGame();
                  } catch (e) {
                    await onlineGameService.disconnect();
                  }
                } else if (onlineGameService.isConnected) {
                  await onlineGameService.disconnect();
                }
                
                // Disconnect from P2P game
                if (p2pGameService.isConnected && p2pGameService.currentGameId) {
                  try {
                    await p2pGameService.disconnect();
                  } catch (e) {
                    console.warn("P2P disconnect failed:", e);
                  }
                }
                
                // Cancel bot moves and reset game state
                botService.cancelAllBotMoves();
                store.dispatch(resetGame());
                
                // Small delay to ensure cleanup completes
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (error) {
                console.error("Error during tab switch disconnect:", error);
              }
              
              // Navigate to the target screen
              navigation.navigate(routeName);
            },
          },
        ]
      );
    } else {
      // Not in a game, just navigate
      navigation.navigate(routeName);
    }
  };

  return (
    <View style={[styles.container, { bottom: bottom + 12 }]}>
      <View style={styles.glassOuter}>
        <BlurView intensity={100} tint="systemChromeMaterialDark" style={styles.blur}>
          <View style={styles.tabBar}>
            {state.routes
              .filter((route) => route.name !== "TutorialScreen")
              .map((route) => {
                const isFocused = state.index === state.routes.findIndex(r => r.key === route.key);
                const iconName = ICON_MAP[route.name] || "circle";

                return (
                  <View key={route.key} style={styles.tabItem}>
                    <TouchableOpacity
                      onPress={() => handleTabPress(route.name, isFocused)}
                      activeOpacity={0.7}
                      style={[styles.iconWrap, isFocused && styles.iconWrapActive]}
                    >
                      <FontAwesome
                        name={iconName}
                        size={20}
                        color={isFocused ? "#FFFFFF" : "rgba(255,255,255,0.4)"}
                      />
                    </TouchableOpacity>
                  </View>
                );
              })}
          </View>
        </BlurView>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      tabBar={(props) => <CustomTabBar {...props} />}
      initialRouteName="HomeScreen"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        lazy: true,
        detachInactiveScreens: true,
        freezeOnBlur: true,
      }}
    >
      <Tabs.Screen name="HomeScreen" options={{ title: "Home" }} />
      <Tabs.Screen name="P2PLobbyScreen" options={{ title: "Local" }} />
      <Tabs.Screen name="OnlineLobbyScreen" options={{ title: "Online" }} />
      <Tabs.Screen name="GameScreen" options={{ title: "Game" }} />
      <Tabs.Screen name="TutorialScreen" options={{ href: null }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 24,
    right: 24,
  },
  glassOuter: {
    borderRadius: 28,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "rgba(255, 255, 255, 0.2)",
  },
  blur: {
    overflow: "hidden",
  },
  tabBar: {
    flexDirection: "row",
    height: 56,
    alignItems: "center",
    justifyContent: "space-around",
  },
  tabItem: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  iconWrapActive: {
    backgroundColor: "rgba(255, 255, 255, 0.15)",
  },
});
