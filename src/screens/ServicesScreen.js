import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Image,
  StatusBar,
  Alert,
  Modal,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AnimatedCard from '../components/AnimatedCard';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as ImagePicker from 'expo-image-picker';
import {
  getAllServiceProviders,
  getApprovedBusinesses,
  addServiceProvider,
  deleteServiceProvider,
  updateServiceProvider,
  getCurrentUser,
} from '../data/storage';
import { categories } from '../data/services';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticMedium, hapticWarning } from '../utils/haptics';

const DEFAULT_IMAGES = {
  Plumbing: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
  Electrical: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=400',
  Carpentry: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=400',
  Painting: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=400',
  Cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400',
  Gardening: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400',
  Plumbing: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
  'Air Conditioning': 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
  Welding: 'https://images.unsplash.com/photo-1504328345606-18bbc8c9d7d1?w=400',
  'Moving & Delivery': 'https://images.unsplash.com/photo-1600880292203-757bb62b4baf?w=400',
  Other: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
};

export default function ServicesScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { categoryName } = route.params;
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [providers, setProviders] = useState([]);
  const [user, setUser] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newHours, setNewHours] = useState('');
  const [newServicesText, setNewServicesText] = useState('');
  const [newImage, setNewImage] = useState(null);

  const category = categories.find((c) => c.name === categoryName);
  const isAdmin = user?.role === 'admin';

  const getStyles = (colors) => StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.bg,
    },
    heroBanner: {
      height: 160,
      position: 'relative',
    },
    heroImage: {
      width: '100%',
      height: '100%',
    },
    heroOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    backBtn: {
      position: 'absolute',
      top: 14,
      left: 14,
      width: 38,
      height: 38,
      borderRadius: 19,
      backgroundColor: 'rgba(0,0,0,0.35)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroContent: {
      position: 'absolute',
      bottom: 16,
      left: 16,
      right: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    heroIcon: {
      width: 48,
      height: 48,
      borderRadius: 14,
      justifyContent: 'center',
      alignItems: 'center',
    },
    heroTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#fff',
    },
    heroSubtitle: {
      fontSize: 13,
      color: 'rgba(255,255,255,0.8)',
      marginTop: 2,
    },
    adminAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: '#4CAF50',
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 20,
      gap: 4,
    },
    adminAddBtnText: {
      color: '#fff',
      fontSize: 14,
      fontWeight: 'bold',
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      margin: 16,
      marginBottom: 8,
      borderRadius: 12,
      paddingHorizontal: 12,
      elevation: 2,
    },
    searchIcon: {
      marginRight: 8,
    },
    searchInput: {
      flex: 1,
      height: 46,
      fontSize: 15,
      color: colors.text,
    },
    listContent: {
      padding: 16,
      paddingTop: 8,
    },
    resultText: {
      fontSize: 13,
      color: colors.textSecondary,
      marginBottom: 12,
    },
    sortBar: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingBottom: 8,
    },
    sortLabel: {
      fontSize: 13,
      color: colors.textSecondary,
      marginRight: 8,
    },
    sortChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 14,
      backgroundColor: colors.card,
      marginRight: 8,
      gap: 4,
      elevation: 1,
    },
    sortChipActive: {
      backgroundColor: colors.primary,
    },
    sortChipText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    sortChipTextActive: {
      color: '#fff',
      fontWeight: '600',
    },
    providerCard: {
      backgroundColor: colors.card,
      borderRadius: 14,
      marginBottom: 10,
      elevation: 2,
      overflow: 'hidden',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 14,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.05,
      shadowRadius: 4,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 12,
    },
    providerAvatar: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primaryLight,
    },
    providerAvatarFallback: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarInitials: {
      fontSize: 24,
      fontWeight: 'bold',
      color: '#fff',
    },
    cameraOverlay: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 24,
      height: 24,
      borderRadius: 12,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.card,
    },
    providerInfo: {
      flex: 1,
    },
    providerName: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 3,
    },
    providerDescription: {
      fontSize: 12,
      color: colors.textSecondary,
      lineHeight: 17,
      marginBottom: 6,
    },
    providerMeta: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 6,
    },
    ratingContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    ratingText: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.text,
    },
    reviewCount: {
      fontSize: 11,
      color: colors.textMuted,
    },
    hoursContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    hoursText: {
      fontSize: 11,
      color: colors.textSecondary,
    },
    servicesChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 4,
    },
    serviceChip: {
      backgroundColor: '#E8F5E9',
      paddingHorizontal: 8,
      paddingVertical: 3,
      borderRadius: 10,
    },
    serviceChipText: {
      fontSize: 11,
      color: '#4CAF50',
      fontWeight: '500',
    },
    providerActions: {
      alignItems: 'center',
      marginLeft: 10,
      gap: 8,
    },
    chooseButton: {
      backgroundColor: colors.primary,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderRadius: 10,
      gap: 4,
    },
    chooseText: {
      fontSize: 13,
      fontWeight: 'bold',
      color: '#fff',
    },
    deleteButton: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: '#FEE2E2',
      justifyContent: 'center',
      alignItems: 'center',
    },
    emptyContainer: {
      alignItems: 'center',
      paddingVertical: 60,
    },
    emptyIconCircle: {
      width: 80,
      height: 80,
      borderRadius: 40,
      backgroundColor: colors.borderLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    emptyText: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.textSecondary,
      marginBottom: 4,
    },
    emptySubtext: {
      fontSize: 14,
      color: colors.textMuted,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 16,
    },
    emptyAddBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 24,
      gap: 6,
    },
    emptyAddBtnText: {
      color: '#fff',
      fontSize: 15,
      fontWeight: 'bold',
    },
    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'flex-end',
    },
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
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 18,
      fontWeight: 'bold',
      color: colors.text,
    },
    inputGroup: {
      marginBottom: 14,
    },
    label: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 6,
    },
    input: {
      backgroundColor: colors.inputBg,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 15,
      color: colors.text,
    },
    textArea: {
      height: 80,
      paddingTop: 12,
    },
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
    saveButtonText: {
      color: '#fff',
      fontSize: 16,
      fontWeight: 'bold',
    },
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

  const styles = getStyles(colors);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [categoryName])
  );

  const loadData = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);

    const businesses = await getApprovedBusinesses();
    const categoryBusinesses = businesses.filter((b) => b.category === categoryName);
    const sp = await getAllServiceProviders();
    const categoryProviders = sp.filter((p) => p.category === categoryName);
    setProviders([...categoryBusinesses, ...categoryProviders]);
  };

  const filteredProviders = useMemo(() => {
    let filtered = [...providers];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.name.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.services.some((sv) => sv.toLowerCase().includes(q))
      );
    }
    if (sortBy === 'rating') {
      filtered.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    } else if (sortBy === 'name') {
      filtered.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'reviews') {
      filtered.sort((a, b) => (b.reviews || 0) - (a.reviews || 0));
    }
    return filtered;
  }, [searchQuery, providers, sortBy]);

  const handleAddProvider = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }
    if (!newPhone.trim()) {
      Alert.alert('Error', 'Phone is required');
      return;
    }

    const servicesList = newServicesText
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    const provider = {
      id: 'sp_' + Date.now(),
      name: newName.trim(),
      category: categoryName,
      description: newDescription.trim() || `Professional ${categoryName.toLowerCase()} services`,
      phone: newPhone.trim(),
      address: newAddress.trim(),
      hours: newHours.trim() || 'Mon-Sat: 8:00 AM - 5:00 PM',
      services: servicesList.length > 0 ? servicesList : ['General Service'],
      rating: 0,
      reviews: 0,
      image: newImage || DEFAULT_IMAGES[categoryName] || category?.image || 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
      isUserRegistered: false,
      createdAt: new Date().toISOString(),
    };

    await addServiceProvider(provider);
    setShowAddModal(false);
    resetAddForm();
    loadData();
    Alert.alert('Added', `"${provider.name}" has been added to ${categoryName}`);
  };

  const handleDelete = (item) => {
    Alert.alert('Delete Provider', `Remove "${item.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteServiceProvider(item.id);
          loadData();
        },
      },
    ]);
  };

  const handleChangePhoto = async (item) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please grant camera roll access to change the photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await updateServiceProvider(item.id, { image: result.assets[0].uri });
      loadData();
    }
  };

  const resetAddForm = () => {
    setNewName('');
    setNewDescription('');
    setNewPhone('');
    setNewAddress('');
    setNewHours('');
    setNewServicesText('');
    setNewImage(null);
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
      base64: true,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      setNewImage(result.assets[0].uri);
    }
  };

  const renderProvider = ({ item, index }) => (
    <AnimatedCard style={styles.providerCard}>
      <View style={styles.avatarContainer}>
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.providerAvatar} />
        ) : (
          <View style={styles.providerAvatarFallback}>
            <Text style={styles.avatarInitials}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        {isAdmin && (
          <TouchableOpacity
            style={styles.cameraOverlay}
            onPress={() => handleChangePhoto(item)}
          >
            <Ionicons name="camera" size={12} color="#fff" />
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.providerInfo}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 3 }}>
          <Text style={styles.providerName}>{item.name}</Text>
          {item.verified && (
            <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
          )}
          {item.licensed && (
            <Ionicons name="ribbon" size={14} color="#2196F3" />
          )}
        </View>
        <Text style={styles.providerDescription} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.providerMeta}>
          <View style={styles.ratingContainer}>
            <Ionicons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>
              {item.rating > 0 ? item.rating : 'New'}
            </Text>
            {item.reviews > 0 && (
              <Text style={styles.reviewCount}>({item.reviews} reviews)</Text>
            )}
          </View>
          <View style={styles.hoursContainer}>
            <Ionicons name="time" size={14} color="#666" />
            <Text style={styles.hoursText}>{item.hours}</Text>
          </View>
        </View>
        <View style={styles.servicesChips}>
          {item.services.slice(0, 3).map((s, i) => (
            <View key={i} style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>{s}</Text>
            </View>
          ))}
          {item.services.length > 3 && (
            <View style={styles.serviceChip}>
              <Text style={styles.serviceChipText}>+{item.services.length - 3} more</Text>
            </View>
          )}
        </View>
      </View>
      <View style={styles.providerActions}>
        <TouchableOpacity
          style={styles.chooseButton}
          onPress={() => { hapticLight(); navigation.navigate('ServiceDetail', { service: item }); }}
          accessibilityLabel={`View ${item.name}`}
          accessibilityRole="button"
        >
          <Ionicons name="person" size={18} color="#fff" />
          <Text style={styles.chooseText}>Choose</Text>
        </TouchableOpacity>
        {isAdmin && (
          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => {
          hapticWarning();
          handleDelete(item);
        }}
            accessibilityLabel={`Delete ${item.name}`}
            accessibilityRole="button"
          >
            <Ionicons name="trash" size={16} color="#F44336" />
          </TouchableOpacity>
        )}
      </View>
    </AnimatedCard>
  );  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} />

      {/* Category Header Banner */}
      <View style={styles.heroBanner}>
        {category?.image && <Image source={{ uri: category.image }} style={styles.heroImage} />}
        <View style={styles.heroOverlay} />
        <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.heroContent}>
          {category && (
            <View style={[styles.heroIcon, { backgroundColor: category.color }]}>
              <Ionicons name={category.icon} size={24} color="#fff" />
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{categoryName}</Text>
            <Text style={styles.heroSubtitle}>
              {providers.length} provider{providers.length !== 1 ? 's' : ''} available
            </Text>
          </View>
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminAddBtn}
              onPress={() => {
                hapticMedium();
                resetAddForm();
                setShowAddModal(true);
              }}
              accessibilityLabel="Add provider"
              accessibilityRole="button"
            >
              <Ionicons name="add" size={20} color="#fff" />
              <Text style={styles.adminAddBtnText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color={colors.textMuted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder={`Search ${categoryName} deliverers...`}
          placeholderTextColor={colors.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
          accessibilityLabel={`Search ${categoryName} providers`}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')} accessibilityLabel="Clear search" accessibilityRole="button">
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.sortBar}>
        <Text style={styles.sortLabel}>Sort by:</Text>
        {[
          { key: 'rating', label: 'Rating', icon: 'star' },
          { key: 'name', label: 'Name', icon: 'text' },
          { key: 'reviews', label: 'Reviews', icon: 'chatbubble' },
        ].map((option) => (
          <TouchableOpacity
            key={option.key}
            style={[styles.sortChip, sortBy === option.key && styles.sortChipActive]}
            onPress={() => { hapticLight(); setSortBy(option.key); }}
            accessibilityLabel={`Sort by ${option.label}`}
            accessibilityRole="button"
            accessibilityState={{ selected: sortBy === option.key }}
          >
            <Ionicons
              name={option.icon}
              size={14}
              color={sortBy === option.key ? '#fff' : colors.textSecondary}
            />
            <Text style={[styles.sortChipText, sortBy === option.key && styles.sortChipTextActive]}>
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={filteredProviders}
        renderItem={renderProvider}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          filteredProviders.length > 0 ? (
            <Text style={styles.resultText}>
              {filteredProviders.length} deliverer{filteredProviders.length !== 1 ? 's' : ''} — tap "Choose" to select
            </Text>
          ) : null
        }
        ListEmptyComponent={
          providers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="people-outline" size={40} color="#C4C4C4" />
              </View>
              <Text style={styles.emptyText}>No providers yet</Text>
              <Text style={styles.emptySubtext}>
                No {categoryName.toLowerCase()} providers have been added.{'\n'}
                {isAdmin
                  ? 'Tap the "Add" button above to add a provider.'
                  : 'Check back soon or contact admin.'}
              </Text>
              {isAdmin && (
                <TouchableOpacity
                  style={styles.emptyAddBtn}
                  onPress={() => {
                    resetAddForm();
                    setShowAddModal(true);
                  }}
                  accessibilityLabel="Add provider"
                  accessibilityRole="button"
                >
                  <Ionicons name="add-circle" size={20} color="#fff" />
                  <Text style={styles.emptyAddBtnText}>Add Provider</Text>
                </TouchableOpacity>
              )}
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconCircle}>
                <Ionicons name="search" size={40} color="#C4C4C4" />
              </View>
              <Text style={styles.emptyText}>No providers found</Text>
              <Text style={styles.emptySubtext}>
                Try a different search or check back later
              </Text>
            </View>
          )
        }
      />

      {/* Admin Add Provider Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add {categoryName} Provider</Text>
              <TouchableOpacity onPress={() => setShowAddModal(false)} accessibilityLabel="Close" accessibilityRole="button">
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Business Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g. John's Plumbing"
                  placeholderTextColor={colors.textMuted}
                  value={newName}
                  onChangeText={setNewName}
                  accessibilityLabel="Business name"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Description</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="What services do they offer?"
                  placeholderTextColor={colors.textMuted}
                  value={newDescription}
                  onChangeText={setNewDescription}
                  multiline
                  numberOfLines={3}
                  textAlignVertical="top"
                  accessibilityLabel="Description"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Photo</Text>
                <TouchableOpacity style={styles.imagePickerBtn} onPress={pickImage} accessibilityLabel="Add photo" accessibilityRole="button">
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
                  <TouchableOpacity style={styles.removeImageBtn} onPress={() => setNewImage(null)} accessibilityLabel="Remove photo" accessibilityRole="button">
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
                  value={newPhone}
                  onChangeText={setNewPhone}
                  keyboardType="phone-pad"
                  accessibilityLabel="Phone number"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Address</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Street address"
                  placeholderTextColor={colors.textMuted}
                  value={newAddress}
                  onChangeText={setNewAddress}
                  accessibilityLabel="Address"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Working Hours</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Mon-Sat: 8:00 AM - 5:00 PM"
                  placeholderTextColor={colors.textMuted}
                  value={newHours}
                  onChangeText={setNewHours}
                  accessibilityLabel="Working hours"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Services (comma separated)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Pipe Repair, Drain Cleaning, ..."
                  placeholderTextColor={colors.textMuted}
                  value={newServicesText}
                  onChangeText={setNewServicesText}
                  accessibilityLabel="Services offered"
                />
              </View>

              <TouchableOpacity style={styles.saveButton} onPress={handleAddProvider} accessibilityLabel="Add provider" accessibilityRole="button">
                <Ionicons name="checkmark-circle" size={22} color="#fff" />
                <Text style={styles.saveButtonText}>Add Provider</Text>
              </TouchableOpacity>

              <View style={{ height: 20 }} />
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
