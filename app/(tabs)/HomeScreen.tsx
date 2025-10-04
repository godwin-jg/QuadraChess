import React, { useState, useEffect } from "react";
import { useRouter } from "expo-router";
import { View, Text, TouchableOpacity, StyleSheet, useWindowDimensions } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect } from "@react-navigation/native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useDispatch } from 'react-redux';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withTiming, 
  withRepeat, 
  withSequence,
  withDelay,
  interpolate,
  Easing,
  withSpring,
  cancelAnimation
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import { hapticsService } from "@/services/hapticsService";
import modeSwitchService from "../../services/modeSwitchService";
import { resetGame, setBotPlayers } from '../../state/gameSlice';
// import Piece from "../../components/board/Piece";
import Svg, { G, Path } from "react-native-svg";
import GridBackground from "../components/ui/GridBackground";

// --- Background Piece Component ---
const BackgroundPiece = ({ piece, size, style }: { piece: string, size: number, style: any }) => {
  // Simple SVG paths for background pieces
  const piecePaths: { [key: string]: string } = {
    'rQ': "M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z",
    'bK': "M 22.5,11.63 L 22.5,6 M 20,8 h 5 M 22.5,25 s 4.5,-7.5 3,-10.5 c 0 0 -1,-2.5 -3,-2.5 s -3 2.5 -3 2.5 c -1.5 3 3 10.5 3 10.5 M 12.5,37 c 5.5 3.5 14.5 3.5 20 0 v -7 s 9,-4.5 6,-10.5 c -4,-6.5 -13.5,-3.5 -16 4 V 27 v -3.5 c -2.5,-7.5 -12,-10.5 -16,-4 -3 6 6 10.5 6 10.5 v 7",
    'gR': "M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 M 34,14 L 31,17 L 14,17 L 11,14 M 31,17 L 31,29.5 L 14,29.5 L 14,17 M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5 M 11,14 L 34,14",
    'yB': "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z",
    'rN': "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10",
    'bP': "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z",
    'yR': "M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 M 34,14 L 31,17 L 14,17 L 11,14 M 31,17 L 31,29.5 L 14,29.5 L 14,17 M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5 M 11,14 L 34,14",
    'gB': "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z",
    'bN': "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10",
    'gP': "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z"
  };

  const path = piecePaths[piece] || piecePaths['bP']; // fallback to pawn
  const color = piece[0] === 'r' ? '#ef4444' : piece[0] === 'b' ? '#3b82f6' : piece[0] === 'g' ? '#10b981' : '#7c3aed';

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <G fill={color} stroke="#374151" strokeWidth="0.8">
        <Path d={path} />
      </G>
    </Svg>
  );
};

// --- Reusable AnimatedButton Component ---
interface AnimatedButtonProps {
  onPress: () => void;
  disabled: boolean;
  gradientColors: string[];
  icon: string;
  title: string;
  subtitle: string;
  textColor?: string;
  subtitleColor?: string;
  delay?: number;
}

const AnimatedButton: React.FC<AnimatedButtonProps> = ({
  onPress,
  disabled,
  gradientColors,
  icon,
  title,
  subtitle,
  textColor = "black",
  subtitleColor = "gray-600",
  delay = 0,
}) => {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(30);

  // Staggered entrance animation for each button
  useEffect(() => {
    opacity.value = withDelay(delay, withTiming(1, { duration: 600 }));
    translateY.value = withDelay(
      delay,
      withSpring(0, { damping: 12, stiffness: 80 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: translateY.value }],
    opacity: opacity.value,
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 400 });
    hapticsService.buttonPress();
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  return (
    <Animated.View style={animatedStyle}>
            <TouchableOpacity
              onPress={onPress}
              onPressIn={handlePressIn}
              onPressOut={handlePressOut}
              disabled={disabled}
              className="py-3 px-5 rounded-xl active:opacity-80 items-center overflow-hidden"
              style={{
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 8 },
                shadowOpacity: 0.3,
                shadowRadius: 12,
                elevation: 8,
              }}
            >
        <LinearGradient 
          colors={gradientColors as any} 
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: 12 }]} 
        />
        <Text className="text-2xl text-center mb-1">{icon}</Text>
        <Text
          className="text-lg font-extrabold text-center mb-1 tracking-wider"
          style={{ 
            color: textColor === 'white' ? '#ffffff' : '#000000',
            fontWeight: '900', 
            letterSpacing: 1.2, 
            textShadowColor: 'rgba(0,0,0,0.3)', 
            textShadowOffset: {width: 1, height: 1}, 
            textShadowRadius: 2 
          }}
        >
          {title}
        </Text>
        <Text 
          className="text-xs text-center font-semibold tracking-widest uppercase"
          style={{ 
            color: subtitleColor === 'gray-300' ? '#d1d5db' : 
                   subtitleColor === 'blue-100' ? '#dbeafe' : '#6b7280',
            fontWeight: '600', 
            letterSpacing: 0.8 
          }}
        >
          {subtitle}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

