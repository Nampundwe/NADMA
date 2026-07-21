import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  SafeAreaView,
  Alert,
  Share,
  Modal,
  TextInput,
  FlatList,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  toggleFavorite,
  isFavorite,
  getCurrentUser,
  getReviews,
  addReview,
  deleteReview,
  deleteBusiness,
  updateServiceProvider,
  addReport,
  getProviderAvailability,
} from '../data/storage';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../utils/haptics';

export default function ServiceDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const { service } = route.params;
  const [fav, setFav] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviews, setReviews] = useState([]);
  const [reviewText, setReviewText] = useState('');
  const [reviewRating, setReviewRating] = useState(5);
  const [user, setUser] = useState(null);
  const [showFullImage, setShowFullImage] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportCategory, setReportCategory] = useState('Other');
  const [availability, setAvailability] = useState(null);
  const [loading, setLoading] = useState(true);

  const styles = getStyles(colors);

  useEffect(() => {
    (async () => {
      await Promise.all([
        isFavorite(service.id).then(setFav),
        getReviews(service.id).then(setReviews),
        getCurrentUser().then(setUser),
      ]);
      setLoading(false);
    })();
  }, [service.id]);

  useEffect(() => {
    if (service.id) {
      getProviderAvailability(service.id).then(setAvailability);
    }
  }, [service.id]);

  const isAdmin = user?.role === 'admin';
  const initials = service.name?.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  const openPhone = () => Linking.openURL(`tel:${service.phone}`);

  const handleFavorite = async () => {
    hapticLight();
    const newState = await toggleFavorite(service);
    setFav(newState);
  };

  const shareViaWhatsApp = () => {
    const message = `Check out ${service.name} on Nadma!\n\n${service.description}\n\nPhone: ${service.phone}\nAddress: ${service.address}\nHours: ${service.hours}`;
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(message)}`);
  };

  const shareViaSMS = () => {
    const message = `Check out ${service.name} on Nadma!\n${service.description}\nPhone: ${service.phone}\nAddress: ${service.address}`;
    Linking.openURL(`sms:&body=${encodeURIComponent(message)}`);
  };

  const shareGeneric = async () => {
    try {
      await Share.share({
        message: `Check out ${service.name} on Nadma!\n\n${service.description}\n\nPhone: ${service.phone}\nAddress: ${service.address}\nHours: ${service.hours}`,
        title: service.name,
      });
    } catch (error) {
      console.log(error);
    }
  };

  const handleSubmitReview = async () => {
    if (!reviewText.trim()) {
      Alert.alert('Error', 'Please write a review');
      return;
    }
    const review = {
      id: 'review_' + Date.now(),
      serviceId: service.id,
      userId: user ? user.id : null,
      userName: user ? user.name : 'Guest',
      rating: reviewRating,
      text: reviewText.trim(),
      date: new Date().toISOString(),
    };
    await addReview(review);
    const updatedReviews = await getReviews(service.id);
    setReviews(updatedReviews);
    hapticSuccess();
    setShowReviewModal(false);
    setReviewText('');
    setReviewRating(5);
  };

  const handleDeleteReview = (reviewId) => {
    Alert.alert('Delete Review', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteReview(reviewId);
          const updated = await getReviews(service.id);
          setReviews(updated);
        },
      },
    ]);
  };

  const handleDeleteBusiness = () => {
    Alert.alert('Delete Business', `Delete "${service.name}"? This cannot be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteBusiness(service.id);
          Alert.alert('Deleted', 'Business has been removed.');
          navigation.goBack();
        },
      },
    ]);
  };

  const handleChangeProfilePic = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Please grant camera roll access to change the profile photo.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      await updateServiceProvider(service.id, { image: result.assets[0].uri });
      service.image = result.assets[0].uri;
      Alert.alert('Updated', 'Profile photo has been changed.');
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim()) {
      Alert.alert('Error', 'Please describe the issue');
      return;
    }
    const report = {
      id: 'report_' + Date.now(),
      providerId: service.id,
      providerName: service.name,
      reporterId: user?.id,
      reporterName: user?.name || 'Guest',
      category: reportCategory,
      reason: reportReason.trim(),
      timestamp: new Date().toISOString(),
    };
    await addReport(report);
    hapticWarning();
    setShowReportModal(false);
    setReportReason('');
    setReportCategory('Other');
    Alert.alert('Reported', 'Thank you for your report. Admin will review it.');
  };

  const renderReview = ({ item }) => (
    <View style={styles.reviewCard}>
      <View style={styles.reviewHeader}>
        <View style={styles.reviewLeft}>
          <View style={styles.reviewAvatar}>
            <Text style={styles.reviewAvatarText}>{item.userName?.charAt(0)?.toUpperCase()}</Text>
          </View>
          <View>
            <Text style={styles.reviewUserName}>{item.userName}</Text>
            <View style={styles.reviewStars}>
              {[1, 2, 3, 4, 5].map((star) => (
                <Ionicons key={star} name={star <= item.rating ? 'star' : 'star-outline'} size={13} color="#FFD700" />
              ))}
            </View>
          </View>
        </View>
        <View style={styles.reviewRight}>
          <Text style={styles.reviewDate}>{new Date(item.date).toLocaleDateString()}</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => handleDeleteReview(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>
      </View>
      <Text style={styles.reviewText}>{item.text}</Text>
      {item.reply && (
        <View style={styles.replyContainer}>
          <Text style={styles.replyLabel}>Owner Reply</Text>
          <Text style={styles.replyText}>{item.reply}</Text>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Image */}
        <View style={styles.imageContainer}>
          <Image source={{ uri: service.image }} style={styles.image} />
          <View style={styles.imageOverlay} pointerEvents="none" />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.favBtn} onPress={handleFavorite} accessibilityLabel={fav ? "Remove from favorites" : "Add to favorites"} accessibilityRole="button" accessibilityState={{ selected: fav }}>
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={24} color={fav ? '#F44336' : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Profile Picture */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.profilePicWrapper}
            activeOpacity={0.8}
            onPress={() => {
              if (isAdmin) {
                Alert.alert('Profile Photo', 'Choose an option', [
                  { text: 'View Full Picture', onPress: () => setShowFullImage(true) },
                  { text: 'Change Photo', onPress: handleChangeProfilePic },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              } else {
                setShowFullImage(true);
              }
            }}
            accessibilityLabel={isAdmin ? "View or change profile photo" : "View profile photo"}
            accessibilityRole="button"
          >
            <Image source={{ uri: service.image }} style={styles.profilePic} />
            {isAdmin && (
              <View style={styles.profilePicOverlay} pointerEvents="none">
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          {isAdmin ? (
            <Text style={styles.changePhotoText}>Tap photo to view or change</Text>
          ) : (
            <Text style={styles.changePhotoText}>Tap photo to view</Text>
          )}
        </View>

        {/* Content */}
        <View style={styles.content}>
          <View style={styles.titleSection}>
            <View style={styles.titleRow}>
              <Text style={styles.name}>{service.name}</Text>
            </View>
            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color="#FFD700" />
                <Text style={styles.rating}>{service.rating > 0 ? service.rating : 'New'}</Text>
              </View>
              {service.reviews > 0 && (
                <Text style={styles.reviewCount}>({service.reviews} reviews)</Text>
              )}
              <View style={styles.categoryBadge}>
                <Text style={styles.categoryText}>{service.category}</Text>
              </View>
              {service.verified && (
                <View style={styles.verifiedBadge}>
                  <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
              {service.licensed && (
                <View style={styles.licensedBadge}>
                  <Ionicons name="ribbon" size={14} color="#2196F3" />
                  <Text style={styles.licensedText}>Licensed</Text>
                </View>
              )}
            </View>
          </View>

          <Text style={styles.description}>{service.description}</Text>

          {/* Services */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <View style={styles.servicesGrid}>
              {service.services.map((s, index) => (
                <View key={index} style={styles.serviceChip}>
                  <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
                  <Text style={styles.serviceText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Availability */}
          {availability && availability.days && availability.days.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, elevation: 1 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {availability.days.map((day) => (
                    <View key={day} style={{ backgroundColor: '#E8F5E9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: '600' }}>{day}</Text>
                    </View>
                  ))}
                </View>
                {availability.startTime && availability.endTime && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="time" size={16} color={colors.textMuted} />
                    <Text style={{ fontSize: 14, color: colors.textSecondary }}>{availability.startTime} - {availability.endTime}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* Portfolio */}
          {service.portfolio && service.portfolio.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Work Portfolio</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {service.portfolio.map((photo, index) => (
                  <TouchableOpacity
                    key={index}
                    style={{ marginRight: 10 }}
                    onPress={() => {
                      setShowFullImage(true);
                    }}
                    accessibilityLabel={`View portfolio image ${index + 1}`}
                    accessibilityRole="button"
                  >
                    <Image source={{ uri: photo.uri }} style={{ width: 120, height: 120, borderRadius: 12 }} />
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Contact */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.contactCard}>
              <TouchableOpacity style={styles.contactRow} onPress={openPhone} activeOpacity={0.7} accessibilityLabel="Call provider" accessibilityRole="button">
                <View style={[styles.contactIcon, { backgroundColor: '#E8F5E9' }]}>
                  <Ionicons name="call" size={18} color="#4CAF50" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  <Text style={styles.contactValue}>{service.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: '#E3F2FD' }]}>
                  <Ionicons name="location" size={18} color="#2196F3" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Address</Text>
                  <Text style={styles.contactValue}>{service.address}</Text>
                </View>
              </View>

              <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.contactIcon, { backgroundColor: '#FFF3E0' }]}>
                  <Ionicons name="time" size={18} color="#FF9800" />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Hours</Text>
                  <Text style={styles.contactValue}>{service.hours}</Text>
                </View>
              </View>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.actionsGrid}>
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: '#E8F5E9' }]} onPress={openPhone} activeOpacity={0.7} accessibilityLabel="Call provider" accessibilityRole="button">
              <Ionicons name="call" size={24} color="#4CAF50" />
              <Text style={[styles.actionLabel, { color: '#4CAF50' }]}>Call Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#E3F2FD' }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Chat', { businessId: service.id, businessName: service.name })}
              accessibilityLabel="Message provider"
              accessibilityRole="button"
            >
              <Ionicons name="chatbubbles" size={24} color="#2196F3" />
              <Text style={[styles.actionLabel, { color: '#2196F3' }]}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: '#F3E5F5' }]}
              activeOpacity={0.7}
              onPress={() => setShowReviewModal(true)}
              accessibilityLabel="Write a review"
              accessibilityRole="button"
            >
              <Ionicons name="star" size={24} color="#9C27B0" />
              <Text style={[styles.actionLabel, { color: '#9C27B0' }]}>Review</Text>
            </TouchableOpacity>
          </View>

          {/* Book Button */}
          <TouchableOpacity
            style={styles.bookButton}
            activeOpacity={0.85}
            onPress={() => { hapticMedium(); navigation.navigate('Booking', { service }); }}
            accessibilityLabel="Book this service"
            accessibilityRole="button"
          >
            <Ionicons name="calendar" size={22} color="#fff" />
            <Text style={styles.bookButtonText}>Book This Provider</Text>
            <Ionicons name="arrow-forward" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.shareButton}
            activeOpacity={0.8}
            onPress={() => { hapticLight(); setShowShareMenu(true); }}
            accessibilityLabel="Share provider"
            accessibilityRole="button"
          >
            <Ionicons name="share-outline" size={20} color={colors.primary} />
            <Text style={styles.shareButtonText}>Share Provider</Text>
          </TouchableOpacity>

          {/* Report Provider */}
          {!isAdmin && user && (
            <TouchableOpacity
              style={styles.reportButton}
              activeOpacity={0.8}
              onPress={() => setShowReportModal(true)}
              accessibilityLabel="Report provider"
              accessibilityRole="button"
            >
              <Ionicons name="flag-outline" size={18} color="#FF9800" />
              <Text style={styles.reportButtonText}>Report Provider</Text>
            </TouchableOpacity>
          )}

          {/* Admin Delete */}
          {isAdmin && (
            <TouchableOpacity
              style={styles.adminDeleteButton}
              activeOpacity={0.8}
              onPress={handleDeleteBusiness}
              accessibilityLabel="Delete business"
              accessibilityRole="button"
            >
              <Ionicons name="trash" size={18} color="#F44336" />
              <Text style={styles.adminDeleteText}>Delete Business</Text>
            </TouchableOpacity>
          )}

          {/* Reviews */}
          {reviews.length > 0 && (
            <View style={styles.section}>
              <View style={styles.reviewsSectionHeader}>
                <Text style={styles.sectionTitle}>Reviews ({reviews.length})</Text>
              </View>
              {reviews.map((review) => (
                <View key={review.id}>
                  {renderReview({ item: review })}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal visible={showShareMenu} transparent animationType="slide" onRequestClose={() => setShowShareMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowShareMenu(false)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share via</Text>

            <TouchableOpacity style={styles.shareOption} onPress={shareViaWhatsApp} accessibilityLabel="Share via WhatsApp" accessibilityRole="button">
              <View style={[styles.shareIcon, { backgroundColor: '#E8F5E9' }]}>
                <Ionicons name="logo-whatsapp" size={24} color="#25D366" />
              </View>
              <Text style={styles.shareOptionText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={shareViaSMS} accessibilityLabel="Share via SMS" accessibilityRole="button">
              <View style={[styles.shareIcon, { backgroundColor: '#E3F2FD' }]}>
                <Ionicons name="chatbubble" size={24} color="#2196F3" />
              </View>
              <Text style={styles.shareOptionText}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={shareGeneric} accessibilityLabel="Share via more options" accessibilityRole="button">
              <View style={[styles.shareIcon, { backgroundColor: '#FFF3E0' }]}>
                <Ionicons name="share-social" size={24} color="#FF9800" />
              </View>
              <Text style={styles.shareOptionText}>More Options</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Review Modal */}
      <Modal visible={showReviewModal} transparent animationType="slide" onRequestClose={() => setShowReviewModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReviewModal(false)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Write a Review</Text>

            <Text style={styles.ratingLabel}>Your Rating</Text>
            <View style={styles.ratingPicker}>
              {[1, 2, 3, 4, 5].map((star) => (
                <TouchableOpacity key={star} onPress={() => setReviewRating(star)} accessibilityLabel={`Rate ${star} star${star > 1 ? 's' : ''}`} accessibilityRole="button" accessibilityState={{ selected: star <= reviewRating }}>
                  <Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={36} color="#FFD700" />
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.reviewInput}
              placeholder="Write your experience..."
              placeholderTextColor={colors.textMuted}
              value={reviewText}
              onChangeText={setReviewText}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Write your review"
            />

            <View style={styles.reviewModalButtons}>
              <TouchableOpacity
                style={styles.cancelReviewButton}
                activeOpacity={0.8}
                onPress={() => setShowReviewModal(false)}
                accessibilityLabel="Cancel review"
                accessibilityRole="button"
              >
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitReviewButton}
                activeOpacity={0.85}
                onPress={handleSubmitReview}
                accessibilityLabel="Submit review"
                accessibilityRole="button"
              >
                <Text style={styles.submitReviewText}>Submit Review</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Report Provider</Text>
            <Text style={styles.ratingLabel}>Reason</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Fraud', 'Rude behavior', 'Poor quality', 'No show', 'Overcharging', 'Other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.reportChip, reportCategory === cat && styles.reportChipActive]}
                  onPress={() => setReportCategory(cat)}
                  accessibilityLabel={`Report for ${cat}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: reportCategory === cat }}
                >
                  <Text style={[styles.reportChipText, reportCategory === cat && styles.reportChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={styles.reviewInput}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textMuted}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              accessibilityLabel="Report reason"
            />
            <View style={styles.reviewModalButtons}>
              <TouchableOpacity style={styles.cancelReviewButton} onPress={() => setShowReportModal(false)} accessibilityLabel="Cancel report" accessibilityRole="button">
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitReviewButton, { backgroundColor: '#FF9800' }]} onPress={handleReport} accessibilityLabel="Submit report" accessibilityRole="button">
                <Text style={styles.submitReviewText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Full Screen Image Modal */}
      <Modal visible={showFullImage} transparent animationType="fade">
        <TouchableOpacity
          style={styles.fullImageOverlay}
          activeOpacity={1}
          onPress={() => setShowFullImage(false)}
        >
          <TouchableOpacity
            style={styles.fullImageClose}
            onPress={() => setShowFullImage(false)}
          >
            <Ionicons name="close" size={28} color="#fff" />
          </TouchableOpacity>
          <Image source={{ uri: service.image }} style={styles.fullImage} resizeMode="contain" />
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  // Image
  imageContainer: {
    height: 260,
    position: 'relative',
    zIndex: 1,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  backBtn: {
    position: 'absolute',
    top: 16,
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  favBtn: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Content
  profileSection: {
    alignItems: 'center',
    marginTop: -48,
    marginBottom: 8,
    zIndex: 10,
  },
  profilePicWrapper: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    borderColor: colors.card,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 8,
    zIndex: 11,
  },
  profilePic: {
    width: '100%',
    height: '100%',
  },
  profilePicOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  changePhotoText: {
    fontSize: 12,
    color: colors.primary,
    marginTop: 6,
    fontWeight: '500',
  },
  content: {
    padding: 20,
  },
  titleSection: {
    marginBottom: 12,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  name: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    lineHeight: 30,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF8E1',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F57F17',
  },
  reviewCount: {
    fontSize: 13,
    color: colors.textMuted,
  },
  categoryBadge: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  description: {
    fontSize: 15,
    color: colors.textSecondary,
    lineHeight: 23,
    marginBottom: 20,
  },
  // Sections
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  servicesGrid: {
    gap: 6,
  },
  serviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    padding: 12,
    borderRadius: 12,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  serviceText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Contact
  contactCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 3,
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 12,
  },
  contactIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    fontSize: 11,
    color: colors.textMuted,
    marginBottom: 1,
  },
  contactValue: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  // Actions
  actionsGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  actionCard: {
    flex: 1,
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    gap: 6,
  },
  actionLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  // Buttons
  bookButton: {
    backgroundColor: '#4CAF50',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    marginBottom: 10,
    gap: 10,
    shadowColor: '#4CAF50',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bookButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 'bold',
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginBottom: 10,
    gap: 8,
  },
  shareButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  adminDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FEE2E2',
    marginBottom: 10,
    gap: 8,
  },
  adminDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#F44336',
  },
  // Reviews
  reviewsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewCard: {
    backgroundColor: colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  reviewAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  reviewAvatarText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.primary,
  },
  reviewStars: {
    flexDirection: 'row',
    gap: 1,
  },
  reviewUserName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  reviewRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewDate: {
    fontSize: 11,
    color: colors.textMuted,
  },
  reviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  replyContainer: {
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.borderLight,
    padding: 10,
    borderRadius: 10,
  },
  replyLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 4,
  },
  replyText: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  bottomModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  shareOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  shareIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  shareOptionText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  // Review Modal
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 10,
  },
  ratingPicker: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  reviewInput: {
    backgroundColor: colors.inputBg,
    borderRadius: 14,
    padding: 16,
    fontSize: 15,
    color: colors.text,
    height: 120,
    marginBottom: 20,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  reviewModalButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelReviewButton: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.borderLight,
  },
  cancelReviewText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '600',
  },
  submitReviewButton: {
    flex: 1,
    padding: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  submitReviewText: {
    fontSize: 15,
    color: '#fff',
    fontWeight: '600',
  },
  fullImageOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '80%',
  },
  fullImageClose: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#4CAF50',
  },
  licensedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  licensedText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2196F3',
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: '#FFF3E0',
    marginBottom: 10,
    gap: 8,
    backgroundColor: '#FFF8E1',
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FF9800',
  },
  reportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
  },
  reportChipActive: {
    backgroundColor: '#FF9800',
  },
  reportChipText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  reportChipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
});
