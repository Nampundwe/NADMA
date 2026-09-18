import React, { useEffect, useRef, useCallback, memo } from 'react';
import { Modal, View, Text, Pressable, TouchableOpacity, Animated, Dimensions, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTheme } from '../context/ThemeContext';
import { createStyleSheet } from '../utils/responsive';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

function BottomSheet({
  visible,
  onClose,
  title,
  children,
  maxHeight = '70%',
  showCloseButton = true,
  closeOnBackdropPress = true,
  onOpen,
  onCloseComplete,
  containerStyle,
  testID,
}) {
  const { colors } = useTheme();
  const slideAnim = useRef(new Animated.Value(0)).current;
  const backdropAnim = useRef(new Animated.Value(0)).current;
  const isOpenRef = useRef(false);
  const bottomPadding = Platform.OS === 'ios' ? 34 : 16;

  const animateIn = useCallback(() => {
    isOpenRef.current = true;
    Animated.parallel([
      Animated.spring(slideAnim, {
        toValue: 1,
        damping: 15,
        stiffness: 150,
        mass: 0.8,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onOpen && onOpen();
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    });
  }, [slideAnim, backdropAnim, onOpen]);

  const animateOut = useCallback(() => {
    isOpenRef.current = false;
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(backdropAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onCloseComplete && onCloseComplete();
      try { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); } catch (e) {}
    });
  }, [slideAnim, backdropAnim, onCloseComplete]);

  useEffect(() => {
    if (visible && !isOpenRef.current) {
      animateIn();
    } else if (!visible && isOpenRef.current) {
      animateOut();
    }
  }, [visible]);

  const handleBackdropPress = useCallback(() => {
    if (closeOnBackdropPress && onClose) {
      onClose();
    }
  }, [closeOnBackdropPress, onClose]);

  const handleClosePress = useCallback(() => {
    if (onClose) onClose();
  }, [onClose]);

  const styles = createStyles(colors);

  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [SCREEN_HEIGHT, 0],
  });

  const backdropOpacity = backdropAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.5],
  });

  return (
    <Modal visible={visible || isOpenRef.current} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.wrapper}>
        <Animated.View
          style={[styles.backdrop, { opacity: backdropOpacity }]}
        >
          <Pressable style={styles.backdropPress} onPress={handleBackdropPress} />
        </Animated.View>

        <Animated.View
          style={[
            styles.content,
            {
              backgroundColor: colors.card,
              maxHeight,
              paddingBottom: bottomPadding,
              transform: [{ translateY }],
            },
            containerStyle,
          ]}
          testID={testID}
        >
          <View style={styles.handleRow}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
          </View>

          {(title || showCloseButton) && (
            <View style={styles.header}>
              {title ? (
                <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
              ) : <View style={styles.headerSpacer} />}

              {showCloseButton ? (
                <TouchableOpacity
                  style={[styles.closeBtn, { backgroundColor: colors.borderLight }]}
                  onPress={handleClosePress}
                  accessibilityLabel="Close"
                  accessibilityRole="button"
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="close" size={18} color={colors.textSecondary} />
                </TouchableOpacity>
              ) : null}
            </View>
          )}

          {children}
        </Animated.View>
      </View>
    </Modal>
  );
}

const createStyles = (colors) => createStyleSheet({
  wrapper: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
  },
  backdropPress: {
    flex: 1,
  },
  content: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 8,
    paddingHorizontal: 20,
  },
  handleRow: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 2.5,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headerSpacer: {
    flex: 1,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default memo(BottomSheet);