export default function HomeScreen() {
  const router = useRouter();
  const dispatch = useDispatch();
  const [isNavigating, setIsNavigating] = useState(false);
  const { height, width } = useWindowDimensions(); // Get screen dimensions

  // Simplified animation values for the container
  const containerOpacity = useSharedValue(0);


  const pieceAnimations = Array.from({ length: 10 }, () => ({
    opacity: useSharedValue(0),
    scale: useSharedValue(1),
    translateX: useSharedValue(0),
    translateY: useSharedValue(height), // Start all pieces at the bottom
    // Bubble pulsing effect
    bubbleScale: useSharedValue(1),
    // Subtle rotation for dynamic movement
    rotateZ: useSharedValue(0),
  }));

  // Create the new recursive animation function
  const animatePiece = (index: number) => {
    const piece = pieceAnimations[index];
    const pieceSize = 100; // An estimated average size of the bubble container

    // Reset the bubble to a new random state from various screen positions
    const startY = height + pieceSize + Math.random() * 200; // Start from bottom with some variation
    const endY = -pieceSize + Math.random() * 100; // End closer to top, more visible
    piece.translateY.value = startY;
    piece.translateX.value = Math.random() * width;
    piece.scale.value = 0.4 + Math.random() * 0.6; // Smaller, more subtle size range
    piece.opacity.value = 0.2 + Math.random() * 0.3; // More subtle opacity range

    // Much slower animation for gentle floating
    const randomDuration = 20000 + Math.random() * 15000; // 20-35 seconds for very slow movement
    
    // Use the animation's callback to loop
    piece.translateY.value = withTiming(
      endY, // Animate to just off-screen at the top
      {
        duration: randomDuration,
        easing: Easing.linear,
      },
      (finished) => {
        // When the animation finishes, pause at the top before restarting
        if (finished) {
          // Add a delay before restarting to keep bubbles visible longer
          setTimeout(() => {
            scheduleOnRN(animatePiece, index);
          }, 3000 + Math.random() * 2000); // 3-5 second pause at the top
        }
      }
    );

    // ✅ ADD: Gentle side-to-side movement
    const sideToSideDuration = 5000 + Math.random() * 3000;
    const sideToSideDistance = (Math.random() - 0.5) * 80; // How far it drifts left/right

    piece.translateX.value = withRepeat(
      withSequence(
        withTiming(piece.translateX.value + sideToSideDistance, { duration: sideToSideDuration, easing: Easing.inOut(Easing.ease) }),
        withTiming(piece.translateX.value - sideToSideDistance, { duration: sideToSideDuration, easing: Easing.inOut(Easing.ease) })
      ),
      -1, // Infinite repeat
      true // Reverse
    );

    // ✅ ADD: Subtle rotation for dynamic movement
    const rotationDuration = 15000 + Math.random() * 10000; // 15-25 seconds for slow rotation
    const rotationAmount = (Math.random() - 0.5) * 360; // Random rotation direction and amount

    piece.rotateZ.value = withRepeat(
      withTiming(rotationAmount, { duration: rotationDuration, easing: Easing.linear }),
      -1, // Infinite repeat
      false // Don't reverse - continuous rotation
    );
  };

  const playEntranceAnimation = () => {
    // Entrance animation for the whole screen
    containerOpacity.value = withTiming(1, { duration: 400 });

    // Start the animation loop for each piece with a delay
    pieceAnimations.forEach((_, index) => {
      const delay = index * 3000; // Longer stagger delay for more gradual appearance
      setTimeout(() => animatePiece(index), delay);
    });
  };

  // Run animation when screen comes into focus
  useFocusEffect(
    React.useCallback(() => {
      playEntranceAnimation();
      
      // Cleanup function to stop animations when screen loses focus
      return () => {
        pieceAnimations.forEach(piece => {
          // Cancel any running animations by resetting values
          piece.opacity.value = 0;
          piece.scale.value = 1;
          piece.translateX.value = 0;
          piece.translateY.value = height;
          piece.bubbleScale.value = 1;
          piece.rotateZ.value = 0;
        });
      };
    }, [])
  );

  const handleStartSinglePlayer = () => {
    // Set default bot players and start single player game
    hapticsService.buttonPress();
    dispatch(setBotPlayers(['b', 'y', 'g'])); // Default to 3 AI players (Blue, Yellow, Green)
    router.push("/(tabs)/GameScreen");
  };


  const handleModeSwitch = async (
    targetMode: "online" | "local" | "solo",
    path: string
  ) => {
    if (isNavigating) return;

    setIsNavigating(true);

    try {
      // 🔊 Play home screen button sound
      try {
        const soundService = require('../../services/soundService').default;
        soundService.playButtonHomescreenSound();
      } catch (error) {
        console.log('🔊 SoundService: Failed to play home screen button sound:', error);
      }

      await modeSwitchService.handleModeSwitch(
        targetMode,
        () => {
          // Confirm: Navigate to the target mode immediately
          router.push(path as any);
        },
        () => {
          // Cancel: Stay on current screen
          console.log("Mode switch cancelled by user");
        }
      );
    } finally {
      setIsNavigating(false);
    }
  };

  // Animated styles
  const containerStyle = useAnimatedStyle(() => ({
    opacity: containerOpacity.value,
  }));

  const getPieceStyle = (index: number) =>
    useAnimatedStyle(() => {
      const piece = pieceAnimations[index];
      return {
        opacity: piece.opacity.value,
        transform: [
          { scale: piece.scale.value },
          { translateX: piece.translateX.value },
          { translateY: piece.translateY.value },
          { rotateZ: `${piece.rotateZ.value}deg` }, // Add rotation
        ],
      };
    });

  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-black">
      {/* Subtle blueprint grid background */}
      <GridBackground />
      
      {/* Background Chess Pieces */}
      <View 
        className="absolute inset-0 pointer-events-none overflow-hidden" 
        style={{ zIndex: 0 }}
      >
        {/* Constellation layout with bubble-styled containers */}
        {[
          // Primary focal point - large Queen in top right
          { piece: 'rQ', size: 70, style: { top: '20%', right: '15%', bubbleColor: 'rgba(255, 107, 107, 0.3)' } },
          // Balances the Queen - King in mid-lower left
          { piece: 'bK', size: 50, style: { top: '65%', left: '10%', bubbleColor: 'rgba(78, 205, 196, 0.3)' } },
          // Anchors top-left corner
          { piece: 'gR', size: 60, style: { top: '12%', left: '8%', bubbleColor: 'rgba(69, 183, 209, 0.3)' } },
          // Fills space below top-left Rook
          { piece: 'yB', size: 50, style: { top: '30%', left: '25%', bubbleColor: 'rgba(249, 202, 36, 0.3)' } },
          // Balances right edge between Queen and bottom
          { piece: 'rN', size: 40, style: { top: '50%', right: '10%', bubbleColor: 'rgba(168, 85, 247, 0.3)' } },
          // Fills bottom-right negative space
          { piece: 'bP', size: 40, style: { top: '80%', right: '20%', bubbleColor: 'rgba(6, 182, 212, 0.3)' } },
          // Anchors bottom-left corner
          { piece: 'yR', size: 60, style: { top: '85%', left: '15%', bubbleColor: 'rgba(124, 58, 237, 0.3)' } },
          // Creates depth - appears "behind" other pieces
          { piece: 'gB', size: 50, style: { top: '15%', right: '40%', bubbleColor: 'rgba(217, 70, 239, 0.3)' } },
          // Fills gap below buttons subtly
          { piece: 'bN', size: 40, style: { top: '75%', left: '45%', bubbleColor: 'rgba(132, 204, 22, 0.3)' } },
          // Mid-ground element with variety
          { piece: 'gP', size: 60, style: { top: '40%', left: '10%', bubbleColor: 'rgba(120, 53, 15, 0.3)' } },
        ].map((p, i) => (
            <Animated.View 
              key={i} 
              style={[
                {
                  position: 'absolute',
                  // ✅ Use a large border radius for a perfect circle
                  borderRadius: 999,
                  // Enhanced glass edge effect
                  borderWidth: 2,
                  borderColor: 'rgba(255, 255, 255, 0.4)',
                  // Stronger bubble shadow for depth
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 12 },
                  shadowOpacity: 0.4,
                  shadowRadius: 18,
                  elevation: 12,
                },
                p.style as any, // Unique position
                getPieceStyle(i) // The crucial animation styles
              ]}
            >
              {/* ✅ Add subtle bubble reflections */}
              <LinearGradient
                colors={[
                  // Subtle highlight at top-left (light source)
                  'rgba(255, 255, 255, 0.3)',
                  // Very subtle highlight in upper area
                  'rgba(255, 255, 255, 0.1)',
                  // Main bubble color
                  p.style.bubbleColor,
                  // Darker shadow at bottom-right
                  p.style.bubbleColor.replace('0.3', '0.1'),
                ]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                  padding: 16,
                  borderRadius: 999, // Match the outer radius
                }}
              >
                <BackgroundPiece 
                  piece={p.piece} 
                  size={p.size}
                  style={p.style}
                />
              </LinearGradient>
            </Animated.View>
        ))}
      </View>

      <Animated.View className="flex-1" style={[containerStyle, { zIndex: 1 }]}>
      {/* Top Navigation Bar */}
      <View className="flex-row justify-between items-center px-6 pt-8 pb-4">
        <View className="w-10" />
        {/* <Text className="text-3xl font-bold text-white">
          ♔ QUAD CHESS ♔
        </Text> */}
        <TouchableOpacity
          className="w-10 h-10 rounded-full bg-white/10 justify-center items-center border border-white/20"
          onPress={async () => {
            try {
              // ✅ CRITICAL FIX: Use sound service to respect haptics settings
              const soundService = require('../../services/soundService').default;
              await soundService.playSound('button');
            } catch (error) {
              console.log('🔊 Failed to play button sound:', error);
            }
            router.push("/settings");
          }}
        >
          <Text className="text-xl">⚙️</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-1 px-6 pb-16 justify-between mt-8">
        {/* Header Section */}
        
        <View className="items-center mb-8">
          <Text className="text-xl text-gray-300 text-center mb-1 font-semibold" style={{
            letterSpacing: 0.8,
            textShadowColor: 'rgba(0,0,0,0.3)',
            textShadowOffset: {width: 1, height: 1},
            textShadowRadius: 2,
          }}>
            MASTER THE ULTIMATE STRATEGY
          </Text>
          {/* <Text className="text-lg text-gray-400 text-center mb-2 font-medium" style={{
            letterSpacing: 0.5,
          }}>
            Where Four Minds Collide
          </Text> */}
          {/* Main column container for the new title layout */}
          <View className="items-center mb-4">
            {/* Top line of text */}
            {/* <Text className="text-xl font-semibold text-gray-300 tracking-wider">
              4 PLAYERS
            </Text> */}

            {/* Bottom line with flanking icons */}
            <View className="flex-row items-center justify-center">
              {/* <Svg width={32} height={32} viewBox="0 0 48 48" className="mr-2">
                <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5 M 4,12 A 2,2 0 1,1 8,12 A 2,2 0 1,1 4,12 M 12,9 A 2,2 0 1,1 16,9 A 2,2 0 1,1 12,9 M 20.5,8 A 2,2 0 1,1 24.5,8 A 2,2 0 1,1 20.5,8 M 29,9 A 2,2 0 1,1 33,9 A 2,2 0 1,1 29,9 M 37,12 A 2,2 0 1,1 41,12 A 2,2 0 1,1 37,12" />
                </G>
              </Svg> */}
              <Text className="text-4xl font-extrabold text-white tracking-widest">
              QUADRA CHESS
              </Text>
              {/* <Svg width={32} height={32} viewBox="0 0 48 48" className="ml-2">
                <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z M 11.5,30 C 15,29 30,29 33.5,30 M 12,33.5 C 18,32.5 27,32.5 33,33.5 M 4,12 A 2,2 0 1,1 8,12 A 2,2 0 1,1 4,12 M 12,9 A 2,2 0 1,1 16,9 A 2,2 0 1,1 12,9 M 20.5,8 A 2,2 0 1,1 24.5,8 A 2,2 0 1,1 20.5,8 M 29,9 A 2,2 0 1,1 33,9 A 2,2 0 1,1 29,9 M 37,12 A 2,2 0 1,1 41,12 A 2,2 0 1,1 37,12" />
                </G>
              </Svg> */}
            </View>
          </View>
            <View className="w-20 h-20 rounded-full bg-white/10 justify-center items-center border-2 border-white/20">
              <Svg width={48} height={48} viewBox="0 0 48 48">
                <G fill="none" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <Path d="M22.5 11.63V6M20 8h5 M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5 M12.5 37c5.5 3.5 14.5 3.5 20 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V27v-3.5c-2.5-7.5-12-10.5-16-4-3 6 6 10.5 6 10.5v7 M12.5 30c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0m-20 3.5c5.5-3 14.5-3 20 0" />
                </G>
              </Svg>
            </View>
        </View>

          {/* Buttons Section - Now using the component */}
          <View className="gap-4">
            <AnimatedButton
              delay={300} // Stagger delay
              icon="🦁"
              title="SINGLE PLAYER"
              subtitle="Play against AI"
              gradientColors={['rgb(255, 255, 255)', 'rgb(245, 200, 200)']}
              onPress={handleStartSinglePlayer}
            disabled={isNavigating}
            />
            <AnimatedButton
              delay={450} // Stagger delay
              icon="🏠"
              title="LOCAL MULTIPLAYER"
              subtitle="Play with friends"
              textColor="white"
              subtitleColor="gray-300"
              gradientColors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
              onPress={() => handleModeSwitch("local", "/(tabs)/P2PLobbyScreen")}
            disabled={isNavigating}
            />
            <AnimatedButton
              delay={600} // Stagger delay
              icon="🌍"
              title="ONLINE MULTIPLAYER"
              subtitle="Play online"
              textColor="white"
              subtitleColor="blue-100"
              gradientColors={['rgba(0, 106, 255, 0.35)', 'rgba(155, 173, 234, 0.2)']}
              onPress={() => handleModeSwitch("online", "/(tabs)/OnlineLobbyScreen")}
            disabled={isNavigating}
            />
        </View>

        {/* Features Section */}
        <View className="flex-row justify-around px-5 pb-4 mt-4">
          <View className="items-center flex-1">
            <Text className="text-2xl mb-2">👥</Text>
            <Text className="text-gray-300 text-sm font-semibold text-center">
              Up to 4 Players
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl mb-2">⚡</Text>
            <Text className="text-gray-300 text-sm font-semibold text-center">
              Real-time Play
            </Text>
          </View>
          <View className="items-center flex-1">
            <Text className="text-2xl mb-2">🏆</Text>
            <Text className="text-gray-300 text-sm font-semibold text-center">
              Strategic Gameplay
            </Text>
          </View>
        </View>
      </View>
      </Animated.View>

    </SafeAreaView>
  );
}
