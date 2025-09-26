#!/bin/bash

echo "Setting up P2P Multiplayer for Four Player Chess..."
echo "=================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

echo "✅ Node.js is installed"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ npm is installed"

# Install dependencies
echo ""
echo "Installing dependencies..."
npm install

if [ $? -eq 0 ]; then
    echo "✅ Dependencies installed successfully"
else
    echo "❌ Failed to install dependencies"
    exit 1
fi

# Check if signaling server dependencies are available
echo ""
echo "Checking signaling server dependencies..."
if [ -f "signaling-server.js" ]; then
    echo "✅ Signaling server file found"
else
    echo "❌ Signaling server file not found"
    exit 1
fi

# Test the signaling server
echo ""
echo "Testing signaling server..."
node signaling-server.js &
SERVER_PID=$!

# Wait for server to start
sleep 2

# Test the server
node test-p2p.js

if [ $? -eq 0 ]; then
    echo "✅ Signaling server test passed"
else
    echo "❌ Signaling server test failed"
    kill $SERVER_PID 2>/dev/null
    exit 1
fi

# Kill the test server
kill $SERVER_PID 2>/dev/null

echo ""
echo "🎉 P2P setup completed successfully!"
echo ""
echo "To start the P2P multiplayer:"
echo "1. Start the signaling server: npm run signaling-server"
echo "2. Start the app: npm start"
echo "3. Go to the 'P2P' tab in the app"
echo ""
echo "For more information, see README-P2P.md"


