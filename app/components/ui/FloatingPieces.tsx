import React, { useEffect, useRef } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { useIsFocused } from "@react-navigation/native";
import Animated, {
  useAnimatedStyle,
  withTiming,
  withRepeat,
  withSequence,
  Easing,
  cancelAnimation,
  makeMutable,
  type SharedValue,
} from "react-native-reanimated";
import { scheduleOnRN } from "react-native-worklets";
import Svg, { G, Path } from "react-native-svg";

type FloatingPieceConfig = {
  piece: string;
  size: number;
  bubbleColor: string;
  style: Record<string, string | number>;
};

type PieceAnimation = {
  opacity: SharedValue<number>;
  scale: SharedValue<number>;
  translateX: SharedValue<number>;
  translateY: SharedValue<number>;
  rotateZ: SharedValue<number>;
};

const PIECE_PATHS: Record<string, string> = {
  rQ: "M 9,26 C 17.5,24.5 30,24.5 36,26 L 38.5,13.5 L 31,25 L 30.7,10.9 L 25.5,24.5 L 22.5,10 L 19.5,24.5 L 14.3,10.9 L 14,25 L 6.5,13.5 L 9,26 z M 9,26 C 9,28 10.5,28 11.5,30 C 12.5,31.5 12.5,31 12,33.5 C 10.5,34.5 11,36 11,36 C 9.5,37.5 11,38.5 11,38.5 C 17.5,39.5 27.5,39.5 34,38.5 C 34,38.5 35.5,37.5 34,36 C 34,36 34.5,34.5 33,33.5 C 32.5,31 32.5,31.5 33.5,30 C 34.5,28 36,28 36,26 C 27.5,24.5 17.5,24.5 9,26 z",
  bK: "M 22.5,11.63 L 22.5,6 M 20,8 h 5 M 22.5,25 s 4.5,-7.5 3,-10.5 c 0 0 -1,-2.5 -3,-2.5 s -3 2.5 -3 2.5 c -1.5 3 3 10.5 3 10.5 M 12.5,37 c 5.5 3.5 14.5 3.5 20 0 v -7 s 9,-4.5 6,-10.5 c -4,-6.5 -13.5,-3.5 -16 4 V 27 v -3.5 c -2.5,-7.5 -12,-10.5 -16,-4 -3 6 6 10.5 6 10.5 v 7",
  gR: "M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 M 34,14 L 31,17 L 14,17 L 11,14 M 31,17 L 31,29.5 L 14,29.5 L 14,17 M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5 M 11,14 L 34,14",
  yB: "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z",
  rN: "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10",
  bP: "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z",
  yR: "M 9,39 L 36,39 L 36,36 L 9,36 L 9,39 z M 12,36 L 12,32 L 33,32 L 33,36 L 12,36 z M 11,14 L 11,9 L 15,9 L 15,11 L 20,11 L 20,9 L 25,9 L 25,11 L 30,11 L 30,9 L 34,9 L 34,14 M 34,14 L 31,17 L 14,17 L 11,14 M 31,17 L 31,29.5 L 14,29.5 L 14,17 M 31,29.5 L 32.5,32 L 12.5,32 L 14,29.5 M 11,14 L 34,14",
  gB: "M 9,36 C 12.39,35.03 19.11,36.43 22.5,34 C 25.89,36.43 32.61,35.03 36,36 C 36,36 37.65,36.54 39,38 C 38.32,38.97 37.35,38.99 36,38.5 C 32.61,37.53 25.89,38.96 22.5,37.5 C 19.11,38.96 12.39,37.53 9,38.5 C 7.65,38.99 6.68,38.97 6,38 C 7.35,36.54 9,36 9,36 z M 15,32 C 17.5,34.5 27.5,34.5 30,32 C 30.5,30.5 30,30 30,30 C 30,27.5 27.5,26 27.5,26 C 33,24.5 33.5,14.5 22.5,10.5 C 11.5,14.5 12,24.5 17.5,26 C 17.5,26 15,27.5 15,30 C 15,30 14.5,30.5 15,32 z M 25 8 A 2.5 2.5 0 1 1 20,8 A 2.5 2.5 0 1 1 25 8 z",
  bN: "M 22,10 C 32.5,11 38.5,18 38,39 L 15,39 C 15,30 25,32.5 23,18 M 24,18 C 24.38,20.91 18.45,25.37 16,27 C 13,29 13.18,31.34 11,31 C 9.958,30.06 12.41,27.96 11,28 C 10,28 11.19,29.23 10,30 C 9,30 5.997,31 6,26 C 6,24 12,14 12,14 C 12,14 13.89,12.1 14,10.5 C 13.27,9.506 13.5,8.5 13.5,7.5 C 14.5,6.5 16.5,10 16.5,10 L 18.5,10 C 18.5,10 19.28,8.008 21,7 C 22,7 22,10 22,10",
  gP: "m 22.5,9 c -2.21,0 -4,1.79 -4,4 0,0.89 0.29,1.71 0.78,2.38 C 17.33,16.5 16,18.59 16,21 c 0,2.03 0.94,3.84 2.41,5.03 C 15.41,27.09 11,31.58 11,39.5 H 34 C 34,31.58 29.59,27.09 26.59,26.03 28.06,24.84 29,23.03 29,21 29,18.59 27.67,16.5 25.72,15.38 26.21,14.71 26.5,13.89 26.5,13 c 0,-2.21 -1.79,-4 -4,-4 z",
};

