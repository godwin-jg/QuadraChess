import { useColorScheme } from "@/components/useColorScheme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "../global.css";
import { store } from "../state";
import { SettingsProvider } from "../context/SettingsContext";
import CustomSplashScreen from "./components/ui/SplashScreen";

// Initialize Firebase with a small delay to ensure proper initialization
import "../services/firebaseInit";
// Start game cleanup service
import soundService from "../services/soundService";

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from "expo-router";

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: "(tabs)",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });
  const [showCustomSplash, setShowCustomSplash] = useState(true);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Initialize sound service
      soundService.initialize().catch(error => {
        console.warn('Failed to initialize sound service:', error);
      });
      
      // Hide the default splash screen immediately
      SplashScreen.hideAsync();
      
      // Show our custom splash for a bit longer for a polished feel
      setTimeout(() => {
        setShowCustomSplash(false);
      }, 1500);
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <Provider store={store}>
          <RootLayoutNav />
          <CustomSplashScreen visible={showCustomSplash} />
        </Provider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen 
          name="modal" 
          options={{ 
            presentation: "modal",
            animation: 'fade'
          }} 
        />
      </Stack>
    </ThemeProvider>
  );
}
