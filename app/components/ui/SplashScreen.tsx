import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withDelay
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { VideoView, useVideoPlayer } from 'expo-video';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  visible: boolean;
  transitioning?: boolean;
  videoSource?: string; // Path to MP4 video file
  useVideo?: boolean; // Whether to use video or static image
  onVideoEnd?: () => void; // Callback when video finishes
}

export default function SplashScreen({ visible, transitioning = false, videoSource, useVideo = false, onVideoEnd }: SplashScreenProps) {
  const backgroundOpacity = useSharedValue(1);
  const [videoError, setVideoError] = React.useState(false);
  
  // Create video player instance with error handling
  const player = useVideoPlayer(videoSource || '', (player) => {
    player.loop = false; // Don't loop the video
    player.muted = true; // Mute the video
    
    // Add status update listener
    player.addListener('statusChange', (status) => {
      console.log('Video status:', status);
      // Check if video has finished playing
      if (status.status === 'idle') {
        console.log('Video finished playing');
        onVideoEnd?.(); // Trigger transition when video ends
      }
    });
  });

  // Debug logging
  React.useEffect(() => {
    console.log('🎬 SplashScreen Debug:', {
      useVideo,
      videoSource,
      videoError,
      player: player ? 'Player created' : 'No player'
    });
  }, [useVideo, videoSource, videoError, player]);

  React.useEffect(() => {
    if (visible) {
      // Start video playback if using video
      if (useVideo && player) {
        player.play();
      }
    } else {
      // Stop video playback if using video
      if (useVideo && player) {
        player.pause();
      }
    }
  }, [visible, useVideo, player]);

  // Handle transition animation
  React.useEffect(() => {
    if (transitioning) {
      // Smooth fade out transition
      backgroundOpacity.value = withTiming(0, { duration: 500 });
    }
  }, [transitioning]);

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, backgroundStyle]}>
      {/* Background - Video or Gradient */}
      {useVideo && videoSource && !videoError ? (
        <View style={styles.videoContainer}>
          <VideoView
            player={player}
            style={styles.video}
            contentFit="cover"
            allowsFullscreen={false}
            allowsPictureInPicture={false}
            nativeControls={false}
            // allowsExternalPlayback={false}
          />
        </View>
      ) : (
        <LinearGradient
          colors={['#0F172A', '#1E293B', '#334155']}
          style={StyleSheet.absoluteFill}
        />
      )}
      
      {/* Subtle grid pattern overlay - show if not using video or if video fails */}
      {(!useVideo || videoError) && (
        <View style={styles.gridOverlay}>
          {Array.from({ length: 20 }).map((_, i) => (
            <View key={i} style={[styles.gridLine, { 
              left: (width / 20) * i,
              opacity: 0.1 
            }]} />
          ))}
          {Array.from({ length: 15 }).map((_, i) => (
            <View key={i} style={[styles.gridLine, styles.gridLineVertical, { 
              top: (height / 15) * i,
              opacity: 0.1 
            }]} />
          ))}
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 99999, // Higher z-index to stay on top
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'white',
  },
  video: {
    width: '80%',
    aspectRatio: 1, // This makes it square (1:1 ratio)
    // You can customize these for different effects:
    // transform: [{ scale: 0.6 }], // Scale down to 80%
    transform: [{ scale: 1.2 }], // Scale up to 120%
    // transform: [{ scaleX: 0.9 }, { scaleY: 0.9 }], // Different X/Y scaling
  },
  gridOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  gridLine: {
    position: 'absolute',
    width: 1,
    height: '100%',
    backgroundColor: '#64748B',
  },
  gridLineVertical: {
    width: '100%',
    height: 1,
  },
});
