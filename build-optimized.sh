#!/bin/bash

# 🚀 Optimized APK Build Script for QuadChess
# This script builds a production-ready APK with maximum size optimization

echo "🎯 Building Optimized APK for QuadChess..."
echo "📱 Target: Reduce from 146MB to ~60-80MB"
echo ""

# Clean previous builds
echo "🧹 Cleaning previous builds..."
cd android
./gradlew clean

# Build optimized release APK
echo "🔨 Building optimized release APK..."
./gradlew assembleRelease

# Check APK size
echo ""
echo "📊 Build Results:"
echo "=================="
ls -lh app/build/outputs/apk/release/

echo ""
echo "✅ Optimized APK build complete!"
echo "📱 Expected size reduction: ~50-70MB"
echo ""
echo "🔍 Key optimizations applied:"
echo "  • Architecture reduction (armeabi-v7a, arm64-v8a only)"
echo "  • R8 minification enabled"
echo "  • Resource shrinking enabled"
echo "  • ProGuard optimization (5 passes)"
echo "  • PNG crunching enabled"
echo "  • GIF/WebP support disabled"
echo "  • Splash video optimized (4K → 1080p)"
echo "  • APK splitting by architecture"
echo ""
echo "📱 APK Location: android/app/build/outputs/apk/release/"

