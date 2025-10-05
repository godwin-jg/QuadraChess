import { useColorScheme } from "@/components/useColorScheme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import { useEffect, useState } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as ScreenOrientation from 'expo-screen-orientation';
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

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [splashTransitioning, setSplashTransitioning] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      // Lock screen orientation to portrait
      ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP).catch(error => {
        console.warn('Failed to lock screen orientation:', error);
      });
      
      // Initialize sound service
      soundService.initialize().catch(error => {
        console.warn('Failed to initialize sound service:', error);
      });
      
      // Show our custom splash for the full video duration
      setTimeout(() => {
        setSplashTransitioning(true); // Start transition
        setTimeout(() => {
          setShowCustomSplash(false); // Hide splash after transition
        }, 500); // 500ms transition duration
      }, 3600); // 3.6 seconds - slightly longer to prevent flash
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <SettingsProvider>
        <Provider store={store}>
          {!showCustomSplash && <RootLayoutNav />}
          <CustomSplashScreen 
            visible={showCustomSplash} 
            transitioning={splashTransitioning}
            useVideo={true} // ✅ Auto-enabled when video is added
            videoSource={require('../assets/videos/splash-video.mp4')} // ✅ Direct require
          />
        </Provider>
      </SettingsProvider>
    </SafeAreaProvider>
  );
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}>
        <Stack.Screen name="index"
        options={{ 
          presentation: "modal",
          animation: 'fade'
        }} 
        />
      </Stack>
    </ThemeProvider>
  );
}
