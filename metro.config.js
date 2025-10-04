const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Fix for event-target-shim warning by configuring resolver
config.resolver.platforms = ['ios', 'android', 'native', 'web'];

// Add resolver configuration for event-target-shim
config.resolver.alias = {
  ...config.resolver.alias,
  'event-target-shim': require.resolve('event-target-shim'),
};

// ✅ CRITICAL FIX: Ensure video player threading compatibility
// Enhanced resolver configuration for video libraries
config.resolver.assetExts.push('mp4', 'mov', 'avi', 'mkv', 'webm');
config.resolver.sourceExts.push('webm');

// Better handling of native modules for threading
config.transformer.minifierConfig = {
  keep_fnames: true,
  mangle: {
    keep_fnames: true,
  },
};

module.exports = withNativeWind(config, { input: "./global.css" });
