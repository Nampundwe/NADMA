import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { categories } from '../data/services';
import {
  saveRegisteredBusiness,
  getCurrentUser,
} from '../data/storage';
import { useTheme } from '../context/ThemeContext';

export default function RegisterScreen({ navigation }) {
  const { colors } = useTheme();
  const styles = getStyles(colors);
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [hours, setHours] = useState('');
  const [services, setServices] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const handleRegister = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your business name');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }
    if (!description.trim()) {
      Alert.alert('Error', 'Please enter a description');
      return;
    }
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter a phone number');
      return;
    }
    if (!address.trim()) {
      Alert.alert('Error', 'Please enter an address');
      return;
    }

    const currentUser = await getCurrentUser();

    const newBusiness = {
      id: 'biz_' + Date.now(),
      name: name.trim(),
      category,
      description: description.trim(),
      phone: phone.trim(),
      address: address.trim(),
      hours: hours.trim() || 'Contact for hours',
      rating: 0,
      reviews: 0,
      image: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=400',
      services: services
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0),
      approvalStatus: 'pending',
      createdBy: currentUser ? currentUser.id : null,
    };

    try {
      await saveRegisteredBusiness(newBusiness);
      Alert.alert(
        'Submitted!',
        'Your business registration has been submitted for admin approval. You will be notified once it is reviewed.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
    } catch (error) {
      Alert.alert('Error', 'Failed to save your business. Please try again.');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <Ionicons name="storefront" size={48} color={colors.headerText} />
            <Text style={styles.headerTitle}>Register Your Business</Text>
            <Text style={styles.headerSubtitle}>
              List your services on Nadma and reach more customers in Nampundwe
            </Text>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Name *</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. John's Plumbing Services"
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
                <Text
                  style={[
                    styles.pickerText,
                    !category && styles.pickerPlaceholder,
                  ]}
                >
                  {category || 'Select a category'}
                </Text>
                <Ionicons
                  name={showCategoryPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>
              {showCategoryPicker && (
                <View style={styles.categoryList}>
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      style={[
                        styles.categoryOption,
                        category === cat.name && styles.categoryOptionSelected,
                      ]}
                      onPress={() => {
                        setCategory(cat.name);
                        setShowCategoryPicker(false);
                      }}
                    >
                      <Ionicons name={cat.icon} size={20} color={cat.color} />
                      <Text
                        style={[
                          styles.categoryOptionText,
                          category === cat.name &&
                            styles.categoryOptionTextSelected,
                        ]}
                      >
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
                placeholder="Describe your business and services..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number *</Text>
              <TextInput
                style={styles.input}
                placeholder="+260 XX XXX XXXX"
                placeholderTextColor={colors.textMuted}
                value={phone}
                onChangeText={setPhone}
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Address *</Text>
              <TextInput
                style={styles.input}
                placeholder="Street address, Nampundwe"
                placeholderTextColor={colors.textMuted}
                value={address}
                onChangeText={setAddress}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Business Hours</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. Mon-Sat: 8:00 AM - 5:00 PM"
                placeholderTextColor={colors.textMuted}
                value={hours}
                onChangeText={setHours}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Services Offered</Text>
              <TextInput
                style={styles.input}
                placeholder="Separate with commas (e.g. Pipe Repair, Drain Cleaning)"
                placeholderTextColor={colors.textMuted}
                value={services}
                onChangeText={setServices}
              />
            </View>

            <TouchableOpacity style={styles.registerButton} onPress={handleRegister}>
              <Ionicons name="checkmark-circle" size={24} color="#fff" />
              <Text style={styles.registerButtonText}>Register Business</Text>
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              By registering, you agree that the information provided is accurate.
              Your listing will be visible to all Nadma users.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  header: {
    backgroundColor: colors.headerBg,
    padding: 24,
    paddingTop: 16,
    paddingBottom: 32,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.headerText,
    marginTop: 12,
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#c5cae9',
    textAlign: 'center',
  },
  form: {
    padding: 16,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
    elevation: 1,
  },
  textArea: {
    height: 120,
    paddingTop: 14,
  },
  picker: {
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    elevation: 1,
  },
  pickerText: {
    fontSize: 16,
    color: colors.text,
  },
  pickerPlaceholder: {
    color: colors.textMuted,
  },
  categoryList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  categoryOptionSelected: {
    backgroundColor: colors.primaryLight,
  },
  categoryOptionText: {
    marginLeft: 12,
    fontSize: 16,
    color: colors.text,
  },
  categoryOptionTextSelected: {
    fontWeight: '600',
    color: colors.primary,
  },
  registerButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: 16,
    lineHeight: 18,
  },
});


