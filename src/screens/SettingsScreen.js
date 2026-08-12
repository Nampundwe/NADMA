import React, { useState, useEffect, useContext } from 'react';
import {
  View,
  Text,

  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Switch,
  Alert,
  StatusBar,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getCurrentUser,
  updateCurrentUser,
  changePassword,
  getCachedProviders,
  logout,
} from '../data/firebaseStorage';
import { AuthContext } from '../navigation/AppNavigator';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight, hapticSuccess, hapticWarning } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'bem', label: 'Bemba' },
  { code: 'ny', label: 'Nyanja' },
  { code: 'loz', label: 'Lozi' },
  { code: 'hnj', label: 'Tonga' },
];

const SETTINGS_KEY = '@nadma_settings';

export default function SettingsScreen({ navigation }) {
  const { onLogout } = useContext(AuthContext);
  const { colors, isDark, toggleTheme } = useTheme();
  const toast = useToast();
  const [user, setUser] = useState(null);
  const [settings, setSettings] = useState({
    notifications: true,
    emailNotifications: false,
    language: 'en',
    showPhone: true,
    showEmail: false,
    locationSharing: true,
    analyticsOptIn: true,
  });
  const [showLanguageModal, setShowLanguageModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [cacheSize, setCacheSize] = useState('Calculating...');

  useEffect(() => {
    loadSettings();
    loadCacheSize();
  }, []);

  const loadSettings = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const { darkMode, ...rest } = parsed;
      setSettings((s) => ({ ...s, ...rest }));
    }
  };

  const loadCacheSize = async () => {
    await getCachedProviders();
    const keys = await AsyncStorage.getAllKeys();
    setCacheSize(`${keys.length} keys cached`);
  };

  const updateSetting = async (key, value) => {
    hapticLight();
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    const saved = await AsyncStorage.getItem(SETTINGS_KEY);
    const all = saved ? JSON.parse(saved) : {};
    all[key] = value;
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(all));
  };

  const handleClearCache = () => {
    Alert.alert('Clear Cache', 'This will remove all cached data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          hapticWarning();
          const keys = await AsyncStorage.getAllKeys();
          const preserve = ['@nadma_current_user', '@nadma_users', '@nadma_favorites', SETTINGS_KEY];
          await AsyncStorage.multiRemove(keys.filter((k) => !preserve.includes(k)));
          setCacheSize('0 keys cached');
          toast.success('Cache cleared');
        },
      },
    ]);
  };

  const handleChangePassword = async () => {
    if (!currentPassword) {
      toast.error('Enter your current password');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }
    const result = await changePassword(currentPassword, newPassword);
    if (result.success) {
      hapticSuccess();
      setShowPasswordModal(false);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated');
    } else {
      toast.error(result.error);
    }
  };

  const handleDeleteAccount = async () => {
    Alert.alert('Delete Account', 'This will remove your account and personal data.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          hapticWarning();
          if (user) {
            const keys = await AsyncStorage.getAllKeys();
            const userKeys = keys.filter((k) => k.includes(user.id));
            await AsyncStorage.multiRemove(userKeys);
          }
          await logout();
          onLogout();
        },
      },
    ]);
    setShowDeleteModal(false);
  };

  const languageLabel = LANGUAGES.find((l) => l.code === settings.language)?.label || 'English';

  const s = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={s.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <View style={s.header}>
        <TouchableOpacity style={s.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Settings</Text>
        <View style={{ width: 32 }} />
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        {/* Notifications */}
        <Text style={s.sectionTitle}>NOTIFICATIONS</Text>
        <View style={s.sectionCard}>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#FF980015' }]}>
              <Ionicons name="notifications" size={20} color="#FF9800" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Push Notifications</Text>
              <Text style={s.settingDesc}>Receive alerts for bookings and messages</Text>
            </View>
            <Switch
              value={settings.notifications}
              onValueChange={(v) => updateSetting('notifications', v)}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={settings.notifications ? colors.primary : colors.textMuted}
              accessibilityLabel="Push notifications"
            />
          </View>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#2196F315' }]}>
              <Ionicons name="mail" size={20} color="#2196F3" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Email Notifications</Text>
              <Text style={s.settingDesc}>Get email updates about your bookings</Text>
            </View>
            <Switch
              value={settings.emailNotifications}
              onValueChange={(v) => updateSetting('emailNotifications', v)}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={settings.emailNotifications ? colors.primary : colors.textMuted}
              accessibilityLabel="Email notifications"
            />
          </View>
        </View>

        {/* Appearance */}
        <Text style={s.sectionTitle}>APPEARANCE</Text>
        <View style={s.sectionCard}>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#673AB715' }]}>
              <Ionicons name="moon" size={20} color="#673AB7" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Dark Mode</Text>
              <Text style={s.settingDesc}>Switch to dark theme</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={isDark ? colors.primary : colors.textMuted}
              accessibilityLabel="Dark mode"
            />
          </View>
          <TouchableOpacity style={s.settingRow} activeOpacity={0.7} onPress={() => setShowLanguageModal(true)} accessibilityLabel="Select language" accessibilityRole="button">
            <View style={[s.settingIcon, { backgroundColor: '#4CAF5015' }]}>
              <Ionicons name="language" size={20} color="#4CAF50" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Language</Text>
              <Text style={s.settingDesc}>App display language</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <Text style={s.settingValue}>{languageLabel}</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
            </View>
          </TouchableOpacity>
        </View>

        {/* Privacy */}
        <Text style={s.sectionTitle}>PRIVACY</Text>
        <View style={s.sectionCard}>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#E91E6315' }]}>
              <Ionicons name="call" size={20} color="#E91E63" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Show Phone Number</Text>
              <Text style={s.settingDesc}>Visible to providers you book</Text>
            </View>
            <Switch
              value={settings.showPhone}
              onValueChange={(v) => updateSetting('showPhone', v)}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={settings.showPhone ? colors.primary : colors.textMuted}
              accessibilityLabel="Show phone number"
            />
          </View>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#FF980015' }]}>
              <Ionicons name="mail" size={20} color="#FF9800" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Show Email</Text>
              <Text style={s.settingDesc}>Visible on your public profile</Text>
            </View>
            <Switch
              value={settings.showEmail}
              onValueChange={(v) => updateSetting('showEmail', v)}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={settings.showEmail ? colors.primary : colors.textMuted}
              accessibilityLabel="Show email"
            />
          </View>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#4CAF5015' }]}>
              <Ionicons name="location" size={20} color="#4CAF50" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Location Sharing</Text>
              <Text style={s.settingDesc}>Share location for better service matching</Text>
            </View>
            <Switch
              value={settings.locationSharing}
              onValueChange={(v) => updateSetting('locationSharing', v)}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={settings.locationSharing ? colors.primary : colors.textMuted}
              accessibilityLabel="Location sharing"
            />
          </View>
          <View style={[s.settingRow, { borderBottomWidth: 0 }]}>
            <View style={[s.settingIcon, { backgroundColor: '#9C27B015' }]}>
              <Ionicons name="bar-chart" size={20} color="#9C27B0" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Usage Analytics</Text>
              <Text style={s.settingDesc}>Help improve the app</Text>
            </View>
            <Switch
              value={settings.analyticsOptIn}
              onValueChange={(v) => updateSetting('analyticsOptIn', v)}
              trackColor={{ false: colors.border, true: '#BBDEFB' }}
              thumbColor={settings.analyticsOptIn ? colors.primary : colors.textMuted}
              accessibilityLabel="Usage analytics"
            />
          </View>
        </View>

        {/* Account */}
        <Text style={s.sectionTitle}>ACCOUNT</Text>
        <View style={s.sectionCard}>
          <TouchableOpacity style={s.settingRow} activeOpacity={0.7} onPress={() => setShowPasswordModal(true)} accessibilityLabel="Change password" accessibilityRole="button">
            <View style={[s.settingIcon, { backgroundColor: '#F4433615' }]}>
              <Ionicons name="lock-closed" size={20} color="#F44336" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Change Password</Text>
              <Text style={s.settingDesc}>Update your account password</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[s.settingRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => Alert.alert('Export Data', 'Request a copy of your data?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Request', onPress: () => toast.success('Data export request submitted') },
            ])}
            accessibilityLabel="Export my data"
            accessibilityRole="button"
          >
            <View style={[s.settingIcon, { backgroundColor: '#2196F315' }]}>
              <Ionicons name="download" size={20} color="#2196F3" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Export My Data</Text>
              <Text style={s.settingDesc}>Download a copy of your account data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Storage */}
        <Text style={s.sectionTitle}>STORAGE</Text>
        <View style={s.sectionCard}>
          <View style={s.settingRow}>
            <View style={[s.settingIcon, { backgroundColor: '#79554815' }]}>
              <Ionicons name="folder" size={20} color="#795548" />
            </View>
            <View style={s.settingInfo}>
              <Text style={s.settingLabel}>Local Cache</Text>
              <Text style={s.settingDesc}>{cacheSize}</Text>
            </View>
          </View>
          <TouchableOpacity style={[s.settingRow, { borderBottomWidth: 0 }]} activeOpacity={0.7} onPress={handleClearCache} accessibilityLabel="Clear app cache" accessibilityRole="button">
            <View style={[s.settingIcon, { backgroundColor: '#FF572215' }]}>
              <Ionicons name="trash" size={20} color="#FF5722" />
            </View>
            <View style={s.settingInfo}>
              <Text style={[s.settingLabel, { color: '#FF5722' }]}>Clear Cache</Text>
              <Text style={s.settingDesc}>Free up storage space</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Danger Zone */}
        <Text style={s.sectionTitle}>DANGER ZONE</Text>
        <View style={[s.sectionCard, { borderColor: isDark ? '#5C2020' : '#FEE2E2', borderWidth: 1 }]}>
          <TouchableOpacity
            style={[s.settingRow, { borderBottomWidth: 0 }]}
            activeOpacity={0.7}
            onPress={() => setShowDeleteModal(true)}
            accessibilityLabel="Delete account"
            accessibilityRole="button"
          >
            <View style={[s.settingIcon, { backgroundColor: '#F4433615' }]}>
              <Ionicons name="warning" size={20} color="#F44336" />
            </View>
            <View style={s.settingInfo}>
              <Text style={[s.settingLabel, { color: '#F44336' }]}>Delete Account</Text>
              <Text style={s.settingDesc}>Permanently remove all your data</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        <Text style={s.version}>Nadma v1.0.0</Text>
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Language Modal */}
      <Modal visible={showLanguageModal} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowLanguageModal(false)}>
          <View style={s.modalContent} onStartShouldSetResponder={() => true}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Select Language</Text>
            {LANGUAGES.map((lang) => (
              <TouchableOpacity
                key={lang.code}
                style={[s.langOption, settings.language === lang.code && { backgroundColor: colors.primaryLight }]}
                onPress={() => { hapticLight(); updateSetting('language', lang.code); setShowLanguageModal(false); }}
                accessibilityLabel={`Select ${lang.label}`}
                accessibilityRole="button"
                accessibilityState={{ selected: settings.language === lang.code }}
              >
                <Text style={[s.langText, settings.language === lang.code && { color: colors.primary, fontWeight: '600' }]}>
                  {lang.label}
                </Text>
                {settings.language === lang.code && <Ionicons name="checkmark-circle" size={22} color={colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Delete Modal */}
      <Modal visible={showDeleteModal} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowDeleteModal(false)}>
          <View style={s.modalContent} onStartShouldSetResponder={() => true}>
            <View style={s.modalHandle} />
            <View style={{ alignItems: 'center', marginBottom: 16 }}>
              <View style={[s.warningIcon, { backgroundColor: isDark ? '#5C202020' : '#FEE2E2' }]}>
                <Ionicons name="warning" size={36} color="#F44336" />
              </View>
            </View>
            <Text style={s.modalTitle}>Delete Account?</Text>
            <Text style={s.modalSubtitle}>This will permanently delete your account, bookings, reviews, and all data.</Text>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: '#F44336' }]} onPress={handleDeleteAccount} accessibilityLabel="Delete account permanently" accessibilityRole="button">
              <Text style={s.modalBtnText}>Yes, Delete My Account</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.borderLight }]} onPress={() => setShowDeleteModal(false)} accessibilityLabel="Cancel" accessibilityRole="button">
              <Text style={[s.modalBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Password Modal */}
      <Modal visible={showPasswordModal} transparent animationType="slide">
        <TouchableOpacity style={s.modalOverlay} activeOpacity={1} onPress={() => setShowPasswordModal(false)}>
          <View style={s.modalContent} onStartShouldSetResponder={() => true}>
            <View style={s.modalHandle} />
            <Text style={s.modalTitle}>Change Password</Text>
            <View style={{ marginBottom: 14 }}>
              <Text style={s.inputLabel}>Current Password</Text>
              <TextInput
                style={s.input}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                secureTextEntry
                placeholder="Enter current password"
                placeholderTextColor={colors.textMuted}
                maxLength={72}
                accessibilityLabel="Current password"
              />
            </View>
            <View style={{ marginBottom: 14 }}>
              <Text style={s.inputLabel}>New Password</Text>
              <TextInput
                style={s.input}
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
                placeholder="Min 6 characters"
                placeholderTextColor={colors.textMuted}
                maxLength={72}
                accessibilityLabel="New password"
              />
            </View>
            <View style={{ marginBottom: 14 }}>
              <Text style={s.inputLabel}>Confirm Password</Text>
              <TextInput
                style={s.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                placeholder="Re-enter password"
                placeholderTextColor={colors.textMuted}
                maxLength={72}
                accessibilityLabel="Confirm password"
              />
            </View>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.primary }]} onPress={handleChangePassword} accessibilityLabel="Update password" accessibilityRole="button">
              <Text style={s.modalBtnText}>Update Password</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[s.modalBtn, { backgroundColor: colors.borderLight }]} onPress={() => { setShowPasswordModal(false); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}>
              <Text style={[s.modalBtnText, { color: colors.text }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (c) => createStyleSheet({
  container: { flex: 1, backgroundColor: c.bg },
  header: {
    backgroundColor: c.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12, paddingBottom: 16, paddingHorizontal: 16,
  },
  backBtn: { width: 32, height: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: c.headerText },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: c.textMuted,
    marginTop: 20, marginBottom: 8, marginLeft: 20, letterSpacing: 0.5,
  },
  sectionCard: {
    backgroundColor: c.card, marginHorizontal: 16, borderRadius: 14,
    shadowColor: c.shadow, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 3, elevation: 1,
  },
  settingRow: {
    flexDirection: 'row', alignItems: 'center', padding: 14,
    borderBottomWidth: 1, borderBottomColor: c.borderLight,
  },
  settingIcon: { width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  settingInfo: { flex: 1, marginLeft: 12 },
  settingLabel: { fontSize: 15, fontWeight: '500', color: c.text },
  settingDesc: { fontSize: 12, color: c.textMuted, marginTop: 2 },
  settingValue: { fontSize: 14, color: c.textSecondary },
  version: { textAlign: 'center', fontSize: 12, color: c.textMuted, marginTop: 24 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: c.card, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHandle: { width: 40, height: 4, backgroundColor: c.border, borderRadius: 2, alignSelf: 'center', marginBottom: 20 },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: c.text, marginBottom: 8, textAlign: 'center' },
  modalSubtitle: { fontSize: 14, color: c.textSecondary, textAlign: 'center', lineHeight: 20, marginBottom: 20 },
  modalBtn: { padding: 16, borderRadius: 12, alignItems: 'center', marginBottom: 8 },
  modalBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  warningIcon: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  langOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    padding: 16, borderRadius: 12, marginBottom: 6, backgroundColor: c.inputBg,
  },
  langText: { fontSize: 16, color: c.text },
  inputLabel: { fontSize: 13, fontWeight: '600', color: c.text, marginBottom: 6 },
  input: {
    backgroundColor: c.inputBg, borderRadius: 12, padding: 14, fontSize: 15,
    color: c.text, borderWidth: 1, borderColor: c.border,
  },
});
