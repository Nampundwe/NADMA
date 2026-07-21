import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
};

const ThemeContext = createContext({
  colors: lightColors,
  isDark: false,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    loadTheme();
  }, []);

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
    <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
