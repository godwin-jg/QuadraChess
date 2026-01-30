import React from 'react';
import { StyleSheet } from 'react-native';
import Svg, { Defs, Pattern, Rect, Path } from 'react-native-svg';

const GridBackground: React.FC = () => {
  // Rectangle dimensions (taller than wider)
  const rectWidth = 28;
  const rectHeight = 48;

  return (
    <Svg style={StyleSheet.absoluteFill}>
      <Defs>
        <Pattern 
          id="rectGrid" 
          width={rectWidth} 
          height={rectHeight} 
          patternUnits="userSpaceOnUse"
        >
          <Path 
            d={`M ${rectWidth} 0 L 0 0 0 ${rectHeight}`}
            fill="none" 
            stroke="rgba(113, 113, 122, 0.12)"
            strokeWidth="0.5" 
          />
        </Pattern>
      </Defs>
      <Rect width="100%" height="100%" fill="url(#rectGrid)" />
    </Svg>
  );
};

export default GridBackground;
