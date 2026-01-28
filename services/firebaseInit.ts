import { initializeApp, getApps, getApp } from "@react-native-firebase/app";
import type { FirebaseApp } from "@react-native-firebase/app";

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyD7jNco2ekWI0aXL_BxP4ZRyHVWxdFlxNc",
  authDomain: "dchess-97670.firebaseapp.com",
  projectId: "dchess-97670",
  storageBucket: "dchess-97670.firebasestorage.app",
  messagingSenderId: "877818154021",
  appId: "1:877818154021:android:5e151a924610132beac3cc",
  databaseURL: "https://dchess-97670-default-rtdb.firebaseio.com",
};

export const ensureFirebaseApp = (): FirebaseApp => {
  if (getApps().length === 0) {
    initializeApp(firebaseConfig);
  }
  return getApp() as FirebaseApp;
};

// Initialize Firebase if it hasn't been initialized already
try {
  const hadApps = getApps().length > 0;
  const app = ensureFirebaseApp();
  console.log(
    hadApps ? "Firebase already initialized:" : "Firebase initialized:",
    app.name
  );
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Continue with app initialization even if Firebase fails
  console.log("App will continue without Firebase");
}

export default firebaseConfig;
