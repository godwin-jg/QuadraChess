#!/bin/bash

echo "Setting up EAS environment variable for google-services.json..."

# Check if google-services.json exists
if [ ! -f "android/app/google-services.json" ]; then
    echo "❌ Error: android/app/google-services.json not found!"
    echo "Please make sure the file exists before running this script."
    exit 1
fi

# Read the google-services.json content
GOOGLE_SERVICES_CONTENT=$(cat android/app/google-services.json)

echo "Creating EAS environment variable..."

# Create the EAS environment variable for all environments
echo "Creating environment variable for production..."
eas env:create \
  --name GOOGLE_SERVICES_JSON \
  --value "$GOOGLE_SERVICES_CONTENT" \
  --type string \
  --visibility sensitive \
  --scope project \
  --environment production \
  --non-interactive

echo "Creating environment variable for preview..."
eas env:create \
  --name GOOGLE_SERVICES_JSON \
  --value "$GOOGLE_SERVICES_CONTENT" \
  --type string \
  --visibility sensitive \
  --scope project \
  --environment preview \
  --non-interactive

echo "Creating environment variable for development..."
eas env:create \
  --name GOOGLE_SERVICES_JSON \
  --value "$GOOGLE_SERVICES_CONTENT" \
  --type string \
  --visibility sensitive \
  --scope project \
  --environment development \
  --force \
  --non-interactive

echo "✅ Done! The GOOGLE_SERVICES_JSON environment variable has been created."
echo "You can now run your EAS build and it will use this environment variable."
