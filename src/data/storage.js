import AsyncStorage from '@react-native-async-storage/async-storage';

const simpleHash = (str) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return 'h_' + Math.abs(hash).toString(36);
};

const BUSINESSES_KEY = '@nadma_registered_businesses';
const SERVICE_PROVIDERS_KEY = '@nadma_service_providers';
const FAVORITES_KEY = '@nadma_favorites';
const REVIEWS_KEY = '@nadma_reviews';
const USERS_KEY = '@nadma_users';
const CURRENT_USER_KEY = '@nadma_current_user';
const BOOKINGS_KEY = '@nadma_bookings';
const MESSAGES_KEY = '@nadma_messages';
const NOTIFICATIONS_KEY = '@nadma_notifications';
const CATEGORIES_KEY = '@nadma_categories';

// ============ CATEGORIES ============
const defaultCategories = [
  { id: '1', name: 'Plumbing', icon: 'water-outline', color: '#2196F3', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600', tagline: 'Expert plumbers for all your water needs', description: 'Pipe repairs, drain cleaning, installations, and emergency plumbing services' },
  { id: '2', name: 'Electrical', icon: 'flash-outline', color: '#FF9800', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600', tagline: 'Safe and certified electrical work', description: 'Wiring, installations, solar panels, safety inspections, and repairs' },
  { id: '3', name: 'Carpentry', icon: 'hammer-outline', color: '#795548', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600', tagline: 'Custom woodwork and furniture', description: 'Furniture, doors, windows, kitchen cabinets, and custom woodwork' },
  { id: '4', name: 'Painting', icon: 'brush-outline', color: '#9C27B0', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600', tagline: 'Transform your space with color', description: 'Interior, exterior, decorative finishes, wallpaper, and murals' },
  { id: '5', name: 'Cleaning', icon: 'sparkles', color: '#4CAF50', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600', tagline: 'Professional cleaning services', description: 'Deep cleaning, office cleaning, post-construction, and carpet cleaning' },
  { id: '6', name: 'Gardening', icon: 'leaf-outline', color: '#8BC34A', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600', tagline: 'Beautiful outdoor spaces', description: 'Landscaping, lawn care, tree trimming, irrigation, and garden design' },
];

export const getAllCategories = async () => {
  try {
    const data = await AsyncStorage.getItem(CATEGORIES_KEY);
    if (data) return JSON.parse(data);
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(defaultCategories));
    return defaultCategories;
  } catch (e) {
    return defaultCategories;
  }
};

export const addCategory = async (category) => {
  try {
    const categories = await getAllCategories();
    const newCategory = { ...category, id: 'cat_' + Date.now() };
    categories.push(newCategory);
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    return { success: true, category: newCategory };
  } catch (e) {
    return { success: false, error: 'Failed to add category' };
  }
};

export const updateCategory = async (categoryId, updates) => {
  try {
    const categories = await getAllCategories();
    const index = categories.findIndex((c) => c.id === categoryId);
    if (index === -1) return { success: false, error: 'Category not found' };
    categories[index] = { ...categories[index], ...updates };
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(categories));
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to update category' };
  }
};

export const deleteCategory = async (categoryId) => {
  try {
    const categories = await getAllCategories();
    const filtered = categories.filter((c) => c.id !== categoryId);
    await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(filtered));
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to delete category' };
  }
};

// ============ USERS / AUTH ============
export const signup = async (email, password, name, role = 'user') => {
  try {
    const users = await getAllUsers();
    if (users.find((u) => u.email === email)) {
      return { success: false, error: 'Email already registered' };
    }
    const isAdminEmail = email.toLowerCase() === 'munangimuyambangorodwell@gmail.com' || email.toLowerCase() === 'munangimuyambangorodwell';
    const newUser = {
      id: 'user_' + Date.now(),
      email,
      password: simpleHash(password),
      name,
      role: isAdminEmail ? 'admin' : role,
      banned: false,
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(newUser));
    return { success: true, user: newUser };
  } catch (error) {
    return { success: false, error: 'Signup failed' };
  }
};

export const login = async (email, password) => {
  try {
    const users = await getAllUsers();
    const hashed = simpleHash(password);
    let user = users.find(
      (u) => u.email === email && u.password === hashed
    );
    // Fallback: plaintext password from pre-hash accounts
    if (!user) {
      user = users.find(
        (u) => u.email === email && u.password === password
      );
      if (user) {
        // Upgrade to hashed password
        user.password = hashed;
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
      }
    }
    if (!user) {
      return { success: false, error: 'Invalid email or password' };
    }
    if (user.banned) {
      return { success: false, error: 'Account has been banned' };
    }
    const isAdminEmail = email.toLowerCase() === 'munangimuyambangorodwell@gmail.com' || email.toLowerCase() === 'munangimuyambangorodwell';
    if (isAdminEmail && user.role !== 'admin') {
      user.role = 'admin';
      const allUsers = await getAllUsers();
      const idx = allUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        allUsers[idx].role = 'admin';
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(allUsers));
      }
    }
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
    return { success: true, user };
  } catch (error) {
    return { success: false, error: 'Login failed' };
  }
};

export const logout = async () => {
  await AsyncStorage.removeItem(CURRENT_USER_KEY);
};

export const setCurrentUser = async (user) => {
  await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
};

export const getCurrentUser = async () => {
  try {
    const data = await AsyncStorage.getItem(CURRENT_USER_KEY);
    if (!data) return null;
    const user = JSON.parse(data);
    const isAdminEmail = user.email && (
      user.email.toLowerCase() === 'munangimuyambangorodwell@gmail.com' ||
      user.email.toLowerCase() === 'munangimuyambangorodwell'
    );
    if (isAdminEmail && user.role !== 'admin') {
      user.role = 'admin';
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(user));
      const allUsers = await getAllUsers();
      const idx = allUsers.findIndex((u) => u.id === user.id);
      if (idx !== -1) {
        allUsers[idx].role = 'admin';
        await AsyncStorage.setItem(USERS_KEY, JSON.stringify(allUsers));
      }
    }
    return user;
  } catch (error) {
    return null;
  }
};

