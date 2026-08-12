import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  SafeAreaView,
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

if (Platform.OS === 'android') {
  UIManager.setLayoutAnimationEnabledExperimental?.(true);
}
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  addCommunityPost,
  deleteCommunityPost,
  togglePostLike,
  addPostComment,
  getCurrentUser,
  onPostsSnapshot,
  onPostCommentsSnapshot,
  uploadCommunityImage,
  toggleFollow,
  onUserFollowsSnapshot,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight, hapticMedium, hapticSuccess, hapticWarning } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { CommunitySkeleton } from '../components/Skeleton';
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
  if (!name) return '?';
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
      quality: 0.7,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets?.[0]) {
      setSelectedImage(result.assets[0].uri);
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
    }
    const post = {
      id: postId,
      userId: user.id,
      userName: user.name,
      userHeadline: user.headline || '',
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

  const handleFollow = (targetId) => run(async () => {
    if (!user) {
      toast.error('Please log in to follow others');
      return;
    }
    if (targetId === user.id) return;
    hapticLight();
    const nowFollowing = await toggleFollow(user.id, targetId, 'user');
    toast.success(nowFollowing ? 'Now following' : 'Unfollowed');
  });

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
    setSelectedPost(post);
    setCommentsModalVisible(true);
    setPostComments([]);
    if (commentsUnsubRef.current) commentsUnsubRef.current();
    commentsUnsubRef.current = onPostCommentsSnapshot(post.id, (comments) => {
      setPostComments(comments);
    });
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
    const isLiked = user && item.likes && item.likes.includes(user.id);
    const likeCount = item.likes ? item.likes.length : 0;
    const commentCount = item.commentCount || 0;
    const isAdmin = user && user.role === 'admin';
    const isOwner = user && item.userId === user.id;
    const isFollowing = user && followingIds.has(item.userId);
    const categoryColor = CATEGORY_COLORS[item.category] || '#6B7280';

    return (
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
            <View
              style={[
                styles.avatar,
                { backgroundColor: getAvatarColor(item.userName) },
              ]}
            >
              <Text style={styles.avatarText}>
                {getInitials(item.userName)}
              </Text>
            </View>
            <View style={styles.postUserInfo}>
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
            </View>
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
          {(isAdmin || isOwner) && (
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDeletePost(item)}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              accessibilityLabel="Delete post"
              accessibilityRole="button"
            >
              <Ionicons name="trash-outline" size={18} color="#F44336" />
            </TouchableOpacity>
          )}
        </View>

        {item.category && (
          <View style={[styles.categoryTag, { backgroundColor: categoryColor + '18' }]}>
            <Text style={[styles.categoryTagText, { color: categoryColor }]}>
              {item.category}
            </Text>
          </View>
        )}

        <Text style={styles.postTitle}>{item.title}</Text>
        <Text style={styles.postDescription}>{item.description}</Text>

        {item.imageUrl ? (
          <Image source={{ uri: item.imageUrl }} style={styles.postImage} />
        ) : null}

        {(likeCount > 0 || commentCount > 0) && (
          <View style={styles.postStatsRow}>
            {likeCount > 0 ? (
              <View style={styles.postStatsLeft}>
                <Ionicons name="heart" size={13} color="#F44336" />
                <Text style={styles.postStatsText}>{likeCount} reactions</Text>
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
            onPress={() => handleLike(item.id)}
            activeOpacity={0.7}
            accessibilityLabel={isLiked ? "Unlike post" : "Like post"}
            accessibilityRole="button"
            accessibilityState={{ selected: !!isLiked }}
          >
            <Ionicons
              name={isLiked ? 'heart' : 'heart-outline'}
              size={20}
              color={isLiked ? '#F44336' : colors.textMuted}
            />
            <Text
              style={[
                styles.actionText,
                { color: isLiked ? '#F44336' : colors.textMuted },
              ]}
            >
              Like
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => openComments(item)}
            activeOpacity={0.7}
            accessibilityLabel="Comment on post"
            accessibilityRole="button"
          >
            <Ionicons name="chatbubble-outline" size={19} color={colors.textMuted} />
            <Text style={styles.actionText}>Comment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleRepost(item)}
            activeOpacity={0.7}
            accessibilityLabel="Repost"
            accessibilityRole="button"
          >
            <Ionicons name="repeat" size={20} color={colors.textMuted} />
            <Text style={styles.actionText}>Repost</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.actionBtn}
            onPress={() => handleNativeShare(item)}
            activeOpacity={0.7}
            accessibilityLabel="Share post"
            accessibilityRole="button"
          >
            <Ionicons name="send" size={19} color={colors.textMuted} />
            <Text style={styles.actionText}>Send</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmpty = () => (
    <Animated.View style={{ opacity: emptyOpacity, flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 }}>
      <View style={styles.emptyIconCircle}>
        <Ionicons name="megaphone-outline" size={48} color={colors.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No posts yet</Text>
      <Text style={styles.emptySubtitle}>
        Be the first to post!
      </Text>
      <TouchableOpacity
        style={styles.emptyCreateBtn}
        activeOpacity={0.8}
        onPress={() => setCreateModalVisible(true)}
        accessibilityLabel="Create a post"
        accessibilityRole="button"
      >
        <Ionicons name="add" size={20} color="#fff" />
        <Text style={styles.emptyCreateBtnText}>Create a Post</Text>
      </TouchableOpacity>
    </Animated.View>
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
          const color = CATEGORY_COLORS[cat] || '#6B7280';
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
            <View
              style={[
                styles.composerAvatar,
                { backgroundColor: getAvatarColor(user.name) },
              ]}
            >
              <Text style={styles.composerAvatarText}>{getInitials(user.name)}</Text>
            </View>
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
              <Ionicons name="image-outline" size={22} color={colors.primary} />
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                    onPress={() => setSelectedImage(null)}
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
                  <Ionicons name="image-outline" size={22} color={colors.primary} />
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
                        CATEGORY_COLORS[newCategory] || '#6B7280',
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
                  <Ionicons name="checkmark" size={20} color="#1a237e" />
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
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
                <View style={styles.commentsPostHeader}>
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
                    <Text style={styles.avatarTextSmall}>
                      {getInitials(selectedPost.userName)}
                    </Text>
                  </View>
                  <View>
                    <Text style={styles.commentsPostUser}>
                      {selectedPost.userName}
                    </Text>
                    <Text style={styles.commentsPostTime}>
                      {getTimeAgo(selectedPost.createdAt)}
                    </Text>
                  </View>
                </View>
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
                    name="chatbubbles-outline"
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
              renderItem={({ item }) => (
                <View style={styles.commentItem}>
                  <View
                    style={[
                      styles.avatarTiny,
                      {
                        backgroundColor: getAvatarColor(item.userName),
                      },
                    ]}
                  >
                    <Text style={styles.avatarTextTiny}>
                      {getInitials(item.userName)}
                    </Text>
                  </View>
                  <View style={styles.commentContent}>
                    <View style={styles.commentHeader}>
                      <Text style={styles.commentUser}>{item.userName}</Text>
                      <Text style={styles.commentTime}>
                        {getTimeAgo(item.createdAt)}
                      </Text>
                    </View>
                    <Text style={styles.commentText}>{item.text}</Text>
                  </View>
                </View>
              )}
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
    borderLeftColor: '#D32F2F',
  },
  postUserNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#D32F2F',
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
    backgroundColor: '#1a237e',
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
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
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
  deleteBtn: {
    padding: 6,
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
    color: '#4B5563',
    lineHeight: 21,
    marginBottom: 14,
  },
  postImage: {
    width: '100%',
    height: 200,
    borderRadius: 12,
    marginBottom: 14,
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
    backgroundColor: '#1a237e',
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
    backgroundColor: '#1a237e',
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
    color: '#1a237e',
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
    color: '#4B5563',
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
    backgroundColor: '#1a237e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  commentSendBtnDisabled: {
    backgroundColor: '#C4C4C4',
  },
});


