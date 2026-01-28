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
export const TAB_BAR_HEIGHT = 56;
export const TAB_BAR_OFFSET = 12;
export const getTabBarSpacer = (insetBottom = 0) =>
  insetBottom + TAB_BAR_HEIGHT + TAB_BAR_OFFSET;
export const getHudHeight = (windowHeight: number = H) => {
  const compact = windowHeight < 700;
  const min = compact ? 90 : 110;
  const max = compact ? 170 : 200;
  return Math.min(Math.max(Math.round(windowHeight * 0.18), min), max);
};
export const getBottomPadding = () => Math.min(Math.max(Math.round(H * 0.08), 60), 120);
export const getBoardSize = (windowWidth: number = W, windowHeight: number = H) => {
  const tablet = windowWidth >= 600;
  const compact = windowHeight < 700;
  const widthLimit = tablet ? windowWidth * 0.85 : windowWidth * 0.98;
  const hardCap = tablet ? 800 : 600;
  const verticalPadding = Math.round(
    PixelRatio.roundToNearestPixel((windowHeight / 667) * (compact ? 24 : 32))
  );
  const heightLimit = Math.max(
    220,
    windowHeight - (getHudHeight(windowHeight) * 2) - verticalPadding
  );
  return Math.min(widthLimit, heightLimit, hardCap);
};

const RoutePlaceholder = () => null;

export default RoutePlaceholder;