export const updateCurrentUser = async (updates) => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const updatedUser = { ...user, ...updates };
    await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedUser));

    const users = await getAllUsers();
    const index = users.findIndex((u) => u.id === user.id);
    if (index !== -1) {
      users[index] = updatedUser;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
    }
    return updatedUser;
  } catch (error) {
    return null;
  }
};

export const getAllUsers = async () => {
  try {
    const data = await AsyncStorage.getItem(USERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const banUser = async (userId) => {
  try {
    const users = await getAllUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index].banned = true;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const unbanUser = async (userId) => {
  try {
    const users = await getAllUsers();
    const index = users.findIndex((u) => u.id === userId);
    if (index !== -1) {
      users[index].banned = false;
      await AsyncStorage.setItem(USERS_KEY, JSON.stringify(users));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const deleteUser = async (userId) => {
  try {
    const users = await getAllUsers();
    const updated = users.filter((u) => u.id !== userId);
    await AsyncStorage.setItem(USERS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ BUSINESSES ============
export const saveRegisteredBusiness = async (business) => {
  try {
    const existing = await getRegisteredBusinesses();
    const updated = [...existing, business];
    await AsyncStorage.setItem(BUSINESSES_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

export const getRegisteredBusinesses = async () => {
  try {
    const data = await AsyncStorage.getItem(BUSINESSES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getApprovedBusinesses = async () => {
  try {
    const all = await getRegisteredBusinesses();
    return all.filter((b) => b.approvalStatus === 'approved');
  } catch (error) {
    return [];
  }
};

export const getPendingBusinesses = async () => {
  try {
    const all = await getRegisteredBusinesses();
    return all.filter((b) => b.approvalStatus === 'pending');
  } catch (error) {
    return [];
  }
};

export const updateBusiness = async (businessId, updates) => {
  try {
    const businesses = await getRegisteredBusinesses();
    const index = businesses.findIndex((b) => b.id === businessId);
    if (index !== -1) {
      businesses[index] = { ...businesses[index], ...updates };
      await AsyncStorage.setItem(BUSINESSES_KEY, JSON.stringify(businesses));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const approveBusiness = async (businessId) => {
  const result = await updateBusiness(businessId, { approvalStatus: 'approved' });
  if (result) {
    const businesses = await getRegisteredBusinesses();
    const business = businesses.find((b) => b.id === businessId);
    if (business) {
      await addNotification({
        id: 'notif_' + Date.now(),
        userId: business.userId,
        type: 'business_update',
        title: 'Business Approved!',
        message: `"${business.name}" has been approved and is now listed.`,
        businessId: business.id,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
  }
  return result;
};

export const rejectBusiness = async (businessId) => {
  const result = await updateBusiness(businessId, { approvalStatus: 'rejected' });
  if (result) {
    const businesses = await getRegisteredBusinesses();
    const business = businesses.find((b) => b.id === businessId);
    if (business) {
      await addNotification({
        id: 'notif_' + Date.now(),
        userId: business.userId,
        type: 'business_update',
        title: 'Business Rejected',
        message: `"${business.name}" has been rejected.`,
        businessId: business.id,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
  }
  return result;
};

export const deleteBusiness = async (businessId) => {
  try {
    const existing = await getRegisteredBusinesses();
    const updated = existing.filter((b) => b.id !== businessId);
    await AsyncStorage.setItem(BUSINESSES_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ SERVICE PROVIDERS (Admin-managed CRUD) ============
export const seedDefaultProviders = async () => {
  try {
    const existing = await getAllServiceProviders();
    if (existing.length > 0) return;

    const { allServices } = require('./services');
    await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(allServices));
  } catch (error) {
    console.log('Seed error:', error);
  }
};

export const getAllServiceProviders = async () => {
  try {
    const data = await AsyncStorage.getItem(SERVICE_PROVIDERS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getServiceProvidersByCategory = async (categoryName) => {
  try {
    const all = await getAllServiceProviders();
    return all.filter((p) => p.category === categoryName);
  } catch (error) {
    return [];
  }
};

export const addServiceProvider = async (provider) => {
  try {
    const existing = await getAllServiceProviders();
    existing.push(provider);
    await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(existing));
    return true;
  } catch (error) {
    return false;
  }
};

export const updateServiceProvider = async (providerId, updates) => {
  try {
    const existing = await getAllServiceProviders();
    const index = existing.findIndex((p) => p.id === providerId);
    if (index !== -1) {
      existing[index] = { ...existing[index], ...updates };
      await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(existing));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const deleteServiceProvider = async (providerId) => {
  try {
    const existing = await getAllServiceProviders();
    const updated = existing.filter((p) => p.id !== providerId);
    await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ FAVORITES ============
export const toggleFavorite = async (service) => {
  try {
    const existing = await getFavorites();
    const isFav = existing.some((f) => f.id === service.id);
    let updated;
    if (isFav) {
      updated = existing.filter((f) => f.id !== service.id);
    } else {
      updated = [...existing, service];
    }
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return !isFav;
  } catch (error) {
    return false;
  }
};

export const getFavorites = async () => {
  try {
    const data = await AsyncStorage.getItem(FAVORITES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const isFavorite = async (serviceId) => {
  try {
    const favorites = await getFavorites();
    return favorites.some((f) => f.id === serviceId);
  } catch (error) {
    return false;
  }
};

export const removeFavorite = async (userId, serviceId) => {
  try {
    const existing = await getFavorites();
    const updated = existing.filter((f) => f.id !== serviceId);
    await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ REVIEWS ============
export const addReview = async (review) => {
  try {
    const allReviews = await getAllReviews();
    allReviews.push(review);
    await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(allReviews));
    return true;
  } catch (error) {
    return false;
  }
};

export const getReviews = async (serviceId) => {
  try {
    const allReviews = await getAllReviews();
    return allReviews.filter((r) => r.serviceId === serviceId);
  } catch (error) {
    return [];
  }
};

export const getAllReviews = async () => {
  try {
    const data = await AsyncStorage.getItem(REVIEWS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const deleteReview = async (reviewId) => {
  try {
    const allReviews = await getAllReviews();
    const updated = allReviews.filter((r) => r.id !== reviewId);
    await AsyncStorage.setItem(REVIEWS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ BOOKINGS ============
export const createBooking = async (booking) => {
  try {
    const all = await getAllBookings();
    all.push(booking);
    await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(all));

    await addNotification({
      id: 'notif_' + Date.now(),
      userId: 'admin',
      type: 'new_booking',
      title: 'New Booking',
      message: `${booking.userName} booked ${booking.businessName} for ${booking.date} at ${booking.time}`,
      bookingId: booking.id,
      timestamp: new Date().toISOString(),
      read: false,
    });

    return true;
  } catch (error) {
    return false;
  }
};

export const getAllBookings = async () => {
  try {
    const data = await AsyncStorage.getItem(BOOKINGS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getBookingsByUser = async (userId) => {
  try {
    const all = await getAllBookings();
    return all.filter((b) => b.userId === userId);
  } catch (error) {
    return [];
  }
};

export const getBookingsByBusiness = async (businessId) => {
  try {
    const all = await getAllBookings();
    return all.filter((b) => b.businessId === businessId);
  } catch (error) {
    return [];
  }
};

export const updateBookingStatus = async (bookingId, status) => {
  try {
    const all = await getAllBookings();
    const index = all.findIndex((b) => b.id === bookingId);
    if (index !== -1) {
      all[index].status = status;
      await AsyncStorage.setItem(BOOKINGS_KEY, JSON.stringify(all));

      const booking = all[index];
      const statusMessages = {
        approved: `Your booking with ${booking.businessName} has been approved!`,
        rejected: `Your booking with ${booking.businessName} has been rejected.`,
        completed: `Your booking with ${booking.businessName} has been completed!`,
        cancelled: `Your booking with ${booking.businessName} has been cancelled.`,
      };
      if (statusMessages[status]) {
        await addNotification({
          id: 'notif_' + Date.now(),
          userId: booking.userId,
          type: 'booking_update',
          title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
          message: statusMessages[status],
          bookingId: booking.id,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const cancelBooking = async (bookingId) => {
  return updateBookingStatus(bookingId, 'cancelled');
};

// ============ MESSAGES ============
export const sendMessage = async (message) => {
  try {
    const all = await getAllMessages();
    all.push(message);
    await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(all));
    return true;
  } catch (error) {
    return false;
  }
};

export const getAllMessages = async () => {
  try {
    const data = await AsyncStorage.getItem(MESSAGES_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getConversation = async (userId, otherId) => {
  try {
    const all = await getAllMessages();
    return all.filter(
      (m) =>
        (m.senderId === userId && m.receiverId === otherId) ||
        (m.senderId === otherId && m.receiverId === userId)
    );
  } catch (error) {
    return [];
  }
};

export const getConversationsForUser = async (userId) => {
  try {
    const all = await getAllMessages();
    const conversations = {};

    all.forEach((msg) => {
      if (msg.senderId === userId || msg.receiverId === userId) {
        const otherId = msg.senderId === userId ? msg.receiverId : msg.senderId;
        const otherName = msg.senderId === userId ? msg.receiverName : msg.senderName;
        const type = msg.conversationType || 'business';

        if (!conversations[otherId] || new Date(msg.timestamp) > new Date(conversations[otherId].lastMessage.timestamp)) {
          conversations[otherId] = {
            otherId,
            otherName,
            conversationType: type,
            businessId: msg.businessId,
            businessName: msg.businessName,
            lastMessage: msg,
            unread: (msg.receiverId === userId && !msg.read) ? 1 : 0,
          };
        }
      }
    });
    return Object.values(conversations).sort(
      (a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
    );
  } catch (error) {
    return [];
  }
};

export const getConversationsForAdmin = async (adminId) => {
  try {
    const all = await getAllMessages();
    const conversations = {};

    all.forEach((msg) => {
      if (msg.conversationType === 'admin') {
        const otherId = msg.senderId === adminId ? msg.receiverId : msg.senderId;
        const otherName = msg.senderId === adminId ? msg.receiverName : msg.senderName;

        if (!conversations[otherId] || new Date(msg.timestamp) > new Date(conversations[otherId].lastMessage.timestamp)) {
          conversations[otherId] = {
            otherId,
            otherName,
            conversationType: 'admin',
            lastMessage: msg,
            unread: (msg.receiverId === adminId && !msg.read) ? 1 : 0,
          };
        }
      }
    });
    return Object.values(conversations).sort(
      (a, b) => new Date(b.lastMessage.timestamp) - new Date(a.lastMessage.timestamp)
    );
  } catch (error) {
    return [];
  }
};

export const markMessagesRead = async (senderId, receiverId) => {
  try {
    const all = await getAllMessages();
    let changed = false;
    all.forEach((msg) => {
      if (msg.senderId === senderId && msg.receiverId === receiverId && !msg.read) {
        msg.read = true;
        changed = true;
      }
    });
    if (changed) {
      await AsyncStorage.setItem(MESSAGES_KEY, JSON.stringify(all));
    }
    return true;
  } catch (error) {
    return false;
  }
};

// ============ NOTIFICATIONS ============
export const addNotification = async (notification) => {
  try {
    const all = await getAllNotifications();
    all.push(notification);
    await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
    return true;
  } catch (error) {
    return false;
  }
};

export const getAllNotifications = async () => {
  try {
    const data = await AsyncStorage.getItem(NOTIFICATIONS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getNotificationsByUser = async (userId) => {
  try {
    const all = await getAllNotifications();
    return all
      .filter((n) => n.userId === userId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    return [];
  }
};

export const markNotificationRead = async (notificationId) => {
  try {
    const all = await getAllNotifications();
    const index = all.findIndex((n) => n.id === notificationId);
    if (index !== -1) {
      all[index].read = true;
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const markAllNotificationsRead = async (userId) => {
  try {
    const all = await getAllNotifications();
    let changed = false;
    all.forEach((n) => {
      if (n.userId === userId && !n.read) {
        n.read = true;
        changed = true;
      }
    });
    if (changed) {
      await AsyncStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(all));
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const getUnreadNotificationCount = async (userId) => {
  try {
    const all = await getAllNotifications();
    return all.filter((n) => n.userId === userId && !n.read).length;
  } catch (error) {
    return 0;
  }
};

// ============ REPORTS ============
const REPORTS_KEY = '@nadma_reports';

export const addReport = async (report) => {
  try {
    const all = await getAllReports();
    all.push(report);
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(all));
    await addNotification({
      id: 'notif_' + Date.now(),
      userId: 'admin',
      type: 'new_report',
      title: 'Provider Reported',
      message: `${report.reporterName} reported "${report.providerName}" for: ${report.reason}`,
      timestamp: new Date().toISOString(),
      read: false,
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const getAllReports = async () => {
  try {
    const data = await AsyncStorage.getItem(REPORTS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const deleteReport = async (reportId) => {
  try {
    const all = await getAllReports();
    const updated = all.filter((r) => r.id !== reportId);
    await AsyncStorage.setItem(REPORTS_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ REFERRALS ============
const REFERRALS_KEY = '@nadma_referrals';

export const generateReferralCode = async (userId) => {
  try {
    const all = await getAllReferrals();
    const existing = all.find((r) => r.userId === userId);
    if (existing) return existing.code;
    const code = 'NADMA' + userId.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    all.push({ userId, code, referrals: 0, createdAt: new Date().toISOString() });
    await AsyncStorage.setItem(REFERRALS_KEY, JSON.stringify(all));
    return code;
  } catch (error) {
    return null;
  }
};

export const getAllReferrals = async () => {
  try {
    const data = await AsyncStorage.getItem(REFERRALS_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const applyReferralCode = async (code, newUserId) => {
  try {
    const all = await getAllReferrals();
    const ref = all.find((r) => r.code === code.toUpperCase());
    if (!ref || ref.userId === newUserId) return false;
    ref.referrals += 1;
    await AsyncStorage.setItem(REFERRALS_KEY, JSON.stringify(all));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ COMMUNITY BOARD ============
const COMMUNITY_KEY = '@nadma_community';

export const addCommunityPost = async (post) => {
  try {
    const all = await getCommunityPosts();
    all.push(post);
    await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(all));
    return true;
  } catch (error) {
    return false;
  }
};

export const getCommunityPosts = async () => {
  try {
    const data = await AsyncStorage.getItem(COMMUNITY_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const deleteCommunityPost = async (postId) => {
  try {
    const all = await getCommunityPosts();
    const updated = all.filter((p) => p.id !== postId);
    await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(updated));
    return true;
  } catch (error) {
    return false;
  }
};

export const addPostComment = async (postId, comment) => {
  try {
    const all = await getCommunityPosts();
    const index = all.findIndex((p) => p.id === postId);
    if (index !== -1) {
      if (!all[index].comments) all[index].comments = [];
      all[index].comments.push(comment);
      await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(all));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const togglePostLike = async (postId, userId) => {
  try {
    const all = await getCommunityPosts();
    const index = all.findIndex((p) => p.id === postId);
    if (index === -1) return false;
    const post = all[index];
    if (!post.likes) post.likes = [];
    const likedIndex = post.likes.indexOf(userId);
    if (likedIndex > -1) {
      post.likes.splice(likedIndex, 1);
    } else {
      post.likes.push(userId);
    }
    await AsyncStorage.setItem(COMMUNITY_KEY, JSON.stringify(all));
    return true;
  } catch (error) {
    return false;
  }
};

// ============ PROVIDER DASHBOARD ============
export const getProviderStats = async (providerId) => {
  try {
    const bookings = await getAllBookings();
    const reviews = await getAllReviews();
    const providerBookings = bookings.filter((b) => b.businessId === providerId);
    const providerReviews = reviews.filter((r) => r.serviceId === providerId);
    const completed = providerBookings.filter((b) => b.status === 'completed');
    const pending = providerBookings.filter((b) => b.status === 'pending');
    const avgRating = providerReviews.length > 0
      ? providerReviews.reduce((sum, r) => sum + r.rating, 0) / providerReviews.length
      : 0;
    return {
      totalBookings: providerBookings.length,
      completedBookings: completed.length,
      pendingBookings: pending.length,
      totalReviews: providerReviews.length,
      avgRating: Math.round(avgRating * 10) / 10,
    };
  } catch (error) {
    return { totalBookings: 0, completedBookings: 0, pendingBookings: 0, totalReviews: 0, avgRating: 0 };
  }
};

export const getAdminAnalytics = async () => {
  try {
    const users = await getAllUsers();
    const bookings = await getAllBookings();
    const reviews = await getAllReviews();
    const businesses = await getRegisteredBusinesses();
    const providers = await getAllServiceProviders();
    const thisWeek = new Date();
    thisWeek.setDate(thisWeek.getDate() - 7);
    const weekBookings = bookings.filter((b) => new Date(b.createdAt) > thisWeek);
    const completedBookings = bookings.filter((b) => b.status === 'completed');
    const avgRating = reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0;
    return {
      totalUsers: users.length,
      totalBookings: bookings.length,
      weekBookings: weekBookings.length,
      completedBookings: completedBookings.length,
      totalReviews: reviews.length,
      avgRating: Math.round(avgRating * 10) / 10,
      totalBusinesses: businesses.length,
      totalProviders: providers.length,
      pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    };
  } catch (error) {
    return { totalUsers: 0, totalBookings: 0, weekBookings: 0, completedBookings: 0, totalReviews: 0, avgRating: 0, totalBusinesses: 0, totalProviders: 0, pendingBookings: 0 };
  }
};

// ============ PROVIDER AVAILABILITY ============
export const setProviderAvailability = async (providerId, availability) => {
  try {
    const existing = await getAllServiceProviders();
    const index = existing.findIndex((p) => p.id === providerId);
    if (index !== -1) {
      existing[index].availability = availability;
      await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(existing));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const getProviderAvailability = async (providerId) => {
  try {
    const providers = await getAllServiceProviders();
    const provider = providers.find((p) => p.id === providerId);
    return provider?.availability || null;
  } catch (error) {
    return null;
  }
};

// ============ PROVIDER PORTFOLIO ============
export const addPortfolioPhoto = async (providerId, photoUri) => {
  try {
    const existing = await getAllServiceProviders();
    const index = existing.findIndex((p) => p.id === providerId);
    if (index !== -1) {
      if (!existing[index].portfolio) existing[index].portfolio = [];
      existing[index].portfolio.push({ uri: photoUri, addedAt: new Date().toISOString() });
      await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(existing));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const removePortfolioPhoto = async (providerId, photoIndex) => {
  try {
    const existing = await getAllServiceProviders();
    const index = existing.findIndex((p) => p.id === providerId);
    if (index !== -1 && existing[index].portfolio) {
      existing[index].portfolio.splice(photoIndex, 1);
      await AsyncStorage.setItem(SERVICE_PROVIDERS_KEY, JSON.stringify(existing));
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

// ============ PUSH NOTIFICATIONS ============
const PUSH_TOKEN_KEY = '@nadma_push_token';

export const savePushToken = async (token) => {
  try {
    await AsyncStorage.setItem(PUSH_TOKEN_KEY, token);
    return true;
  } catch (error) {
    return false;
  }
};

export const getPushToken = async () => {
  try {
    return await AsyncStorage.getItem(PUSH_TOKEN_KEY);
  } catch (error) {
    return null;
  }
};

// ============ OFFLINE CACHE ============
const CACHE_KEY = '@nadma_cache';
const CACHE_TIMESTAMP_KEY = '@nadma_cache_timestamp';

export const cacheProviders = async (providers) => {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(providers));
    await AsyncStorage.setItem(CACHE_TIMESTAMP_KEY, new Date().toISOString());
    return true;
  } catch (error) {
    return false;
  }
};

export const getCachedProviders = async () => {
  try {
    const data = await AsyncStorage.getItem(CACHE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    return [];
  }
};

export const getCacheAge = async () => {
  try {
    const timestamp = await AsyncStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return null;
    const diff = Date.now() - new Date(timestamp).getTime();
    return Math.floor(diff / 60000); // minutes
  } catch (error) {
    return null;
  }
};

export const getRecommendedProviders = async (userId) => {
  try {
    const providers = await getAllServiceProviders();
    const bookings = await getBookingsByUser(userId);
    const favorites = await getFavorites();
    const reviews = await getAllReviews();
    
    if (providers.length === 0) return [];
    
    if (bookings.length === 0 && favorites.length === 0) {
      return providers
        .sort((a, b) => (b.rating || 0) - (a.rating || 0))
        .slice(0, 5);
    }
    
    const categoryScores = {};
    
    bookings.forEach(b => {
      if (b.category) categoryScores[b.category] = (categoryScores[b.category] || 0) + 3;
    });
    
    favorites.forEach(fav => {
      const provider = providers.find(p => p.id === fav);
      if (provider) categoryScores[provider.category] = (categoryScores[provider.category] || 0) + 5;
    });
    
    const userReviews = reviews.filter(r => r.userId === userId && r.rating >= 4);
    userReviews.forEach(r => {
      const provider = providers.find(p => p.id === r.serviceId || p.id === r.businessId);
      if (provider) categoryScores[provider.category] = (categoryScores[provider.category] || 0) + 2;
    });
    
    const scored = providers.map(p => {
      const categoryMatch = categoryScores[p.category] || 0;
      const ratingScore = (p.rating || 0) * 2;
      const reviewScore = Math.min((p.reviews || 0), 10);
      const isFav = favorites.includes(p.id) ? 5 : 0;
      const score = (categoryMatch * 3) + ratingScore + reviewScore + isFav;
      return { ...p, matchScore: score };
    });
    
    return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  } catch (error) {
    return [];
  }
};
