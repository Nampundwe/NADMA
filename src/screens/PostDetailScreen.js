import { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
  getCurrentUser,
  onPostCommentsSnapshot,
  addPostComment,
  deleteComment,
  toggleCommentLike,
  togglePostReaction,
  onPostsSnapshot,
  addReport,
  REACTIONS,
  REACTION_LABELS,
} from '../data/firebaseStorage';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { hapticLight } from '../utils/haptics';
import { useNetworkAction } from '../utils/useNetworkAction';
import { createStyleSheet } from '../utils/responsive';

const CATEGORY_COLORS = {
  News: '#D32F2F', General: '#6B7280', Plumbing: '#2196F3', Electrical: '#FF9800',
  Carpentry: '#795548', Painting: '#9C27B0', Cleaning: '#4CAF50', Gardening: '#8BC34A',
  Tip: '#1a237e', Question: '#E91E63',
};

const AVATAR_COLORS = ['#1a237e', '#4CAF50', '#FF9800', '#E91E63', '#9C27B0', '#00BCD4', '#795548', '#F44336'];
function getAvatarColor(name) {
  if (!name) return AVATAR_COLORS[0];
  return AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
}
function getInitials(name) {
  if (!name) return '';
  const parts = name.trim().split(' ');
  return parts.length === 1 ? parts[0].charAt(0).toUpperCase() : (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}
function getTimeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function PostDetailScreen({ route, navigation }) {
  const { colors } = useTheme();
  const toast = useToast();
  const { run } = useNetworkAction();
  const { postId } = route.params;

  const [post, setPost] = useState(null);
  const [comments, setComments] = useState([]);
  const [user, setUser] = useState(null);
  const [newComment, setNewComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [reactionPickerVisible, setReactionPickerVisible] = useState(false);
  const [replyingTo, setReplyingTo] = useState(null);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportCategory, setReportCategory] = useState('Other');
  const [reportReason, setReportReason] = useState('');

  useEffect(() => {
    getCurrentUser().then(setUser);
  }, []);

  useEffect(() => {
    const unsub = onPostsSnapshot((posts) => {
      const found = posts.find((p) => p.id === postId);
      if (found) setPost(found);
    });
    return () => unsub();
  }, [postId]);

  useEffect(() => {
    const unsub = onPostCommentsSnapshot(postId, setComments);
    return () => unsub();
  }, [postId]);

  const parentComments = useMemo(() => comments.filter((c) => !c.parentId), [comments]);
  const getReplies = (parentId) => comments.filter((c) => c.parentId === parentId);

  const handleReaction = (emoji) => run(async () => {
    if (!user) return;
    hapticLight();
    await togglePostReaction(postId, user.id, user.name, emoji);
    setReactionPickerVisible(false);
  });

  const handleAddComment = () => run(async () => {
    if (!newComment.trim() || !user || !post) return;
    setCommenting(true);
    const comment = {
      userId: user.id,
      userName: user.name,
      userProfileImage: user.profileImage || null,
      text: newComment.trim(),
      createdAt: new Date().toISOString(),
      ...(replyingTo ? { parentId: replyingTo.id, parentUserName: replyingTo.userName } : {}),
    };
    setNewComment('');
    setReplyingTo(null);
    const success = await addPostComment(postId, comment);
    setCommenting(false);
    if (!success) {
      setNewComment(comment.text);
      toast.error('Failed to comment');
    }
  });

  const handleDeleteComment = (commentId) => {
    Alert.alert('Delete Comment', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteComment(postId, commentId); } },
    ]);
  };

  const handleCommentLike = (commentId) => run(async () => {
    if (!user) return;
    hapticLight();
    await toggleCommentLike(postId, commentId, user.id);
  });

  const handleShare = () => {
    if (!post) return;
    Share.share({
      message: `${post.title || 'Community Post'}\n\n${post.description || ''}\n\nShared from Nadma Community by ${post.userName}`,
      title: 'Nadma Community',
    }).catch(() => {});
  };

  const handleReport = () => run(async () => {
    if (!reportReason.trim() || !user || !post) {
      toast.error('Please describe the issue');
      return;
    }
    const report = {
      id: 'rpt_post_' + Date.now(),
      type: 'post',
      postId: post.id,
      postTitle: post.title,
      postOwnerId: post.userId,
      postOwnerName: post.userName,
      reporterId: user.id,
      reporterName: user.name || 'Guest',
      category: reportCategory,
      reason: reportReason.trim(),
      timestamp: new Date().toISOString(),
    };
    const result = await addReport(report);
    if (result === true || result?.success !== false) {
      hapticLight();
      setShowReportModal(false);
      setReportReason('');
      setReportCategory('Other');
      toast.success('Report submitted. Admin will review it.');
    } else {
      toast.error(result?.error || 'Failed to submit report');
    }
  });

  const openProfile = (targetId, targetName) => {
    if (targetId) navigation.navigate('PublicProfile', { userId: targetId, userName: targetName });
  };

  const styles = createStyles(colors);

  if (!post) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const reactions = post.reactions || {};
  const myReaction = user ? reactions[user.id] : null;
  const reactionCounts = {};
  Object.values(reactions).forEach((r) => { reactionCounts[r] = (reactionCounts[r] || 0) + 1; });
  const totalReactions = Object.keys(reactions).length;
  const topReactions = Object.entries(reactionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3);
  const categoryColor = CATEGORY_COLORS[post.category] || colors.textSecondary;

  const renderComment = ({ item: cmt }) => {
    const isReply = !!cmt.parentId;
    const commentLiked = user && cmt.likes && cmt.likes.includes(user.id);
    const commentLikeCount = cmt.likes ? cmt.likes.length : 0;
    const isCommentOwner = user && cmt.userId === user.id;
    const isPostOwner = user && post.userId === user.id;
    const isAdmin = user && user.role === 'admin';
    const replies = getReplies(cmt.id);

    return (
      <View>
        <View style={[styles.commentItem, isReply && styles.replyItem, { borderBottomColor: colors.borderLight }]}>
          <TouchableOpacity style={[styles.avatarTiny, { backgroundColor: getAvatarColor(cmt.userName) }]} onPress={() => openProfile(cmt.userId, cmt.userName)}>
            {cmt.userProfileImage ? (
              <Image source={{ uri: cmt.userProfileImage }} style={{ width: 34, height: 34, borderRadius: 17 }} />
            ) : (
              <Text style={styles.avatarTextTiny}>{getInitials(cmt.userName)}</Text>
            )}
          </TouchableOpacity>
          <View style={styles.commentContent}>
            <View style={styles.commentHeader}>
              <TouchableOpacity onPress={() => openProfile(cmt.userId, cmt.userName)}>
                <Text style={[styles.commentUser, { color: colors.text }]}>{cmt.userName}</Text>
              </TouchableOpacity>
              <Text style={[styles.commentTime, { color: colors.textMuted }]}>{getTimeAgo(cmt.createdAt)}</Text>
            </View>
            {cmt.parentUserName && (
              <Text style={[styles.replyTo, { color: colors.textMuted }]}>Replying to {cmt.parentUserName}</Text>
            )}
            <Text style={[styles.commentText, { color: colors.text }]}>{cmt.text}</Text>
            <View style={styles.commentActions}>
              <TouchableOpacity onPress={() => handleCommentLike(cmt.id)} style={styles.commentActionBtn}>
                <Ionicons name={commentLiked ? 'heart' : 'heart-outline'} size={14} color={commentLiked ? colors.danger : colors.textMuted} />
                <Text style={[styles.commentActionText, { color: commentLiked ? colors.danger : colors.textMuted }]}>
                  {commentLikeCount > 0 ? commentLikeCount : 'Like'}
                </Text>
              </TouchableOpacity>
              {!isReply && (
                <TouchableOpacity onPress={() => setReplyingTo(cmt)} style={styles.commentActionBtn}>
                  <Ionicons name="chatbubble-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.commentActionText, { color: colors.textMuted }]}>Reply</Text>
                </TouchableOpacity>
              )}
              {(isCommentOwner || isPostOwner || isAdmin) && (
                <TouchableOpacity onPress={() => handleDeleteComment(cmt.id)} style={styles.commentActionBtn}>
                  <Ionicons name="trash-outline" size={13} color={colors.textMuted} />
                  <Text style={[styles.commentActionText, { color: colors.textMuted }]}>Delete</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
        {!isReply && replies.length > 0 && replies.map((reply) => (
          <View key={reply.id} style={[styles.commentItem, styles.replyItem, { borderBottomColor: colors.borderLight, marginLeft: 44 }]}>
            <TouchableOpacity style={[styles.avatarTinySmall, { backgroundColor: getAvatarColor(reply.userName) }]} onPress={() => openProfile(reply.userId, reply.userName)}>
              {reply.userProfileImage ? (
                <Image source={{ uri: reply.userProfileImage }} style={{ width: 26, height: 26, borderRadius: 13 }} />
              ) : (
                <Text style={styles.avatarTextTinySmall}>{getInitials(reply.userName)}</Text>
              )}
            </TouchableOpacity>
            <View style={styles.commentContent}>
              <View style={styles.commentHeader}>
                <TouchableOpacity onPress={() => openProfile(reply.userId, reply.userName)}>
                  <Text style={[styles.commentUser, { color: colors.text, fontSize: 12 }]}>{reply.userName}</Text>
                </TouchableOpacity>
                <Text style={[styles.commentTime, { color: colors.textMuted }]}>{getTimeAgo(reply.createdAt)}</Text>
              </View>
              {reply.parentUserName && (
                <Text style={[styles.replyTo, { color: colors.textMuted, fontSize: 11 }]}>Replying to {reply.parentUserName}</Text>
              )}
              <Text style={[styles.commentText, { color: colors.text, fontSize: 13 }]}>{reply.text}</Text>
              <View style={styles.commentActions}>
                <TouchableOpacity onPress={() => handleCommentLike(reply.id)} style={styles.commentActionBtn}>
                  <Ionicons name={user && reply.likes?.includes(user.id) ? 'heart' : 'heart-outline'} size={12} color={user && reply.likes?.includes(user.id) ? colors.danger : colors.textMuted} />
                  <Text style={[styles.commentActionText, { color: user && reply.likes?.includes(user.id) ? colors.danger : colors.textMuted, fontSize: 11 }]}>
                    {reply.likes?.length > 0 ? reply.likes.length : 'Like'}
                  </Text>
                </TouchableOpacity>
                {(user && reply.userId === user.id || isPostOwner || isAdmin) && (
                  <TouchableOpacity onPress={() => handleDeleteComment(reply.id)} style={styles.commentActionBtn}>
                    <Ionicons name="trash-outline" size={12} color={colors.textMuted} />
                    <Text style={[styles.commentActionText, { color: colors.textMuted, fontSize: 11 }]}>Delete</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        ))}
      </View>
    );
  };

  const renderHeader = () => (
    <View style={styles.postCard}>
      {post.reposted && (
        <View style={styles.repostBanner}>
          <Ionicons name="repeat" size={14} color={colors.primary} />
          <Text style={[styles.repostBannerText, { color: colors.textSecondary }]}>{post.userName} reposted</Text>
        </View>
      )}

      <View style={styles.postHeader}>
        <View style={styles.postHeaderLeft}>
          <TouchableOpacity style={[styles.avatar, { backgroundColor: getAvatarColor(post.userName) }]} onPress={() => openProfile(post.userId, post.userName)}>
            <Text style={styles.avatarText}>{getInitials(post.userName)}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openProfile(post.userId, post.userName)}>
            <View style={styles.postUserNameRow}>
              <Text style={[styles.postUserName, { color: colors.text }]}>{post.userName}</Text>
              {post.userRole === 'admin' && (
                <View style={styles.roleBadge}><Ionicons name="shield-checkmark" size={10} color="#fff" /><Text style={styles.roleBadgeText}>ADMIN</Text></View>
              )}
              {post.category === 'News' && (
                <View style={styles.adminBadge}><Ionicons name="megaphone" size={10} color="#fff" /><Text style={styles.adminBadgeText}>NEWS</Text></View>
              )}
            </View>
            {post.userHeadline ? <Text style={[styles.postHeadline, { color: colors.textSecondary }]} numberOfLines={1}>{post.userHeadline}</Text> : null}
            <Text style={[styles.postTime, { color: colors.textMuted }]}>{getTimeAgo(post.createdAt)}</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.moreBtn} onPress={() => setShowOptionsMenu(true)} accessibilityLabel="More options" accessibilityRole="button">
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.textMuted} />
        </TouchableOpacity>
      </View>

      {post.category && (
        <View style={[styles.categoryTag, { backgroundColor: categoryColor + '18' }]}>
          <Text style={[styles.categoryTagText, { color: categoryColor }]}>{post.category}</Text>
        </View>
      )}

      {post.title ? <Text style={[styles.postTitle, { color: colors.text }]}>{post.title}</Text> : null}
      <Text style={[styles.postDescription, { color: colors.text }]}>{post.description}</Text>

      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={styles.postImage} resizeMode="contain" />
      ) : null}

      <View style={[styles.postStatsRow, { borderBottomColor: colors.borderLight }]}>
        {totalReactions > 0 ? (
          <View style={styles.postStatsLeft}>
            <View style={styles.reactionIcons}>
              {topReactions.map(([emoji]) => <Text key={emoji} style={styles.reactionIconSmall}>{emoji}</Text>)}
            </View>
            <View style={styles.reactionBreakdown}>
              {topReactions.map(([emoji, count]) => (
                <Text key={emoji} style={[styles.reactionCountText, { color: colors.textMuted }]}>
                  {emoji} {count}
                </Text>
              ))}
              {totalReactions > topReactions.reduce((sum, [, c]) => sum + c, 0) && (
                <Text style={[styles.reactionCountText, { color: colors.textMuted }]}>
                  +{totalReactions - topReactions.reduce((sum, [, c]) => sum + c, 0)}
                </Text>
              )}
            </View>
          </View>
        ) : <View />}
        <Text style={[styles.postStatsText, { color: colors.textMuted }]}>
          {comments.length > 0 ? `${comments.length} comment${comments.length !== 1 ? 's' : ''}` : 'No comments yet'}
        </Text>
      </View>

      <View style={[styles.postActions, { borderTopColor: colors.borderLight }]}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => setReactionPickerVisible(!reactionPickerVisible)}>
          <Text style={{ fontSize: 18 }}>{myReaction || '👍'}</Text>
          <Text style={[styles.actionText, { color: myReaction ? colors.primary : colors.textMuted }]}>
            {myReaction ? REACTION_LABELS[REACTIONS.indexOf(myReaction)] || 'Like' : 'Like'}
          </Text>
        </TouchableOpacity>
        <View style={styles.actionBtn}>
          <Ionicons name="chatbubble-outline" size={19} color={colors.primary} />
          <Text style={[styles.actionText, { color: colors.primary }]}>{comments.length}</Text>
        </View>
      </View>

      {reactionPickerVisible && (
        <View style={[styles.reactionPicker, { backgroundColor: colors.card }]}>
          {REACTIONS.map((emoji, i) => (
            <TouchableOpacity key={emoji} style={styles.reactionOption} onPress={() => handleReaction(emoji)}>
              <Text style={styles.reactionEmoji}>{emoji}</Text>
              <Text style={[styles.reactionLabel, { color: colors.textMuted }]}>{REACTION_LABELS[i]}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <Text style={[styles.commentsSectionTitle, { color: colors.text }]}>Comments</Text>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.headerBar, { backgroundColor: colors.headerBg, borderBottomColor: colors.borderLight }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color={colors.headerText} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.headerText }]}>Post</Text>
        <View style={{ width: 40 }} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior="padding" keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <FlatList
          data={parentComments}
          keyExtractor={(item) => item.id}
          renderItem={renderComment}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={styles.commentsList}
          ListEmptyComponent={
            <View style={styles.commentsEmpty}>
              <Ionicons name="chatbubbles" size={36} color={colors.textMuted} />
              <Text style={[styles.commentsEmptyText, { color: colors.textMuted }]}>No comments yet</Text>
              <Text style={[styles.commentsEmptySubtext, { color: colors.textMuted }]}>Be the first to comment!</Text>
            </View>
          }
        />

        {replyingTo && (
          <View style={[styles.replyBar, { backgroundColor: colors.primaryLight, borderTopColor: colors.borderLight }]}>
            <Ionicons name="return-down-forward" size={16} color={colors.primary} />
            <Text style={[styles.replyBarText, { color: colors.text }]} numberOfLines={1}>
              Replying to <Text style={{ fontWeight: '700' }}>{replyingTo.userName}</Text>
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <Ionicons name="close-circle" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>
        )}

        <View style={[styles.commentInputContainer, { backgroundColor: colors.card, borderTopColor: colors.borderLight }]}>
            <TextInput
              style={[styles.commentInput, { backgroundColor: colors.borderLight, color: colors.text }]}
              placeholder={replyingTo ? `Reply to ${replyingTo.userName}...` : 'Write a comment...'}
              placeholderTextColor={colors.textMuted}
              value={newComment}
              onChangeText={setNewComment}
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[styles.commentSendBtn, { backgroundColor: newComment.trim() ? colors.primary : colors.textMuted }]}
              onPress={handleAddComment}
              disabled={!newComment.trim() || commenting}
            >
              {commenting ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="send" size={18} color="#fff" />}
            </TouchableOpacity>
          </View>
      </KeyboardAvoidingView>

      {/* Options Menu */}
      <Modal visible={showOptionsMenu} transparent animationType="fade" onRequestClose={() => setShowOptionsMenu(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowOptionsMenu(false)}>
          <View style={styles.optionsModal}>
            <View style={styles.modalHandle} />
            <Text style={[styles.optionsTitle, { color: colors.text }]}>Options</Text>
            <TouchableOpacity style={styles.optionItem} onPress={() => { handleShare(); setShowOptionsMenu(false); }}>
              <Ionicons name="share-outline" size={22} color={colors.text} />
              <Text style={[styles.optionText, { color: colors.text }]}>Share</Text>
            </TouchableOpacity>
            {post && user && post.userId !== user.id && (
              <TouchableOpacity style={styles.optionItem} onPress={() => { setShowOptionsMenu(false); setShowReportModal(true); }}>
                <Ionicons name="flag-outline" size={22} color={colors.warning} />
                <Text style={[styles.optionText, { color: colors.warning }]}>Report</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={[styles.optionItem, { borderBottomWidth: 0 }]} onPress={() => setShowOptionsMenu(false)}>
              <Ionicons name="close-circle-outline" size={22} color={colors.textMuted} />
              <Text style={[styles.optionText, { color: colors.textMuted }]}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Report Modal */}
      <Modal visible={showReportModal} transparent animationType="slide" onRequestClose={() => setShowReportModal(false)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setShowReportModal(false)}>
          <View style={styles.bottomModal}>
            <View style={styles.modalHandle} />
            <Text style={[styles.bottomModalTitle, { color: colors.text }]}>Report Post</Text>
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
            <View style={styles.modalButtons}>
              <TouchableOpacity style={[styles.modalCancelBtn, { borderColor: colors.border }]} onPress={() => setShowReportModal(false)}>
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: colors.warning }]} onPress={handleReport}>
                <Text style={styles.modalSubmitText}>Submit Report</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const createStyles = (colors) => createStyleSheet({
  container: { flex: 1 },
  flex: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '600' },
  postCard: { backgroundColor: colors.card, marginBottom: 8 },
  postHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  postHeaderLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  moreBtn: { padding: 6 },
  avatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  postUserNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  postUserName: { fontSize: 15, fontWeight: '600' },
  postHeadline: { fontSize: 12, marginTop: 1 },
  postTime: { fontSize: 12, marginTop: 2 },
  roleBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.primary, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 3 },
  roleBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  adminBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.danger, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, gap: 3 },
  adminBadgeText: { fontSize: 9, fontWeight: 'bold', color: '#fff' },
  repostBanner: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, paddingHorizontal: 2 },
  repostBannerText: { fontSize: 12, fontWeight: '500' },
  categoryTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, marginBottom: 10 },
  categoryTagText: { fontSize: 12, fontWeight: '600' },
  postTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 6 },
  postDescription: { fontSize: 15, lineHeight: 22, marginBottom: 12 },
  postImage: { width: '100%', height: 300, borderRadius: 12, marginBottom: 12, backgroundColor: 'rgba(0,0,0,0.05)' },
  postStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, marginBottom: 4 },
  postStatsLeft: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionIcons: { flexDirection: 'row', marginRight: 4 },
  reactionIconSmall: { fontSize: 14, marginLeft: -4 },
  reactionBreakdown: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  reactionCountText: { fontSize: 12, fontWeight: '500' },
  postStatsText: { fontSize: 12 },
  postActions: { flexDirection: 'row', justifyContent: 'space-around', paddingVertical: 8, borderTopWidth: 1 },
  actionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 4, paddingHorizontal: 12 },
  actionText: { fontSize: 13, fontWeight: '600' },
  reactionPicker: { flexDirection: 'row', justifyContent: 'space-around', paddingHorizontal: 12, paddingVertical: 10, marginHorizontal: 16, marginBottom: 8, borderRadius: 24, elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 8 },
  reactionOption: { alignItems: 'center', paddingHorizontal: 6 },
  reactionEmoji: { fontSize: 28 },
  reactionLabel: { fontSize: 10, marginTop: 2 },
  commentsSectionTitle: { fontSize: 16, fontWeight: '600', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  commentsList: { paddingBottom: 20 },
  commentItem: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 10, borderBottomWidth: 0.5 },
  replyItem: { paddingLeft: 16 },
  avatarTiny: { width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  avatarTextTiny: { fontSize: 12, fontWeight: 'bold', color: '#fff' },
  avatarTinySmall: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  avatarTextTinySmall: { fontSize: 10, fontWeight: 'bold', color: '#fff' },
  commentContent: { flex: 1 },
  commentHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
  commentUser: { fontSize: 13, fontWeight: '600' },
  commentTime: { fontSize: 11 },
  replyTo: { fontSize: 11, fontStyle: 'italic', marginBottom: 2 },
  commentText: { fontSize: 14, lineHeight: 20 },
  commentActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  commentActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  commentActionText: { fontSize: 12, fontWeight: '600' },
  commentsEmpty: { alignItems: 'center', paddingTop: 40, paddingBottom: 20 },
  commentsEmptyText: { fontSize: 15, fontWeight: '600', marginTop: 8 },
  commentsEmptySubtext: { fontSize: 13, marginTop: 4 },
  replyBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, gap: 8, borderTopWidth: 1 },
  replyBarText: { flex: 1, fontSize: 13 },
  commentInputContainer: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 16, paddingVertical: 10, borderTopWidth: 1, gap: 10 },
  commentInput: { flex: 1, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, maxHeight: 90 },
  commentSendBtn: { width: 38, height: 38, borderRadius: 19, justifyContent: 'center', alignItems: 'center' },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  optionsModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 8,
    paddingBottom: 34,
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
  optionText: { fontSize: 16 },
  bottomModal: {
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  bottomModalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  reportChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.borderLight,
  },
  reportChipActive: { backgroundColor: colors.primary },
  reportChipText: { fontSize: 13, fontWeight: '500', color: colors.text },
  reportChipTextActive: { color: '#fff' },
  reportInput: {
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    minHeight: 80,
    marginBottom: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  modalCancelBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  modalCancelText: { fontSize: 14, fontWeight: '600' },
  modalSubmitBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  modalSubmitText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
