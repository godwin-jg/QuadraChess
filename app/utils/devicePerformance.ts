import Constants from "expo-constants";
import { Dimensions, PixelRatio, Platform } from "react-native";

const LOW_END_DEVICE_YEAR_CLASS = 2017;
const LOW_END_PHYSICAL_PIXELS = 720 * 1280;

const getDeviceYearClass = (): number | null => {
  const yearClass = Constants.deviceYearClass;
  return typeof yearClass === "number" && Number.isFinite(yearClass)
    ? yearClass
    : null;
};

const getPhysicalPixelCount = (): number => {
  const { width, height } = Dimensions.get("window");
  const scale = PixelRatio.get();
  return width * height * scale * scale;
};

const isLowEndWebDevice = (): boolean => {
  const deviceMemory = (globalThis as { navigator?: { deviceMemory?: number } })
    ?.navigator?.deviceMemory;
  return typeof deviceMemory === "number" ? deviceMemory <= 3 : false;
};

export const isLowEndDevice = (): boolean => {
  if (Platform.OS === "web") {
    return isLowEndWebDevice();
  }

  const yearClass = getDeviceYearClass();
  if (yearClass !== null) {
    return yearClass <= LOW_END_DEVICE_YEAR_CLASS;
  }

  const physicalPixels = getPhysicalPixelCount();
  if (Number.isFinite(physicalPixels) && physicalPixels > 0) {
    return physicalPixels <= LOW_END_PHYSICAL_PIXELS;
  }

  const { width, height } = Dimensions.get("window");
  return Math.min(width, height) <= 360;
};

export const getDefaultAnimationsEnabled = (): boolean => !isLowEndDevice();