const FLOATING_PIECES: FloatingPieceConfig[] = [
  { piece: "rQ", size: 70, bubbleColor: "rgba(255, 107, 107, 0.3)", style: { top: "20%", right: "15%" } },
  { piece: "bK", size: 50, bubbleColor: "rgba(78, 205, 196, 0.3)", style: { top: "65%", left: "10%" } },
  { piece: "gR", size: 60, bubbleColor: "rgba(69, 183, 209, 0.3)", style: { top: "12%", left: "8%" } },
  { piece: "yB", size: 50, bubbleColor: "rgba(249, 202, 36, 0.3)", style: { top: "30%", left: "25%" } },
  { piece: "rN", size: 40, bubbleColor: "rgba(168, 85, 247, 0.3)", style: { top: "50%", right: "10%" } },
  { piece: "bP", size: 40, bubbleColor: "rgba(6, 182, 212, 0.3)", style: { top: "80%", right: "20%" } },
  { piece: "yR", size: 60, bubbleColor: "rgba(124, 58, 237, 0.3)", style: { top: "85%", left: "15%" } },
  { piece: "gB", size: 50, bubbleColor: "rgba(217, 70, 239, 0.3)", style: { top: "15%", right: "40%" } },
  { piece: "bN", size: 40, bubbleColor: "rgba(132, 204, 22, 0.3)", style: { top: "75%", left: "45%" } },
  { piece: "gP", size: 60, bubbleColor: "rgba(120, 53, 15, 0.3)", style: { top: "40%", left: "10%" } },
];

const floatingPieceBaseStyle = {
  position: "absolute" as const,
  borderRadius: 999,
  borderWidth: 2,
  borderColor: "rgba(255, 255, 255, 0.4)",
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 12 },
  shadowOpacity: 0.4,
  shadowRadius: 18,
  elevation: 12,
};

const createPieceAnimations = (count: number, height: number): PieceAnimation[] =>
  Array.from({ length: count }, () => ({
    opacity: makeMutable(0),
    scale: makeMutable(1),
    translateX: makeMutable(0),
    translateY: makeMutable(height),
    rotateZ: makeMutable(0),
  }));

const BackgroundPiece = React.memo(({ piece, size }: { piece: string; size: number }) => {
  const path = PIECE_PATHS[piece] || PIECE_PATHS.bP;
  const color =
    piece[0] === "r" ? "#ef4444" : piece[0] === "b" ? "#3b82f6" : piece[0] === "g" ? "#10b981" : "#7c3aed";

  return (
    <Svg width={size} height={size} viewBox="0 0 48 48">
      <G fill={color} stroke="#374151" strokeWidth="0.8">
        <Path d={path} />
      </G>
    </Svg>
  );
});

