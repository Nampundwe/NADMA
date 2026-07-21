import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  LayoutAnimation,
  UIManager,
} from 'react-native';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import { getCategories } from '../data/services';
import {
  getAllServiceProviders,
  addServiceProvider,
  updateServiceProvider,
  deleteServiceProvider,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';

export default function ManageProvidersScreen({ navigation }) {
  const { colors } = useTheme();
  const [providers, setProviders] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingProvider, setEditingProvider] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [servicesText, setServicesText] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [newImage, setNewImage] = useState(null);
  const [categories, setCategories] = useState([]);

  useFocusEffect(
    useCallback(() => {
      loadProviders();
    }, [])
  );

  const animateList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const loadProviders = async () => {
    const cats = await getCategories();
    setCategories(cats);
    const data = await getAllServiceProviders();
    setProviders(data.sort((a, b) => b.rating - a.rating));
  };

  const openAddModal = () => {
    setEditingProvider(null);
    setName('');
    setCategory('');
    setDescription('');
    setPhone('');
    setAddress('');
    setHours('');
    setServicesText('');
    setNewImage(null);
    setShowModal(true);
  };

  const openEditModal = (provider) => {
    setEditingProvider(provider);
    setName(provider.name);
    setCategory(provider.category);
    setDescription(provider.description);
    setPhone(provider.phone);
    setAddress(provider.address);
    setHours(provider.hours);
    setServicesText(provider.services.join(', '));
    setNewImage(provider.image || null);
    setShowModal(true);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please grant camera roll access to add photos.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewImage(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Select a category');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Description is required');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Phone is required');
      return;
    }

    const servicesList = servicesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    if (editingProvider) {
      await updateServiceProvider(editingProvider.id, {
        name: name.trim(),
        category,
        description: description.trim(),
        phone: phone.trim(),
        address: address.trim(),
        hours: hours.trim(),
        services: servicesList,
        image: newImage || editingProvider.image,
      });
      Alert.alert('Updated', 'Provider updated');
    } else {
      const catObj = categories.find((c) => c.name === category);
      const provider = {
        id: 'sp_' + Date.now(),
        name: name.trim(),
        category,
        description: description.trim(),
        phone: phone.trim(),
        address: address.trim(),
        hours: hours.trim() || 'Mon-Sat: 8:00 AM - 5:00 PM',
        services: servicesList.length > 0 ? servicesList : ['General Service'],
        rating: 0,
        reviews: 0,
        image: newImage || 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
        isUserRegistered: false,
        createdAt: new Date().toISOString(),
      };
      await addServiceProvider(provider);
      Alert.alert('Added', 'Provider added');
    }

    setShowModal(false);
    animateList();
    loadProviders();
  };

  const handleDelete = (provider) => {
    Alert.alert('Delete Provider', `Delete "${provider.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteServiceProvider(provider.id);
          animateList();
          loadProviders();
        },
      },
    ]);
  };

  const filteredProviders = searchQuery.trim()
    ? providers.filter(
        (p) =>
          p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.category.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : providers;

  const renderProvider = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={styles.cardInfo}>
          <Text style={styles.cardName}>{item.name}</Text>
          <Text style={styles.cardCategory}>{item.category}</Text>
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity onPress={() => openEditModal(item)} style={styles.actionBtn}>
            <Ionicons name="create" size={18} color="#2196F3" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => handleDelete(item)} style={styles.actionBtn}>
            <Ionicons name="trash" size={18} color="#F44336" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await updateServiceProvider(item.id, { verified: !item.verified });
              animateList();
              loadProviders();
            }}
            style={styles.actionBtn}
          >
            <Ionicons name={item.verified ? 'checkmark-circle' : 'checkmark-circle-outline'} size={18} color={item.verified ? '#4CAF50' : '#ccc'} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={async () => {
              await updateServiceProvider(item.id, { licensed: !item.licensed });
              animateList();
              loadProviders();
            }}
            style={styles.actionBtn}
          >
            <Ionicons name={item.licensed ? 'ribbon' : 'ribbon-outline'} size={18} color={item.licensed ? '#2196F3' : '#ccc'} />
          </TouchableOpacity>
        </View>
      </View>
      <Text style={styles.cardDescription} numberOfLines={2}>
        {item.description}
      </Text>
      <View style={styles.cardMeta}>
        <View style={styles.metaItem}>
          <Ionicons name="call" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{item.phone}</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="location" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText} numberOfLines={1}>{item.address}</Text>
        </View>
      </View>
      {item.services.length > 0 && (
        <View style={styles.servicesRow}>
          {item.services.slice(0, 3).map((s, i) => (
            <View key={i} style={styles.serviceTag}>
              <Text style={styles.serviceTagText}>{s}</Text>
            </View>
          ))}
          {item.services.length > 3 && (
            <Text style={styles.moreText}>+{item.services.length - 3} more</Text>
          )}
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Providers</Text>
        <TouchableOpacity onPress={openAddModal}>
          <Ionicons name="add-circle" size={28} color={colors.headerText} />
        </TouchableOpacity>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={20} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search providers..."
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <FlatList
        data={filteredProviders}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.countText}>
            {filteredProviders.length} provider{filteredProviders.length !== 1 ? 's' : ''}
          </Text>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="people" size={64} color={colors.textMuted} />
            <Text style={styles.emptyText}>No providers yet</Text>
            <Text style={styles.emptySubtext}>Tap + to add a service provider</Text>
          </View>
        }
      />

      {/* Add/Edit Modal */}
      <Modal visible={showModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {editingProvider ? 'Edit Provider' : 'Add Provider'}
              </Text>
              <TouchableOpacity onPress={() => setShowModal(false)}>
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Business Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. Nampundwe Plumbing"
                  placeholderTextColor={colors.textMuted}
                  value={name}
                  onChangeText={setName}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Category *</Text>
                <TouchableOpacity
                  style={styles.picker}
                  onPress={() => setShowCategoryPicker(!showCategoryPicker)}
                >
                  <Text style={[styles.pickerText, !category && { color: colors.textMuted }]}>
                    {category || 'Select category'}
                  </Text>
                  <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
                {showCategoryPicker && (
                  <View style={styles.optionList}>
                    {categories.map((cat) => (
                      <TouchableOpacity
                        key={cat.id}
                        style={[styles.optionItem, category === cat.name && styles.optionSelected]}
                        onPress={() => {
                          setCategory(cat.name);
                          setShowCategoryPicker(false);
                        }}
                      >
                        <Ionicons name={cat.icon} size={18} color={cat.color} />
                        <Text style={[styles.optionText, category === cat.name && styles.optionTextSelected]}>
                          {cat.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description *</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What services do they offer?"
                  placeholderTextColor={colors.textMuted}
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Photo</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage}>
                  {newImage ? (
                    <Image source={{ uri: newImage }} style={styles.imagePreview} />
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="camera" size={28} color={colors.textMuted} />
                      <Text style={styles.imagePlaceholderText}>Tap to add photo</Text>
                    </View>
                  )}
                </TouchableOpacity>
                {newImage && (
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setNewImage(null)}>
                    <Ionicons name="close-circle" size={18} color="#F44336" />
                    <Text style={styles.removeImageText}>Remove photo</Text>
                  </TouchableOpacity>
                )}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="+260 9X XXX XXXX"
                  placeholderTextColor={colors.textMuted}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Street address"
                  placeholderTextColor={colors.textMuted}
                  value={address}
                  onChangeText={setAddress}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Working Hours</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mon-Sat: 8:00 AM - 5:00 PM"
                  placeholderTextColor={colors.textMuted}
                  value={hours}
                  onChangeText={setHours}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Services (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Pipe Repair, Drain Cleaning, ..."
                  placeholderTextColor={colors.textMuted}
                  value={servicesText}
                  onChangeText={setServicesText}
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>
                  {editingProvider ? 'Update Provider' : 'Add Provider'}
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

const getStyles = (colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    backgroundColor: colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: colors.headerText },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    margin: 16,
    marginBottom: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    elevation: 1,
  },
  searchInput: { flex: 1, height: 44, fontSize: 15, marginLeft: 8, color: colors.text },
  list: { padding: 16, paddingTop: 0 },
  countText: { fontSize: 13, color: colors.textSecondary, marginBottom: 12 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  cardInfo: { flex: 1 },
  cardName: { fontSize: 16, fontWeight: 'bold', color: colors.text },
  cardCategory: { fontSize: 13, color: colors.primary, marginTop: 2 },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { padding: 6 },
  cardDescription: { fontSize: 13, color: colors.textSecondary, lineHeight: 18, marginBottom: 10 },
  cardMeta: { gap: 4, marginBottom: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 12, color: colors.textSecondary, flex: 1 },
  servicesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' },
  serviceTag: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  serviceTagText: { fontSize: 11, color: colors.primary, fontWeight: '500' },
  moreText: { fontSize: 11, color: colors.textMuted },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.textSecondary, marginTop: 16 },
  emptySubtext: { fontSize: 14, color: colors.textMuted, marginTop: 8 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '85%',
    padding: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalTitle: { fontSize: 18, fontWeight: 'bold', color: colors.text },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 6 },
  input: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
  },
  textArea: { height: 80, paddingTop: 12 },
  picker: {
    backgroundColor: colors.inputBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pickerText: { fontSize: 15, color: colors.text },
  optionList: {
    backgroundColor: colors.card,
    borderRadius: 10,
    marginTop: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionSelected: { backgroundColor: colors.primaryLight },
  optionText: { fontSize: 14, color: colors.text },
  optionTextSelected: { fontWeight: '600', color: colors.primary },
  saveButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  saveButtonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  imagePickerBtn: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.textMuted,
    height: 140,
    backgroundColor: colors.inputBg,
  },
  imagePreview: {
    width: '100%',
    height: '100%',
    borderRadius: 12,
  },
  imagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
  },
  imagePlaceholderText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  removeImageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  removeImageText: {
    fontSize: 13,
    color: '#F44336',
  },
});

const styles = getStyles({ bg:'#F0F2F5', card:'#fff', text:'#1A1A2E', textSecondary:'#6B7280', textMuted:'#9CA3AF', border:'#E5E7EB', borderLight:'#F3F4F6', primary:'#1a237e', primaryLight:'#E8EAF6', headerBg:'#1a237e', headerText:'#fff', inputBg:'#F9FAFB', white:'#fff', shadow:'#000', tabBg:'#fff', statusBar:'dark-content' });
