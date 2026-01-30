import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Rect } from 'react-native-svg';

const RadialGlowBackground: React.FC = () => {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <RadialGradient
          id="radialGlow"
          cx="50%"
          cy="40%"
          rx="70%"
          ry="60%"
          fx="50%"
          fy="40%"
        >
          <Stop offset="0%" stopColor="rgba(30, 30, 35, 1)" />
          <Stop offset="50%" stopColor="rgba(15, 15, 18, 1)" />
          <Stop offset="100%" stopColor="rgba(0, 0, 0, 1)" />
        </RadialGradient>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#radialGlow)" />
    </Svg>
  );
};

export default RadialGlowBackground;
