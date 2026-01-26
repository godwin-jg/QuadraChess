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

function CustomTabBar({ state, navigation }: BottomTabBarProps) {
  const { bottom } = useSafeAreaInsets();

  return (
    <View style={[styles.container, { bottom: bottom + 12 }]}>
      <View style={styles.glassOuter}>
        <BlurView intensity={100} tint="systemChromeMaterialDark" style={styles.blur}>
          <View style={styles.tabBar}>
            {state.routes.map((route, index) => {
              const isFocused = state.index === index;
              const iconName = ICON_MAP[route.name] || "circle";

            return (
              <View key={route.key} style={styles.tabItem}>
                <TouchableOpacity
                  onPress={() => {
                    if (!isFocused) {
                      hapticsService.selection();
                      navigation.navigate(route.name);
                    }
                  }}
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
