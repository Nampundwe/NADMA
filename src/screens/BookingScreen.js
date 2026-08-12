import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { createBooking, getCurrentUser } from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight, hapticSuccess, hapticError } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { createStyleSheet } from '../utils/responsive';

export default function BookingScreen({ route, navigation }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { loading, run } = useNetworkAction();
  const { service } = route.params;
  const [date, setDate] = useState(null);
  const [time, setTime] = useState('');
  const [description, setDescription] = useState('');
  const [urgency, setUrgency] = useState('normal');
  const [showUrgencyPicker, setShowUrgencyPicker] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);

  const urgencyOptions = [
    { value: 'low', label: 'Low - Whenever convenient', color: '#4CAF50' },
    { value: 'normal', label: 'Normal - Within a few days', color: '#2196F3' },
    { value: 'high', label: 'High - ASAP', color: '#FF9800' },
    { value: 'urgent', label: 'Urgent - Emergency', color: '#F44336' },
  ];

  const formatDate = (d) => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  };

  const formatTime = (t) => {
    const hours = t.getHours();
    const minutes = t.getMinutes().toString().padStart(2, '0');
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    return `${h}:${minutes} ${ampm}`;
  };

  const onDateChange = (event, selectedDate) => {
    setShowDatePicker(false);
    if (selectedDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (selectedDate < today) {
        toast.error('Please select a date today or later');
        return;
      }
      setDate(selectedDate);
    }
  };

  const onTimeChange = (event, selectedTime) => {
    setShowTimePicker(false);
    if (selectedTime) {
      setTime(formatTime(selectedTime));
    }
  };

  const handleBooking = () => run(async () => {
    if (!date) {
      hapticError();
      toast.error('Please select a preferred date');
      return;
    }
    if (!time.trim()) {
      hapticError();
      toast.error('Please enter a preferred time');
      return;
    }
    if (!description.trim()) {
      hapticError();
      toast.error('Please describe what you need');
      return;
    }

    const user = await getCurrentUser();
    if (!user) {
      toast.error('Please login to book a service');
      return;
    }

    const booking = {
      id: 'booking_' + Date.now(),
      businessId: service.id,
      businessName: service.name,
      businessPhone: service.phone,
      userId: user.id,
      userName: user.name,
      userEmail: user.email,
      date: formatDate(date),
      time: time.trim(),
      description: description.trim(),
      urgency,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    const result = await createBooking(booking);
    if (result === true || result?.success !== false) {
      hapticSuccess();
      toast.success('Booking request sent!');
    } else {
      toast.error(result?.error || 'Failed to create booking');
    }
  });

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.businessCard}>
            <Ionicons name="storefront" size={32} color="#1a237e" />
            <View style={styles.businessInfo}>
              <Text style={styles.businessName}>{service.name}</Text>
              <Text style={styles.businessCategory}>{service.category}</Text>
            </View>
          </View>

          <View style={styles.form}>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Date *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => { hapticLight(); setShowDatePicker(true); }}
                accessibilityLabel="Select date"
                accessibilityRole="button"
              >
                <Ionicons name="calendar" size={22} color="#1a237e" />
                <Text style={[styles.pickerText, !date && { color: colors.textMuted }]}>
                  {date ? formatDate(date) : 'Select a date'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {showDatePicker && (
                <DateTimePicker
                  value={date || new Date()}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onDateChange}
                  minimumDate={new Date()}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Preferred Time *</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => { hapticLight(); setShowTimePicker(true); }}
                accessibilityLabel="Select time"
                accessibilityRole="button"
              >
                <Ionicons name="time" size={22} color="#1a237e" />
                <Text style={[styles.pickerText, !time && { color: colors.textMuted }]}>
                  {time || 'Select a time'}
                </Text>
                <Ionicons name="chevron-down" size={20} color="#666" />
              </TouchableOpacity>
              {showTimePicker && (
                <DateTimePicker
                  value={new Date()}
                  mode="time"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  onChange={onTimeChange}
                />
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>What do you need? *</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Describe the issue or service you need..."
                placeholderTextColor={colors.textMuted}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                maxLength={500}
                accessibilityLabel="Describe what you need"
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Urgency</Text>
              <TouchableOpacity
                style={styles.picker}
                onPress={() => setShowUrgencyPicker(!showUrgencyPicker)}
                accessibilityLabel="Select urgency level"
                accessibilityRole="button"
                accessibilityState={{ expanded: showUrgencyPicker }}
              >
                <View style={styles.urgencyRow}>
                  <View
                    style={[
                      styles.urgencyDot,
                      { backgroundColor: urgencyOptions.find((u) => u.value === urgency).color },
                    ]}
                  />
                  <Text style={styles.pickerText}>
                    {urgencyOptions.find((u) => u.value === urgency).label}
                  </Text>
                </View>
                <Ionicons
                  name={showUrgencyPicker ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#666"
                />
              </TouchableOpacity>
              {showUrgencyPicker && (
                <View style={styles.optionList}>
                  {urgencyOptions.map((option) => (
                    <TouchableOpacity
                      key={option.value}
                      style={[
                        styles.optionItem,
                        urgency === option.value && styles.optionItemSelected,
                      ]}
                      onPress={() => {
                        setUrgency(option.value);
                        setShowUrgencyPicker(false);
                      }}
                      accessibilityLabel={option.label}
                      accessibilityRole="button"
                      accessibilityState={{ selected: urgency === option.value }}
                    >
                      <View style={[styles.urgencyDot, { backgroundColor: option.color }]} />
                      <Text
                        style={[
                          styles.optionText,
                          urgency === option.value && styles.optionTextSelected,
                        ]}
                      >
                        {option.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>

            <View style={styles.summaryCard}>
              <Text style={styles.summaryTitle}>Booking Summary</Text>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Service:</Text>
                <Text style={styles.summaryValue}>{service.name}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Contact:</Text>
                <Text style={styles.summaryValue}>{service.phone}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Date:</Text>
                <Text style={styles.summaryValue}>{date ? formatDate(date) : 'Not set'}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Time:</Text>
                <Text style={styles.summaryValue}>{time || 'Not set'}</Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.bookButton, loading && { opacity: 0.7 }]} onPress={handleBooking} disabled={loading} accessibilityLabel="Confirm booking" accessibilityRole="button">
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={24} color="#fff" />
                  <Text style={styles.bookButtonText}>Confirm Booking</Text>
                </>
              )}
            </TouchableOpacity>

            <Text style={styles.note}>
              Your booking will be reviewed by the admin. You'll be notified once it's approved or rejected.
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primaryLight,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  businessInfo: {
    marginLeft: 12,
  },
  businessName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1a237e',
  },
  businessCategory: {
    fontSize: 14,
    color: colors.textSecondary,
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
    flex: 1,
    marginLeft: 8,
  },
  urgencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  urgencyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  optionList: {
    backgroundColor: colors.card,
    borderRadius: 12,
    marginTop: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionItemSelected: {
    backgroundColor: colors.primaryLight,
  },
  optionText: {
    marginLeft: 12,
    fontSize: 14,
    color: colors.text,
  },
  optionTextSelected: {
    fontWeight: '600',
    color: '#1a237e',
  },
  summaryCard: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  bookButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  note: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
  },
});
