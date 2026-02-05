/**
 * App Update Service
 * 
 * Handles checking for app updates and prompting users to upgrade.
 * Stores version config in Firebase Realtime Database.
 * 
 * Firebase structure at /appConfig:
 * {
 *   "latestVersion": "1.1.0",
 *   "minSupportedVersion": "1.0.5",
 *   "updateMessage": "New features and bug fixes available!",
 *   "forceUpdate": false,
 *   "playStoreUrl": "https://play.google.com/store/apps/details?id=com.quadrachess"
 * }
 */

import { get, getDatabase, ref } from "@react-native-firebase/database";
import { Linking, Platform } from "react-native";
import Constants from "expo-constants";
import { ensureFirebaseApp } from "./firebaseInit";

ensureFirebaseApp();
const db = getDatabase();

export interface AppVersionConfig {
  latestVersion: string;
  minSupportedVersion: string;
  updateMessage?: string;
  forceUpdate?: boolean;
  playStoreUrl?: string;
  appStoreUrl?: string;
}

export interface UpdateCheckResult {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  updateMessage: string;
  storeUrl: string;
}

const DEFAULT_PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.quadrachess";
const DEFAULT_APP_STORE_URL = "https://apps.apple.com/app/quadrachess/id0000000000"; // Update with real ID

/**
 * Get the current app version from expo-constants
 */
export function getCurrentAppVersion(): string {
  // Try to get version from Constants.expoConfig (Expo SDK 49+)
  const expoVersion = Constants.expoConfig?.version;
  if (expoVersion) return expoVersion;
  
  // Fallback to manifest for older Expo versions
  const manifestVersion = (Constants.manifest as any)?.version;
  if (manifestVersion) return manifestVersion;
  
  // Last resort fallback
  return "1.0.0";
}

/**
 * Compare two semantic versions
 * Returns: -1 if v1 < v2, 0 if equal, 1 if v1 > v2
 */
export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split(".").map(Number);
  const parts2 = v2.split(".").map(Number);
  
  // Pad arrays to same length
  const maxLength = Math.max(parts1.length, parts2.length);
  while (parts1.length < maxLength) parts1.push(0);
  while (parts2.length < maxLength) parts2.push(0);
  
  for (let i = 0; i < maxLength; i++) {
    if (parts1[i] < parts2[i]) return -1;
    if (parts1[i] > parts2[i]) return 1;
  }
  
  return 0;
}

/**
 * Fetch app version config from Firebase
 */
export async function fetchVersionConfig(): Promise<AppVersionConfig | null> {
  try {
    const configRef = ref(db, "appConfig");
    const snapshot = await get(configRef);
    
    if (snapshot.exists()) {
      return snapshot.val() as AppVersionConfig;
    }
    
    console.log("[AppUpdate] No version config found in Firebase");
    return null;
  } catch (error) {
    console.warn("[AppUpdate] Error fetching version config:", error);
    return null;
  }
}

/**
 * Check if an app update is available
 */
export async function checkForUpdate(): Promise<UpdateCheckResult | null> {
  try {
    const config = await fetchVersionConfig();
    
    if (!config) {
      return null;
    }
    
    const currentVersion = getCurrentAppVersion();
    const { latestVersion, minSupportedVersion, updateMessage, forceUpdate, playStoreUrl, appStoreUrl } = config;
    
    // Check if current version is below minimum supported
    const isBelowMinimum = compareVersions(currentVersion, minSupportedVersion) < 0;
    
    // Check if an update is available
    const updateAvailable = compareVersions(currentVersion, latestVersion) < 0;
    
    // Determine store URL based on platform
    const storeUrl = Platform.OS === "ios" 
      ? (appStoreUrl || DEFAULT_APP_STORE_URL)
      : (playStoreUrl || DEFAULT_PLAY_STORE_URL);
    
    // Force update if below minimum supported version OR if forceUpdate flag is set
    const shouldForceUpdate = isBelowMinimum || (updateAvailable && forceUpdate === true);
    
    console.log(`[AppUpdate] Current: ${currentVersion}, Latest: ${latestVersion}, Min: ${minSupportedVersion}`);
    console.log(`[AppUpdate] Update available: ${updateAvailable}, Force: ${shouldForceUpdate}`);
    
    return {
      updateAvailable,
      forceUpdate: shouldForceUpdate,
      currentVersion,
      latestVersion,
      updateMessage: updateMessage || `A new version (${latestVersion}) is available with improvements and bug fixes.`,
      storeUrl,
    };
  } catch (error) {
    console.warn("[AppUpdate] Error checking for update:", error);
    return null;
  }
}

/**
 * Open the app store page for the app
 */
export async function openStore(storeUrl: string): Promise<void> {
  try {
    const canOpen = await Linking.canOpenURL(storeUrl);
    
    if (canOpen) {
      await Linking.openURL(storeUrl);
    } else {
      console.warn("[AppUpdate] Cannot open store URL:", storeUrl);
      // Fallback: Try with market:// scheme on Android
      if (Platform.OS === "android") {
        const marketUrl = "market://details?id=com.quadrachess";
        const canOpenMarket = await Linking.canOpenURL(marketUrl);
        if (canOpenMarket) {
          await Linking.openURL(marketUrl);
        }
      }
    }
  } catch (error) {
    console.warn("[AppUpdate] Error opening store:", error);
  }
}

// Export a singleton-like interface
const appUpdateService = {
  getCurrentAppVersion,
  compareVersions,
  fetchVersionConfig,
  checkForUpdate,
  openStore,
};

export default appUpdateService;
