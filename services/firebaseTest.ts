import { getApp } from "@react-native-firebase/app";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import database from "@react-native-firebase/database";

export const testFirebaseConnection = async () => {
  try {
    console.log("Testing Firebase connection...");

    // Test Firebase App
    const app = getApp();
    console.log("Firebase app is initialized:", app.name);

    // Test Auth
    const authInstance = auth();
    console.log("Auth instance available:", !!authInstance);

    // Test Firestore
    const firestoreInstance = firestore();
    console.log("Firestore instance available:", !!firestoreInstance);

    // Test Realtime Database
    const realtimeDbInstance = database();
    console.log("Realtime Database instance available:", !!realtimeDbInstance);

    // Try to get current user (should be null initially)
    const currentUser = authInstance.currentUser;
    console.log("Current user:", currentUser ? currentUser.uid : "No user");

    console.log("Firebase test completed successfully");
    return true;
  } catch (error) {
    console.error("Firebase test failed:", error);
    return false;
  }
};
