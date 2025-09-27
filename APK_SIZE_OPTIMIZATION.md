# APK Size Optimization Guide

## 🎯 **Target: Reduce APK from 150MB to ~60-80MB**

## ✅ **Optimizations Applied**

### 1. **Architecture Reduction** (Saves ~30-40MB)
- **Before**: `armeabi-v7a,arm64-v8a,x86,x86_64`
- **After**: `armeabi-v7a,arm64-v8a` (essential architectures only)
- **Impact**: Removes x86/x86_64 support (not needed for production)

### 2. **R8 Minification** (Saves ~20-30MB)
- **Enabled**: `android.enableMinifyInReleaseBuilds=true`
- **Enabled**: `android.enableShrinkResourcesInReleaseBuilds=true`
- **Impact**: Removes unused code and resources

### 3. **Disabled Unused Features** (Saves ~5-10MB)
- **GIF Support**: `expo.gif.enabled=false`
- **WebP Support**: `expo.webp.enabled=false`
- **Animated WebP**: `expo.webp.animated=false`
- **Impact**: Removes image format dependencies

### 4. **ProGuard Optimization** (Saves ~10-15MB)
- **Aggressive optimization**: 5 optimization passes
- **Log removal**: Removes console.log and Log statements in release
- **Code shrinking**: Removes unused classes and methods

### 5. **PNG Crunching** (Saves ~2-5MB)
- **Enabled**: `android.enablePngCrunchInReleaseBuilds=true`
- **Impact**: Compresses PNG images automatically

## 🚀 **Build Commands**

### For Optimized APK:
```bash
# Build with all optimizations
eas build --platform android --profile production-small
```

### For Local Testing:
```bash
# Build locally with optimizations
cd android
./gradlew assembleRelease
```

## 📊 **Expected Results**

| Optimization | Size Reduction | Total Impact |
|--------------|---------------|--------------|
| Architecture Reduction | 30-40MB | 30-40MB |
| R8 Minification | 20-30MB | 50-70MB |
| Disabled Features | 5-10MB | 55-80MB |
| ProGuard Rules | 10-15MB | 65-95MB |
| PNG Crunching | 2-5MB | 67-100MB |

**Expected Final Size**: **50-80MB** (down from 150MB)

## 🔧 **Additional Optimizations (Optional)**

### 1. **Remove Unused Dependencies**
Check if you're using all Firebase modules:
- `@react-native-firebase/firestore` (if not using Firestore)
- `@react-native-firebase/functions` (if not using Cloud Functions)

### 2. **Asset Optimization**
- Convert large PNGs to WebP (if WebP support is re-enabled)
- Use vector graphics where possible
- Compress SVG files

### 3. **Code Splitting**
- Implement lazy loading for screens
- Use dynamic imports for heavy components

## ⚠️ **Important Notes**

1. **Test Thoroughly**: Minification can break reflection-based code
2. **Firebase**: Keep Firebase rules minimal to avoid breaking functionality
3. **Architecture**: Only remove x86 if you don't need emulator support
4. **Features**: Re-enable GIF/WebP if you plan to use them

## 🧪 **Testing**

After building, test these features:
- [ ] Firebase authentication
- [ ] Firebase realtime database
- [ ] WebRTC connections
- [ ] Chess piece rendering
- [ ] Game state synchronization
- [ ] Push notifications (if used)

## 📱 **Build Profiles**

- **`production`**: Standard build with all features
- **`production-small`**: Optimized build for smaller APK size
- **`development`**: Debug build with all debugging features

Use `production-small` for Play Store releases to minimize download size.
