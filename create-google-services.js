#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Create google-services.json from environment variable during EAS build
if (process.env.GOOGLE_SERVICES_JSON && process.env.EAS_BUILD) {
  console.log('🔧 Creating google-services.json from environment variable...');
  
  // Ensure the android/app directory exists
  const androidAppDir = path.join(__dirname, 'android', 'app');
  if (!fs.existsSync(androidAppDir)) {
    fs.mkdirSync(androidAppDir, { recursive: true });
  }

  // Write the google-services.json file
  const googleServicesPath = path.join(androidAppDir, 'google-services.json');
  fs.writeFileSync(googleServicesPath, process.env.GOOGLE_SERVICES_JSON);
  
  console.log('✅ google-services.json created successfully');
}
