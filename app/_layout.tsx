import "react-native-gesture-handler";
import { useColorScheme } from "@/components/useColorScheme";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { useFonts } from "expo-font";
import {
  Rajdhani_400Regular,
  Rajdhani_500Medium,
  Rajdhani_600SemiBold,
  Rajdhani_700Bold,
} from "@expo-google-fonts/rajdhani";
import { Stack } from "expo-router";
import { useEffect, useState, useCallback } from "react";
import { Provider } from "react-redux";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import * as ScreenOrientation from 'expo-screen-orientation';
import "../global.css";
import { store } from "../state";
import { SettingsProvider } from "../context/SettingsContext";
import CustomSplashScreen from "./components/ui/SplashScreen";
import UpdatePromptModal from "./components/ui/UpdatePromptModal";
import appUpdateService, { UpdateCheckResult } from "../services/appUpdateService";

// Initialize Firebase with a small delay to ensure proper initialization
import "../services/firebaseInit";
// Start game cleanup service
import soundService from "../services/soundService";
import { startBotStateMachine, stopBotStateMachine } from "../services/botStateMachine";
import { startGameFlowMachine, stopGameFlowMachine } from "../services/gameFlowService";

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
    Rajdhani_400Regular,
    Rajdhani_500Medium,
    Rajdhani_600SemiBold,
    Rajdhani_700Bold,
    ...FontAwesome.font,
  });
  const [showCustomSplash, setShowCustomSplash] = useState(true);
  const [splashTransitioning, setSplashTransitioning] = useState(false);
  
  // App update state
  const [updateInfo, setUpdateInfo] = useState<UpdateCheckResult | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  // Check for app updates after splash screen
  const checkForAppUpdate = useCallback(async () => {
    try {
      const result = await appUpdateService.checkForUpdate();
      if (result && result.updateAvailable) {
        setUpdateInfo(result);
        setShowUpdateModal(true);
      }
    } catch (err) {
      console.warn('Failed to check for app update:', err);
    }
  }, []);

  useEffect(() => {
    if (loaded) {
      startGameFlowMachine();
      startBotStateMachine();
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
          // Check for updates after splash screen is hidden
          checkForAppUpdate();
        }, 500); // 500ms transition duration
      }, 3600); // 3.6 seconds - slightly longer to prevent flash
    }
    return () => {
      stopGameFlowMachine();
      stopBotStateMachine();
    };
  }, [loaded, checkForAppUpdate]);

  // Handle update button press
  const handleUpdate = useCallback(() => {
    if (updateInfo?.storeUrl) {
      appUpdateService.openStore(updateInfo.storeUrl);
    }
  }, [updateInfo]);

  // Handle "later" button press
  const handleLater = useCallback(() => {
    // Only allow dismissing if not a forced update
    if (!updateInfo?.forceUpdate) {
      setShowUpdateModal(false);
    }
  }, [updateInfo]);

  if (!loaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
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
            {/* App Update Modal */}
            {updateInfo && (
              <UpdatePromptModal
                visible={showUpdateModal}
                currentVersion={updateInfo.currentVersion}
                latestVersion={updateInfo.latestVersion}
                updateMessage={updateInfo.updateMessage}
                forceUpdate={updateInfo.forceUpdate}
                onUpdate={handleUpdate}
                onLater={handleLater}
              />
            )}
          </Provider>
        </SettingsProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
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
