import { ConfigContext, ExpoConfig } from "expo/config";

export default ({ config }) => {

  return {
    ...config,
    expo: {
      ...config.expo,
      name: "Quadrachess",
      slug: "FourPlayer",
      version: "1.0.4",
      scheme: "FourPlayer",
      icon: "./assets/images/chess.png",
      splash: {
        image: "./assets/images/splash-icon.png",
        resizeMode: "contain",
        backgroundColor: "#000000"
      },
      android: {
        ...config.expo?.android,
        package: "com.quadrachess",
        adaptiveIcon: {
          foregroundImage: "./assets/images/chess.png",
          backgroundColor: "#000000"
        },
        screenOrientation: "portrait",
        // Optimize for broader device compatibility
        minSdkVersion: 24, // Android 7.0 (Nougat) - required for release builds
        targetSdkVersion: 35, // Android 15 - required by Google Play Store
        compileSdkVersion: 35, // Android 15 - required for dependencies
        // Privacy policy URL for camera permission
        privacyPolicy: "https://godwin-jg.github.io/quadrachess-privacy"
      },
      ios: {
        ...config.expo?.ios,
        bundleIdentifier: "com.quadrachess",
        screenOrientation: "portrait",
        requireFullScreen: true
      },
      owner: "jgnsecrets",
      plugins: [
        "expo-router",
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
              minSdkVersion: 24, // Android 7.0 - required for release builds
              targetSdkVersion: 35, // Android 15 - required by Google Play Store
              compileSdkVersion: 35, // Android 15 - required for dependencies
              // Optimize for older devices
              enableProguardInReleaseBuilds: true,
              enableShrinkResourcesInReleaseBuilds: true,
            },
          },
        ],
        [
          "expo-screen-orientation",
          {
            initialOrientation: "PORTRAIT_UP"
          }
        ],
        "expo-video",
        "expo-audio",
        "expo-web-browser",
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
