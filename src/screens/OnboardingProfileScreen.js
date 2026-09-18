import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressForProfile } from '../utils/imageCompression';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { updateUserProfile, getCurrentUser } from '../data/firebaseStorage';
import { createStyleSheet } from '../utils/responsive';

const STEPS = [
  { key: 'photo', title: 'Add a profile photo', subtitle: 'Help people recognize you' },
  { key: 'headline', title: 'What do you do?', subtitle: 'Add a professional headline' },
  { key: 'about', title: 'Tell us about yourself', subtitle: 'Write a short bio' },
  { key: 'skills', title: 'Add your skills', subtitle: 'What are you good at?' },
];

const COMMON_SKILLS = [
  'Plumbing', 'Electrical', 'Carpentry', 'Painting', 'Cleaning',
  'Welding', 'Bricklaying', 'Tiling', 'Roofing', 'Landscaping',
  'Cooking', 'Baking', 'Tailoring', 'Hairdressing', 'Mechanic',
  'Driving', 'Teaching', 'Tutoring', 'Photography', 'Events',
  'Construction', 'Masonry', 'Fitting', 'Repairs', 'Installation',
];

export default function OnboardingProfileScreen({ navigation, route }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { userId, isProvider } = route.params || {};

  const [step, setStep] = useState(0);
  const [profileImage, setProfileImage] = useState(null);
  const [headline, setHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [location, setLocation] = useState('');
  const [phone, setPhone] = useState('');
  const [skills, setSkills] = useState([]);
  const [showSkillModal, setShowSkillModal] = useState(false);
  const [customSkill, setCustomSkill] = useState('');
  const [loading, setLoading] = useState(false);

  const currentStep = STEPS[step];
  const progress = ((step + 1) / STEPS.length) * 100;

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Camera roll access needed');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const compressedUri = await compressForProfile(result.assets[0].uri);
      setProfileImage(compressedUri);
    }
  };

  const takePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Camera access needed');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled) {
      const compressedUri = await compressForProfile(result.assets[0].uri);
      setProfileImage(compressedUri);
    }
  };

  const addSkill = (skill) => {
    if (!skill.trim()) return;
    if (skills.includes(skill.trim())) {
      toast.error('Skill already added');
      return;
    }
    if (skills.length >= 10) {
      toast.error('Maximum 10 skills');
      return;
    }
    setSkills([...skills, skill.trim()]);
    setShowSkillModal(false);
    setCustomSkill('');
  };

  const removeSkill = (skill) => {
    setSkills(skills.filter((s) => s !== skill));
  };

  const handleNext = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  const handleSkip = () => {
    if (step < STEPS.length - 1) {
      setStep(step + 1);
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    setLoading(true);
    try {
      const updates = {};
      if (profileImage) updates.profileImage = profileImage;
      if (headline.trim()) updates.headline = headline.trim();
      if (about.trim()) updates.about = about.trim();
      if (location.trim()) updates.location = location.trim();
      if (phone.trim()) updates.phone = phone.trim();
      if (skills.length > 0) updates.skills = skills.map((s) => ({ name: s }));

      if (Object.keys(updates).length > 0) {
        const user = await getCurrentUser();
        if (user) {
          await updateUserProfile(user.id, updates);
        }
      }
      toast.success('Profile set up!');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } catch (e) {
      toast.error('Failed to save profile');
      navigation.reset({ index: 0, routes: [{ name: 'MainTabs' }] });
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (currentStep.key) {
      case 'photo':
        return (
          <View style={styles.stepContent}>
            <TouchableOpacity style={styles.photoContainer} onPress={pickImage} activeOpacity={0.8}>
              {profileImage ? (
                <Image source={{ uri: profileImage }} style={styles.profileImage} />
              ) : (
                <View style={[styles.photoPlaceholder, { backgroundColor: colors.primaryLight }]}>
                  <Ionicons name="camera" size={40} color={colors.primary} />
                  <Text style={[styles.photoHint, { color: colors.textMuted }]}>Tap to add photo</Text>
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.photoButtons}>
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.inputBg }]} onPress={pickImage}>
                <Ionicons name="images" size={20} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.text }]}>Gallery</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.photoBtn, { backgroundColor: colors.inputBg }]} onPress={takePhoto}>
                <Ionicons name="camera" size={20} color={colors.primary} />
                <Text style={[styles.photoBtnText, { color: colors.text }]}>Camera</Text>
              </TouchableOpacity>
            </View>
          </View>
        );

      case 'headline':
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.label, { color: colors.text }]}>Professional Headline</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Plumber, Electrician, Teacher..."
              placeholderTextColor={colors.textMuted}
              value={headline}
              onChangeText={setHeadline}
              maxLength={100}
              autoFocus
            />
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Example: "Professional Plumber with 5 years experience"
            </Text>

            <Text style={[styles.label, { color: colors.text, marginTop: 20 }]}>Location</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="e.g. Nampundwe, Zambia"
              placeholderTextColor={colors.textMuted}
              value={location}
              onChangeText={setLocation}
              maxLength={100}
            />

            <Text style={[styles.label, { color: colors.text, marginTop: 20 }]}>Phone Number</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="+260..."
              placeholderTextColor={colors.textMuted}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              maxLength={20}
            />
          </View>
        );

      case 'about':
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.label, { color: colors.text }]}>About You</Text>
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
              placeholder="Tell people about yourself, your experience, and what you offer..."
              placeholderTextColor={colors.textMuted}
              value={about}
              onChangeText={setAbout}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              maxLength={500}
              autoFocus
            />
            <Text style={[styles.charCount, { color: colors.textMuted }]}>{about.length}/500</Text>
          </View>
        );

      case 'skills':
        return (
          <View style={styles.stepContent}>
            <Text style={[styles.label, { color: colors.text }]}>Your Skills</Text>
            {skills.length > 0 && (
              <View style={styles.skillsList}>
                {skills.map((skill) => (
                  <View key={skill} style={[styles.skillTag, { backgroundColor: colors.primaryLight }]}>
                    <Text style={[styles.skillText, { color: colors.primary }]}>{skill}</Text>
                    <TouchableOpacity onPress={() => removeSkill(skill)}>
                      <Ionicons name="close-circle" size={18} color={colors.primary} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <TouchableOpacity
              style={[styles.addSkillBtn, { borderColor: colors.border }]}
              onPress={() => setShowSkillModal(true)}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.primary} />
              <Text style={[styles.addSkillText, { color: colors.primary }]}>Add a skill</Text>
            </TouchableOpacity>
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              Add up to 10 skills. Skills help people find you.
            </Text>
          </View>
        );

      default:
        return null;
    }
  };

  const styles = createStyles(colors);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={handleBack} disabled={step === 0} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={step === 0 ? colors.border : colors.text} />
        </TouchableOpacity>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.primary }]} />
        </View>
        <TouchableOpacity onPress={handleSkip} style={styles.skipBtn}>
          <Text style={[styles.skipText, { color: colors.primary }]}>Skip</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding">
        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <Text style={[styles.stepTitle, { color: colors.text }]}>{currentStep.title}</Text>
          <Text style={[styles.stepSubtitle, { color: colors.textMuted }]}>{currentStep.subtitle}</Text>
          {renderStepContent()}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: colors.primary }]}
            onPress={handleNext}
            disabled={loading}
          >
            <Text style={styles.nextBtnText}>
              {step === STEPS.length - 1 ? (loading ? 'Saving...' : 'Finish') : 'Continue'}
            </Text>
            {step < STEPS.length - 1 && <Ionicons name="arrow-forward-outline" size={20} color="#fff" style={{ marginLeft: 6 }} />}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <Modal visible={showSkillModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
            <Text style={[styles.modalTitle, { color: colors.text }]}>Add Skill</Text>

            <FlatList
              data={COMMON_SKILLS.filter((s) => !skills.includes(s))}
              keyExtractor={(item) => item}
              numColumns={3}
              contentContainerStyle={styles.skillsGrid}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.skillOption, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  onPress={() => addSkill(item)}
                >
                  <Text style={[styles.skillOptionText, { color: colors.text }]}>{item}</Text>
                </TouchableOpacity>
              )}
            />

            <View style={[styles.customSkillRow, { borderTopColor: colors.border }]}>
              <TextInput
                style={[styles.customSkillInput, { backgroundColor: colors.inputBg, color: colors.text, borderColor: colors.border }]}
                placeholder="Custom skill..."
                placeholderTextColor={colors.textMuted}
                value={customSkill}
                onChangeText={setCustomSkill}
                maxLength={30}
              />
              <TouchableOpacity style={[styles.customSkillAdd, { backgroundColor: colors.primary }]} onPress={() => addSkill(customSkill)}>
                <Ionicons name="add" size={22} color="#fff" />
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={() => setShowSkillModal(false)} style={styles.modalClose}>
              <Text style={[styles.modalCloseText, { color: colors.primary }]}>Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => createStyleSheet({
  container: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginHorizontal: 12,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: 2 },
  skipBtn: { padding: 4 },
  skipText: { fontSize: 14, fontWeight: '600' },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 40 },
  stepTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 6 },
  stepSubtitle: { fontSize: 15, marginBottom: 24 },
  stepContent: { flex: 1 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    minHeight: 140,
  },
  charCount: { fontSize: 12, textAlign: 'right', marginTop: 4 },
  hint: { fontSize: 13, marginTop: 8, lineHeight: 18 },
  photoContainer: { alignSelf: 'center', marginBottom: 16 },
  profileImage: { width: 140, height: 140, borderRadius: 70 },
  photoPlaceholder: {
    width: 140,
    height: 140,
    borderRadius: 70,
    justifyContent: 'center',
    alignItems: 'center',
  },
  photoHint: { fontSize: 12, marginTop: 6 },
  photoButtons: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  photoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
  },
  photoBtnText: { fontSize: 14, fontWeight: '600' },
  skillsList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  skillTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  skillText: { fontSize: 13, fontWeight: '600' },
  addSkillBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: 10,
    paddingVertical: 14,
    gap: 6,
  },
  addSkillText: { fontSize: 14, fontWeight: '600' },
  footer: { paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1 },
  nextBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 10,
  },
  nextBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingBottom: 30,
    maxHeight: '70%',
  },
  modalHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 12 },
  modalTitle: { fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  skillsGrid: { paddingHorizontal: 16, paddingBottom: 12 },
  skillOption: {
    flex: 1,
    margin: 4,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  skillOptionText: { fontSize: 13 },
  customSkillRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    gap: 8,
  },
  customSkillInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
  },
  customSkillAdd: {
    width: 38,
    height: 38,
    borderRadius: 19,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalClose: { alignItems: 'center', paddingTop: 14 },
  modalCloseText: { fontSize: 16, fontWeight: '600' },
});
