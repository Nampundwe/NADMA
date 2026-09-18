import React, { useRef } from 'react';
import { View, Animated, PanResponder, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hapticMedium } from '../utils/haptics';

const SWIPE_THRESHOLD = 60;

export default function SwipeablePostCard({ children, onSwipeRight, onSwipeLeft }) {
  const translateX = useRef(new Animated.Value(0)).current;
  const likeOpacity = useRef(new Animated.Value(0)).current;

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => false,
      onMoveShouldSetPanResponderCapture: (_, gs) => {
        return Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2;
      },
      onMoveShouldSetPanResponder: (_, gs) => {
        return Math.abs(gs.dx) > 10 && Math.abs(gs.dx) > Math.abs(gs.dy) * 1.2;
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderMove: (_, gs) => {
        if (gs.dx > 0) {
          translateX.setValue(gs.dx * 0.5);
          likeOpacity.setValue(Math.min(gs.dx / SWIPE_THRESHOLD, 1));
        }
      },
      onPanResponderRelease: (_, gs) => {
        if (gs.dx > SWIPE_THRESHOLD) {
          hapticMedium();
          onSwipeRight && onSwipeRight();
        } else if (gs.dx < -SWIPE_THRESHOLD) {
          hapticMedium();
          onSwipeLeft && onSwipeLeft();
        }
        Animated.parallel([
          Animated.spring(translateX, { toValue: 0, useNativeDriver: true, friction: 8 }),
          Animated.timing(likeOpacity, { toValue: 0, duration: 200, useNativeDriver: true }),
        ]).start();
      },
    })
  ).current;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.likeBackground, { opacity: likeOpacity }]}>
        <Animated.View style={{ transform: [{ scale: likeOpacity.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1.2] }) }] }}>
          <Ionicons name="heart" size={28} color="#FF6B6B" />
        </Animated.View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateX }] }} {...panResponder.panHandlers}>
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 16,
  },
  likeBackground: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    width: 100,
    backgroundColor: '#FF6B6B20',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
  },
});
