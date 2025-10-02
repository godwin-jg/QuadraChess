# 🎬 MP4 Video Splash Screen Guide

## ✅ Implementation Complete!

Your splash screen now supports MP4 videos! Here's how to use it:

## 🚀 How to Use

### 1. **Add Your MP4 Video**
Place your MP4 file in the assets folder:
```
assets/
  videos/
    splash-video.mp4  ← Your MP4 file here
```

### 2. **Enable Video Mode**
In `app/_layout.tsx`, update the CustomSplashScreen props:

```typescript
<CustomSplashScreen 
  visible={showCustomSplash} 
  useVideo={true} // ✅ Enable video mode
  videoSource={require('../assets/videos/splash-video.mp4')} // ✅ Your video path
/>
```

### 3. **Video Requirements**
- **Format**: MP4
- **Duration**: 2-5 seconds recommended
- **Size**: Keep under 10MB for fast loading
- **Resolution**: 1080p or 720p
- **Aspect Ratio**: 16:9 or 9:16 (matches most devices)

## 🎨 Features

### **Video Mode:**
- ✅ **Full-screen video background**
- ✅ **Automatic looping**
- ✅ **Muted playback** (no sound)
- ✅ **Smooth logo overlay animation**
- ✅ **Cover resize mode** (fills screen)

### **Fallback Mode:**
- ✅ **Gradient background** (if video fails)
- ✅ **Grid overlay pattern**
- ✅ **Same logo animations**

## 🔧 Configuration Options

```typescript
interface SplashScreenProps {
  visible: boolean;
  videoSource?: string; // Path to MP4 video file
  useVideo?: boolean; // Whether to use video or static image
}
```

## 📱 Video Placement Options

### **Local Asset (Recommended):**
```typescript
videoSource={require('../assets/videos/splash-video.mp4')}
```

### **Remote URL:**
```typescript
videoSource="https://your-domain.com/splash-video.mp4"
```

### **Dynamic Path:**
```typescript
videoSource={Platform.OS === 'ios' ? 'ios-splash.mp4' : 'android-splash.mp4'}
```

## 🎯 Best Practices

### **Video Creation Tips:**
1. **Keep it short**: 2-5 seconds max
2. **Smooth transitions**: Avoid jarring cuts
3. **Chess theme**: Incorporate chess pieces or board
4. **Dark background**: Match your app's dark theme
5. **High contrast**: Ensure logo visibility

### **Performance Tips:**
1. **Compress video**: Use H.264 codec
2. **Optimize size**: Balance quality vs file size
3. **Test on devices**: Ensure smooth playback
4. **Fallback ready**: Always have static version

## 🎬 Example Video Ideas

### **Chess-Themed Animations:**
- Pieces moving into formation
- Board materializing
- Pawn promotion sequence
- Checkmate animation
- Rotating chess pieces

### **App Branding:**
- Logo reveal animation
- Color transitions
- Particle effects
- Typography animation

## 🚀 Ready to Use!

Your splash screen now supports both:
- **Static mode**: Gradient + grid + logo animation
- **Video mode**: MP4 background + logo overlay

Simply set `useVideo={true}` and provide your MP4 path! 🎉
