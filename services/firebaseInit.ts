import { initializeApp, getApps, getApp } from "@react-native-firebase/app";

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

// Initialize Firebase if it hasn't been initialized already
try {
  if (getApps().length === 0) {
    const app = initializeApp(firebaseConfig);
    console.log("Firebase initialized:", app.name);
  } else {
    const app = getApp();
    console.log("Firebase already initialized:", app.name);
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
  // Continue with app initialization even if Firebase fails
  console.log("App will continue without Firebase");
}

export default firebaseConfig;
