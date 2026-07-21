import React, { createContext, useState, useEffect, useContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const SETTINGS_KEY = '@nadma_settings';

const lightColors = {
  bg: '#F0F2F5',
  card: '#fff',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
  primary: '#1a237e',
  primaryLight: '#E8EAF6',
  headerBg: '#1a237e',
  headerText: '#fff',
  inputBg: '#F9FAFB',
  white: '#fff',
  shadow: '#000',
  tabBg: '#fff',
  statusBar: 'dark-content',
};

const darkColors = {
  bg: '#0D1117',
  card: '#161B22',
  text: '#E6EDF3',
  textSecondary: '#8B949E',
  textMuted: '#484F58',
  border: '#30363D',
  borderLight: '#21262D',
  primary: '#58A6FF',
  primaryLight: '#1C2D44',
  headerBg: '#161B22',
  headerText: '#E6EDF3',
  inputBg: '#0D1117',
  white: '#161B22',
  shadow: '#000',
  tabBg: '#161B22',
  statusBar: 'light-content',
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
