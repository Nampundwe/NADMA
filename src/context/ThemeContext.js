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
  cardSolid: '#FFFFFF',
  text: '#1B2559',
  textSecondary: '#68769F',
  textMuted: '#A3AED0',
  border: '#E9EDF7',
  borderLight: '#F4F7FE',
  primary: '#1B2559',
  primaryLight: '#EEF4FF',
  headerBg: '#1B2559',
  headerText: '#FFFFFF',
  inputBg: '#FFFFFF',
  white: '#FFFFFF',
  shadow: '#000',
  tabBg: '#FFFFFF',
  statusBar: 'dark-content',
  success: '#01B574',
  successLight: '#E8F5E9',
  danger: '#EE5D50',
  dangerLight: '#FEE2E2',
  warning: '#FFB547',
  warningLight: '#FFF3E0',
  info: '#5B9CF6',
  infoLight: '#E3F2FD',
  purple: '#9C27B0',
  purpleLight: '#F3E5F5',
  glassBg: 'rgba(255,255,255,0.7)',
  glassBorder: 'rgba(255,255,255,0.3)',
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
  bg: '#0F1923',
  card: '#162231',
  cardSolid: '#1A2A3A',
  text: '#FFFFFF',
  textSecondary: '#A0B4C8',
  textMuted: '#5A7A94',
  border: 'rgba(255,255,255,0.1)',
  borderLight: 'rgba(255,255,255,0.05)',
  primary: '#4ECDC4',
  primaryLight: 'rgba(78,205,196,0.15)',
  headerBg: '#0F1923',
  headerText: '#FFFFFF',
  inputBg: '#162231',
  white: '#1A2A3A',
  shadow: '#000',
  tabBg: '#162231',
  statusBar: 'light-content',
  success: '#4ECDC4',
  successLight: 'rgba(78,205,196,0.15)',
  danger: '#FF6B6B',
  dangerLight: 'rgba(255,107,107,0.15)',
  warning: '#FFD93D',
  warningLight: 'rgba(255,217,61,0.15)',
  info: '#6BCB77',
  infoLight: 'rgba(107,203,119,0.15)',
  purple: '#BB86FC',
  purpleLight: 'rgba(187,134,252,0.15)',
  glassBg: 'rgba(255,255,255,0.06)',
  glassBorder: 'rgba(255,255,255,0.12)',
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
