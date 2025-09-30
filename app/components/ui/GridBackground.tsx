import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path } from 'react-native-svg';

const GridBackground: React.FC = () => {
  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern 
          id="grid" 
          width="40" 
          height="40" 
          patternUnits="userSpaceOnUse"
        >
          <Path 
            d="M 40 0 L 0 0 0 40" 
            fill="none" 
            stroke="rgba(113, 113, 122, 0.15)" // Very faint gray lines
            strokeWidth="1" 
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#grid)" />
    </Svg>
  );
};

export default GridBackground;
