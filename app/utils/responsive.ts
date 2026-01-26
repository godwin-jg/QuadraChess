import { Dimensions, PixelRatio } from 'react-native';

const { width: W, height: H } = Dimensions.get('window');
const BASE_W = 375; // iPhone SE baseline

// Core scaling functions
export const sw = (size: number) => Math.round(PixelRatio.roundToNearestPixel((W / BASE_W) * size));
export const sh = (size: number) => Math.round(PixelRatio.roundToNearestPixel((H / 667) * size));
export const sf = (size: number) => Math.round(size + (size * ((W / BASE_W) - 1) * 0.5));

// Device detection
export const isTablet = W >= 600;
export const isCompact = H < 700;

// Layout helpers
export const getHudHeight = () => Math.min(Math.max(Math.round(H * 0.15), 100), 180);
export const getBottomPadding = () => Math.min(Math.max(Math.round(H * 0.08), 60), 120);
export const getBoardSize = () => isTablet 
  ? Math.min(W * 0.85, H * 0.55, 800) 
  : Math.min(W * 0.98, 600);
