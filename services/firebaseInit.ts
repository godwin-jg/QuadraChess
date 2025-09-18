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
let app;
if (getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

console.log("Firebase initialized:", app.name);

export default firebaseConfig;
