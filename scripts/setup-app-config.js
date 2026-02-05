#!/usr/bin/env node
/**
 * Setup App Config Script
 * 
 * This script sets up the initial appConfig in Firebase Realtime Database
 * for the app update prompt feature.
 * 
 * Usage:
 *   node scripts/setup-app-config.js
 * 
 * Prerequisites:
 *   - Firebase CLI installed and logged in (firebase login)
 *   - Project selected (firebase use dchess-97670)
 */

const { execSync } = require('child_process');

// Current app version from package.json
const packageJson = require('../package.json');
const currentVersion = packageJson.version;

// App config to set in Firebase
const appConfig = {
  latestVersion: currentVersion,
  minSupportedVersion: "1.0.0",
  updateMessage: "A new version is available with exciting improvements and bug fixes. Update now for the best experience!",
  forceUpdate: false,
  playStoreUrl: "https://play.google.com/store/apps/details?id=com.quadrachess",
  appStoreUrl: "https://apps.apple.com/app/quadrachess/id0000000000"
};

console.log('Setting up appConfig in Firebase Realtime Database...');
console.log('');
console.log('Config to be set:');
console.log(JSON.stringify(appConfig, null, 2));
console.log('');

// Create the Firebase CLI command
const configJson = JSON.stringify(appConfig);
const command = `firebase database:set /appConfig --data '${configJson}' --project dchess-97670 --force`;

try {
  console.log('Executing Firebase command...');
  execSync(command, { stdio: 'inherit' });
} catch (error) {
  // Firebase CLI sometimes throws after success, check if data was persisted
  if (error.stdout && error.stdout.toString().includes('Data persisted successfully')) {
    // Command succeeded despite error
  } else {
    console.error('❌ Failed to set appConfig:', error.message);
    console.log('');
    console.log('Make sure you are logged into Firebase CLI:');
    console.log('  firebase login');
    console.log('');
    console.log('And have the correct project selected:');
    console.log('  firebase use dchess-97670');
    process.exit(1);
  }
}

console.log('');
console.log('✅ appConfig successfully set in Firebase!');
console.log('');
console.log('To update the version later when you release a new version, run:');
console.log('  firebase database:update /appConfig --data \'{"latestVersion": "1.1.0"}\' --project dchess-97670 --force');
console.log('');
console.log('To force all users to update (for critical updates), run:');
console.log('  firebase database:update /appConfig --data \'{"minSupportedVersion": "1.1.0"}\' --project dchess-97670 --force');
