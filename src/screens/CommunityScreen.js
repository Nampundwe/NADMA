import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  TextInput,
  Modal,
  Alert,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Animated,
  LayoutAnimation,
  UIManager,
  Image,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { compressForPost } from '../utils/imageCompression';
import {
  addCommunityPost,
  deleteCommunityPost,
  togglePostLike,
  togglePostReaction,
  addPostComment,
  deleteComment,
  toggleCommentLike,
  savePost,
  unsavePost,
  getCurrentUser,
  onPostsSnapshot,
  uploadCommunityImage,
  toggleFollow,
  onUserFollowsSnapshot,
  addReport,
  REACTIONS,
  REACTION_LABELS,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { CommunitySkeleton } from '../components/Skeleton';
import EmptyState from '../components/EmptyState';
import SwipeablePostCard from '../components/SwipeablePostCard';
import { createStyleSheet } from '../utils/responsive';

const POST_CATEGORIES = [
  'All',
  'News',
  'General',
  'Plumbing',
  'Electrical',
  'Carpentry',
  'Painting',
  'Cleaning',
  'Gardening',
  'Tip',
  'Question',
];

const CATEGORY_COLORS = {
  All: '#6B7280',
  News: '#D32F2F',
  General: '#6B7280',
  Plumbing: '#2196F3',
  Electrical: '#FF9800',
  Carpentry: '#795548',
  Painting: '#9C27B0',
  Cleaning: '#4CAF50',
  Gardening: '#8BC34A',
  Tip: '#1a237e',
  Question: '#E91E63',
};

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
  const charCode = name.charCodeAt(0);
  return AVATAR_COLORS[charCode % AVATAR_COLORS.length];
}

const sanitize = (text) => text.replace(/<[^>]*>/g, '').trim();

function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

function getTimeAgo(timestamp) {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);
  const diffWeek = Math.floor(diffDay / 7);
  const diffMonth = Math.floor(diffDay / 30);

  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  if (diffWeek < 4) return `${diffWeek}w ago`;
  return `${diffMonth}mo ago`;
}

