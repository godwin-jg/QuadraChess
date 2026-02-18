import React, { useRef } from "react";
import { View, PanResponder, type LayoutChangeEvent } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

interface ThickSliderProps {
  value: number;
  minimumValue: number;
  maximumValue: number;
  step: number;
  disabled?: boolean;
  accentColors: string[];
  trackColor: string;
  thumbColor: string;
  onValueChange: (v: number) => void;
  onSlidingComplete: (v: number) => void;
}

const TRACK_HEIGHT = 6;
const THUMB_SIZE = 20;

const ThickSlider: React.FC<ThickSliderProps> = ({
  value, minimumValue, maximumValue, step, disabled,
  accentColors, trackColor, thumbColor,
  onValueChange, onSlidingComplete,
}) => {
  const trackWidth = useRef(0);
  const fraction = (value - minimumValue) / (maximumValue - minimumValue);

  const snap = (raw: number) => {
    const clamped = Math.max(minimumValue, Math.min(maximumValue, raw));
    return Math.round((clamped - minimumValue) / step) * step + minimumValue;
  };

  const valueFromX = (x: number) => {
    const ratio = Math.max(0, Math.min(1, x / trackWidth.current));
    return snap(minimumValue + ratio * (maximumValue - minimumValue));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabled,
      onMoveShouldSetPanResponder: () => !disabled,
      onPanResponderGrant: (e) => {
        const v = valueFromX(e.nativeEvent.locationX);
        onValueChange(v);
      },
      onPanResponderMove: (e) => {
        const v = valueFromX(e.nativeEvent.locationX);
        onValueChange(v);
      },
      onPanResponderRelease: (e) => {
        const v = valueFromX(e.nativeEvent.locationX);
        onSlidingComplete(v);
      },
    })
  ).current;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View
      style={{ height: 28, justifyContent: 'center' }}
      onLayout={onLayout}
      {...panResponder.panHandlers}
    >
      <View style={{
        height: TRACK_HEIGHT,
        borderRadius: TRACK_HEIGHT / 2,
        backgroundColor: trackColor,
        overflow: 'hidden',
      }}>
        <LinearGradient
          colors={accentColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={{
            width: `${fraction * 100}%`,
            height: '100%',
            borderRadius: TRACK_HEIGHT / 2,
          }}
        />
      </View>
      <View style={{
        position: 'absolute',
        left: `${fraction * 100}%`,
        marginLeft: -THUMB_SIZE / 2,
        width: THUMB_SIZE,
        height: THUMB_SIZE,
        borderRadius: THUMB_SIZE / 2,
        backgroundColor: thumbColor,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
        elevation: 4,
      }} />
    </View>
  );
};

export default ThickSlider;
