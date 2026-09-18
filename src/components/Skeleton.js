import React, { useEffect, useRef, useMemo, memo } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import { useTheme } from '../context/ThemeContext';

/**
 * Single skeleton block with shimmer animation.
 * Shimmer slides a highlight across the base color using Animated.
 */
function SkeletonBlock({ width = '100%', height = 20, borderRadius = 8, style, speed = 1 }) {
  const { colors } = useTheme();
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const duration = Math.round(1200 / Math.max(0.5, Math.min(3, speed)));

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, { toValue: 1, duration, useNativeDriver: true }),
        Animated.timing(shimmerAnim, { toValue: 0, duration, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [duration]);

  const opacity = shimmerAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.7, 0.4],
  });

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: colors.borderLight,
          opacity,
          overflow: 'hidden',
        },
        style,
      ]}
      accessible
      accessibilityLabel="Loading"
      accessibilityRole="progressbar"
    />
  );
}

const MemoBlock = memo(SkeletonBlock);

/**
 * ProfileSkeleton — avatar circle (60px), name bar, stats row, menu items.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeletons to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 * @param {string} [props.testID] - E2E test ID
 */
export const ProfileSkeleton = memo(function ProfileSkeleton({ count = 1, speed = 1, testID }) {
  const { colors } = useTheme();
  return (
    <View
      style={styles.profileContainer}
      accessible
      accessibilityLabel="Loading profile"
      accessibilityRole="progressbar"
      testID={testID}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.profileInner}>
          <MemoBlock width={60} height={60} borderRadius={30} speed={speed} style={{ marginBottom: 14 }} />
          <MemoBlock width={180} height={18} speed={speed} style={{ marginBottom: 8 }} />
          <MemoBlock width={120} height={13} speed={speed} style={{ marginBottom: 20 }} />
          <View style={styles.statsRow}>
            <MemoBlock width={55} height={20} speed={speed} />
            <MemoBlock width={55} height={20} speed={speed} />
            <MemoBlock width={55} height={20} speed={speed} />
          </View>
          <View style={{ marginTop: 20 }}>
            {[1, 2, 3].map((j) => (
              <MemoBlock key={j} height={48} borderRadius={12} speed={speed} style={{ marginBottom: 10 }} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
});

/**
 * ChatSkeleton — alternating left/right message bubbles.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton sets to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 * @param {string} [props.testID] - E2E test ID
 */
export const ChatSkeleton = memo(function ChatSkeleton({ count = 1, speed = 1, testID }) {
  const widths = [180, 140, 200, 120, 160];
  const heights = [44, 36, 50, 32, 42];

  return (
    <View
      style={styles.chatContainer}
      accessible
      accessibilityLabel="Loading chat"
      accessibilityRole="progressbar"
      testID={testID}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          {widths.map((w, j) => {
            const isMine = j % 2 === 0;
            return (
              <View
                key={j}
                style={{
                  flexDirection: 'row',
                  justifyContent: isMine ? 'flex-end' : 'flex-start',
                  marginBottom: 10,
                }}
              >
                <View style={{ maxWidth: '75%' }}>
                  <MemoBlock
                    width={w}
                    height={heights[j]}
                    borderRadius={18}
                    speed={speed}
                  />
                  <MemoBlock
                    width={40}
                    height={9}
                    speed={speed}
                    style={{
                      marginTop: 3,
                      alignSelf: isMine ? 'flex-end' : 'flex-start',
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
});

/**
 * MessagesSkeleton — conversation list items with avatar, name, message, timestamp.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton sets to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 * @param {string} [props.testID] - E2E test ID
 */
export const MessagesSkeleton = memo(function MessagesSkeleton({ count = 1, speed = 1, testID }) {
  return (
    <View
      style={styles.messagesContainer}
      accessible
      accessibilityLabel="Loading conversations"
      accessibilityRole="progressbar"
      testID={testID}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          {[1, 2, 3, 4].map((j) => (
            <View key={j} style={styles.messageRow}>
              <MemoBlock width={46} height={46} borderRadius={23} speed={speed} />
              <View style={styles.messageTextCol}>
                <MemoBlock width={130} height={14} speed={speed} style={{ marginBottom: 6 }} />
                <MemoBlock width={200} height={12} speed={speed} />
              </View>
              <MemoBlock width={36} height={11} speed={speed} />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * ServiceDetailSkeleton — image, title, text lines, button, review card.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton sets to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 * @param {string} [props.testID] - E2E test ID
 */
export const ServiceDetailSkeleton = memo(function ServiceDetailSkeleton({ count = 1, speed = 1, testID }) {
  return (
    <View
      style={styles.serviceContainer}
      accessible
      accessibilityLabel="Loading service details"
      accessibilityRole="progressbar"
      testID={testID}
    >
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          <MemoBlock height={200} borderRadius={16} speed={speed} style={{ marginBottom: 16 }} />
          <MemoBlock width={200} height={22} speed={speed} style={{ marginBottom: 8 }} />
          <MemoBlock width={140} height={13} speed={speed} style={{ marginBottom: 16 }} />
          <MemoBlock width="100%" height={13} speed={speed} style={{ marginBottom: 6 }} />
          <MemoBlock width="85%" height={13} speed={speed} style={{ marginBottom: 6 }} />
          <MemoBlock width="60%" height={13} speed={speed} style={{ marginBottom: 20 }} />
          <MemoBlock height={46} borderRadius={12} speed={speed} style={{ marginBottom: 14 }} />
          <MemoBlock height={90} borderRadius={12} speed={speed} />
        </View>
      ))}
    </View>
  );
});

const styles = StyleSheet.create({
  profileContainer: {
    alignItems: 'center',
    padding: 20,
  },
  profileInner: {
    alignItems: 'center',
    width: '100%',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 20,
  },
  chatContainer: {
    padding: 16,
  },
  messagesContainer: {
    padding: 16,
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  messageTextCol: {
    flex: 1,
    marginLeft: 12,
  },
  serviceContainer: {
    padding: 16,
  },
});

/**
 * HomeSkeleton — header bar, search, category grid, list cards.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton sets to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 */
export const HomeSkeleton = memo(function HomeSkeleton({ count = 1, speed = 1 }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, paddingTop: 10 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          <MemoBlock width={140} height={24} borderRadius={6} speed={speed} style={{ marginBottom: 16 }} />
          <MemoBlock height={48} borderRadius={12} speed={speed} style={{ marginBottom: 20 }} />
          <MemoBlock height={18} width="60%" speed={speed} style={{ marginBottom: 8 }} />
          <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
            {[1, 2, 3].map((j) => (
              <View key={j} style={{ flex: 1, alignItems: 'center' }}>
                <MemoBlock width={64} height={64} borderRadius={16} speed={speed} style={{ marginBottom: 8 }} />
                <MemoBlock width={50} height={12} speed={speed} />
              </View>
            ))}
          </View>
          {[1, 2, 3].map((j) => (
            <MemoBlock key={j} height={80} borderRadius={12} speed={speed} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ))}
    </View>
  );
});

/**
 * CommunitySkeleton — post cards with avatar, name, text lines, image.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton sets to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 */
export const CommunitySkeleton = memo(function CommunitySkeleton({ count = 1, speed = 1 }) {
  return (
    <View style={{ padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <MemoBlock width={40} height={40} borderRadius={20} speed={speed} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <MemoBlock width={120} height={14} speed={speed} style={{ marginBottom: 4 }} />
              <MemoBlock width={80} height={10} speed={speed} />
            </View>
          </View>
          <MemoBlock height={14} width="90%" speed={speed} style={{ marginBottom: 6 }} />
          <MemoBlock height={14} width="70%" speed={speed} style={{ marginBottom: 10 }} />
          <MemoBlock height={180} borderRadius={12} speed={speed} />
        </View>
      ))}
    </View>
  );
});

/**
 * ServicesSkeleton — search bar + list of service cards.
 * @param {Object} props
 * @param {number} [props.count=1] - Number of skeleton sets to render
 * @param {number} [props.speed=1] - Animation speed multiplier (0.5-3)
 */
export const ServicesSkeleton = memo(function ServicesSkeleton({ count = 1, speed = 1 }) {
  return (
    <View style={{ padding: 16 }}>
      <MemoBlock height={44} borderRadius={12} speed={speed} style={{ marginBottom: 16 }} />
      {Array.from({ length: count }).map((_, i) => (
        <View key={i}>
          {[1, 2, 3, 4].map((j) => (
            <MemoBlock key={j} height={100} borderRadius={12} speed={speed} style={{ marginBottom: 12 }} />
          ))}
        </View>
      ))}
    </View>
  );
});
