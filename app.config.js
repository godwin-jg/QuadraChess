import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => {
  // Create google-services.json from environment variable if it exists
  // Only do this during EAS builds, not during local development
  if (process.env.GOOGLE_SERVICES_JSON && process.env.EAS_BUILD) {
    const fs = require("fs");
    const path = require("path");

    // Ensure the android/app directory exists
    const androidAppDir = path.join(__dirname, "android", "app");
    if (!fs.existsSync(androidAppDir)) {
      fs.mkdirSync(androidAppDir, { recursive: true });
    }

    // Write the google-services.json file
    const googleServicesPath = path.join(androidAppDir, "google-services.json");
    fs.writeFileSync(googleServicesPath, process.env.GOOGLE_SERVICES_JSON);

    console.log(
      "✅ google-services.json created from environment variable during EAS build"
    );
  }

  return {
    ...config,
    expo: {
      ...config.expo,
      slug: "chess4d",
      scheme: "chess4d",
      icon: "./assets/images/chess.png",
      splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000"
      },
      android: {
        ...config.expo?.android,
        package: "com.chess4d",
        adaptiveIcon: {
          foregroundImage: "./assets/images/chess.png",
          backgroundColor: "#000000"
        },
        screenOrientation: "portrait",
        // Optimize for broader device compatibility
        minSdkVersion: 23, // Android 6.0 (Marshmallow) - supports 95%+ of devices
        targetSdkVersion: 34, // Android 14 - current stable target
        compileSdkVersion: 34 // Android 14 - for compilation
      },
      ios: {
        ...config.expo?.ios,
        bundleIdentifier: "com.chess4d",
        screenOrientation: "portrait"
      },
      owner: "jgnsecrets",
      plugins: [
        [
          "@config-plugins/react-native-webrtc",
          {
            cameraPermission: "Allow $(PRODUCT_NAME) to access your camera for P2P connections",
            microphonePermission: "Allow $(PRODUCT_NAME) to access your microphone for P2P connections",
          },
        ],
        [
          "expo-build-properties",
          {
            android: {
              usesCleartextTraffic: true,
              minSdkVersion: 23, // Android 6.0 - broader compatibility
              targetSdkVersion: 34, // Android 14 - stable target
              compileSdkVersion: 34, // Android 14 - compilation target
              // Optimize for older devices
              enableProguardInReleaseBuilds: true,
              enableShrinkResourcesInReleaseBuilds: true,
            },
          },
        ],
        "expo-video",
      ],
      extra: {
        ...config.expo?.extra,
        eas: {
          projectId: "f086ac25-5dfc-4e74-a789-907d3813339c",
        },
      },
    },
  };
};
