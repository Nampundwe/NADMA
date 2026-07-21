export const COLORS = {
  primary: '#1a237e',
  primaryLight: '#3949AB',
  primaryDark: '#0D1642',
  accent: '#FF6B35',
  success: '#4CAF50',
  danger: '#F44336',
  warning: '#FF9800',
  info: '#2196F3',
  background: '#F0F2F5',
  card: '#FFFFFF',
  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E5E7EB',
  borderLight: '#F3F4F6',
};

export const SHADOWS = {
  small: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  medium: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 4,
  },
  large: {
    shadowColor: '#1a237e',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
};

export const FONTS = {
  regular: { fontSize: 14, color: COLORS.text },
  medium: { fontSize: 14, fontWeight: '500', color: COLORS.text },
  semibold: { fontSize: 14, fontWeight: '600', color: COLORS.text },
  bold: { fontSize: 14, fontWeight: 'bold', color: COLORS.text },
  title: { fontSize: 22, fontWeight: 'bold', color: COLORS.text },
  subtitle: { fontSize: 16, fontWeight: '600', color: COLORS.text },
  caption: { fontSize: 12, color: COLORS.textMuted },
};

export const LAYOUT = {
  padding: 16,
  paddingSmall: 8,
  margin: 16,
  marginSmall: 8,
  borderRadius: 14,
  borderRadiusSmall: 10,
  borderRadiusLarge: 20,
};
