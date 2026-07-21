import React, { useState, useContext } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { signup, login, setCurrentUser } from '../data/firebaseStorage';
import { AuthContext } from '../navigation/AppNavigator';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function AuthScreen({ navigation }) {
  const { onLogin } = useContext(AuthContext);
  const { colors } = useTheme();
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [referralCode, setReferralCode] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAuth = async () => {
    if (loading) return;
    setLoading(true);
    try {
      if (isLogin) {
        if (!email.trim() || !password.trim()) {
          hapticError();
          Alert.alert('Error', 'Please fill in all fields');
          return;
        }
        if (!EMAIL_REGEX.test(email.trim())) {
          hapticError();
          Alert.alert('Error', 'Please enter a valid email address');
          return;
        }
        const result = await login(email.trim(), password);
        if (result.success) {
          hapticSuccess();
          onLogin();
        } else {
          hapticError();
          Alert.alert('Error', result.error);
        }
      } else {
        if (!name.trim() || !email.trim() || !password.trim()) {
          hapticError();
          Alert.alert('Error', 'Please fill in all fields');
          return;
        }
        if (!EMAIL_REGEX.test(email.trim())) {
          hapticError();
          Alert.alert('Error', 'Please enter a valid email address');
          return;
        }
        if (password !== confirmPassword) {
          hapticError();
          Alert.alert('Error', 'Passwords do not match');
          return;
        }
        if (password.length < 6) {
          hapticError();
          Alert.alert('Error', 'Password must be at least 6 characters');
          return;
        }
        if (!agreedToTerms) {
          hapticError();
          Alert.alert('Error', 'Please agree to the Terms of Service');
          return;
        }
        const result = await signup(email.trim(), password, name.trim());
        if (result.success) {
          if (referralCode.trim()) {
            const { applyReferralCode } = require('../data/firebaseStorage');
            await applyReferralCode(referralCode.trim(), result.user?.id || email.trim());
          }
          hapticSuccess();
          Alert.alert('Welcome!', 'Account created successfully.', [
            { text: 'OK', onPress: () => onLogin() },
          ]);
        } else {
          hapticError();
          Alert.alert('Error', result.error);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    if (!email.trim()) {
      Alert.alert('Reset Password', 'Please enter your email address first, then tap "Forgot Password" again.');
      return;
    }
    if (!EMAIL_REGEX.test(email.trim())) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }
    Alert.alert(
      'Reset Password',
      `A password reset link would be sent to ${email.trim()}.\n\nFor now, please contact admin support to reset your password.`,
      [{ text: 'OK' }]
    );
  };

  const getStyles = (colors) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.headerBg,
    },
    scrollContent: {
      flexGrow: 1,
    },
    header: {
      paddingTop: 30,
      paddingBottom: 40,
      alignItems: 'center',
    },
    logoContainer: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    headerTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: '#fff',
      marginBottom: 6,
    },
    headerSubtitle: {
      fontSize: 16,
      color: '#C5CAE9',
    },
    formCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderTopLeftRadius: 28,
      borderTopRightRadius: 28,
      paddingHorizontal: 24,
      paddingTop: 28,
      paddingBottom: 40,
    },
    formHeader: {
      marginBottom: 28,
    },
    formTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 6,
    },
    formSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    inputGroup: {
      marginBottom: 18,
    },
    label: {
      fontSize: 13,
      fontWeight: '600',
      color: '#374151',
      marginBottom: 8,
    },
    inputContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.inputBg,
      borderRadius: 12,
      paddingHorizontal: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 10,
    },
    input: {
      flex: 1,
      paddingVertical: 14,
      fontSize: 15,
      color: colors.text,
    },
    authButton: {
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 8,
      gap: 8,
    },
    authButtonDisabled: {
      backgroundColor: '#7986CB',
    },
    authButtonText: {
      color: '#fff',
      fontSize: 17,
      fontWeight: 'bold',
    },
    switchButton: {
      flexDirection: 'row',
      padding: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: 4,
    },
    switchText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    switchTextBold: {
      fontSize: 14,
      color: colors.primary,
      fontWeight: '700',
    },
    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 8,
    },
    dividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.border,
    },
    dividerText: {
      marginHorizontal: 16,
      fontSize: 13,
      color: colors.textMuted,
    },
    guestButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 14,
      borderRadius: 14,
      borderWidth: 1.5,
      borderColor: colors.border,
      gap: 8,
    },
    guestText: {
      fontSize: 15,
      color: colors.textSecondary,
      fontWeight: '600',
    },
  });

  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Ionicons name="business" size={36} color="#fff" />
            </View>
            <Text style={styles.headerTitle}>Nadma</Text>
            <Text style={styles.headerSubtitle}>
              {isLogin ? 'Welcome back!' : 'Join the community'}
            </Text>
          </View>

          {/* Form Card */}
          <View style={styles.formCard}>
            <View style={styles.formHeader}>
              <Text style={styles.formTitle}>{isLogin ? 'Sign In' : 'Create Account'}</Text>
              <Text style={styles.formSubtitle}>
                {isLogin
                  ? 'Enter your credentials to continue'
                  : 'Fill in your details to get started'}
              </Text>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Full Name</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="John Mwanza"
                    placeholderTextColor="#C4C4C4"
                    value={name}
                    onChangeText={setName}
                    accessibilityLabel="Full name"
                  />
                </View>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="mail-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#C4C4C4"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  accessibilityLabel="Email address"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter password"
                  placeholderTextColor="#C4C4C4"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  accessibilityLabel="Password"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  accessibilityLabel={showPassword ? "Hide password" : "Show password"}
                  accessibilityRole="button"
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={20}
                    color={colors.textMuted}
                  />
                </TouchableOpacity>
              </View>
            </View>

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="lock-closed-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Confirm password"
                    placeholderTextColor="#C4C4C4"
                    value={confirmPassword}
                    onChangeText={setConfirmPassword}
                    secureTextEntry={!showConfirmPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  >
                    <Ionicons
                      name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                      size={20}
                      color={colors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {!isLogin && (
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Referral Code (Optional)</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="gift-outline" size={20} color={colors.textMuted} />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter referral code"
                    placeholderTextColor="#C4C4C4"
                    value={referralCode}
                    onChangeText={setReferralCode}
                    autoCapitalize="characters"
                  />
                </View>
              </View>
            )}

            {!isLogin && (
              <TouchableOpacity
                style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, gap: 10 }}
                onPress={() => setAgreedToTerms(!agreedToTerms)}
                activeOpacity={0.7}
              >
                <View style={{
                  width: 22, height: 22, borderRadius: 6, borderWidth: 2,
                  borderColor: agreedToTerms ? colors.primary : colors.border,
                  backgroundColor: agreedToTerms ? colors.primary : 'transparent',
                  justifyContent: 'center', alignItems: 'center',
                }}>
                  {agreedToTerms && <Ionicons name="checkmark" size={14} color="#fff" />}
                </View>
                <Text style={{ fontSize: 13, color: colors.textSecondary, flex: 1 }}>
                  I agree to the{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Terms of Service</Text>
                  {' '}and{' '}
                  <Text style={{ color: colors.primary, fontWeight: '600' }}>Privacy Policy</Text>
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.authButton, loading && styles.authButtonDisabled]}
              onPress={handleAuth}
              disabled={loading}
              activeOpacity={0.85}
              accessibilityLabel={isLogin ? "Sign in" : "Create account"}
              accessibilityRole="button"
              accessibilityState={{ disabled: loading }}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Text style={styles.authButtonText}>
                    {isLogin ? 'Sign In' : 'Create Account'}
                  </Text>
                  <Ionicons name="arrow-forward" size={20} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {isLogin && (
              <TouchableOpacity
                style={{ alignSelf: 'center', marginTop: 12, padding: 4 }}
                onPress={handleForgotPassword}
              >
                <Text style={{ fontSize: 14, color: colors.primary, fontWeight: '600' }}>Forgot Password?</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.switchButton}
              onPress={() => { hapticLight(); setIsLogin(!isLogin); }}
              activeOpacity={0.7}
              accessibilityLabel={isLogin ? "Create account" : "Sign in"}
              accessibilityRole="button"
            >
              <Text style={styles.switchText}>
                {isLogin
                  ? "Don't have an account? "
                  : 'Already have an account? '}
              </Text>
              <Text style={styles.switchTextBold}>
                {isLogin ? 'Sign Up' : 'Sign In'}
              </Text>
            </TouchableOpacity>

            {isLogin && (
              <>
                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <TouchableOpacity
                  style={styles.guestButton}
                  activeOpacity={0.8}
                  onPress={async () => {
                    hapticLight();
                    await setCurrentUser({
                      id: 'guest',
                      email: '',
                      name: 'Guest',
                      role: 'user',
                    });
                    onLogin();
                  }}
                  accessibilityLabel="Continue as guest"
                  accessibilityRole="button"
                >
                  <Ionicons name="person-outline" size={20} color={colors.textSecondary} />
                  <Text style={styles.guestText}>Continue as Guest</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
