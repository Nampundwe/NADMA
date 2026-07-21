import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

function SkeletonPulse({ style }) {
  const pulse = useRef(new Animated.Value(0.3)).current;
  
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 0.7, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.3, duration: 800, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  return <Animated.View style={[styles.skeleton, style, { opacity: pulse }]} />;
}

export function SkeletonCard({ colors }) {
  return (
    <View style={[styles.card, { backgroundColor: colors.card }]}>
      <SkeletonPulse style={styles.cardImage} />
      <View style={styles.cardContent}>
        <SkeletonPulse style={styles.title} />
        <SkeletonPulse style={styles.subtitle} />
        <SkeletonPulse style={styles.shortLine} />
      </View>
    </View>
  );
}

export function SkeletonList({ count = 4, colors }) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} colors={colors} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  card: {
    flexDirection: 'row',
    padding: 12,
    marginBottom: 10,
    borderRadius: 14,
  },
  cardImage: {
    width: 60,
    height: 60,
    borderRadius: 12,
  },
  cardContent: {
    flex: 1,
    marginLeft: 12,
    gap: 8,
  },
  title: {
    height: 16,
    width: '60%',
  },
  subtitle: {
    height: 12,
    width: '40%',
  },
  shortLine: {
    height: 12,
    width: '30%',
  },
});
