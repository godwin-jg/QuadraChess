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
      android: {
        ...config.expo?.android,
        package: "com.chess4d",
      },
      ios: {
        ...config.expo?.ios,
        bundleIdentifier: "com.chess4d",
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
