import { Dimensions, PixelRatio, Platform } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

// Design dimensions (iPhone 14 - 390x844)
const DESIGN_WIDTH = 390;
const DESIGN_HEIGHT = 844;

// Scale font/layout sizes horizontally based on screen width
export const scale = (size) => (SCREEN_WIDTH / DESIGN_WIDTH) * size;

// Scale vertically based on screen height
export const verticalScale = (size) => (SCREEN_HEIGHT / DESIGN_HEIGHT) * size;

// Moderate scale: factor 0 = no scaling, factor 1 = full scaling
export const moderateScale = (size, factor = 0.5) =>
  size + (scale(size) - size) * factor;

// Scale to PixelRatio for crisp text
export const normalizeFont = (size) => {
  const newSize = moderateScale(size, 0.3);
  return Math.round(PixelRatio.roundToNearestPixel(newSize));
};

// Percentage helpers
export const wp = (percentage) => (SCREEN_WIDTH * percentage) / 100;
export const hp = (percentage) => (SCREEN_HEIGHT * percentage) / 100;

// Device categories
export const screenWidth = SCREEN_WIDTH;
export const screenHeight = SCREEN_HEIGHT;
export const isTablet = SCREEN_WIDTH >= 768;
export const isSmallScreen = SCREEN_WIDTH < 360;
export const isMediumScreen = SCREEN_WIDTH >= 360 && SCREEN_WIDTH < 480;
export const isLargeScreen = SCREEN_WIDTH >= 480;

// Grid column counts based on screen width
export const getGridColumns = (small = 2, medium = 2, large = 3, tablet = 4) => {
  if (isTablet) return tablet;
  if (isLargeScreen) return large;
  if (isMediumScreen) return medium;
  return small;
};

// Responsive padding (scales with screen width)
export const rPadding = moderateScale(16, 0.5);
export const rPaddingSmall = moderateScale(8, 0.5);

// Responsive border radius
export const rBorderRadius = moderateScale(14, 0.5);
export const rBorderRadiusSmall = moderateScale(10, 0.5);
export const rBorderRadiusLarge = moderateScale(20, 0.5);

// Responsive font sizes
export const fontSize = {
  xs: normalizeFont(10),
  sm: normalizeFont(12),
  base: normalizeFont(14),
  md: normalizeFont(15),
  lg: normalizeFont(16),
  xl: normalizeFont(18),
  xxl: normalizeFont(20),
  title: normalizeFont(22),
  hero: normalizeFont(26),
  display: normalizeFont(32),
};

// Spacing scale
export const spacing = {
  xs: moderateScale(4, 0.5),
  sm: moderateScale(8, 0.5),
  md: moderateScale(12, 0.5),
  base: moderateScale(16, 0.5),
  lg: moderateScale(20, 0.5),
  xl: moderateScale(24, 0.5),
  xxl: moderateScale(32, 0.5),
};

// Avatar sizes
export const avatarSize = {
  xs: moderateScale(28, 0.5),
  sm: moderateScale(36, 0.5),
  md: moderateScale(44, 0.5),
  lg: moderateScale(56, 0.5),
  xl: moderateScale(72, 0.5),
  xxl: moderateScale(96, 0.5),
};

// Icon sizes
export const iconSize = {
  xs: moderateScale(14, 0.5),
  sm: moderateScale(18, 0.5),
  md: moderateScale(22, 0.5),
  lg: moderateScale(26, 0.5),
  xl: moderateScale(32, 0.5),
};

// Card dimensions
export const cardHeight = {
  sm: moderateScale(80, 0.5),
  md: moderateScale(100, 0.5),
  lg: moderateScale(120, 0.5),
};

// Drop-in replacement for StyleSheet.create that auto-scales pixel values.
// Usage: import { createStyleSheet } from '../utils/responsive';
//   const styles = createStyleSheet({ ... })  // instead of StyleSheet.create
// All numeric layout values are auto-scaled. flex, zIndex, opacity, etc. are left as-is.
const SCALE_KEYS = new Set([
  'fontSize', 'padding', 'paddingTop', 'paddingBottom', 'paddingLeft', 'paddingRight',
  'paddingHorizontal', 'paddingVertical', 'margin', 'marginTop', 'marginBottom',
  'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical',
  'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight',
  'borderRadius', 'borderTopLeftRadius', 'borderTopRightRadius',
  'borderBottomLeftRadius', 'borderBottomRightRadius',
  'borderWidth', 'borderTopWidth', 'borderBottomWidth', 'borderLeftWidth', 'borderRightWidth',
  'gap', 'rowGap', 'columnGap',
  'top', 'bottom', 'left', 'right',
  'lineHeight',
]);

const SKIP_KEYS = new Set([
  'flex', 'flexShrink', 'flexGrow', 'flexBasis', 'zIndex', 'elevation',
  'opacity', 'aspectRatio', 'order',
]);

const isColorValue = (val) => typeof val === 'string' && (val.startsWith('#') || val.startsWith('rgba') || val.startsWith('rgb'));

const scaleStyleValue = (key, val) => {
  if (typeof val !== 'number') return val;
  if (SKIP_KEYS.has(key)) return val;
  if (SCALE_KEYS.has(key)) return moderateScale(val, 0.35);
  // For unknown keys with small values (likely flex or counts), don't scale
  if (val <= 1 || val === 0) return val;
  // For other numeric values that look like dimensions, scale gently
  return moderateScale(val, 0.25);
};

const scaleStyleObject = (obj) => {
  if (!obj || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(scaleStyleObject);
  const result = {};
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (key === 'transform' && Array.isArray(val)) {
      result[key] = val.map((item) => {
        if (typeof item !== 'object') return item;
        const transformed = {};
        for (const tKey of Object.keys(item)) {
          transformed[tKey] = typeof item[tKey] === 'number' ? scaleStyleValue(tKey, item[tKey]) : item[tKey];
        }
        return transformed;
      });
    } else if (typeof val === 'object' && val !== null && !Array.isArray(val) && key !== 'transform') {
      result[key] = scaleStyleObject(val);
    } else if (Array.isArray(val)) {
      result[key] = val.map((item) => (typeof item === 'object' ? scaleStyleObject(item) : item));
    } else if (typeof val === 'number' && !isColorValue(String(val))) {
      result[key] = scaleStyleValue(key, val);
    } else {
      result[key] = val;
    }
  }
  return result;
};

// Drop-in replacement for StyleSheet.create
export const createStyleSheet = (styles) => {
  const scaled = {};
  for (const key of Object.keys(styles)) {
    scaled[key] = scaleStyleObject(styles[key]);
  }
  return scaled;
};

// Quick inline scale helper for use in JSX: fontSize: s(14), width: s(100), etc.
// Use moderateScale with 0.35 factor for balanced scaling
export const s = (size) => moderateScale(size, 0.35);

// Quick inline font scale for crisp text
export const fs = (size) => normalizeFont(size);

// Common responsive style presets
export const responsiveStyle = {
  container: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  paddingHorizontal: {
    paddingHorizontal: rPadding,
  },
};
