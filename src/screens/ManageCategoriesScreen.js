import React, { useState, useCallback } from 'react';
import {
  View,
  Text,

  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import {
  getAllCategories,
  addCategory,
  updateCategory,
  deleteCategory,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import AnimatedCard from '../components/AnimatedCard';
import { hapticLight, hapticSuccess, hapticWarning, hapticError } from '../utils/haptics';
import { createStyleSheet } from '../utils/responsive';

const ICON_OPTIONS = [
  'water-outline', 'flash-outline', 'hammer-outline', 'brush-outline',
  'sparkles', 'leaf-outline', 'construct-outline', 'car-outline',
  'cut-outline', 'bicycle-outline', 'fitness-outline', 'restaurant-outline',
  'medical-outline', 'school-outline', 'home-outline', 'globe-outline',
  'shield-checkmark-outline', 'megaphone-outline', 'storefront-outline',
  'briefcase-outline', 'code-outline', 'film-outline', 'musical-notes-outline',
  'camera-outline', 'book-outline', 'paw-outline', 'airplane-outline',
];

const COLOR_OPTIONS = [
  '#2196F3', '#FF9800', '#795548', '#9C27B0', '#4CAF50',
  '#8BC34A', '#F44336', '#00BCD4', '#FF5722', '#607D8B',
];

export default function ManageCategoriesScreen({ navigation }) {
  const { colors } = useTheme();
  const [categories, setCategories] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);

  const [name, setName] = useState('');
  const [tagline, setTagline] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('');
  const [color, setColor] = useState('');

  useFocusEffect(
    useCallback(() => {
      loadCategories();
    }, [])
  );

  const animateList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const loadCategories = async () => {
    const data = await getAllCategories();
    setCategories(data);
  };

  const openAddModal = () => {
    setEditingCategory(null);
    setName('');
    setTagline('');
    setDescription('');
    setIcon('');
    setColor('');
    setShowModal(true);
  };

  const openEditModal = (category) => {
    setEditingCategory(category);
    setName(category.name);
    setTagline(category.tagline || '');
    setDescription(category.description || '');
    setIcon(category.icon);
    setColor(category.color);
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Validation', 'Category name is required');
      return;
    }
    if (!icon) {
      Alert.alert('Validation', 'Please select an icon');
      return;
    }
    if (!color) {
      Alert.alert('Validation', 'Please select a color');
      return;
    }

    const payload = {
      name: name.trim(),
      tagline: tagline.trim(),
      description: description.trim(),
      icon,
      color,
    };

    if (editingCategory) {
      const result = await updateCategory(editingCategory.id, payload);
      if (result.success) {
        hapticSuccess();
        Alert.alert('Updated', 'Category updated');
      } else {
        hapticError();
        Alert.alert('Error', result.error || 'Failed to update');
      }
    } else {
      const result = await addCategory(payload);
      if (result.success) {
        hapticSuccess();
        Alert.alert('Added', 'Category added');
      } else {
        hapticError();
        Alert.alert('Error', result.error || 'Failed to add');
      }
    }

    setShowModal(false);
    animateList();
    loadCategories();
  };

  const handleDelete = (category) => {
    Alert.alert(
      'Delete Category',
      `Delete "${category.name}"?\n\nThis action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticWarning();
            const result = await deleteCategory(category.id);
            if (result.success) {
              animateList();
              loadCategories();
            } else {
              hapticError();
              Alert.alert('Error', result.error || 'Failed to delete');
            }
          },
        },
      ]
    );
  };

  const renderCategory = ({ item }) => (
    <AnimatedCard
      style={[styles.card, { backgroundColor: colors.card }]}
      onPress={() => openEditModal(item)}
    >
      <View style={styles.cardRow}>
        <View style={[styles.iconCircle, { backgroundColor: item.color + '20' }]}>
          <Ionicons name={item.icon} size={24} color={item.color} />
        </View>
        <View style={styles.cardInfo}>
          <View style={styles.cardNameRow}>
            <Text style={[styles.cardName, { color: colors.text }]}>{item.name}</Text>
            <View style={[styles.colorDot, { backgroundColor: item.color }]} />
          </View>
          {item.tagline ? (
            <Text style={[styles.cardTagline, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.tagline}
            </Text>
          ) : null}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => openEditModal(item)}
            style={styles.actionBtn}
          >
            <Ionicons name="create" size={18} color={colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDelete(item)}
            style={styles.actionBtn}
          >
            <Ionicons name="trash" size={18} color={colors.danger} />
          </TouchableOpacity>
        </View>
      </View>
    </AnimatedCard>
  );

  const styles = getStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Categories</Text>
        <TouchableOpacity onPress={() => { hapticLight(); openAddModal(); }}>
          <Ionicons name="add-circle" size={28} color={colors.headerText} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={categories}
        renderItem={renderCategory}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={[styles.countText, { color: colors.textSecondary }]}>
            {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconWrap, { backgroundColor: colors.borderLight }]}>
              <Ionicons name="apps-outline" size={48} color={colors.textMuted} />
            </View>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No categories yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textMuted }]}>Tap + to add a service category</Text>
          </View>
        }
      />

      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={[styles.modalHeader, { borderBottomColor: colors.borderLight }]}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {editingCategory ? 'Edit Category' : 'Add Category'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Name *</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="e.g. Plumbing"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Tagline</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="Short tagline for the category"
                  placeholderTextColor={colors.textMuted}
                  value={tagline}
                  onChangeText={setTagline}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, color: colors.text }]}
                  placeholder="Detailed description of this category"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Icon *</Text>
                <View style={styles.iconGrid}>
                  {ICON_OPTIONS.map((iconName) => {
                    const selected = icon === iconName;
                    return (
                      <TouchableOpacity
                        key={iconName}
                        style={[
                          styles.iconOption,
                          selected && styles.iconOptionSelected,
                          selected && { borderColor: color || colors.primary, backgroundColor: (color || colors.primary) + '15' },
                        ]}
                        onPress={() => { hapticLight(); setIcon(iconName); }}
                      >
                        <Ionicons
                          name={iconName}
                          size={22}
                          color={selected ? (color || colors.primary) : colors.textMuted}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: colors.text }]}>Color *</Text>
                <View style={styles.colorGrid}>
                  {COLOR_OPTIONS.map((c) => {
                    const selected = color === c;
                    return (
                      <TouchableOpacity
                        key={c}
                        style={[
                          styles.colorOption,
                          { backgroundColor: c },
                          selected && styles.colorOptionSelected,
                        ]}
                        onPress={() => { hapticLight(); setColor(c); }}
                      >
                        {selected && (
                          <Ionicons name="checkmark" size={18} color="#fff" />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, { backgroundColor: colors.primary }]}
                onPress={handleSave}
              >
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {editingCategory ? 'Update Category' : 'Add Category'}
                </Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.headerText },
  list: { padding: 16, paddingTop: 0 },
  countText: { fontSize: 13, marginBottom: 12 },
  card: {
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  cardRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cardName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  cardTagline: {
    fontSize: 13,
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 8,
  },
  actionBtn: {
    padding: 6,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconWrap: {
    width: 88,
    height: 88,
    borderRadius: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyText: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtext: { fontSize: 14, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '88%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 6 },
  input: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  textArea: { height: 80, paddingTop: 12 },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  iconOption: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  iconOptionSelected: {
    borderWidth: 2,
  },
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  colorOption: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  colorOptionSelected: {
    borderColor: '#fff',
    elevation: 4,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    marginTop: 8,
    gap: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
});
