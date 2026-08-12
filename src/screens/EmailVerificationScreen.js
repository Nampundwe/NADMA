import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { sendVerificationEmail, checkEmailVerified, logout, getCurrentUser } from '../data/firebaseStorage';
import { hapticLight, hapticSuccess } from '../utils/haptics';

export default function EmailVerificationScreen({ onVerified }) {
  const { colors } = useTheme();
  const toast = useToast();
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [userEmail, setUserEmail] = useState('');

  useEffect(() => {
    getCurrentUser().then((u) => {
      if (u?.email) setUserEmail(u.email);
    });
    handleSendEmail();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendEmail = async () => {
    if (cooldown > 0) return;
    setSending(true);
    const result = await sendVerificationEmail();
    setSending(false);
    if (result.success) {
      hapticSuccess();
      toast.success('Verification email sent!');
      setCooldown(60);
    } else {
      toast.error(result.error || 'Failed to send email. Please check your email address.');
    }
  };

  const handleCheckVerified = async () => {
    setChecking(true);
    const verified = await checkEmailVerified();
    setChecking(false);
    if (verified) {
      hapticSuccess();
      toast.success('Email verified!');
      onVerified();
    } else {
      toast.info('Email not yet verified. Check your inbox.');
    }
  };

  const handleLogout = async () => {
    hapticLight();
    await logout();
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: colors.primary + '20' }]}>
          <Ionicons name="mail-open-outline" size={64} color={colors.primary} />
        </View>

        <Text style={[styles.title, { color: colors.text }]}>Verify Your Email</Text>
        {userEmail ? (
          <View style={[styles.emailBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="mail" size={18} color={colors.primary} />
            <Text style={[styles.emailText, { color: colors.text }]}>{userEmail}</Text>
          </View>
        ) : null}
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          We've sent a verification link to the email above. Please check your inbox and click the link to verify your account.{'\n\n'}
          Didn't receive it? Check your spam folder, or tap Resend below.
        </Text>

        <TouchableOpacity
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={handleCheckVerified}
          disabled={checking}
          activeOpacity={0.8}
        >
          {checking ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>I've Verified My Email</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.resendButton, { borderColor: colors.border }]}
          onPress={handleSendEmail}
          disabled={sending || cooldown > 0}
          activeOpacity={0.8}
        >
          <Text style={[styles.resendText, { color: colors.primary }]}>
            {sending ? 'Sending...' : cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend Verification Email'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
          <Text style={[styles.logoutText, { color: colors.textMuted }]}>Log Out</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  emailBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 16,
    alignSelf: 'center',
  },
  emailText: {
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  resendButton: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    marginBottom: 24,
  },
  resendText: {
    fontSize: 15,
    fontWeight: '500',
  },
  logoutButton: {
    padding: 8,
  },
  logoutText: {
    fontSize: 14,
  },
});
