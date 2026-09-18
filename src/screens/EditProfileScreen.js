import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressForProfile } from '../utils/imageCompression';
import {
  getCurrentUser,
  updateUserProfile,
  uploadImageDetailed,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight, hapticSuccess, hapticWarning } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { createStyleSheet } from '../utils/responsive';

const MODAL_CONFIG = {
  experience: {
    title: 'Add Experience',
    editTitle: 'Edit Experience',
    fields: [
      { key: 'title', label: 'Job title', placeholder: 'e.g. Senior Plumber', max: 80 },
      { key: 'company', label: 'Company / Organization', placeholder: 'e.g. Nampundwe Water Works', max: 80 },
      { key: 'period', label: 'Period', placeholder: 'e.g. 2018 - Present', max: 40 },
      { key: 'description', label: 'Description', placeholder: 'What did you do?', max: 400, multiline: true },
    ],
  },
  education: {
    title: 'Add Education',
    editTitle: 'Edit Education',
    fields: [
      { key: 'school', label: 'School / Institution', placeholder: 'e.g. Nampundwe Secondary School', max: 80 },
      { key: 'degree', label: 'Degree / Course', placeholder: 'e.g. BSc Electrical Engineering', max: 80 },
      { key: 'period', label: 'Period', placeholder: 'e.g. 2014 - 2018', max: 40 },
    ],
  },
  qualification: {
    title: 'Add Qualification',
    editTitle: 'Edit Qualification',
    fields: [
      { key: 'title', label: 'Qualification / Certificate', placeholder: 'e.g. Certified Electrician', max: 80 },
      { key: 'issuer', label: 'Issued by', placeholder: 'e.g. TEVETA Zambia', max: 80 },
      { key: 'year', label: 'Year', placeholder: 'e.g. 2021', max: 20 },
    ],
  },
};

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const toast = useToast();
  const { run } = useNetworkAction();
  const styles = React.useMemo(() => getStyles(colors), [colors]);

  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);

  const [headline, setHeadline] = useState('');
  const [location, setLocation] = useState('');
  const [about, setAbout] = useState('');
  const [skills, setSkills] = useState([]);
  const [skillInput, setSkillInput] = useState('');
  const [experience, setExperience] = useState([]);
  const [education, setEducation] = useState([]);
  const [qualifications, setQualifications] = useState([]);
  const [profileImage, setProfileImage] = useState(null);

  const [itemModal, setItemModal] = useState(null);
  const [itemFields, setItemFields] = useState({});
  const [editingIndex, setEditingIndex] = useState(null);

  useEffect(() => {
    getCurrentUser().then((u) => {
      setUser(u);
      if (u) {
        setHeadline(u.headline || '');
        setLocation(u.location || '');
        setAbout(u.about || '');
        setSkills(Array.isArray(u.skills) ? u.skills.map((s) => (typeof s === 'string' ? s : s.name)) : []);
        setExperience(Array.isArray(u.experience) ? u.experience : []);
        setEducation(Array.isArray(u.education) ? u.education : []);
        setQualifications(Array.isArray(u.qualifications) ? u.qualifications : []);
        setProfileImage(u.profileImage || null);
      }
      setLoading(false);
    });
  }, []);

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Camera roll access needed to add a photo');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
      aspect: [1, 1],
    });
    if (!result.canceled && result.assets?.[0]) {
      setUploadingImage(true);
      const compressedUri = await compressForProfile(result.assets[0].uri);
      const res = await uploadImageDetailed(
        `profile-images/${user.id}.jpg`,
        compressedUri
      );
      setUploadingImage(false);
      if (res.success) {
        setProfileImage(res.url);
        await updateUserProfile(user.id, { profileImage: res.url });
        toast.success('Profile photo updated');
      } else {
        toast.error(res.error || 'Photo upload failed');
      }
    }
  };

  const addSkill = () => {
    const name = skillInput.trim();
    if (!name) return;
    if (skills.some((s) => s.toLowerCase() === name.toLowerCase())) {
      toast.error('Skill already added');
      return;
    }
    hapticLight();
    setSkills([...skills, name]);
    setSkillInput('');
  };

  const removeSkill = (name) => {
    hapticLight();
    setSkills(skills.filter((s) => s !== name));
  };

  const openAdd = (type) => {
    setEditingIndex(null);
    const empty = {};
    MODAL_CONFIG[type].fields.forEach((f) => { empty[f.key] = ''; });
    setItemFields(empty);
    setItemModal(type);
  };

  const openEdit = (type, index) => {
    const source = type === 'experience' ? experience : type === 'education' ? education : qualifications;
    setEditingIndex(index);
    setItemFields({ ...source[index] });
    setItemModal(type);
  };

  const saveItem = () => {
    const type = itemModal;
    const config = MODAL_CONFIG[type];
    const requiredKeys = config.fields.map((f) => f.key);
    if (!itemFields[requiredKeys[0]]?.trim()) {
      toast.error(`Please enter ${config.fields[0].label.toLowerCase()}`);
      return;
    }
    const clean = {};
    config.fields.forEach((f) => { clean[f.key] = itemFields[f.key]?.trim() || ''; });
    clean.id = editingIndex == null ? 'item_' + Date.now() : null;
    const apply = (prev) => {
      const next = [...prev];
      if (editingIndex == null) {
        next.push(clean);
      } else {
        next[editingIndex] = { ...next[editingIndex], ...clean };
      }
      return next;
    };
    if (type === 'experience') setExperience(apply(experience));
    else if (type === 'education') setEducation(apply(education));
    else setQualifications(apply(qualifications));
    hapticSuccess();
    setItemModal(null);
  };

  const removeItem = (type, index) => {
    Alert.alert('Remove Item', 'Are you sure you want to remove this entry?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () => {
          hapticWarning();
          if (type === 'experience') setExperience(experience.filter((_, i) => i !== index));
          else if (type === 'education') setEducation(education.filter((_, i) => i !== index));
          else setQualifications(qualifications.filter((_, i) => i !== index));
        },
      },
    ]);
  };

  const handleSave = () => run(async () => {
    setSaving(true);
    const ok = await updateUserProfile(user.id, {
      headline: headline.trim(),
      location: location.trim(),
      about: about.trim(),
      skills: skills.map((name) => ({ name })),
      experience,
      education,
      qualifications,
      profileImage: profileImage || null,
    });
    setSaving(false);
    if (ok) {
      hapticSuccess();
      toast.success('Profile updated');
    } else {
      toast.error('Failed to save profile');
    }
  });

  const modalConfig = itemModal ? MODAL_CONFIG[itemModal] : null;

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const renderItemRow = (icon, title, subtitle, type, index) => (
    <View key={index} style={styles.itemRow}>
      <View style={[styles.itemIcon, { backgroundColor: colors.primaryLight }]}>
        <Ionicons name={icon} size={16} color="#fff" />
      </View>
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.itemSubtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <TouchableOpacity
        style={styles.itemActionBtn}
        onPress={() => openEdit(type, index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Edit ${title}`}
        accessibilityRole="button"
      >
        <Ionicons name="pencil" size={16} color={colors.primary} />
      </TouchableOpacity>
      <TouchableOpacity
        style={styles.itemActionBtn}
        onPress={() => removeItem(type, index)}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityLabel={`Remove ${title}`}
        accessibilityRole="button"
      >
        <Ionicons name="trash-outline" size={16} color={colors.danger} />
      </TouchableOpacity>
    </View>
  );

  const renderAddBtn = (type, label, icon) => (
    <TouchableOpacity
      style={styles.addBtn}
      activeOpacity={0.7}
      onPress={() => openAdd(type)}
      accessibilityLabel={label}
      accessibilityRole="button"
    >
      <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
      <Text style={styles.addBtnText}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={[styles.header, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Edit Profile</Text>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <TouchableOpacity
            style={styles.avatarOuter}
            activeOpacity={0.8}
            onPress={pickImage}
            accessibilityLabel="Change profile photo"
            accessibilityRole="button"
          >
            {profileImage ? (
              <Image source={{ uri: profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: colors.primaryLight }]}>
                <Ionicons name="camera" size={30} color="#fff" />
              </View>
            )}
            <View style={styles.avatarOverlay}>
              <Ionicons name="camera" size={20} color="#fff" />
            </View>
          </TouchableOpacity>
          {uploadingImage ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 10 }} />
          ) : (
            <Text style={styles.avatarHint}>Tap to change profile photo</Text>
          )}
        </View>

        {/* Basic info */}
        <View style={styles.formCard}>
          <Text style={styles.sectionLabel}>Headline</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Certified Plumber in Nampundwe"
            placeholderTextColor={colors.textMuted}
            value={headline}
            onChangeText={setHeadline}
            maxLength={80}
          />
          <Text style={styles.sectionLabel}>Location</Text>
          <TextInput
            style={styles.input}
            placeholder="e.g. Nampundwe, Zambia"
            placeholderTextColor={colors.textMuted}
            value={location}
            onChangeText={setLocation}
            maxLength={60}
          />
          <Text style={styles.sectionLabel}>About</Text>
          <TextInput
            style={[styles.input, styles.multilineInput]}
            placeholder="Tell the community about yourself, your experience and what you offer..."
            placeholderTextColor={colors.textMuted}
            value={about}
            onChangeText={setAbout}
            multiline
            textAlignVertical="top"
            maxLength={600}
          />
        </View>

        {/* Skills */}
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Skills</Text>
          <Text style={styles.cardSubtitle}>Community members can endorse these</Text>
          <View style={styles.skillInputRow}>
            <TextInput
              style={[styles.input, styles.skillInput]}
              placeholder="Add a skill e.g. Pipe Installation"
              placeholderTextColor={colors.textMuted}
              value={skillInput}
              onChangeText={setSkillInput}
              onSubmitEditing={addSkill}
              maxLength={40}
              returnKeyType="done"
            />
            <TouchableOpacity
              style={styles.skillAddBtn}
              onPress={addSkill}
              activeOpacity={0.7}
              accessibilityLabel="Add skill"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={22} color="#fff" />
            </TouchableOpacity>
          </View>
          {skills.length > 0 ? (
            <View style={styles.chipsWrap}>
              {skills.map((skill) => (
                <View key={skill} style={[styles.chip, { backgroundColor: colors.primaryLight }]}>
                  <Text style={styles.chipText}>{skill}</Text>
                  <TouchableOpacity
                    onPress={() => removeSkill(skill)}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    accessibilityLabel={`Remove skill ${skill}`}
                    accessibilityRole="button"
                  >
                    <Ionicons name="close" size={14} color="#fff" />
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyHint}>No skills added yet.</Text>
          )}
        </View>

        {/* Experience */}
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Experience</Text>
          {experience.map((item, i) =>
            renderItemRow('briefcase', item.title, item.company, 'experience', i)
          )}
          {renderAddBtn('experience', 'Add Experience', 'briefcase')}
        </View>

        {/* Education */}
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Education</Text>
          {education.map((item, i) =>
            renderItemRow('school', item.school, item.degree, 'education', i)
          )}
          {renderAddBtn('education', 'Add Education', 'school')}
        </View>

        {/* Qualifications */}
        <View style={styles.formCard}>
          <Text style={styles.cardTitle}>Qualifications & Certifications</Text>
          {qualifications.map((item, i) =>
            renderItemRow('medal', item.title, item.issuer, 'qualification', i)
          )}
          {renderAddBtn('qualification', 'Add Qualification', 'medal')}
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, saving && { opacity: 0.6 }]}
          activeOpacity={0.85}
          onPress={handleSave}
          disabled={saving}
          accessibilityLabel="Save profile"
          accessibilityRole="button"
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Ionicons name="check" size={18} color="#fff" />
              <Text style={styles.saveBtnText}>Save Profile</Text>
            </>
          )}
        </TouchableOpacity>
        <View style={{ height: 30 }} />
      </ScrollView>
      </KeyboardAvoidingView>

      {/* Item modal */}
      {modalConfig && (
        <Modal
          visible={!!itemModal}
          animationType="slide"
          transparent
          onRequestClose={() => setItemModal(null)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.modalSheet}>
              <View style={styles.modalHandle} />
              <Text style={styles.modalTitle}>
                {editingIndex == null ? modalConfig.title : modalConfig.editTitle}
              </Text>
              <ScrollView keyboardShouldPersistTaps="handled">
                {modalConfig.fields.map((f) => (
                  <View key={f.key}>
                    <Text style={styles.sectionLabel}>{f.label}</Text>
                    <TextInput
                      style={[styles.input, f.multiline && styles.multilineInput]}
                      placeholder={f.placeholder}
                      placeholderTextColor={colors.textMuted}
                      value={itemFields[f.key]}
                      onChangeText={(t) => setItemFields({ ...itemFields, [f.key]: t })}
                      maxLength={f.max}
                      multiline={!!f.multiline}
                      textAlignVertical={f.multiline ? 'top' : undefined}
                    />
                  </View>
                ))}
              </ScrollView>
              <View style={styles.modalActions}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalCancelBtn]}
                  onPress={() => setItemModal(null)}
                  activeOpacity={0.7}
                  accessibilityLabel="close-circle"
                  accessibilityRole="button"
                >
                  <Text style={styles.modalCancelText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalSaveBtn]}
                  onPress={saveItem}
                  activeOpacity={0.7}
                  accessibilityLabel="Save entry"
                  accessibilityRole="button"
                >
                  <Text style={styles.modalSaveText}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarSection: {
    alignItems: 'center',
    paddingTop: 24,
    paddingBottom: 8,
  },
  avatarOuter: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: colors.card,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 5,
  },
  avatarCircle: {
    width: 104,
    height: 104,
    borderRadius: 52,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 104,
    height: 104,
    borderRadius: 52,
  },
  avatarOverlay: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.card,
  },
  avatarHint: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 2,
  },
  cardSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 12,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  multilineInput: {
    minHeight: 96,
  },
  skillInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  skillInput: {
    flex: 1,
    marginTop: 0,
  },
  skillAddBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 7,
    borderRadius: 18,
    gap: 6,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  emptyHint: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 10,
  },
  itemIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  itemSubtitle: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  itemActionBtn: {
    padding: 6,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 12,
    marginTop: 4,
    gap: 6,
  },
  addBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginHorizontal: 16,
    marginTop: 20,
    paddingVertical: 15,
    borderRadius: 14,
    gap: 8,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    maxHeight: '85%',
  },
  modalHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: 12,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 16,
  },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: 12,
  },
  modalCancelBtn: {
    backgroundColor: colors.borderLight,
  },
  modalSaveBtn: {
    backgroundColor: colors.primary,
  },
  modalCancelText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  modalSaveText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
});
