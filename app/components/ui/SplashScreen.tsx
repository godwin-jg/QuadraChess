import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withSequence,
  withDelay,
  Easing 
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

interface SplashScreenProps {
  visible: boolean;
}

export default function SplashScreen({ visible }: SplashScreenProps) {
  const logoScale = useSharedValue(0);
  const logoOpacity = useSharedValue(0);
  const backgroundOpacity = useSharedValue(1);

  React.useEffect(() => {
    if (visible) {
      // Animate logo in
      logoScale.value = withSequence(
        withTiming(0.8, { duration: 300, easing: Easing.out(Easing.cubic) }),
        withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) })
      );
      logoOpacity.value = withTiming(1, { duration: 500 });
    } else {
      // Animate out
      logoScale.value = withTiming(0, { duration: 200 });
      logoOpacity.value = withTiming(0, { duration: 200 });
      backgroundOpacity.value = withDelay(100, withTiming(0, { duration: 300 }));
    }
  }, [visible]);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const backgroundStyle = useAnimatedStyle(() => ({
    opacity: backgroundOpacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, backgroundStyle]}>
      <LinearGradient
        colors={['#0F172A', '#1E293B', '#334155']}
        style={StyleSheet.absoluteFill}
      />
      
      <Animated.View style={[styles.logoContainer, logoStyle]}>
        <Image 
          source={require('../../../assets/images/splash-icon.png')} 
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      
      {/* Subtle grid pattern overlay */}
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
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 120,
    height: 120,
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
