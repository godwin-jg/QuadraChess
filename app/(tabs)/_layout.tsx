import FontAwesome from "@expo/vector-icons/FontAwesome";
import { Tabs } from "expo-router";
import React, { useState } from "react";
import { View, Text, TouchableOpacity, useColorScheme, StyleSheet, LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { useAnimatedStyle, withSpring, useSharedValue, runOnUI, measure, useDerivedValue } from "react-native-reanimated";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/Colors";
import { hapticsService } from "@/services/hapticsService";

// --- Helper Components ---
function TabBarIcon(props: { name: React.ComponentProps<typeof FontAwesome>["name"]; color: string; }) {
  return <FontAwesome size={22} {...props} />;
}

const iconMap: { [key: string]: React.ComponentProps<typeof FontAwesome>["name"] } = {
  'HomeScreen': 'home', 'P2PLobbyScreen': 'users', 'OnlineLobbyScreen': 'globe', 'GameScreen': 'gamepad',
};

// --- The NEW Custom Tab Bar Component ---
function CustomTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const [layouts, setLayouts] = useState<Record<string, { x: number; width: number }>>({});
  const activeIndex = useSharedValue(state.index);
  const { bottom } = useSafeAreaInsets(); // Get the bottom inset value

  // Animate the pill's position and width based on the active index
  const pillStyle = useAnimatedStyle(() => {
    // ✅ Hide pill until all tabs are measured to prevent initial flicker
    if (Object.keys(layouts).length !== state.routes.length) {
      return { opacity: 0 };
    }
    const activeLayout = layouts[state.routes[activeIndex.value].key];
    if (!activeLayout) return {};
    return {
      opacity: 1,
      transform: [{ translateX: withSpring(activeLayout.x, { damping: 15, stiffness: 120 }) }],
      width: withSpring(activeLayout.width, { damping: 15, stiffness: 120 }),
    };
  });

  // Update the active index when the state changes
  React.useEffect(() => {
    activeIndex.value = state.index;
  }, [state.index]);

  return (
    <View style={[styles.tabBarContainer, { bottom: bottom + 10 }]}>
      <View style={styles.tabBar}>
        {/* ✅ Ultra transparent with sun reflection effect */}
        <LinearGradient
          // Ultra transparent gradient with sun reflection
          colors={[
            'rgba(255, 255, 255, 0.1)', // Sun reflection highlight
            'rgba(39, 39, 42, 0.15)',   // Very light gray
            'rgba(24, 24, 27, 0.2)',    // Slightly darker gray
            'rgba(15, 15, 15, 0.25)'    // Subtle dark base
          ]} 
          style={StyleSheet.absoluteFill}
        />

        {/* The single, animated sliding pill */}
        <Animated.View style={[styles.activePill, pillStyle]}>
          <LinearGradient
            colors={[
              'rgba(255, 255, 255, 0.3)', // Top reflection highlight
              'rgba(96, 165, 250, 0.6)',   // Light blue
              'rgba(59, 130, 246, 0.7)',   // Medium blue
              'rgba(29, 78, 216, 0.8)',    // Dark blue
              'rgba(15, 23, 42, 0.9)'      // Deep shadow
            ]}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>
        
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const { options } = descriptors[route.key];
          const label = options.title !== undefined ? options.title : route.name;
          const iconName = iconMap[route.name] || 'circle';

          const textStyle = useAnimatedStyle(() => ({
            opacity: withSpring(isFocused ? 1 : 0),
            transform: [{ translateX: withSpring(isFocused ? 0 : -10) }],
            marginLeft: isFocused ? 8 : 0, // Add space between icon and text only when visible
            width: withSpring(isFocused ? 'auto' : 0), // Animate width to prevent text wrapping
          }));

          return (
            <TouchableOpacity
              key={route.key}
              onPress={() => {
                // 🔊 Play haptic feedback for tab button press
                hapticsService.selection();
                navigation.navigate(route.name);
              }}
              onLayout={(event) => {
                const { x, width } = event.nativeEvent.layout;
                setLayouts(prev => ({ ...prev, [route.key]: { x, width } }));
              }}
              style={styles.tabItem}
            >
              <TabBarIcon name={iconName} color={'#FFFFFF'} />
              <Animated.Text style={[styles.labelText, textStyle]}>
                {label}
              </Animated.Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}


// --- The Main Layout ---
export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      // Use our custom component for the tab bar
      tabBar={(props) => <CustomTabBar {...props} />}
      initialRouteName="HomeScreen"
      screenOptions={{
        // Hide all default headers for a fully custom/immersive look
        headerShown: false,
        tabBarActiveTintColor: Colors[colorScheme ?? "light"].tint,
        // ✅ Removed the 'animation' prop as it's not applicable for Tab Navigators
      }}
    >
      <Tabs.Screen
        name="HomeScreen"
        options={{
          title: "Home",
        }}
      />
      <Tabs.Screen
        name="P2PLobbyScreen"
        options={{
          title: "Local",
        }}
      />
      <Tabs.Screen
        name="OnlineLobbyScreen"
        options={{
          title: "Online",
        }}
      />
      <Tabs.Screen
        name="GameScreen"
        options={{
          title: "Game",
        }}
      />
    </Tabs>
  );
}

// --- Styles for the Custom Tab Bar ---
const styles = StyleSheet.create({
  tabBarContainer: {
    position: 'absolute', left: 20, right: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 5,
  },
  tabBar: {
    flexDirection: 'row', 
    height: 60,
    // backgroundColor is now handled by the LinearGradient below
    borderRadius: 99,
    borderWidth: 1.5, // Slightly thicker for a more defined edge
    borderColor: 'rgba(255, 255, 255, 0.2)', // Brighter, more noticeable "glass" border
    overflow: 'hidden', 
    paddingHorizontal: 5,
    alignItems: 'center',
  },
  tabItem: {
    flex: 1, flexDirection: 'row',
    justifyContent: 'center', alignItems: 'center',
    paddingHorizontal: 10, height: '100%',
  },
  activePill: {
    position: 'absolute', top: 5, bottom: 5, // Use top/bottom for height
    borderRadius: 99, overflow: 'hidden',
  },
  labelText: {
    color: '#FFFFFF', fontSize: 14, fontWeight: '600',
  },
});
