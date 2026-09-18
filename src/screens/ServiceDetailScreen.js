import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Linking,
  Alert,
  Share,
  Modal,
  TextInput,
  StatusBar,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ServiceDetailSkeleton } from '../components/Skeleton';
import * as ImagePicker from 'expo-image-picker';
import { compressForProfile } from '../utils/imageCompression';
import {
  toggleFavorite,
  isFavorite,
  getCurrentUser,
  getReviews,
  addReview,
  deleteReview,
  deleteBusiness,
  updateServiceProvider,
  uploadImage,
  addReport,
  getProviderAvailability,
  replyToReview,
  onReviewsSnapshot,
  onProviderSnapshot,
  toggleFollow,
  isFollowing,
  onFollowersSnapshot,
  endorseSkill,
  updateProviderSkills,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { createStyleSheet } from '../utils/responsive';
import { useToast } from '../context/ToastContext';

export default function ServiceDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { run } = useNetworkAction();
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
  const [pageLoading, setPageLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editName, setEditName] = useState(service.name || '');
  const [editDescription, setEditDescription] = useState(service.description || '');
  const [editPhone, setEditPhone] = useState(service.phone || '');
  const [editAddress, setEditAddress] = useState(service.address || '');
  const [editHours, setEditHours] = useState(service.hours || '');
  const [editServices, setEditServices] = useState((service.services || []).join(', '));
  const [replyingTo, setReplyingTo] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState(0);
  const [skills, setSkills] = useState(service.skills || []);
  const [endorsingSkill, setEndorsingSkill] = useState(null);
  const [editSkills, setEditSkills] = useState((service.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).join(', '));
  const followersUnsubRef = React.useRef(null);

  const styles = React.useMemo(() => getStyles(colors), [colors]);

  useEffect(() => {
    let unsubReviews = null;
    let unsubProvider = null;
    let loaded = false;
    (async () => {
      await isFavorite(service.id).then(setFav);
      getCurrentUser().then((u) => {
        setUser(u);
        if (u) {
          isFollowing(u.id, service.id).then(setFollowing);
          followersUnsubRef.current = onFollowersSnapshot(service.id, setFollowers);
        }
      });
      unsubReviews = onReviewsSnapshot(service.id, (reviews) => {
        setReviews(reviews);
        if (!loaded) { loaded = true; setPageLoading(false); }
      });
      unsubProvider = onProviderSnapshot(service.id, (data) => {
        service.name = data.name;
        service.description = data.description;
        service.phone = data.phone;
        service.address = data.address;
        service.hours = data.hours;
        service.services = data.services;
        service.image = data.image;
        service.rating = data.rating;
        service.reviews = data.reviews;
        service.ownerId = data.ownerId;
        service.headline = data.headline;
        setSkills(data.skills || []);
        setEditName(data.name || '');
        setEditDescription(data.description || '');
        setEditPhone(data.phone || '');
        setEditAddress(data.address || '');
        setEditHours(data.hours || '');
        setEditServices((data.services || []).join(', '));
        setEditSkills((data.skills || []).map((s) => (typeof s === 'string' ? s : s.name)).join(', '));
      });
      setTimeout(() => { if (!loaded) { loaded = true; setPageLoading(false); } }, 3000);
    })();
    return () => { if (unsubReviews) unsubReviews(); if (unsubProvider) unsubProvider(); if (followersUnsubRef.current) followersUnsubRef.current(); };
  }, [service.id]);

  useEffect(() => {
    if (service.id) {
      getProviderAvailability(service.id).then(setAvailability);
    }
  }, [service.id]);

  const onRefresh = async () => {
    setRefreshing(true);
    const u = await getCurrentUser();
    setUser(u);
    setRefreshing(false);
  };

  const isAdmin = user?.role === 'admin';
  const isProvider = user?.role === 'provider';
  const isOwner = isProvider && user?.id && service.ownerId === user.id;
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

  const handleSubmitReview = () => run(async () => {
    if (!reviewText.trim()) {
      toast.error('Please write a review');
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
    const result = await addReview(review);
    if (result === true || result?.success !== false) {
      hapticSuccess();
      setShowReviewModal(false);
      setReviewText('');
      setReviewRating(5);
    } else {
      toast.error(result?.error || 'Failed to submit review');
    }
  });

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
          toast.success('Business removed');
          navigation.goBack();
        },
      },
    ]);
  };

  const handleSaveEdit = () => run(async () => {
    if (!editName.trim()) {
      toast.error('Business name is required');
      return;
    }
    const servicesList = editServices.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    await updateServiceProvider(service.id, {
      name: editName.trim(),
      description: editDescription.trim(),
      phone: editPhone.trim(),
      address: editAddress.trim(),
      hours: editHours.trim(),
      services: servicesList.length > 0 ? servicesList : ['General Service'],
    });
    const skillsInput = editSkills.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    const skillsList = skillsInput.map((name) => {
      const existing = skills.find((s) => (typeof s === 'string' ? s === name : s.name === name));
      if (existing && typeof existing !== 'string') return existing;
      return { name, endorsements: 0 };
    });
    await updateProviderSkills(service.id, skillsList);
    setSkills(skillsList);
    hapticSuccess();
    toast.success('Business updated');
    setShowEditModal(false);
  });

  const handleReplyToReview = (reviewId) => run(async () => {
    if (!replyText.trim()) {
      toast.error('Please write a reply');
      return;
    }
    const result = await replyToReview(reviewId, replyText.trim());
    if (result) {
      hapticSuccess();
      setReplyingTo(null);
      setReplyText('');
      toast.success('Reply posted');
    } else {
      toast.error('Failed to post reply');
    }
  });

  const handleChangeProfilePic = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Please grant camera roll access');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (!result.canceled && result.assets && result.assets.length > 0) {
      toast.info('Uploading photo...');
      const compressedUri = await compressForProfile(result.assets[0].uri);
      const url = await uploadImage(`provider-images/${service.id}.jpg`, compressedUri);
      if (url) {
        await updateServiceProvider(service.id, { image: url });
        service.image = url;
        toast.success('Profile photo updated');
      } else {
        toast.error('Failed to upload photo');
      }
    }
  };

  const handleFollowProvider = () => run(async () => {
    if (!user) {
      toast.error('Please log in to follow providers');
      return;
    }
    hapticLight();
    const nowFollowing = await toggleFollow(user.id, service.id, 'provider');
    setFollowing(nowFollowing);
    toast.success(nowFollowing ? `Now following ${service.name}` : `Unfollowed ${service.name}`);
  });

  const handleEndorse = (skillName) => run(async () => {
    if (!user) {
      toast.error('Please log in to endorse skills');
      return;
    }
    hapticMedium();
    setEndorsingSkill(skillName);
    const ok = await endorseSkill(service.id, skillName);
    setEndorsingSkill(null);
    if (ok) {
      setSkills((prev) => prev.map((s) => {
        const name = typeof s === 'string' ? s : s.name;
        if (name !== skillName) return s;
        return { name, endorsements: (typeof s === 'string' ? 0 : s.endorsements || 0) + 1 };
      }));
      hapticSuccess();
      toast.success(`Endorsed ${skillName}`);
    } else {
      toast.error('Failed to endorse skill');
    }
  });

  const handleReport = async () => {
    if (!reportReason.trim()) {
      toast.error('Please describe the issue');
      return;
    }    const report = {
      id: 'report_' + Date.now(),
      providerId: service.id,
      providerName: service.name,
      reporterId: user?.id,
      reporterName: user?.name || 'Guest',
      category: reportCategory,
      reason: reportReason.trim(),
      timestamp: new Date().toISOString(),
    };
    const result = await addReport(report);
    if (result === true || result?.success !== false) {
      hapticWarning();
      setShowReportModal(false);
      setReportReason('');
      setReportCategory('Other');
      toast.success('Report submitted. Admin will review it.');
    } else {
      toast.error(result?.error || 'Failed to submit report');
    }
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
                <Ionicons key={star} name={star <= item.rating ? 'star' : 'star-outline'} size={13} color={colors.warning} />
              ))}
            </View>
          </View>
        </View>
        <View style={styles.reviewRight}>
          <Text style={styles.reviewDate}>{new Date(item.date).toLocaleDateString()}</Text>
          {isAdmin && (
            <TouchableOpacity onPress={() => handleDeleteReview(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="trash-outline" size={16} color={colors.danger} />
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
      {isOwner && !item.reply && (
        replyingTo === item.id ? (
          <View style={{ marginTop: 8 }}>
            <TextInput
              style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, padding: 10, fontSize: 14, color: colors.text, backgroundColor: colors.inputBg, minHeight: 60 }}
              placeholder="Write a reply..."
              placeholderTextColor={colors.textMuted}
              value={replyText}
              onChangeText={setReplyText}
              multiline
              maxLength={500}
            />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, backgroundColor: colors.primary }} onPress={() => handleReplyToReview(item.id)}>
                <Text style={{ color: '#fff', fontSize: 13, fontWeight: '600' }}>Reply</Text>
              </TouchableOpacity>
              <TouchableOpacity style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: colors.border }} onPress={() => { setReplyingTo(null); setReplyText(''); }}>
                <Text style={{ color: colors.textMuted, fontSize: 13 }}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity style={{ marginTop: 6, flexDirection: 'row', alignItems: 'center', gap: 4 }} onPress={() => setReplyingTo(item.id)}>
            <Ionicons name="chatbubble-outline" size={14} color={colors.primary} />
            <Text style={{ fontSize: 13, color: colors.primary, fontWeight: '500' }}>Reply</Text>
          </TouchableOpacity>
        )
      )}
    </View>
  );

  if (pageLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <ServiceDetailSkeleton />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
      <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />}>
        <View style={styles.imageContainer}>
          <Image source={{ uri: service.image }} style={styles.image} />
          <View style={styles.imageOverlay} pointerEvents="none" />
          <TouchableOpacity style={styles.backBtn} onPress={() => navigation.goBack()} accessibilityLabel="Go back" accessibilityRole="button">
            <Ionicons name="arrow-back" size={22} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.favBtn} onPress={handleFavorite} accessibilityLabel={fav ? "Remove from favorites" : "Add to favorites"} accessibilityRole="button" accessibilityState={{ selected: fav }}>
            <Ionicons name={fav ? 'heart' : 'heart-outline'} size={24} color={fav ? colors.danger : '#fff'} />
          </TouchableOpacity>
        </View>

        {/* Profile Picture */}
        <View style={styles.profileSection}>
          <TouchableOpacity
            style={styles.profilePicWrapper}
            activeOpacity={0.8}
            onPress={() => {
              if (isAdmin || isOwner) {
                Alert.alert('Profile Photo', 'Choose an option', [
                  { text: 'View Full Picture', onPress: () => setShowFullImage(true) },
                  { text: 'Change Photo', onPress: handleChangeProfilePic },
                  { text: 'Cancel', style: 'cancel' },
                ]);
              } else {
                setShowFullImage(true);
              }
            }}
            accessibilityLabel={isAdmin || isOwner ? "View or change profile photo" : "View profile photo"}
            accessibilityRole="button"
          >
            <Image source={{ uri: service.image }} style={styles.profilePic} />
            {(isAdmin || isOwner) && (
              <View style={styles.profilePicOverlay} pointerEvents="none">
                <Ionicons name="camera" size={16} color="#fff" />
              </View>
            )}
          </TouchableOpacity>
          {(isAdmin || isOwner) ? (
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
              <TouchableOpacity
                style={[styles.followBtn, following && styles.followBtnActive]}
                onPress={handleFollowProvider}
                activeOpacity={0.7}
                accessibilityLabel={following ? 'Unfollow provider' : 'Follow provider'}
                accessibilityRole="button"
                accessibilityState={{ selected: following }}
              >
                <Ionicons
                  name={following ? 'checkmark' : 'add'}
                  size={16}
                  color={following ? colors.primary : '#fff'}
                />
                <Text style={[styles.followBtnText, following && styles.followBtnTextActive]}>
                  {following ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.headline}>
              {service.headline || `${service.category} professional in Nampundwe`}
            </Text>
            <View style={styles.metaRow}>
              <View style={styles.ratingBadge}>
                <Ionicons name="star" size={14} color={colors.warning} />
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
                  <Ionicons name="checkmark-circle" size={14} color={colors.success} />
                  <Text style={styles.verifiedText}>Verified</Text>
                </View>
              )}
              {service.licensed && (
                <View style={styles.licensedBadge}>
                  <Ionicons name="ribbon" size={14} color={colors.info} />
                  <Text style={styles.licensedText}>Licensed</Text>
                </View>
              )}
            </View>
            {followers > 0 && (
              <View style={styles.followersRow}>
                <Ionicons name="people" size={13} color={colors.textMuted} />
                <Text style={styles.followersText}>{followers} followers</Text>
              </View>
            )}
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>About</Text>
            <Text style={styles.description}>{service.description}</Text>
          </View>

          {/* Services */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Services Offered</Text>
            <View style={styles.servicesGrid}>
              {service.services.map((s, index) => (
                <View key={index} style={styles.serviceChip}>
                  <Ionicons name="checkmark-circle" size={16} color={colors.success} />
                  <Text style={styles.serviceText}>{s}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Skills & Endorsements */}
          {skills.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Skills & Endorsements</Text>
              <View style={styles.skillsList}>
                {skills.map((skill, index) => {
                  const skillName = typeof skill === 'string' ? skill : skill.name;
                  const endorsements = typeof skill === 'string' ? 0 : skill.endorsements || 0;
                  return (
                    <View key={index} style={styles.skillRow}>
                      <View style={styles.skillInfo}>
                        <Text style={styles.skillName}>{skillName}</Text>
                        <Text style={styles.skillEndorsements}>
                          {endorsements > 0 ? `${endorsements} endorsement${endorsements > 1 ? 's' : ''}` : 'Be the first to endorse'}
                        </Text>
                      </View>
                      <TouchableOpacity
                        style={[
                          styles.endorseBtn,
                          endorsingSkill === skillName && styles.endorseBtnActive,
                        ]}
                        onPress={() => handleEndorse(skillName)}
                        activeOpacity={0.7}
                        accessibilityLabel={`Endorse ${skillName}`}
                        accessibilityRole="button"
                      >
                        {endorsingSkill === skillName ? (
                          <ActivityIndicator size="small" color={colors.primary} />
                        ) : (
                          <>
                            <Ionicons name="thumbs-up-outline" size={14} color={colors.primary} />
                            <Text style={styles.endorseBtnText}>Endorse</Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Availability */}
          {availability && availability.days && availability.days.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Availability</Text>
              <View style={{ backgroundColor: colors.card, borderRadius: 12, padding: 14, elevation: 1 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {availability.days.map((day) => (
                    <View key={day} style={{ backgroundColor: colors.successLight, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, color: colors.success, fontWeight: '600' }}>{day}</Text>
                    </View>
                  ))}
                </View>
                {availability.startTime && availability.endTime && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="schedule" size={16} color={colors.textMuted} />
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
                <View style={[styles.contactIcon, { backgroundColor: colors.successLight }]}>
                  <Ionicons name="phone" size={18} color={colors.success} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Phone</Text>
                  <Text style={styles.contactValue}>{service.phone}</Text>
                </View>
                <Ionicons name="chevron-right" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <View style={styles.contactRow}>
                <View style={[styles.contactIcon, { backgroundColor: colors.infoLight }]}>
                  <Ionicons name="location-on" size={18} color={colors.info} />
                </View>
                <View style={styles.contactInfo}>
                  <Text style={styles.contactLabel}>Address</Text>
                  <Text style={styles.contactValue}>{service.address}</Text>
                </View>
              </View>

              <View style={[styles.contactRow, { borderBottomWidth: 0 }]}>
                <View style={[styles.contactIcon, { backgroundColor: colors.warningLight }]}>
                  <Ionicons name="schedule" size={18} color={colors.warning} />
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
            <TouchableOpacity style={[styles.actionCard, { backgroundColor: colors.successLight }]} onPress={openPhone} activeOpacity={0.7} accessibilityLabel="Call provider" accessibilityRole="button">
              <Ionicons name="phone" size={24} color={colors.success} />
              <Text style={[styles.actionLabel, { color: colors.success }]}>Call Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.infoLight }]}
              activeOpacity={0.7}
              onPress={() => navigation.navigate('Chat', { businessId: service.id, businessName: service.name, receiverId: service.ownerId, receiverName: service.name, conversationType: 'business' })}
              accessibilityLabel="Message provider"
              accessibilityRole="button"
            >
              <Ionicons name="chatbubbles" size={24} color={colors.info} />
              <Text style={[styles.actionLabel, { color: colors.info }]}>Message</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: colors.purpleLight }]}
              activeOpacity={0.7}
              onPress={() => setShowReviewModal(true)}
              accessibilityLabel="Write a review"
              accessibilityRole="button"
            >
              <Ionicons name="star" size={24} color={colors.purple} />
              <Text style={[styles.actionLabel, { color: colors.purple }]}>Review</Text>
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
            <Ionicons name="arrow-forward-outline" size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>

          {/* Share */}
          <TouchableOpacity
            style={styles.shareButton}
            activeOpacity={0.8}
            onPress={() => { hapticLight(); setShowShareMenu(true); }}
            accessibilityLabel="Share provider"
            accessibilityRole="button"
          >
            <Ionicons name="share" size={20} color={colors.primary} />
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
              <Ionicons name="flag" size={18} color={colors.warning} />
              <Text style={styles.reportButtonText}>Report Provider</Text>
            </TouchableOpacity>
          )}

          {/* Provider Edit */}
          {isOwner && (
            <TouchableOpacity
              style={styles.providerEditButton}
              activeOpacity={0.8}
              onPress={() => setShowEditModal(true)}
              accessibilityLabel="Edit business"
              accessibilityRole="button"
            >
              <Ionicons name="pencil" size={18} color="#fff" />
              <Text style={styles.providerEditText}>Edit Business</Text>
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
              <Ionicons name="trash" size={18} color={colors.danger} />
              <Text style={styles.adminDeleteText}>Delete Business</Text>
            </TouchableOpacity>
          )}

          {/* Reviews */}
          <View style={styles.section}>
            <View style={styles.reviewsSectionHeader}>
              <Text style={styles.sectionTitle}>Reviews {reviews.length > 0 ? `(${reviews.length})` : ''}</Text>
            </View>
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <View key={review.id}>
                  {renderReview({ item: review })}
                </View>
              ))
            ) : (
              <View style={styles.emptyReviewsContainer}>
                <Ionicons name="chatbubble-ellipses-outline" size={48} color={colors.textMuted} />
                <Text style={styles.emptyReviewsTitle}>No reviews yet</Text>
                <Text style={styles.emptyReviewsText}>Be the first to review this provider</Text>
                <TouchableOpacity
                  style={[styles.writeReviewButton, { backgroundColor: colors.primary }]}
                  onPress={() => setShowReviewModal(true)}
                  accessibilityLabel="Write a review"
                  accessibilityRole="button"
                >
                  <Ionicons name="pencil" size={16} color="#fff" />
                  <Text style={styles.writeReviewButtonText}>Write a Review</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Share Modal */}
      <Modal visible={showShareMenu} transparent animationType="slide" onRequestClose={() => setShowShareMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowShareMenu(false)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Share via</Text>

            <TouchableOpacity style={styles.shareOption} onPress={shareViaWhatsApp} accessibilityLabel="Share via WhatsApp" accessibilityRole="button">
              <View style={[styles.shareIcon, { backgroundColor: colors.successLight }]}>
                <Ionicons name="chat" size={24} color={colors.success} />
              </View>
              <Text style={styles.shareOptionText}>WhatsApp</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={shareViaSMS} accessibilityLabel="Share via SMS" accessibilityRole="button">
              <View style={[styles.shareIcon, { backgroundColor: colors.infoLight }]}>
                <Ionicons name="chat" size={24} color={colors.info} />
              </View>
              <Text style={styles.shareOptionText}>SMS</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.shareOption} onPress={shareGeneric} accessibilityLabel="Share via more options" accessibilityRole="button">
              <View style={[styles.shareIcon, { backgroundColor: colors.warningLight }]}>
                <Ionicons name="share" size={24} color={colors.warning} />
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
                  <Ionicons name={star <= reviewRating ? 'star' : 'star-outline'} size={36} color={colors.warning} />
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
              maxLength={1000}
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
              maxLength={500}
              accessibilityLabel="Report reason"
            />
            <View style={styles.reviewModalButtons}>
              <TouchableOpacity style={styles.cancelReviewButton} onPress={() => setShowReportModal(false)} accessibilityLabel="Cancel report" accessibilityRole="button">
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.submitReviewButton, { backgroundColor: colors.warning }]} onPress={handleReport} accessibilityLabel="Submit report" accessibilityRole="button">
                <Text style={styles.submitReviewText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Edit Business Modal */}
      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowEditModal(false)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Edit Business</Text>

            <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Business Name</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg }} value={editName} onChangeText={setEditName} maxLength={50} />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Description</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg, minHeight: 80 }} value={editDescription} onChangeText={setEditDescription} multiline maxLength={300} />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Phone</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg }} value={editPhone} onChangeText={setEditPhone} keyboardType="phone-pad" maxLength={20} />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Address</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg }} value={editAddress} onChangeText={setEditAddress} maxLength={100} />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Hours</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg }} value={editHours} onChangeText={setEditHours} maxLength={50} />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Services (comma separated)</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg }} value={editServices} onChangeText={setEditServices} maxLength={200} />
              </View>
              <View style={{ marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textSecondary, marginBottom: 6 }}>Skills (comma separated)</Text>
                <TextInput style={{ borderWidth: 1.5, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: colors.text, backgroundColor: colors.inputBg }} value={editSkills} onChangeText={setEditSkills} maxLength={300} />
              </View>
            </ScrollView>

            <View style={styles.reviewModalButtons}>
              <TouchableOpacity style={styles.cancelReviewButton} onPress={() => setShowEditModal(false)}>
                <Text style={styles.cancelReviewText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.submitReviewButton} onPress={handleSaveEdit}>
                <Text style={styles.submitReviewText}>Save Changes</Text>
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

