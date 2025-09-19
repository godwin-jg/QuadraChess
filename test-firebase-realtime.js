// Test script to verify Firebase Realtime Database connection and data structure
const admin = require("firebase-admin");

// Initialize Firebase Admin SDK
const serviceAccount = {
  type: "service_account",
  project_id: "dchess-97670",
  private_key_id: "test",
  private_key: "test",
  client_email: "test@dchess-97670.iam.gserviceaccount.com",
  client_id: "test",
  auth_uri: "https://accounts.google.com/o/oauth2/auth",
  token_uri: "https://oauth2.googleapis.com/token",
  auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
  client_x509_cert_url:
    "https://www.googleapis.com/oauth2/v1/certs/test@dchess-97670.iam.gserviceaccount.com",
};

// For testing, we'll use the REST API instead
const https = require("https");

const databaseUrl = "https://dchess-97670-default-rtdb.firebaseio.com";

function testFirebaseConnection() {
  console.log("Testing Firebase Realtime Database connection...");

  // Test reading from the database
  const options = {
    hostname: "dchess-97670-default-rtdb.firebaseio.com",
    port: 443,
    path: "/games.json",
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  };

  const req = https.request(options, (res) => {
    let data = "";

    res.on("data", (chunk) => {
      data += chunk;
    });

    res.on("end", () => {
      console.log("Response status:", res.statusCode);
      console.log("Response data:", data);

      if (res.statusCode === 200) {
        console.log("✅ Firebase Realtime Database connection successful!");
        try {
          const games = JSON.parse(data);
          console.log("Games in database:", Object.keys(games || {}));
        } catch (e) {
          console.log("No games found or invalid JSON");
        }
      } else {
        console.log("❌ Firebase Realtime Database connection failed");
      }
    });
  });

  req.on("error", (error) => {
    console.error("❌ Error connecting to Firebase:", error);
  });

  req.end();
}

// Run the test
testFirebaseConnection();




