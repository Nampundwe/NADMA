import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { View, Text, Animated, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const ToastContext = createContext();

const TOAST_TYPES = {
  success: { icon: 'checkmark-circle', color: '#01B574', bg: '#ECFDF5', border: '#A7F3D0' },
  error: { icon: 'close-circle', color: '#EE5D50', bg: '#FEF2F2', border: '#FECACA' },
  warning: { icon: 'warning', color: '#FFB547', bg: '#FFFBEB', border: '#FDE68A' },
  info: { icon: 'information-circle', color: '#5B9CF6', bg: '#EFF6FF', border: '#BFDBFE' },
};

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-60)).current;
  const timeoutRef = useRef(null);

  const show = useCallback((message, type = 'success', duration = 2500) => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    setToast({ message, type });
    fadeAnim.setValue(0);
    slideAnim.setValue(-60);

    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, tension: 80, friction: 10, useNativeDriver: true }),
    ]).start();

    timeoutRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
        Animated.timing(slideAnim, { toValue: -60, duration: 200, useNativeDriver: true }),
      ]).start(() => setToast(null));
    }, duration);
  }, [fadeAnim, slideAnim]);

  const success = useCallback((msg) => show(msg, 'success'), [show]);
  const error = useCallback((msg) => show(msg, 'error', 3500), [show]);
  const warning = useCallback((msg) => show(msg, 'warning'), [show]);
  const info = useCallback((msg) => show(msg, 'info'), [show]);

  const hide = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: -60, duration: 200, useNativeDriver: true }),
    ]).start(() => setToast(null));
  }, [fadeAnim, slideAnim]);

  const config = toast ? TOAST_TYPES[toast.type] : null;

  return (
    <ToastContext.Provider value={{ show, success, error, warning, info, hide }}>
      {children}
      {toast && config && (
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
              backgroundColor: config.bg,
              borderColor: config.border,
            },
          ]}
          pointerEvents="box-none"
        >
          <View style={styles.content}>
            <Ionicons name={config.icon} size={20} color={config.color} />
            <Text style={[styles.message, { color: '#1F2937' }]} numberOfLines={2}>
              {toast.message}
            </Text>
            <TouchableOpacity onPress={hide} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Ionicons name="close" size={16} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    left: 16,
    right: 16,
    zIndex: 9999,
    borderRadius: 12,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  message: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
    lineHeight: 18,
  },
});