const getStyles = (colors) => createStyleSheet({
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
  headline: {
    fontSize: 15,
    color: colors.textSecondary,
    marginTop: 4,
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followBtnText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  followBtnTextActive: {
    color: colors.primary,
  },
  followersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  followersText: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '500',
  },
  skillsList: {
    gap: 8,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    gap: 10,
  },
  skillInfo: {
    flex: 1,
  },
  skillName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  skillEndorsements: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  endorseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
    minWidth: 90,
    justifyContent: 'center',
  },
  endorseBtnActive: {
    opacity: 0.6,
  },
  endorseBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
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
    backgroundColor: colors.warningLight,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  rating: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.warning,
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
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 18,
    borderRadius: 14,
    marginBottom: 10,
    gap: 10,
    shadowColor: colors.primary,
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
  providerEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.success,
    marginBottom: 10,
    gap: 8,
  },
  providerEditText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  adminDeleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.dangerLight,
    marginBottom: 10,
    gap: 8,
  },
  adminDeleteText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.danger,
  },
  // Reviews
  reviewsSectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyReviewsContainer: {
    alignItems: 'center',
    paddingVertical: 32,
    paddingHorizontal: 16,
  },
  emptyReviewsTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 12,
    marginBottom: 6,
  },
  emptyReviewsText: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  writeReviewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
  },
  writeReviewButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
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
    backgroundColor: colors.successLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  verifiedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.success,
  },
  licensedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.infoLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 3,
  },
  licensedText: {
    fontSize: 11,
    fontWeight: '600',
    color: colors.info,
  },
  reportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.warningLight,
    marginBottom: 10,
    gap: 8,
    backgroundColor: colors.warningLight,
  },
  reportButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.warning,
  },
  reportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
  },
  reportChipActive: {
    backgroundColor: colors.warning,
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
