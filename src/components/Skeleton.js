import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

function SkeletonBlock({ width = '100%', height = 20, borderRadius = 8, style }) {
  const opacity = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  return (
    <Animated.View
      style={[
        { width, height, borderRadius, backgroundColor: '#2A3466', opacity },
        style,
      ]}
    />
  );
}

export function HomeSkeleton({ colors }) {
  return (
    <View style={{ padding: 20, paddingTop: 10 }}>
      <SkeletonBlock width={140} height={24} style={{ marginBottom: 16 }} />
      <SkeletonBlock height={48} borderRadius={12} style={{ marginBottom: 20 }} />
      <SkeletonBlock height={18} width="60%" style={{ marginBottom: 8 }} />
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
        {[1, 2, 3].map((i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <SkeletonBlock width={64} height={64} borderRadius={16} style={{ marginBottom: 8 }} />
            <SkeletonBlock width={50} height={12} />
          </View>
        ))}
      </View>
      {[1, 2, 3].map((i) => (
        <SkeletonBlock key={i} height={80} borderRadius={12} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}

export function CommunitySkeleton() {
  return (
    <View style={{ padding: 16 }}>
      {[1, 2, 3].map((i) => (
        <View key={i} style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
            <SkeletonBlock width={40} height={40} borderRadius={20} style={{ marginRight: 10 }} />
            <View style={{ flex: 1 }}>
              <SkeletonBlock width={120} height={14} style={{ marginBottom: 4 }} />
              <SkeletonBlock width={80} height={10} />
            </View>
          </View>
          <SkeletonBlock height={14} width="90%" style={{ marginBottom: 6 }} />
          <SkeletonBlock height={14} width="70%" style={{ marginBottom: 10 }} />
          <SkeletonBlock height={180} borderRadius={12} />
        </View>
      ))}
    </View>
  );
}

export function ServicesSkeleton() {
  return (
    <View style={{ padding: 16 }}>
      <SkeletonBlock height={44} borderRadius={12} style={{ marginBottom: 16 }} />
      {[1, 2, 3, 4].map((i) => (
        <SkeletonBlock key={i} height={100} borderRadius={12} style={{ marginBottom: 12 }} />
      ))}
    </View>
  );
}
