import React, { createContext, useState, useEffect, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  scale,
  verticalScale,
  moderateScale,
  normalizeFont,
  wp,
  hp,
  isTablet as baseIsTablet,
  isSmallScreen as baseIsSmall,
  fontSize,
  spacing,
  rPadding,
  rBorderRadius,
  avatarSize,
  iconSize,
  cardHeight,
  getGridColumns,
} from '../utils/responsive';

const SETTINGS_KEY = '@nadma_settings';

const lightColors = {
  bg: '#F5F6FA',
  card: '#FFFFFF',
  text: '#1B2559',
  textSecondary: '#68769F',
  textMuted: '#A3AED0',
  border: '#E9EDF7',
  borderLight: '#F4F7FE',
  primary: '#1B2559',
  primaryLight: '#EEF4FF',
  headerBg: '#1B2559',
  headerText: '#FFFFFF',
  inputBg: '#F7F9FC',
  white: '#FFFFFF',
  shadow: '#000',
  tabBg: '#FFFFFF',
  statusBar: 'dark-content',
  success: '#01B574',
  danger: '#EE5D50',
  warning: '#FFB547',
  info: '#5B9CF6',
  chatBg: '#ECE5DD',
  sentBubble: '#D9FDD3',
  sentBubbleText: '#111B21',
  receivedBubble: '#FFFFFF',
  receivedBubbleText: '#111B21',
  chatDatePill: '#E1F3FB',
  chatDateText: '#54656F',
  chatInputBg: '#F0F2F5',
  chatInput: '#111B21',
  chatInputBorder: '#E0E0E0',
  chatSendBtn: '#25D366',
  chatTime: '#667781',
  chatCheckRead: '#53BDEB',
  chatCheckSent: '#8696A0',
  chatPreview: '#667781',
  chatUnreadTime: '#25D366',
  chatUnreadBg: '#25D366',
};

const darkColors = {
  bg: '#111C44',
  card: '#1B2559',
  text: '#FFFFFF',
  textSecondary: '#A3AED0',
  textMuted: '#4B5E7C',
  border: '#2B3A67',
  borderLight: '#1F2E56',
  primary: '#5B9CF6',
  primaryLight: '#11204A',
  headerBg: '#1B2559',
  headerText: '#FFFFFF',
  inputBg: '#111C44',
  white: '#1B2559',
  shadow: '#000',
  tabBg: '#1B2559',
  statusBar: 'light-content',
  success: '#01B574',
  danger: '#EE5D50',
  warning: '#FFB547',
  info: '#5B9CF6',
  chatBg: '#0B141A',
  sentBubble: '#005C4B',
  sentBubbleText: '#E9EDEF',
  receivedBubble: '#1F2C34',
  receivedBubbleText: '#E9EDEF',
  chatDatePill: '#182229',
  chatDateText: '#8696A0',
  chatInputBg: '#202C33',
  chatInput: '#E9EDEF',
  chatInputBorder: '#313D45',
  chatSendBtn: '#00A884',
  chatTime: '#8696A0',
  chatCheckRead: '#53BDEB',
  chatCheckSent: '#8696A0',
  chatPreview: '#8696A0',
  chatUnreadTime: '#00A884',
  chatUnreadBg: '#00A884',
};

const ThemeContext = createContext({
  colors: lightColors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  const isSmall = width < 360;
  const cols = getGridColumns(2, 2, 3, isTablet ? 4 : 3);

  useEffect(() => {
    loadTheme();
  }, []);

  const responsive = useMemo(() => ({
    width,
    height,
    isTablet,
    isSmall,
    scale: (size) => (width / 390) * size,
    verticalScale: (size) => (height / 844) * size,
    moderateScale: (size, factor = 0.5) => size + ((width / 390) * size - size) * factor,
    wp: (pct) => (width * pct) / 100,
    hp: (pct) => (height * pct) / 100,
    cols,
    fontSize,
    spacing,
    rPadding,
    rBorderRadius,
    avatarSize,
    iconSize,
    cardHeight,
  }), [width, height, isTablet, isSmall, cols]);

  const loadTheme = async () => {
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.darkMode) setIsDark(true);
      }
    } catch (e) {}
  };

  const toggleTheme = async () => {
    const newVal = !isDark;
    setIsDark(newVal);
    try {
      const saved = await AsyncStorage.getItem(SETTINGS_KEY);
      const settings = saved ? JSON.parse(saved) : {};
      settings.darkMode = newVal;
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {}
  };

  return (
    <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark, toggleTheme, responsive }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