export default function CommunityScreen({ navigation }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { run } = useNetworkAction();
  const styles = React.useMemo(() => getStyles(colors), [colors]);
  const [posts, setPosts] = useState([]);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [commentsModalVisible, setCommentsModalVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newCategory, setNewCategory] = useState('General');
  const [newComment, setNewComment] = useState('');
  const [posting, setPosting] = useState(false);
  const [commenting, setCommenting] = useState(false);
  const [categoryPickerVisible, setCategoryPickerVisible] = useState(false);
  const [filterCategory, setFilterCategory] = useState('All');
  const [refreshing, setRefreshing] = useState(false);
  const [postComments, setPostComments] = useState([]);
  const [selectedImage, setSelectedImage] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [followingIds, setFollowingIds] = useState(new Set());
  const [failedImages, setFailedImages] = useState(new Set());
  const [reactionPickerPost, setReactionPickerPost] = useState(null);
  const [savedPostIds, setSavedPostIds] = useState(new Set());
  const [postOptionsMenu, setPostOptionsMenu] = useState(null);
  const [reportModalPost, setReportModalPost] = useState(null);
  const [reportCategory, setReportCategory] = useState('Other');
  const [reportReason, setReportReason] = useState('');
  const emptyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(emptyOpacity, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, []);

  const animateList = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      toast.error('Camera roll access needed to add photos');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      const compressedUri = await compressForPost(result.assets[0].uri);
      setSelectedImage(compressedUri);
    }
  };

  useEffect(() => {
    const unsubscribe = onPostsSnapshot((allPosts) => {
      setPosts(
        allPosts.sort(
          (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
        )
      );
      setLoading(false);
    });
    getCurrentUser().then((currentUser) => {
      setUser(currentUser);
      const followsUnsub = onUserFollowsSnapshot(currentUser?.id, (ids) => {
        setFollowingIds(new Set(ids));
      });
      followsUnsubRef.current = followsUnsub;
    });
    return () => {
      unsubscribe();
      if (commentsUnsubRef.current) commentsUnsubRef.current();
      if (followsUnsubRef.current) followsUnsubRef.current();
    };
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    setRefreshing(false);
  };

  const handleCreatePost = () => run(async () => {
    if (!newDescription.trim()) {
      toast.error('Please enter a description');
      return;
    }
    if (!user) {
      toast.error('Please log in to create a post');
      return;
    }
    if (newCategory === 'News' && user.role !== 'admin') {
      toast.error('Only admins can post News');
      return;
    }

    const postId = 'post_' + Date.now();
    let imageUrl = null;
    if (selectedImage) {
      imageUrl = await uploadCommunityImage(postId, selectedImage);
      if (!imageUrl) {
        toast.error('Photo upload failed — posting without the photo');
      }
    }
    const post = {
      id: postId,
      userId: user.id,
      userName: user.name,
      userHeadline: user.headline || '',
      userProfileImage: user.profileImage || null,
      userRole: user.role,
      title: newTitle.trim() || newDescription.trim().substring(0, 60),
      description: sanitize(newDescription),
      category: newCategory,
      imageUrl,
      likes: [],
      commentCount: 0,
      createdAt: new Date().toISOString(),
    };
    const result = await addCommunityPost(post);
    if (result === true || result?.success !== false) {
      hapticSuccess();
      setNewTitle('');
      setNewDescription('');
      setNewCategory('General');
      setSelectedImage(null);
      setCreateModalVisible(false);
      toast.success('Post created!');
    } else {
      toast.error(result?.error || 'Failed to create post');
    }
  });

  const handleDeletePost = (post) => {
    Alert.alert(
      'Delete Post',
      `Are you sure you want to delete "${post.title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            hapticWarning();
            animateList();
            await deleteCommunityPost(post.id);
          },
        },
      ]
    );
  };

  const handleLike = (postId) => run(async () => {
    if (!user) {
      toast.error('Please log in to like posts');
      return;
    }
    hapticLight();
    await togglePostLike(postId, user.id, user.name);
  });

  const handleReaction = (postId, reaction) => run(async () => {
    if (!user) {
      toast.error('Please log in');
      return;
    }
    hapticLight();
    await togglePostReaction(postId, user.id, user.name, reaction);
    setReactionPickerPost(null);
  });

  const handleSavePost = (postId) => run(async () => {
    if (!user) return;
    hapticLight();
    if (savedPostIds.has(postId)) {
      await unsavePost(user.id, postId);
      setSavedPostIds((prev) => { const s = new Set(prev); s.delete(postId); return s; });
      toast.success('Removed from saved');
    } else {
      await savePost(user.id, postId);
      setSavedPostIds((prev) => new Set(prev).add(postId));
      toast.success('Saved');
    }
  });

  const handleDeleteCommentItem = (postId, commentId) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteComment(postId, commentId);
          hapticSuccess();
        },
      },
    ]);
  };

  const handleCommentLike = (postId, commentId) => run(async () => {
    if (!user) return;
    hapticLight();
    await toggleCommentLike(postId, commentId, user.id);
  });

  const handleFollow = (targetId) => run(async () => {
    if (!user) {
      toast.error('Please log in to follow others');
      return;
    }
    if (targetId === user.id) return;
    hapticLight();
    const nowFollowing = await toggleFollow(user.id, targetId, 'user', user.name);
    toast.success(nowFollowing ? 'Now following' : 'Unfollowed');
  });

  const openProfile = (targetId, targetName) => {
    if (!targetId) return;
    hapticLight();
    navigation.navigate('PublicProfile', { userId: targetId, userName: targetName });
  };

  const openMyProfile = () => {
    if (!user) {
      toast.error('Please log in');
      return;
    }
    hapticLight();
    navigation.navigate('PublicProfile', { userId: user.id, userName: user.name });
  };

  const handleRepost = (post) => {
    if (!user) {
      toast.error('Please log in to repost');
      return;
    }
    Alert.alert('Repost', `Share "${post.title}" with your network?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Repost',
        onPress: () => run(async () => {
          hapticLight();
          const postId = 'post_' + Date.now();
          const repost = {
            id: postId,
            userId: user.id,
            userName: user.name,
            userHeadline: user.headline || '',
            userRole: user.role,
            title: post.title,
            description: post.description,
            category: post.category,
            imageUrl: post.imageUrl,
            likes: [],
            commentCount: 0,
            reposted: true,
            originalPostId: post.id,
            originalAuthor: post.userName,
            originalAuthorId: post.userId,
            originalAuthorHeadline: post.userHeadline || '',
            originalCreatedAt: post.createdAt,
            createdAt: new Date().toISOString(),
          };
          await addCommunityPost(repost);
          hapticSuccess();
          toast.success('Reposted!');
        }),
      },
    ]);
  };

  const handleNativeShare = (post) => {
    Share.share({
      message: `${post.title}\n\n${post.description || ''}\n\nShared from Nadma Community by ${post.userName}`,
      title: 'Nadma Community',
    }).catch(() => {});
  };

  const handleReportPost = () => run(async () => {
    if (!reportReason.trim()) {
      toast.error('Please describe the issue');
      return;
    }
    const post = reportModalPost;
    const report = {
      id: 'rpt_post_' + Date.now(),
      type: 'post',
      postId: post.id,
      postTitle: post.title,
      postOwnerId: post.userId,
      postOwnerName: post.userName,
      reporterId: user?.id,
      reporterName: user?.name || 'Guest',
      category: reportCategory,
      reason: reportReason.trim(),
      timestamp: new Date().toISOString(),
    };
    const result = await addReport(report);
    if (result === true || result?.success !== false) {
      hapticWarning();
      setReportModalPost(null);
      setReportReason('');
      setReportCategory('Other');
      toast.success('Report submitted. Admin will review it.');
    } else {
      toast.error(result?.error || 'Failed to submit report');
    }
  });

  const handleAddComment = () => run(async () => {
    if (!newComment.trim()) return;
    if (!user) {
      toast.error('Please log in to comment');
      return;
    }

    const commentText = newComment.trim();
    setNewComment('');
    const comment = {
      userId: user.id,
      userName: user.name,
      userProfileImage: user.profileImage || null,
      text: commentText,
      createdAt: new Date().toISOString(),
    };
    const success = await addPostComment(selectedPost.id, comment);
    if (!success) {
      setNewComment(commentText);
      toast.error('Failed to add comment');
    } else {
      hapticMedium();
    }
  });

  const commentsUnsubRef = useRef(null);
  const followsUnsubRef = useRef(null);

  const openComments = (post) => {
    navigation.navigate('PostDetail', { postId: post.id });
  };

  const closeComments = () => {
    setCommentsModalVisible(false);
    if (commentsUnsubRef.current) {
      commentsUnsubRef.current();
      commentsUnsubRef.current = null;
    }
    setSelectedPost(null);
    setPostComments([]);
  };

  const filteredPosts = posts.filter((p) => {
    if (filterCategory === 'All') return true;
    return p.category === filterCategory;
  });

  const pinnedPosts = filterCategory === 'All'
    ? filteredPosts.filter((p) => p.category === 'News')
    : [];
  const regularPosts = filteredPosts.filter((p) => !pinnedPosts.includes(p));
  const displayPosts = [...pinnedPosts, ...regularPosts];

  const TAB_CATEGORIES = POST_CATEGORIES;

  const renderPost = ({ item }) => {
    const reactions = item.reactions || {};
    const myReaction = user ? reactions[user.id] : null;
    const reactionCounts = {};
    Object.values(reactions).forEach((r) => { reactionCounts[r] = (reactionCounts[r] || 0) + 1; });
    const totalReactions = Object.keys(reactions).length;
    const commentCount = item.commentCount || 0;
    const isAdmin = user && user.role === 'admin';
    const isOwner = user && item.userId === user.id;
    const isFollowing = user && followingIds.has(item.userId);
    const isSaved = user && savedPostIds.has(item.id);
    const categoryColor = CATEGORY_COLORS[item.category] || colors.textSecondary;
    const topReactions = Object.entries(reactionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);

    return (
      <SwipeablePostCard
        onSwipeRight={() => handleReaction(item.id, myReaction ? null : '👍')}
      >
      <View style={[styles.postCard, item.category === 'News' && styles.newsPostCard]}>
        {item.reposted && (
          <View style={styles.repostBanner}>
            <Ionicons name="repeat" size={14} color={colors.primary} />
            <Text style={styles.repostBannerText}>
              {isOwner ? 'You reposted this' : `${item.userName} reposted`}
            </Text>
          </View>
        )}

        <View style={styles.postHeader}>
          <View style={styles.postHeaderLeft}>
            <TouchableOpacity
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(item.userName) },
              ]}
              activeOpacity={0.7}
              onPress={() => openProfile(item.userId, item.userName)}
              accessibilityLabel={`View ${item.userName}'s profile`}
              accessibilityRole="button"
            >
              {item.userProfileImage ? (
                <Image source={{ uri: item.userProfileImage }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarText}>
                  {getInitials(item.userName)}
                </Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.postUserInfo}
              activeOpacity={0.7}
              onPress={() => openProfile(item.userId, item.userName)}
              accessibilityLabel={`View ${item.userName}'s profile`}
              accessibilityRole="button"
            >
              <View style={styles.postUserNameRow}>
                <Text style={styles.postUserName}>{item.userName}</Text>
                {item.userRole === 'admin' && (
                  <View style={styles.roleBadge}>
                    <Ionicons name="shield-checkmark" size={10} color="#fff" />
                    <Text style={styles.roleBadgeText}>ADMIN</Text>
                  </View>
                )}
                {item.category === 'News' && (
                  <View style={styles.adminBadge}>
                    <Ionicons name="megaphone" size={10} color="#fff" />
                    <Text style={styles.adminBadgeText}>NEWS</Text>
                  </View>
                )}
              </View>
              {item.userHeadline ? (
                <Text style={styles.postHeadline} numberOfLines={1}>{item.userHeadline}</Text>
              ) : null}
              <Text style={styles.postTime}>{getTimeAgo(item.createdAt)}</Text>
            </TouchableOpacity>
          </View>
          {user && item.userId !== user.id && (
            <TouchableOpacity
              style={[
                styles.followBtn,
                isFollowing && styles.followBtnActive,
              ]}
              onPress={() => handleFollow(item.userId)}
              activeOpacity={0.7}
              accessibilityLabel={isFollowing ? 'Unfollow' : 'Follow'}
              accessibilityRole="button"
            >
              <Ionicons
                name={isFollowing ? 'checkmark' : 'add'}
                size={14}
                color={isFollowing ? colors.primary : '#fff'}
              />
              <Text style={[styles.followBtnText, isFollowing && styles.followBtnTextActive]}>
                {isFollowing ? 'Following' : 'Follow'}
              </Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.moreBtn}
            onPress={() => setPostOptionsMenu(item)}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityLabel="More options"
            accessibilityRole="button"
          >
            <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {item.category && (
          <View style={[styles.categoryTag, { backgroundColor: categoryColor + '18' }]}>
            <Text style={[styles.categoryTagText, { color: categoryColor }]}>
              {item.category}
            </Text>
          </View>
        )}

        <TouchableOpacity activeOpacity={0.9} onPress={() => navigation.navigate('PostDetail', { postId: item.id })}>
          {item.title ? <Text style={styles.postTitle}>{item.title}</Text> : null}
          <Text style={styles.postDescription}>{item.description}</Text>

          {item.imageUrl && !failedImages.has(item.id) ? (
            <Image
              source={{ uri: item.imageUrl }}
              style={styles.postImage}
              resizeMode="contain"
              onError={() => setFailedImages((prev) => new Set(prev).add(item.id))}
            />
          ) : null}
        </TouchableOpacity>

        {(totalReactions > 0 || commentCount > 0) && (
          <View style={styles.postStatsRow}>
            {totalReactions > 0 ? (
              <View style={styles.postStatsLeft}>
                <View style={styles.reactionIcons}>
                  {topReactions.map(([emoji]) => (
                    <Text key={emoji} style={styles.reactionIconSmall}>{emoji}</Text>
                  ))}
                </View>
                <View style={styles.reactionBreakdown}>
                  {topReactions.map(([emoji, count]) => (
                    <Text key={emoji} style={styles.reactionCountText}>
                      {emoji} {count}
                    </Text>
                  ))}
                  {totalReactions > topReactions.reduce((sum, [, c]) => sum + c, 0) && (
                    <Text style={styles.reactionCountText}>
                      +{totalReactions - topReactions.reduce((sum, [, c]) => sum + c, 0)}
                    </Text>
                  )}
                </View>
              </View>
            ) : null}
            <Text style={styles.postStatsText}>
              {commentCount > 0 ? `${commentCount} comments` : 'No comments yet'}
            </Text>
          </View>
        )}

        <View style={styles.postActions}>
          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleReaction(item.id, '👍')}
            onLongPress={() => { hapticMedium(); setReactionPickerPost(item.id); }}
            delayLongPress={300}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18 }}>{myReaction || '👍'}</Text>
            <Text style={[styles.actionText, { color: myReaction ? colors.primary : colors.textMuted }]}>
              {myReaction ? REACTION_LABELS[REACTIONS.indexOf(myReaction)] || 'Like' : 'Like'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openComments(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleSavePost(item.id)}
            activeOpacity={0.7}
          >
            <Ionicons name={isSaved ? 'bookmark' : 'bookmark-outline'} size={20} color={isSaved ? colors.primary : colors.textMuted} />
            <Text style={[styles.actionText, { color: isSaved ? colors.primary : colors.textMuted }]}>
              {isSaved ? 'Saved' : 'Save'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleRepost(item)}
            activeOpacity={0.7}
          >
            <Ionicons name="repeat" size={20} color={colors.textMuted} />
            <Text style={styles.actionText}>Repost</Text>
          </TouchableOpacity>
        </View>

        {reactionPickerPost === item.id && (
          <View style={[styles.reactionPicker, { backgroundColor: colors.card }]}>
            {REACTIONS.map((emoji, i) => (
              <TouchableOpacity
                key={emoji}
                style={styles.reactionOption}
                onPress={() => handleReaction(item.id, emoji)}
              >
                <Text style={styles.reactionEmoji}>{emoji}</Text>
                <Text style={[styles.reactionLabel, { color: colors.textMuted }]}>{REACTION_LABELS[i]}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      </SwipeablePostCard>
    );
  };

  const renderEmpty = () => (
    <EmptyState
      icon="megaphone-outline"
      title="No posts yet"
      subtitle="Be the first to post!"
      buttonText="Create a Post"
      onPress={() => setCreateModalVisible(true)}
    />
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Community Board</Text>
        </View>
        <CommunitySkeleton />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={colors.statusBar} backgroundColor={colors.headerBg} />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Community Board</Text>
        <TouchableOpacity
          style={styles.addBtn}
          activeOpacity={0.8}
          onPress={() => setCreateModalVisible(true)}
          accessibilityLabel="Create new post"
          accessibilityRole="button"
        >
          <Ionicons name="add" size={26} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Filter Tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterTabs}
        contentContainerStyle={styles.filterTabsContent}
      >
        {TAB_CATEGORIES.map((cat) => {
          const isActive = filterCategory === cat;
          const color = CATEGORY_COLORS[cat] || colors.textSecondary;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.filterTab, isActive && { backgroundColor: color }]}
              onPress={() => { hapticLight(); setFilterCategory(cat); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.filterTabText, isActive && { color: '#fff' }]}>{cat}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <FlatList
        data={displayPosts}
        renderItem={renderPost}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[
          styles.postsList,
          displayPosts.length === 0 && styles.postsListEmpty,
        ]}
        ListHeaderComponent={user ? (
          <View style={styles.composerCard}>
            <TouchableOpacity
              style={[
                styles.composerAvatar,
                { backgroundColor: getAvatarColor(user.name) },
              ]}
              activeOpacity={0.7}
              onPress={openMyProfile}
              accessibilityLabel="View my profile"
              accessibilityRole="button"
            >
              {user.profileImage ? (
                <Image source={{ uri: user.profileImage }} style={{ width: 40, height: 40, borderRadius: 20 }} />
              ) : (
                <Text style={styles.composerAvatarText}>{getInitials(user.name)}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.composerInput}
              activeOpacity={0.6}
              onPress={() => setCreateModalVisible(true)}
              accessibilityLabel="Start a post"
              accessibilityRole="button"
            >
              <Text style={styles.composerPlaceholder}>
                {user.headline ? `Start a post${user.headline ? ' — share what you know' : ''}` : 'Start a post'}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.composerPhotoBtn}
              activeOpacity={0.6}
              onPress={() => { setCreateModalVisible(true); setTimeout(pickImage, 350); }}
              accessibilityLabel="Post a photo"
              accessibilityRole="button"
            >
              <Ionicons name="image" size={22} color={colors.primary} />
              <Text style={styles.composerPhotoText}>Photo</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        ListEmptyComponent={renderEmpty}
        showsVerticalScrollIndicator={false}
        refreshing={refreshing}
        onRefresh={onRefresh}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      />

      {/* Create Post Modal */}
      <Modal
        visible={createModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => { setCreateModalVisible(false); setSelectedImage(null); }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={() => setCreateModalVisible(false)}
                style={styles.modalCloseBtn}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <Text style={styles.modalTitle}>New Post</Text>
              <TouchableOpacity
                onPress={handleCreatePost}
                disabled={posting}
                style={styles.modalPostBtn}
              >
                {posting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.modalPostBtnText}>Post</Text>
                )}
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.modalBody}
              keyboardShouldPersistTaps="handled"
            >
              <TextInput
                style={styles.titleInput}
                placeholder="Title"
                placeholderTextColor={colors.textMuted}
                value={newTitle}
                onChangeText={setNewTitle}
                maxLength={120}
                accessibilityLabel="Post title"
              />

              <TextInput
                style={styles.descriptionInput}
                placeholder="What do you want to share with the community?"
                placeholderTextColor={colors.textMuted}
                value={newDescription}
                onChangeText={setNewDescription}
                multiline
                textAlignVertical="top"
                maxLength={2000}
                accessibilityLabel="Post description"
              />

              {selectedImage ? (
                <View style={styles.imagePreviewContainer}>
                  <Image source={{ uri: selectedImage }} style={styles.imagePreview} />
                  <TouchableOpacity
                    style={styles.removeImageBtn}
                    onPress={() => { setSelectedImage(null); }}
                    accessibilityLabel="Remove image"
                    accessibilityRole="button"
                  >
                    <Ionicons name="close-circle" size={24} color="#fff" />
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={styles.addImageButton}
                  activeOpacity={0.7}
                  onPress={pickImage}
                  accessibilityLabel="Add photo"
                  accessibilityRole="button"
                >
                  <Ionicons name="image" size={22} color={colors.primary} />
                  <Text style={[styles.addImageText, { color: colors.primary }]}>Add Photo</Text>
                </TouchableOpacity>
              )}

              <Text style={styles.inputLabel}>Category</Text>
              <TouchableOpacity
                style={styles.categorySelector}
                activeOpacity={0.7}
                onPress={() => setCategoryPickerVisible(true)}
                accessibilityLabel="Select category"
                accessibilityRole="button"
              >
                <View
                  style={[
                    styles.categoryDot,
                    {
                      backgroundColor:
                        CATEGORY_COLORS[newCategory] || colors.textSecondary,
                    },
                  ]}
                />
                <Text style={styles.categorySelectorText}>{newCategory}</Text>
                <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
              </TouchableOpacity>

              <Text style={styles.charCount}>{newTitle.length}/120</Text>
            </ScrollView>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Category Picker Modal */}
      <Modal
        visible={categoryPickerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerVisible(false)}
      >
        <TouchableOpacity
          style={styles.pickerOverlay}
          activeOpacity={1}
          onPress={() => setCategoryPickerVisible(false)}
        >
          <View style={styles.pickerContainer}>
            <Text style={styles.pickerTitle}>Select Category</Text>
            {POST_CATEGORIES.filter(cat => cat !== 'All' && (cat !== 'News' || user?.role === 'admin')).map((cat) => (
              <TouchableOpacity
                key={cat}
                style={[
                  styles.pickerItem,
                  newCategory === cat && styles.pickerItemActive,
                ]}
                onPress={() => {
                  setNewCategory(cat);
                  setCategoryPickerVisible(false);
                }}
                activeOpacity={0.7}
              >
                <View
                  style={[
                    styles.pickerDot,
                    { backgroundColor: CATEGORY_COLORS[cat] },
                  ]}
                />
                <Text
                  style={[
                    styles.pickerItemText,
                    newCategory === cat && styles.pickerItemTextActive,
                  ]}
                >
                  {cat}
                </Text>
                {newCategory === cat && (
                  <Ionicons name="check" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Comments Modal */}
      <Modal
        visible={commentsModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setCommentsModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior="padding"
            style={styles.modalKeyboardView}
          >
            <View style={styles.modalHeader}>
              <TouchableOpacity
                onPress={closeComments}
                style={styles.modalCloseBtn}
              >
                <Ionicons name="close" size={24} color={colors.text} />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Comments</Text>
              <View style={{ width: 50 }} />
            </View>

              {selectedPost && (
                <View style={styles.commentsPostPreview}>
                  <TouchableOpacity
                    style={styles.commentsPostHeader}
                    activeOpacity={0.7}
                    onPress={() => openProfile(selectedPost.userId, selectedPost.userName)}
                    accessibilityLabel={`View ${selectedPost.userName}'s profile`}
                    accessibilityRole="button"
                  >
                    <View
                      style={[
                        styles.avatarSmall,
                        {
                          backgroundColor: getAvatarColor(
                            selectedPost.userName
                          ),
                        },
                      ]}
                    >
                      {selectedPost.userProfileImage ? (
                        <Image source={{ uri: selectedPost.userProfileImage }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                      ) : (
                        <Text style={styles.avatarTextSmall}>
                          {getInitials(selectedPost.userName)}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text style={styles.commentsPostUser}>
                        {selectedPost.userName}
                      </Text>
                      <Text style={styles.commentsPostTime}>
                        {getTimeAgo(selectedPost.createdAt)}
                      </Text>
                    </View>
                  </TouchableOpacity>
                  <Text style={styles.commentsPostTitle}>
                    {selectedPost.title}
                  </Text>
                </View>
              )}

            <FlatList
              data={postComments}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.commentsList}
              ListEmptyComponent={
                <View style={styles.commentsEmpty}>
                  <Ionicons
                    name="chatbubbles"
                    size={36}
                    color={colors.textMuted}
                  />
                  <Text style={styles.commentsEmptyText}>
                    No comments yet
                  </Text>
                  <Text style={styles.commentsEmptySubtext}>
                    Start the conversation!
                  </Text>
                </View>
              }
              renderItem={({ item: cmt }) => {
                const commentLiked = user && cmt.likes && cmt.likes.includes(user.id);
                const commentLikeCount = cmt.likes ? cmt.likes.length : 0;
                const isCommentOwner = user && cmt.userId === user.id;
                const isPostOwner = user && selectedPost && selectedPost.userId === user.id;
                return (
                  <View style={styles.commentItem}>
                    <TouchableOpacity
                      style={[styles.avatarTiny, { backgroundColor: getAvatarColor(cmt.userName) }]}
                      activeOpacity={0.7}
                      onPress={() => openProfile(cmt.userId, cmt.userName)}
                    >
                      {cmt.userProfileImage ? (
                        <Image source={{ uri: cmt.userProfileImage }} style={{ width: 28, height: 28, borderRadius: 14 }} />
                      ) : (
                        <Text style={styles.avatarTextTiny}>{getInitials(cmt.userName)}</Text>
                      )}
                    </TouchableOpacity>
                    <View style={styles.commentContent}>
                      <View style={styles.commentHeader}>
                        <TouchableOpacity activeOpacity={0.7} onPress={() => openProfile(cmt.userId, cmt.userName)}>
                          <Text style={styles.commentUser}>{cmt.userName}</Text>
                        </TouchableOpacity>
                        <Text style={styles.commentTime}>{getTimeAgo(cmt.createdAt)}</Text>
                      </View>
                      <Text style={styles.commentText}>{cmt.text}</Text>
                      <View style={styles.commentActions}>
                        <TouchableOpacity onPress={() => handleCommentLike(selectedPost.id, cmt.id)} style={styles.commentActionBtn}>
                          <Ionicons name={commentLiked ? 'heart' : 'heart-outline'} size={14} color={commentLiked ? colors.danger : colors.textMuted} />
                          <Text style={[styles.commentActionText, { color: commentLiked ? colors.danger : colors.textMuted }]}>
                            {commentLikeCount > 0 ? commentLikeCount : 'Like'}
                          </Text>
                        </TouchableOpacity>
                        {(isCommentOwner || isPostOwner || isAdmin) && (
                          <TouchableOpacity onPress={() => handleDeleteCommentItem(selectedPost.id, cmt.id)} style={styles.commentActionBtn}>
                            <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
                            <Text style={[styles.commentActionText, { color: colors.textMuted }]}>Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  </View>
                );
              }}
            />

            <View style={styles.commentInputContainer}>
              <TextInput
                style={styles.commentInput}
                placeholder="Write a comment..."
                placeholderTextColor={colors.textMuted}
                value={newComment}
                onChangeText={setNewComment}
                multiline
                maxLength={500}
                accessibilityLabel="Write a comment"
              />
              <TouchableOpacity
                style={[
                  styles.commentSendBtn,
                  (!newComment.trim() || commenting) &&
                    styles.commentSendBtnDisabled,
                ]}
                onPress={handleAddComment}
                disabled={!newComment.trim() || commenting}
                activeOpacity={0.7}
                accessibilityLabel="Send comment"
                accessibilityRole="button"
                accessibilityState={{ disabled: !(newComment.trim()) || !!commenting }}
              >
                {commenting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="send" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* Post Options Menu */}
      <Modal visible={!!postOptionsMenu} transparent animationType="fade" onRequestClose={() => setPostOptionsMenu(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setPostOptionsMenu(null)}>
          <View style={styles.optionsModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.optionsTitle}>Post Options</Text>
            {postOptionsMenu && (
              <>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => { handleSavePost(postOptionsMenu.id); setPostOptionsMenu(null); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name={savedPostIds.has(postOptionsMenu.id) ? 'bookmark' : 'bookmark-outline'} size={22} color={savedPostIds.has(postOptionsMenu.id) ? colors.primary : colors.text} />
                  <Text style={[styles.optionText, savedPostIds.has(postOptionsMenu.id) && { color: colors.primary }]}>
                    {savedPostIds.has(postOptionsMenu.id) ? 'Unsave' : 'Save'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.optionItem}
                  onPress={() => { handleNativeShare(postOptionsMenu); setPostOptionsMenu(null); }}
                  activeOpacity={0.7}
                >
                  <Ionicons name="share-outline" size={22} color={colors.text} />
                  <Text style={styles.optionText}>Share</Text>
                </TouchableOpacity>
                {postOptionsMenu.userId !== user?.id && (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => { setPostOptionsMenu(null); setReportModalPost(postOptionsMenu); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="flag-outline" size={22} color={colors.warning} />
                    <Text style={[styles.optionText, { color: colors.warning }]}>Report</Text>
                  </TouchableOpacity>
                )}
                {postOptionsMenu.userId === user?.id && (
                  <TouchableOpacity
                    style={styles.optionItem}
                    onPress={() => { handleDeletePost(postOptionsMenu); setPostOptionsMenu(null); }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="trash-outline" size={22} color={colors.danger} />
                    <Text style={[styles.optionText, { color: colors.danger }]}>Delete</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.optionItem, { borderBottomWidth: 0 }]}
                  onPress={() => setPostOptionsMenu(null)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
                  <Text style={[styles.optionText, { color: colors.textMuted }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Post Modal */}
      <Modal visible={!!reportModalPost} transparent animationType="slide" onRequestClose={() => setReportModalPost(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setReportModalPost(null)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Report Post</Text>
            <Text style={[styles.ratingLabel, { color: colors.textSecondary }]}>Reason</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {['Spam', 'Inappropriate', 'Harassment', 'Misinformation', 'Other'].map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.reportChip, reportCategory === cat && styles.reportChipActive]}
                  onPress={() => setReportCategory(cat)}
                >
                  <Text style={[styles.reportChipText, reportCategory === cat && styles.reportChipTextActive]}>{cat}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[styles.reportInput, { backgroundColor: colors.borderLight, color: colors.text }]}
              placeholder="Describe the issue..."
              placeholderTextColor={colors.textMuted}
              value={reportReason}
              onChangeText={setReportReason}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <View style={styles.reviewModalButtons}>
              <TouchableOpacity style={[styles.reviewCancelBtn, { borderColor: colors.border }]} onPress={() => setReportModalPost(null)}>
                <Text style={[styles.reviewCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.reviewSubmitBtn, { backgroundColor: colors.warning }]} onPress={handleReportPost}>
                <Text style={styles.reviewSubmitText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
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
  header: {
    backgroundColor: colors.headerBg,
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 28,
    borderBottomRightRadius: 28,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: colors.headerText,
  },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  filterTabs: {
    maxHeight: 50,
    backgroundColor: colors.card,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  filterTabsContent: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  filterTab: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: colors.borderLight,
  },
  filterTabText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },

  newsPostCard: {
    borderLeftWidth: 4,
    borderLeftColor: colors.danger,
  },
  postUserNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.danger,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  adminBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    gap: 3,
  },
  roleBadgeText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 0.5,
  },
  repostBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
    paddingHorizontal: 2,
  },
  repostBannerText: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  followBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
    marginRight: 8,
  },
  followBtnActive: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  followBtnText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  followBtnTextActive: {
    color: colors.primary,
  },
  postHeadline: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 1,
  },
  postStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: 10,
  },
  postStatsLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  postStatsText: {
    fontSize: 12,
    color: colors.textMuted,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: colors.textSecondary,
  },

  postsList: {
    padding: 16,
    paddingBottom: 32,
  },
  postsListEmpty: {
    flex: 1,
  },

  postCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 14,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  postHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  postHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  avatarText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  avatarImage: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  postUserInfo: {
    flex: 1,
  },
  postUserName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  postTime: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 1,
  },
  moreBtn: {
    padding: 6,
  },
  optionsModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
    maxHeight: '60%',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: 12,
  },
  optionsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  optionText: {
    fontSize: 16,
    color: colors.text,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryTagText: {
    fontSize: 12,
    fontWeight: '600',
  },
  postTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 6,
  },
  postDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 21,
    marginBottom: 14,
  },
  postImage: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    marginBottom: 14,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  postActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: 12,
    gap: 8,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'center',
  },
  actionText: {
    fontSize: 13,
    color: colors.textMuted,
  },

  composerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
    gap: 10,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  composerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  composerAvatarText: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#fff',
  },
  composerInput: {
    flex: 1,
    backgroundColor: colors.borderLight,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  composerPlaceholder: {
    fontSize: 14,
    color: colors.textMuted,
  },
  composerPhotoBtn: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 4,
  },
  composerPhotoText: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '500',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: colors.borderLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  emptyCreateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 14,
    gap: 8,
  },
  emptyCreateBtnText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },

  // Modal shared
  modalContainer: {
    flex: 1,
    backgroundColor: colors.card,
  },
  modalKeyboardView: {
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  modalCloseBtn: {
    width: 50,
  },
  modalCancelText: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
  },
  modalPostBtn: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 70,
  },
  modalPostBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  titleInput: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 16,
  },
  descriptionInput: {
    fontSize: 15,
    color: colors.text,
    minHeight: 160,
    lineHeight: 22,
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  categorySelector: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  categoryDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  categorySelectorText: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    fontWeight: '500',
  },
  addImageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 20,
    gap: 8,
  },
  addImageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 20,
    borderRadius: 12,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 200,
    borderRadius: 12,
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  charCount: {
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 12,
  },

  // Category picker
  pickerOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  pickerContainer: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 8,
    width: '100%',
    maxWidth: 340,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  pickerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    marginBottom: 4,
  },
  pickerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 12,
  },
  pickerItemActive: {
    backgroundColor: colors.primaryLight,
  },
  pickerDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  pickerItemText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  pickerItemTextActive: {
    fontWeight: '600',
    color: colors.primary,
  },

  // Comments
  commentsPostPreview: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
  },
  commentsPostHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarTextSmall: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#fff',
  },
  commentsPostUser: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  commentsPostTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  commentsPostTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
  },
  commentsList: {
    padding: 16,
    paddingBottom: 8,
    flexGrow: 1,
  },
  commentsEmpty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  commentsEmptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textMuted,
    marginTop: 12,
  },
  commentsEmptySubtext: {
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 4,
  },
  commentItem: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 10,
  },
  avatarTiny: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 2,
  },
  avatarTextTiny: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#fff',
  },
  commentContent: {
    flex: 1,
    backgroundColor: colors.inputBg,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  commentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  commentUser: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
  },
  commentTime: {
    fontSize: 11,
    color: colors.textMuted,
  },
  commentText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    backgroundColor: colors.card,
    gap: 10,
  },
  commentInput: {
    flex: 1,
    backgroundColor: colors.borderLight,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: colors.text,
    maxHeight: 90,
  },
  commentSendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendBtnDisabled: {
    backgroundColor: colors.textMuted,
  },
  reactionIcons: {
    flexDirection: 'row',
    marginRight: 6,
  },
  reactionIconSmall: {
    fontSize: 14,
    marginLeft: -4,
  },
  reactionBreakdown: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reactionCountText: {
    fontSize: 12,
    fontWeight: '500',
  },
  reactionPicker: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 24,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  reactionOption: {
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  reactionEmoji: {
    fontSize: 28,
  },
  reactionLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  commentActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  commentActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  commentActionText: {
    fontSize: 12,
    fontWeight: '600',
  },
  bottomModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  reportInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 16,
  },
  reviewModalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  reviewCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  reviewCancelText: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  reviewSubmitText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  reportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
  },
  reportChipActive: {
    backgroundColor: colors.primary,
  },
  reportChipText: {
    fontSize: 13,
    fontWeight: '500',
    color: colors.text,
  },
  reportChipTextActive: {
    color: '#fff',
  },
});