const FloatingPiece = React.memo(
  ({ config, animation }: { config: FloatingPieceConfig; animation: PieceAnimation }) => {
    const animatedStyle = useAnimatedStyle(() => ({
      opacity: animation.opacity.value,
      transform: [
        { scale: animation.scale.value },
        { translateX: animation.translateX.value },
        { translateY: animation.translateY.value },
        { rotateZ: `${animation.rotateZ.value}deg` },
      ],
    }));

    return (
      <Animated.View style={[floatingPieceBaseStyle, config.style, animatedStyle]}>
        <LinearGradient
          colors={[
            "rgba(255, 255, 255, 0.3)",
            "rgba(255, 255, 255, 0.1)",
            config.bubbleColor,
            config.bubbleColor.replace("0.3", "0.1"),
          ]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ padding: 16, borderRadius: 999 }}
        >
          <BackgroundPiece piece={config.piece} size={config.size} />
        </LinearGradient>
      </Animated.View>
    );
  }
);

export default function FloatingPieces() {
  const { width, height } = useWindowDimensions();
  const isFocused = useIsFocused();
  const pieceAnimationsRef = useRef<PieceAnimation[] | null>(null);
  const dimensionsRef = useRef({ width, height });
  const timeoutsRef = useRef<Array<ReturnType<typeof setTimeout>>>([]);

  useEffect(() => {
    dimensionsRef.current = { width, height };
  }, [width, height]);

  if (!pieceAnimationsRef.current) {
    pieceAnimationsRef.current = createPieceAnimations(FLOATING_PIECES.length, height);
  }
  const pieceAnimations = pieceAnimationsRef.current;

  const animatePiece = (index: number) => {
    const piece = pieceAnimations[index];
    const pieceSize = 100;
    const { width: screenWidth, height: screenHeight } = dimensionsRef.current;

    const startY = screenHeight + pieceSize + Math.random() * 200;
    const endY = -pieceSize + Math.random() * 100;
    piece.translateY.value = startY;
    piece.translateX.value = Math.random() * screenWidth;
    piece.scale.value = 0.4 + Math.random() * 0.6;
    piece.opacity.value = 0.2 + Math.random() * 0.3;

    const randomDuration = 20000 + Math.random() * 15000;
    piece.translateY.value = withTiming(
      endY,
      { duration: randomDuration, easing: Easing.linear },
      (finished) => {
        if (finished) {
          setTimeout(() => {
            scheduleOnRN(animatePiece, index);
          }, 3000 + Math.random() * 2000);
        }
      }
    );

    const sideToSideDuration = 5000 + Math.random() * 3000;
    const sideToSideDistance = (Math.random() - 0.5) * 80;
    piece.translateX.value = withRepeat(
      withSequence(
        withTiming(piece.translateX.value + sideToSideDistance, {
          duration: sideToSideDuration,
          easing: Easing.inOut(Easing.ease),
        }),
        withTiming(piece.translateX.value - sideToSideDistance, {
          duration: sideToSideDuration,
          easing: Easing.inOut(Easing.ease),
        })
      ),
      -1,
      true
    );

    const rotationDuration = 15000 + Math.random() * 10000;
    const rotationAmount = (Math.random() - 0.5) * 360;
    piece.rotateZ.value = withRepeat(
      withTiming(rotationAmount, { duration: rotationDuration, easing: Easing.linear }),
      -1,
      false
    );
  };

  useEffect(() => {
    if (!isFocused) {
      return;
    }

    timeoutsRef.current = [];
    pieceAnimations.forEach((_, index) => {
      const delay = index * 3000;
      const timeout = setTimeout(() => animatePiece(index), delay);
      timeoutsRef.current.push(timeout);
    });

    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      const resetY = dimensionsRef.current.height;
      pieceAnimations.forEach((piece) => {
        cancelAnimation(piece.opacity);
        cancelAnimation(piece.scale);
        cancelAnimation(piece.translateX);
        cancelAnimation(piece.translateY);
        cancelAnimation(piece.rotateZ);
        piece.opacity.value = 0;
        piece.scale.value = 1;
        piece.translateX.value = 0;
        piece.translateY.value = resetY;
        piece.rotateZ.value = 0;
      });
    };
  }, [isFocused, pieceAnimations]);

  return (
    <View pointerEvents="none" style={styles.container}>
      {FLOATING_PIECES.map((piece, index) => (
        <FloatingPiece
          key={`${piece.piece}-${index}`}
          config={piece}
          animation={pieceAnimations[index]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: "hidden",
    zIndex: 0,
  },
});
