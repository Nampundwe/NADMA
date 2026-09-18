import React, { useEffect, useRef, memo } from 'react';
import { View, Text, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { createStyleSheet } from '../utils/responsive';

/**
 * Reusable empty state component with icon/image, title, subtitle, and CTA buttons.
 * Supports light/dark mode, configurable icon, secondary CTA, and image variant.
 *
 * @param {Object} props
 * @param {string} [props.icon='file-tray-outline'] - Ionicons icon name
 * @param {number} [props.iconSize=80] - Icon circle size (40-120)
 * @param {string} [props.iconColor] - Icon color (defaults to colors.primary)
 * @param {string} [props.iconBgColor] - Icon circle background (defaults to colors.borderLight)
 * @param {boolean} [props.showIconCircle=true] - Show circle around icon
 * @param {string} props.title - Main heading text
 * @param {string} [props.subtitle] - Subtitle text below title
 * @param {string} [props.description] - Extra description below subtitle
 * @param {string} [props.buttonText] - Primary CTA button text
 * @param {Function} [props.onPress] - Primary CTA press handler
 * @param {string} [props.buttonTextSecondary] - Secondary CTA button text
 * @param {Function} [props.onPressSecondary] - Secondary CTA press handler
 * @param {Object} [props.imageSource] - Image source (overrides icon)
 * @param {string} [props.accessibilityLabel] - Screen reader label
 * @param {string} [props.testID] - E2E test ID
 */
function EmptyState({
  icon = 'file-tray-outline',
  iconSize = 80,
  iconColor,
  iconBgColor,
  showIconCircle = true,
  title,
  subtitle,
  description,
  buttonText,
  onPress,
  buttonTextSecondary,
  onPressSecondary,
  imageSource,
  accessibilityLabel,
  testID,
}) {
  const { colors } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const styles = createStyles(colors);
  const resolvedIconColor = iconColor || colors.primary;
  const resolvedIconBg = iconBgColor || colors.borderLight;
  const circleSize = Math.max(40, Math.min(120, iconSize));
  const iconActualSize = Math.round(circleSize * 0.5);

  return (
    <Animated.View
      style={[styles.container, { opacity: fadeAnim }]}
      accessible
      accessibilityLabel={accessibilityLabel || `${title} empty state`}
      accessibilityRole="summary"
      testID={testID}
    >
      {imageSource ? (
        <Image source={imageSource} style={[styles.image, { width: circleSize, height: circleSize }]} resizeMode="contain" />
      ) : showIconCircle ? (
        <View style={[styles.iconCircle, { width: circleSize, height: circleSize, borderRadius: circleSize / 2, backgroundColor: resolvedIconBg }]}>
          <Ionicons name={icon} size={iconActualSize} color={resolvedIconColor} />
        </View>
      ) : (
        <Ionicons name={icon} size={circleSize} color={resolvedIconColor} style={styles.iconPlain} />
      )}

      <Text style={[styles.title, { color: colors.text }]} accessibilityRole="header">
        {title}
      </Text>

      {subtitle ? (
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>{subtitle}</Text>
      ) : null}

      {description ? (
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
      ) : null}

      {buttonText && onPress ? (
        <TouchableOpacity
          style={[styles.ctaBtn, { backgroundColor: colors.primary }]}
          onPress={onPress}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={buttonText}
        >
          <Text style={styles.ctaText}>{buttonText}</Text>
        </TouchableOpacity>
      ) : null}

      {buttonTextSecondary && onPressSecondary ? (
        <TouchableOpacity
          style={[styles.ctaBtnSecondary, { borderColor: colors.primary }]}
          onPress={onPressSecondary}
          activeOpacity={0.8}
          accessibilityRole="button"
          accessibilityLabel={buttonTextSecondary}
        >
          <Text style={[styles.ctaTextSecondary, { color: colors.primary }]}>{buttonTextSecondary}</Text>
        </TouchableOpacity>
      ) : null}
    </Animated.View>
  );
}

const createStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 48,
    paddingHorizontal: 24,
  },
  iconCircle: {
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconPlain: {
    marginBottom: 16,
  },
  image: {
    marginBottom: 16,
    borderRadius: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 8,
  },
  description: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 20,
  },
  ctaBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 12,
  },
  ctaText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  ctaBtnSecondary: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 10,
    borderWidth: 1.5,
    backgroundColor: 'transparent',
  },
  ctaTextSecondary: {
    fontSize: 15,
    fontWeight: '600',
  },
});

export default memo(EmptyState);
