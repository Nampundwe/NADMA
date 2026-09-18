import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StatusBar,
  ActivityIndicator,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getCurrentUser,
  getUserById,
  onUserSnapshot,
  onFollowersSnapshot,
  getFollowingCount,
  getUserPostsCount,
  isFollowing,
  toggleFollow,
  endorseUserSkill,
  onUserStatusSnapshot,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { createStyleSheet } from '../utils/responsive';

const AVATAR_COLORS = [
  '#1a237e',
  '#4CAF50',
  '#FF9800',
  '#E91E63',
  '#9C27B0',
  '#00BCD4',
  '#795548',
  '#F44336',
];

function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}

function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getRoleBadge(role, colors) {
  switch (role) {
    case 'admin':
      return { label: 'Admin', color: colors.danger, icon: 'verified-user' };
    case 'provider':
      return { label: 'Provider', color: colors.primary, icon: 'business' };
    default:
      return { label: 'Member', color: colors.info, icon: 'person' };
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
}

export default function PublicProfileScreen({ route, navigation }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { run } = useNetworkAction();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const { userId, userName } = route.params || {};

  const [profile, setProfile] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [followers, setFollowers] = useState(0);
  const [following, setFollowing] = useState(0);
  const [postsCount, setPostsCount] = useState(0);
  const [followingState, setFollowingState] = useState(false);
  const [online, setOnline] = useState(false);

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  useEffect(() => {
    getCurrentUser().then(setCurrentUser);
  }, []);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    getUserById(userId).then((u) => {
      setProfile(u);
      setLoading(false);
    });
    const unsubProfile = onUserSnapshot(userId, (u) => {
      if (u) setProfile(u);
    });
    const unsubFollowers = onFollowersSnapshot(userId, (count) => setFollowers(count));
    const unsubStatus = onUserStatusSnapshot(userId, (status) => {
      const lastSeenTime = status?.lastSeen ? new Date(status.lastSeen).getTime() : 0;
      setOnline(status?.isOnline === true && (Date.now() - lastSeenTime) < 120000);
    });
    getFollowingCount(userId).then(setFollowing);
    getUserPostsCount(userId).then(setPostsCount);
    let cancelled = false;
    (async () => {
      const me = await getCurrentUser();
      if (cancelled || !me || me.id === userId) return;
      const follows = await isFollowing(me.id, userId);
      if (!cancelled) setFollowingState(follows);
    })();
    return () => {
      cancelled = true;
      unsubProfile();
      unsubFollowers();
      unsubStatus();
    };
  }, [userId]);

  const handleFollow = () => run(async () => {
    if (!currentUser) {
      toast.error('Please log in to follow others');
      return;
    }
    if (isOwnProfile) return;
    hapticLight();
    const nowFollowing = await toggleFollow(currentUser.id, profile.id, 'user', currentUser.name);
    setFollowingState(nowFollowing);
    toast.success(nowFollowing ? 'Now following' : 'Unfollowed');
  });

  const handleEndorse = (skillName) => run(async () => {
    if (!currentUser) {
      toast.error('Please log in to endorse skills');
      return;
    }
    if (isOwnProfile) return;
    const skill = profile.skills?.find((s) => (typeof s === 'string' ? s === skillName : s.name === skillName));
    const alreadyEndorsed = skill?.endorsers?.includes(currentUser.name);
    hapticLight();
    const ok = await endorseUserSkill(profile.id, skillName, currentUser.name);
    if (ok) {
      toast.success(alreadyEndorsed ? 'Endorsement removed' : 'Endorsement added');
    }
  });

  const handleMessage = () => {
    if (!currentUser) {
      toast.error('Please log in to send a message');
      return;
    }
    hapticLight();
    navigation.navigate('Chat', {
      receiverId: profile.id,
      receiverName: profile.name,
      conversationType: 'user',
    });
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!profile) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <View style={[styles.center, styles.notFound]}>
          <View style={styles.notFoundIcon}>
            <Ionicons name="person-remove-outline" size={44} color={colors.textMuted} />
          </View>
          <Text style={styles.notFoundTitle}>Profile Not Found</Text>
          <Text style={styles.notFoundText}>This user may no longer be available.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const roleBadge = getRoleBadge(profile.role, colors);
  const skills = Array.isArray(profile.skills) ? profile.skills : [];
  const experience = Array.isArray(profile.experience) ? profile.experience : [];
  const education = Array.isArray(profile.education) ? profile.education : [];
  const qualifications = Array.isArray(profile.qualifications) ? profile.qualifications : [];

  const renderSectionHeader = (icon, title) => (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.headerBg} />
      <View style={[styles.navHeader, { backgroundColor: colors.headerBg }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
      </View>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.avatarRing}>
            {profile.profileImage ? (
              <Image source={{ uri: profile.profileImage }} style={styles.avatarImage} />
            ) : (
              <View style={[styles.avatarCircle, { backgroundColor: getAvatarColor(profile.name) }]}>
                <Text style={styles.avatarText}>{getInitials(profile.name)}</Text>
              </View>
            )}
            {online && (
              <View style={styles.onlineDot}>
                <View style={styles.onlineDotInner} />
              </View>
            )}
          </View>
          <Text style={styles.userName}>{profile.name}</Text>
          {profile.headline ? (
            <Text style={styles.userHeadline}>{profile.headline}</Text>
          ) : null}
          {profile.location ? (
            <View style={styles.locationRow}>
              <Ionicons name="location-on" size={13} color="rgba(255,255,255,0.7)" />
              <Text style={styles.locationText}>{profile.location}</Text>
            </View>
          ) : null}
          <View style={[styles.roleBadge, { backgroundColor: roleBadge.color }]}>
            <Ionicons name={roleBadge.icon} size={12} color="#fff" />
            <Text style={styles.roleBadgeText}>{roleBadge.label}</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.actionRow}>
          {isOwnProfile ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.editBtn]}
              activeOpacity={0.85}
              onPress={() => navigation.navigate('EditProfile')}
              accessibilityLabel="Edit professional profile"
              accessibilityRole="button"
            >
              <Ionicons name="pencil" size={16} color="#fff" />
              <Text style={styles.editBtnText}>Edit Profile</Text>
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, followingState ? styles.followingBtn : styles.followBtn]}
                activeOpacity={0.85}
                onPress={handleFollow}
                accessibilityLabel={followingState ? 'Unfollow' : 'Follow'}
                accessibilityRole="button"
              >
                <Ionicons
                  name={followingState ? 'checkmark' : 'person-add-outline'}
                  size={16}
                  color={followingState ? colors.primary : '#fff'}
                />
                <Text style={[styles.actionBtnText, followingState && { color: colors.primary }]}>
                  {followingState ? 'Following' : 'Follow'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.messageBtn]}
                activeOpacity={0.85}
                onPress={handleMessage}
                accessibilityLabel="Send message"
                accessibilityRole="button"
              >
                <Ionicons name="chatbubble-outline" size={16} color="#fff" />
                <Text style={styles.actionBtnText}>Message</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{followers}</Text>
            <Text style={styles.statLabel}>Followers</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{following}</Text>
            <Text style={styles.statLabel}>Following</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{postsCount}</Text>
            <Text style={styles.statLabel}>Posts</Text>
          </View>
        </View>

        {/* About */}
        {profile.about ? (
          <View style={styles.section}>
            {renderSectionHeader('information-circle-outline', 'About')}
            <Text style={styles.bodyText}>{profile.about}</Text>
          </View>
        ) : null}

        {/* Skills */}
        {skills.length > 0 ? (
          <View style={styles.section}>
            {renderSectionHeader('ribbon-outline', 'Skills & Endorsements')}
            {skills.map((skill, i) => {
              const name = typeof skill === 'string' ? skill : skill.name;
              const count = typeof skill === 'string' ? 0 : skill.endorsements || 0;
              const endorsers = typeof skill === 'string' ? [] : Array.isArray(skill.endorsers) ? skill.endorsers : [];
              const alreadyEndorsed = !isOwnProfile && endorsers.includes(currentUser?.name);
              return (
                <View key={`${name}_${i}`} style={styles.skillRow}>
                  <View style={styles.skillInfo}>
                    <View style={styles.skillNameRow}>
                      <Text style={styles.skillName}>{name}</Text>
                      {count > 0 ? (
                        <View style={styles.endorseBadge}>
                          <Ionicons name="thumbs-up" size={10} color="#fff" />
                          <Text style={styles.endorseBadgeText}>{count}</Text>
                        </View>
                      ) : null}
                    </View>
                    {endorsers.length > 0 ? (
                      <Text style={styles.endorserText} numberOfLines={1}>
                        Endorsed by {endorsers.slice(0, 3).join(', ')}
                        {endorsers.length > 3 ? ` +${endorsers.length - 3} more` : ''}
                      </Text>
                    ) : null}
                  </View>
                  {!isOwnProfile ? (
                    <TouchableOpacity
                      style={[
                        styles.endorseBtn,
                        alreadyEndorsed && { backgroundColor: colors.primaryLight },
                      ]}
                      activeOpacity={0.8}
                      onPress={() => handleEndorse(name)}
                      accessibilityLabel={`Endorse ${name}`}
                      accessibilityRole="button"
                    >
                      <Ionicons
                        name="thumbs-up"
                        size={13}
                        color={alreadyEndorsed ? '#fff' : colors.primary}
                      />
                      <Text
                        style={[
                          styles.endorseBtnText,
                          alreadyEndorsed && { color: '#fff' },
                        ]}
                      >
                        {alreadyEndorsed ? 'Endorsed' : 'Endorse'}
                      </Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {/* Experience */}
        {experience.length > 0 ? (
          <View style={styles.section}>
            {renderSectionHeader('briefcase-outline', 'Experience')}
            {experience.map((item, i) => (
              <View key={item.id || `${i}`} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{item.title || item.position}</Text>
                  {item.company ? (
                    <Text style={styles.timelineSubtitle}>{item.company}</Text>
                  ) : null}
                  {item.period ? (
                    <View style={styles.periodRow}>
                      <Ionicons name="calendar" size={12} color={colors.textMuted} />
                      <Text style={styles.periodText}>{item.period}</Text>
                    </View>
                  ) : null}
                  {item.description ? (
                    <Text style={styles.bodyText}>{item.description}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Education */}
        {education.length > 0 ? (
          <View style={styles.section}>
            {renderSectionHeader('school-outline', 'Education')}
            {education.map((item, i) => (
              <View key={item.id || `${i}`} style={styles.timelineItem}>
                <View style={styles.timelineDot} />
                <View style={styles.timelineContent}>
                  <Text style={styles.timelineTitle}>{item.school || item.institution}</Text>
                  {item.degree ? (
                    <Text style={styles.timelineSubtitle}>{item.degree}</Text>
                  ) : null}
                  {item.period ? (
                    <View style={styles.periodRow}>
                      <Ionicons name="calendar" size={12} color={colors.textMuted} />
                      <Text style={styles.periodText}>{item.period}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Qualifications / Certifications */}
        {qualifications.length > 0 ? (
          <View style={styles.section}>
            {renderSectionHeader('medal-outline', 'Qualifications & Certifications')}
            {qualifications.map((item, i) => (
              <View key={item.id || `${i}`} style={styles.qualificationCard}>
                <View style={styles.qualificationIcon}>
                  <Ionicons name="medal" size={18} color={colors.warning} />
                </View>
                <View style={styles.qualificationInfo}>
                  <Text style={styles.timelineTitle}>{item.title}</Text>
                  {item.issuer ? (
                    <Text style={styles.timelineSubtitle}>{item.issuer}</Text>
                  ) : null}
                  {item.year ? (
                    <Text style={styles.periodText}>{item.year}</Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Member since */}
        <View style={styles.footerRow}>
          <Ionicons name="calendar" size={13} color={colors.textMuted} />
          <Text style={styles.footerText}>
            Member since {formatDate(profile.createdAt)}
          </Text>
        </View>
        <View style={{ height: 24 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (colors) => createStyleSheet({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: colors.headerBg,
    paddingTop: 28,
    paddingBottom: 24,
    alignItems: 'center',
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
  },
  avatarRing: {
    width: 108,
    height: 108,
    borderRadius: 54,
    backgroundColor: 'rgba(255,255,255,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  avatarCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#fff',
  },
  onlineDot: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.headerBg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  onlineDotInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.success,
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  userHeadline: {
    fontSize: 15,
    color: colors.textMuted,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 24,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 6,
  },
  locationText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.7)',
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
    marginTop: 12,
  },
  roleBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    paddingHorizontal: 16,
    marginTop: 14,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  followBtn: {
    backgroundColor: colors.primary,
  },
  followingBtn: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: colors.primary,
  },
  messageBtn: {
    backgroundColor: colors.primaryLight,
  },
  editBtn: {
    backgroundColor: colors.primary,
  },
  actionBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    margin: 16,
    marginBottom: 0,
    borderRadius: 16,
    paddingVertical: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.borderLight,
  },
  statNumber: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  section: {
    margin: 16,
    marginBottom: 0,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
  },
  bodyText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
  },
  skillRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    gap: 10,
  },
  skillInfo: {
    flex: 1,
  },
  skillNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  skillName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  skillChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  skillChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  endorseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    gap: 3,
  },
  endorseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  endorseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 4,
  },
  endorseBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.primary,
  },
  endorserText: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
    marginTop: 5,
    marginRight: 12,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  timelineSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  periodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
    marginBottom: 6,
  },
  periodText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  qualificationCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 12,
  },
  qualificationIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
  },
  qualificationInfo: {
    flex: 1,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 16,
  },
  footerText: {
    fontSize: 13,
    color: colors.textMuted,
  },
  notFound: {
    padding: 24,
  },
  notFoundIcon: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  notFoundText: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});
