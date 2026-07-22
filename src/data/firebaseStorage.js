import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, serverTimestamp, onSnapshot
} from 'firebase/firestore';

const ADMIN_EMAILS = ['munangimuyambangorodwell@gmail.com', 'munangimuyambangorodwell'];

let localCurrentUser = null;
let localCache = null;
let localCacheTimestamp = null;

const isAdminEmail = (email) => {
  if (!email) return false;
  const lower = email.toLowerCase();
  return ADMIN_EMAILS.some(e => lower === e.toLowerCase());
};

const defaultCategories = [
  { id: '1', name: 'Plumbing', icon: 'water-outline', color: '#2196F3', image: 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600', tagline: 'Expert plumbers for all your water needs', description: 'Pipe repairs, drain cleaning, installations, and emergency plumbing services' },
  { id: '2', name: 'Electrical', icon: 'flash-outline', color: '#FF9800', image: 'https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600', tagline: 'Safe and certified electrical work', description: 'Wiring, installations, solar panels, safety inspections, and repairs' },
  { id: '3', name: 'Carpentry', icon: 'hammer-outline', color: '#795548', image: 'https://images.unsplash.com/photo-1558618666-fcd25c85f82e?w=600', tagline: 'Custom woodwork and furniture', description: 'Furniture, doors, windows, kitchen cabinets, and custom woodwork' },
  { id: '4', name: 'Painting', icon: 'brush-outline', color: '#9C27B0', image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?w=600', tagline: 'Transform your space with color', description: 'Interior, exterior, decorative finishes, wallpaper, and murals' },
  { id: '5', name: 'Cleaning', icon: 'sparkles', color: '#4CAF50', image: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=600', tagline: 'Professional cleaning services', description: 'Deep cleaning, office cleaning, post-construction, and carpet cleaning' },
  { id: '6', name: 'Gardening', icon: 'leaf-outline', color: '#8BC34A', image: 'https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=600', tagline: 'Beautiful outdoor spaces', description: 'Landscaping, lawn care, tree trimming, irrigation, and garden design' },
];

const CATEGORIES_KEY = 'categories';

const getAdminUserIds = async () => {
  try {
    const snapshot = await getDocs(query(col(COLLECTIONS.users), where('role', '==', 'admin')));
    return snapshot.docs.map(d => d.id);
  } catch (e) {
    return [];
  }
};

const COLLECTIONS = {
  users: 'users',
  businesses: 'businesses',
  providers: 'providers',
  favorites: 'favorites',
  reviews: 'reviews',
  bookings: 'bookings',
  messages: 'messages',
  notifications: 'notifications',
  reports: 'reports',
  referrals: 'referrals',
  posts: 'posts',
  categories: 'categories',
  settings: 'settings',
};

const col = (name) => collection(db, name);
const ref = (name, id) => doc(db, name, id);
const get = (name, id) => getDoc(ref(name, id));
const getAll = (name) => getDocs(col(name));
const set = (name, id, data) => setDoc(ref(name, id), data);
const update = (name, id, data) => updateDoc(ref(name, id), data);
const remove = (name, id) => deleteDoc(ref(name, id));

const queryWhere = (collName, field, op, value) => getDocs(query(col(collName), where(field, op, value)));
const queryWhereTwo = (collName, f1, op1, v1, f2, op2, v2) => getDocs(query(col(collName), where(f1, op1, v1), where(f2, op2, v2)));
const queryOrdered = (collName, field, dir) => getDocs(query(col(collName), orderBy(field, dir)));

const fetchAllDocs = async (snapshot) => {
  const results = [];
  snapshot.forEach((d) => results.push({ id: d.id, ...d.data() }));
  return results;
};

const ensureUserDoc = async (uid, data) => {
  const existing = await get(COLLECTIONS.users, uid);
  if (!existing.exists()) {
    await set(COLLECTIONS.users, uid, data);
  }
};

// ── Rate Limiting ──────────────────────────────────────────────
const RATE_LIMITS = {
  booking: { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  review:  { maxRequests: 3, windowMs: 60 * 60 * 1000 },
  message: { maxRequests: 30, windowMs: 60 * 60 * 1000 },
  post:    { maxRequests: 5, windowMs: 60 * 60 * 1000 },
  report:  { maxRequests: 3, windowMs: 60 * 60 * 1000 },
};

const COLLECTION_TO_RATE_KEY = {
  [COLLECTIONS.bookings]: 'booking',
  [COLLECTIONS.reviews]: 'review',
  [COLLECTIONS.messages]: 'message',
  [COLLECTIONS.posts]: 'post',
  [COLLECTIONS.reports]: 'report',
};

const checkRateLimit = async (userId, collectionName) => {
  const action = COLLECTION_TO_RATE_KEY[collectionName];
  const limit = RATE_LIMITS[action];
  if (!limit) return { allowed: true };
  try {
    const snap = await getDocs(query(col(collectionName), where('userId', '==', userId)));
    const count = snap.size;
    if (count >= limit.maxRequests) {
      const oldest = snap.docs.reduce((min, d) => {
        const ts = d.data().createdAt?.seconds
          ? d.data().createdAt.seconds * 1000
          : new Date(d.data().createdAt || d.data().timestamp || 0).getTime();
        return ts < min ? ts : min;
      }, Infinity);
      const retryMs = Math.max(0, oldest + limit.windowMs - Date.now());
      return {
        allowed: false,
        retryAfterMin: Math.ceil(retryMs / 60000) || 1,
        message: `Rate limit reached. Try again in ${Math.ceil(retryMs / 60000) || 1} minute(s).`,
      };
    }
    return { allowed: true };
  } catch (e) {
    return { allowed: true };
  }
};

export const getAllCategories = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.categories);
    if (snapshot.size === 0) {
      for (const cat of defaultCategories) {
        await set(COLLECTIONS.categories, cat.id, cat);
      }
      return defaultCategories;
    }
    return await fetchAllDocs(snapshot);
  } catch (e) {
    return defaultCategories;
  }
};

export const addCategory = async (category) => {
  try {
    const id = 'cat_' + Date.now();
    const newCategory = { ...category, id };
    await set(COLLECTIONS.categories, id, newCategory);
    return { success: true, category: newCategory };
  } catch (e) {
    return { success: false, error: 'Failed to add category' };
  }
};

export const updateCategory = async (categoryId, updates) => {
  try {
    const snap = await get(COLLECTIONS.categories, categoryId);
    if (!snap.exists()) return { success: false, error: 'Category not found' };
    await update(COLLECTIONS.categories, categoryId, updates);
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to update category' };
  }
};

export const deleteCategory = async (categoryId) => {
  try {
    await remove(COLLECTIONS.categories, categoryId);
    return { success: true };
  } catch (e) {
    return { success: false, error: 'Failed to delete category' };
  }
};

export const signup = async (email, password, name, role = 'user') => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    const isAdmin = isAdminEmail(email);
    const userRole = isAdmin ? 'admin' : role;
    const userData = {
      id: firebaseUser.uid,
      email,
      name,
      role: userRole,
      banned: false,
      createdAt: new Date().toISOString(),
    };
    await set(COLLECTIONS.users, firebaseUser.uid, userData);
    localCurrentUser = userData;
    return { success: true, user: userData };
  } catch (error) {
    const msg = error.code === 'auth/email-already-in-use' ? 'Email already registered' : 'Signup failed';
    return { success: false, error: msg };
  }
};

export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    const userDoc = await get(COLLECTIONS.users, firebaseUser.uid);
    let userData;
    if (userDoc.exists()) {
      userData = { id: userDoc.id, ...userDoc.data() };
    } else {
      userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email,
        role: isAdminEmail(email) ? 'admin' : 'user',
        banned: false,
        createdAt: new Date().toISOString(),
      };
      await set(COLLECTIONS.users, firebaseUser.uid, userData);
    }
    if (userData.banned) {
      await signOut(auth);
      return { success: false, error: 'Account has been banned' };
    }
    if (isAdminEmail(email) && userData.role !== 'admin') {
      userData.role = 'admin';
      await update(COLLECTIONS.users, firebaseUser.uid, { role: 'admin' });
    }
    localCurrentUser = userData;
    return { success: true, user: userData };
  } catch (error) {
    const msg = error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password'
      ? 'Invalid email or password' : 'Login failed';
    return { success: false, error: msg };
  }
};

export const logout = async () => {
  try {
    await signOut(auth);
  } catch (e) {}
  localCurrentUser = null;
};

export const setCurrentUser = async (user) => {
  localCurrentUser = user;
};

export const getCurrentUser = async () => {
  try {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) return localCurrentUser || null;
    const userDoc = await get(COLLECTIONS.users, firebaseUser.uid);
    if (!userDoc.exists()) {
      const userData = {
        id: firebaseUser.uid,
        email: firebaseUser.email,
        name: firebaseUser.displayName || firebaseUser.email,
        role: isAdminEmail(firebaseUser.email) ? 'admin' : 'user',
        banned: false,
        createdAt: new Date().toISOString(),
      };
      await set(COLLECTIONS.users, firebaseUser.uid, userData);
      localCurrentUser = userData;
      return userData;
    }
    const userData = { id: userDoc.id, ...userDoc.data() };
    if (isAdminEmail(userData.email) && userData.role !== 'admin') {
      userData.role = 'admin';
      await update(COLLECTIONS.users, firebaseUser.uid, { role: 'admin' });
    }
    localCurrentUser = userData;
    return userData;
  } catch (error) {
    return localCurrentUser || null;
  }
};

export const updateCurrentUser = async (updates) => {
  try {
    const user = await getCurrentUser();
    if (!user) return null;
    const updatedUser = { ...user, ...updates };
    await update(COLLECTIONS.users, user.id, updates);
    localCurrentUser = updatedUser;
    return updatedUser;
  } catch (error) {
    return null;
  }
};

export const getAllUsers = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.users);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const banUser = async (userId) => {
  try {
    await update(COLLECTIONS.users, userId, { banned: true });
    return true;
  } catch (error) {
    return false;
  }
};

export const unbanUser = async (userId) => {
  try {
    await update(COLLECTIONS.users, userId, { banned: false });
    return true;
  } catch (error) {
    return false;
  }
};

export const deleteUser = async (userId) => {
  try {
    await remove(COLLECTIONS.users, userId);
    return true;
  } catch (error) {
    return false;
  }
};

export const saveRegisteredBusiness = async (business) => {
  try {
    const id = business.id || 'biz_' + Date.now();
    await set(COLLECTIONS.businesses, id, { ...business, id });
    return true;
  } catch (error) {
    return false;
  }
};

export const registerBusiness = saveRegisteredBusiness;

export const getRegisteredBusinesses = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.businesses);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getAllBusinesses = getRegisteredBusinesses;

export const getApprovedBusinesses = async () => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.businesses, 'approvalStatus', '==', 'approved');
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getPendingBusinesses = async () => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.businesses, 'approvalStatus', '==', 'pending');
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const updateBusiness = async (businessId, updates) => {
  try {
    const snap = await get(COLLECTIONS.businesses, businessId);
    if (!snap.exists()) return false;
    await update(COLLECTIONS.businesses, businessId, updates);
    return true;
  } catch (error) {
    return false;
  }
};

export const approveBusiness = async (businessId) => {
  const result = await updateBusiness(businessId, { approvalStatus: 'approved' });
  if (result) {
    const snap = await get(COLLECTIONS.businesses, businessId);
    if (snap.exists()) {
      const business = { id: snap.id, ...snap.data() };
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
    const snap = await get(COLLECTIONS.businesses, businessId);
    if (snap.exists()) {
      const business = { id: snap.id, ...snap.data() };
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
    await remove(COLLECTIONS.businesses, businessId);
    return true;
  } catch (error) {
    return false;
  }
};

export const seedDefaultProviders = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.providers);
    if (snapshot.size > 0) return;
    const { allServices } = require('./services');
    const batch = writeBatch(db);
    for (const provider of allServices) {
      const docRef = doc(db, COLLECTIONS.providers, provider.id);
      batch.set(docRef, provider);
    }
    await batch.commit();
  } catch (error) {}
};

export const getAllServiceProviders = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.providers);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getServiceProvidersByCategory = async (categoryName) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.providers, 'category', '==', categoryName);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const addServiceProvider = async (provider) => {
  try {
    const id = provider.id || 'prov_' + Date.now();
    await set(COLLECTIONS.providers, id, { ...provider, id });
    return true;
  } catch (error) {
    return false;
  }
};

export const updateServiceProvider = async (providerId, updates) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return false;
    await update(COLLECTIONS.providers, providerId, updates);
    return true;
  } catch (error) {
    return false;
  }
};

export const deleteServiceProvider = async (providerId) => {
  try {
    await remove(COLLECTIONS.providers, providerId);
    return true;
  } catch (error) {
    return false;
  }
};

export const addFavorite = async (userId, businessId) => {
  try {
    const docId = `${userId}_${businessId}`;
    await set(COLLECTIONS.favorites, docId, { userId, businessId, createdAt: new Date().toISOString() });
    return true;
  } catch (error) {
    return false;
  }
};

export const removeFavorite = async (userId, serviceId) => {
  try {
    if (userId) {
      const docId = `${userId}_${serviceId}`;
      await remove(COLLECTIONS.favorites, docId);
      return true;
    }
    const snapshot = await queryWhere(COLLECTIONS.favorites, 'businessId', '==', serviceId);
    const batch = writeBatch(db);
    snapshot.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch (error) {
    return false;
  }
};

export const getUserFavorites = async (userId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.favorites, 'userId', '==', userId);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getFavorites = async () => {
  try {
    const user = localCurrentUser || await getCurrentUser();
    if (!user) return [];
    return await getUserFavorites(user.id);
  } catch (error) {
    return [];
  }
};

export const isFavorite = async (userIdOrServiceId, businessId) => {
  try {
    if (businessId) {
      const docId = `${userIdOrServiceId}_${businessId}`;
      const snap = await get(COLLECTIONS.favorites, docId);
      return snap.exists();
    }
    const snapshot = await queryWhere(COLLECTIONS.favorites, 'businessId', '==', userIdOrServiceId);
    return snapshot.size > 0;
  } catch (error) {
    return false;
  }
};

export const toggleFavorite = async (service) => {
  try {
    const user = localCurrentUser || await getCurrentUser();
    if (!user) return false;
    const docId = `${user.id}_${service.id}`;
    const snap = await get(COLLECTIONS.favorites, docId);
    if (snap.exists()) {
      await remove(COLLECTIONS.favorites, docId);
      return false;
    } else {
      await set(COLLECTIONS.favorites, docId, {
        userId: user.id,
        businessId: service.id,
        serviceData: service,
        createdAt: new Date().toISOString(),
      });
      return true;
    }
  } catch (error) {
    return false;
  }
};

export const addReview = async (review) => {
  try {
    const rateCheck = await checkRateLimit(review.userId, COLLECTIONS.reviews);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };
    const id = review.id || 'rev_' + Date.now();
    await set(COLLECTIONS.reviews, id, { ...review, id });
    return true;
  } catch (error) {
    return false;
  }
};

export const getReviews = async (serviceId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.reviews, 'serviceId', '==', serviceId);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getBusinessReviews = getReviews;

export const getAllReviews = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.reviews);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const deleteReview = async (reviewId) => {
  try {
    await remove(COLLECTIONS.reviews, reviewId);
    return true;
  } catch (error) {
    return false;
  }
};

export const createBooking = async (booking) => {
  try {
    const rateCheck = await checkRateLimit(booking.userId, COLLECTIONS.bookings);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };
    const id = booking.id || 'book_' + Date.now();
    await set(COLLECTIONS.bookings, id, { ...booking, id });
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await addNotification({
        id: 'notif_' + Date.now() + '_' + adminId.slice(0, 4),
        userId: adminId,
        type: 'new_booking',
        title: 'New Booking',
        message: `${booking.userName} booked ${booking.businessName} for ${booking.date} at ${booking.time}`,
        bookingId: id,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const getAllBookings = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.bookings);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getBookingsByUser = async (userId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.bookings, 'userId', '==', userId);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getUserBookings = getBookingsByUser;

export const getBookingsByBusiness = async (businessId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.bookings, 'businessId', '==', businessId);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const updateBookingStatus = async (bookingId, status) => {
  try {
    const snap = await get(COLLECTIONS.bookings, bookingId);
    if (!snap.exists()) return false;
    const booking = { id: snap.id, ...snap.data() };
    await update(COLLECTIONS.bookings, bookingId, { status });
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
  } catch (error) {
    return false;
  }
};

export const cancelBooking = async (bookingId) => {
  return updateBookingStatus(bookingId, 'cancelled');
};

export const rateBooking = async (bookingId, rating, review) => {
  try {
    await update(COLLECTIONS.bookings, bookingId, { rating, review, ratedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    return false;
  }
};

export const sendMessage = async (message) => {
  try {
    const rateCheck = await checkRateLimit(message.senderId, COLLECTIONS.messages);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };
    const id = message.id || 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await set(COLLECTIONS.messages, id, { ...message, id });
    return true;
  } catch (error) {
    return false;
  }
};

export const getAllMessages = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.messages);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getConversation = async (userId, otherId) => {
  try {
    const q1 = query(col(COLLECTIONS.messages), where('senderId', '==', userId), where('receiverId', '==', otherId));
    const q2 = query(col(COLLECTIONS.messages), where('senderId', '==', otherId), where('receiverId', '==', userId));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const messages = [];
    snap1.forEach((d) => messages.push({ id: d.id, ...d.data() }));
    snap2.forEach((d) => messages.push({ id: d.id, ...d.data() }));
    messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
    return messages;
  } catch (error) {
    return [];
  }
};

export const getMessages = getConversation;

const buildConversations = async (userId, filterType) => {
  try {
    const q1 = query(col(COLLECTIONS.messages), where('senderId', '==', userId));
    const q2 = query(col(COLLECTIONS.messages), where('receiverId', '==', userId));
    const [snap1, snap2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    const all = [];
    snap1.forEach((d) => all.push({ id: d.id, ...d.data() }));
    snap2.forEach((d) => all.push({ id: d.id, ...d.data() }));
    const conversations = {};
    all.forEach((msg) => {
      if (filterType && msg.conversationType !== filterType) return;
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

export const getConversationsForUser = async (userId) => {
  return buildConversations(userId, null);
};

export const getConversations = getConversationsForUser;

export const getConversationsForAdmin = async (adminId) => {
  return buildConversations(adminId, 'admin');
};

export const markMessagesRead = async (senderId, receiverId) => {
  try {
    const q = query(col(COLLECTIONS.messages),
      where('senderId', '==', senderId),
      where('receiverId', '==', receiverId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    const batch = writeBatch(db);
    snapshot.forEach((d) => batch.update(d.ref, { read: true }));
    await batch.commit();
    return true;
  } catch (error) {
    return false;
  }
};

export const addNotification = async (notification) => {
  try {
    const id = notification.id || 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    await set(COLLECTIONS.notifications, id, { ...notification, id });
    return true;
  } catch (error) {
    return false;
  }
};

export const getAllNotifications = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.notifications);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getNotificationsByUser = async (userId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.notifications, 'userId', '==', userId);
    const results = await fetchAllDocs(snapshot);
    return results.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  } catch (error) {
    return [];
  }
};

export const getNotifications = getNotificationsByUser;

export const markNotificationRead = async (notificationId) => {
  try {
    await update(COLLECTIONS.notifications, notificationId, { read: true });
    return true;
  } catch (error) {
    return false;
  }
};

export const markAllNotificationsRead = async (userId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.notifications, 'userId', '==', userId);
    const batch = writeBatch(db);
    snapshot.forEach((d) => {
      const data = d.data();
      if (!data.read) {
        batch.update(d.ref, { read: true });
      }
    });
    await batch.commit();
    return true;
  } catch (error) {
    return false;
  }
};

export const getUnreadNotificationCount = async (userId) => {
  try {
    const snapshot = await queryWhereTwo(COLLECTIONS.notifications, 'userId', '==', userId, 'read', '==', false);
    return snapshot.size;
  } catch (error) {
    return 0;
  }
};

export const getUnreadCount = getUnreadNotificationCount;

export const addReport = async (report) => {
  try {
    const rateCheck = await checkRateLimit(report.userId, COLLECTIONS.reports);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };
    const id = report.id || 'rpt_' + Date.now();
    await set(COLLECTIONS.reports, id, { ...report, id });
    const adminIds = await getAdminUserIds();
    for (const adminId of adminIds) {
      await addNotification({
        id: 'notif_' + Date.now() + '_' + adminId.slice(0, 4),
        userId: adminId,
        type: 'new_report',
        title: 'Provider Reported',
        message: `${report.reporterName} reported "${report.providerName}" for: ${report.reason}`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const reportProvider = addReport;

export const getAllReports = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.reports);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const deleteReport = async (reportId) => {
  try {
    await remove(COLLECTIONS.reports, reportId);
    return true;
  } catch (error) {
    return false;
  }
};

export const generateReferralCode = async (userId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.referrals, 'userId', '==', userId);
    if (!snapshot.empty) {
      return snapshot.docs[0].data().code;
    }
    const code = 'NADMA' + userId.slice(-4).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
    await set(COLLECTIONS.referrals, userId, { userId, code, referrals: 0, createdAt: new Date().toISOString() });
    return code;
  } catch (error) {
    return null;
  }
};

export const getUserReferralCode = generateReferralCode;

export const getAllReferrals = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.referrals);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const applyReferralCode = async (code, newUserId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.referrals, 'code', '==', code.toUpperCase());
    if (snapshot.empty) return false;
    const refDoc = snapshot.docs[0];
    if (refDoc.data().userId === newUserId) return false;
    await update(COLLECTIONS.referrals, refDoc.id, { referrals: (refDoc.data().referrals || 0) + 1 });
    return true;
  } catch (error) {
    return false;
  }
};

export const addCommunityPost = async (post) => {
  try {
    const rateCheck = await checkRateLimit(post.userId, COLLECTIONS.posts);
    if (!rateCheck.allowed) return { success: false, error: rateCheck.message };
    const id = post.id || 'post_' + Date.now();
    await set(COLLECTIONS.posts, id, { ...post, id });
    return true;
  } catch (error) {
    return false;
  }
};

export const createPost = addCommunityPost;

export const getCommunityPosts = async () => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.posts);
    return await fetchAllDocs(snapshot);
  } catch (error) {
    return [];
  }
};

export const getAllPosts = getCommunityPosts;

export const deleteCommunityPost = async (postId) => {
  try {
    await remove(COLLECTIONS.posts, postId);
    return true;
  } catch (error) {
    return false;
  }
};

export const deletePost = deleteCommunityPost;

export const addPostComment = async (postId, comment) => {
  try {
    const snap = await get(COLLECTIONS.posts, postId);
    if (!snap.exists()) return false;
    const post = snap.data();
    const comments = post.comments || [];
    comments.push(comment);
    await update(COLLECTIONS.posts, postId, { comments });
    return true;
  } catch (error) {
    return false;
  }
};

export const addComment = addPostComment;

export const togglePostLike = async (postId, userId) => {
  try {
    const snap = await get(COLLECTIONS.posts, postId);
    if (!snap.exists()) return false;
    const post = snap.data();
    const likes = post.likes || [];
    const idx = likes.indexOf(userId);
    if (idx > -1) {
      likes.splice(idx, 1);
    } else {
      likes.push(userId);
    }
    await update(COLLECTIONS.posts, postId, { likes });
    return true;
  } catch (error) {
    return false;
  }
};

export const likePost = async (postId, userId) => {
  try {
    const snap = await get(COLLECTIONS.posts, postId);
    if (!snap.exists()) return false;
    const post = snap.data();
    const likes = post.likes || [];
    if (!likes.includes(userId)) {
      likes.push(userId);
      await update(COLLECTIONS.posts, postId, { likes });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const unlikePost = async (postId, userId) => {
  try {
    const snap = await get(COLLECTIONS.posts, postId);
    if (!snap.exists()) return false;
    const post = snap.data();
    const likes = post.likes || [];
    const idx = likes.indexOf(userId);
    if (idx > -1) {
      likes.splice(idx, 1);
      await update(COLLECTIONS.posts, postId, { likes });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const getProviderStats = async (providerId) => {
  try {
    const [bookingsSnap, reviewsSnap] = await Promise.all([
      queryWhere(COLLECTIONS.bookings, 'businessId', '==', providerId),
      queryWhere(COLLECTIONS.reviews, 'serviceId', '==', providerId),
    ]);
    const providerBookings = await fetchAllDocs(bookingsSnap);
    const providerReviews = await fetchAllDocs(reviewsSnap);
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
    const [usersSnap, bookingsSnap, reviewsSnap, businessesSnap, providersSnap] = await Promise.all([
      getAllDocs(COLLECTIONS.users),
      getAllDocs(COLLECTIONS.bookings),
      getAllDocs(COLLECTIONS.reviews),
      getAllDocs(COLLECTIONS.businesses),
      getAllDocs(COLLECTIONS.providers),
    ]);
    const users = await fetchAllDocs(usersSnap);
    const bookings = await fetchAllDocs(bookingsSnap);
    const reviews = await fetchAllDocs(reviewsSnap);
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
      totalBusinesses: businessesSnap.size,
      totalProviders: providersSnap.size,
      pendingBookings: bookings.filter((b) => b.status === 'pending').length,
    };
  } catch (error) {
    return { totalUsers: 0, totalBookings: 0, weekBookings: 0, completedBookings: 0, totalReviews: 0, avgRating: 0, totalBusinesses: 0, totalProviders: 0, pendingBookings: 0 };
  }
};

export const setProviderAvailability = async (providerId, availability) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return false;
    await update(COLLECTIONS.providers, providerId, { availability });
    return true;
  } catch (error) {
    return false;
  }
};

export const updateProviderAvailability = setProviderAvailability;

export const getProviderAvailability = async (providerId) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return null;
    return snap.data().availability || null;
  } catch (error) {
    return null;
  }
};

export const addPortfolioPhoto = async (providerId, photoUri) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return false;
    const data = snap.data();
    const portfolio = data.portfolio || [];
    portfolio.push({ uri: photoUri, addedAt: new Date().toISOString() });
    await update(COLLECTIONS.providers, providerId, { portfolio });
    return true;
  } catch (error) {
    return false;
  }
};

export const addPortfolioItem = addPortfolioPhoto;

export const getProviderPortfolio = async (providerId) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return [];
    return snap.data().portfolio || [];
  } catch (error) {
    return [];
  }
};

export const removePortfolioPhoto = async (providerId, photoIndex) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return false;
    const data = snap.data();
    const portfolio = data.portfolio || [];
    if (photoIndex >= 0 && photoIndex < portfolio.length) {
      portfolio.splice(photoIndex, 1);
      await update(COLLECTIONS.providers, providerId, { portfolio });
      return true;
    }
    return false;
  } catch (error) {
    return false;
  }
};

export const savePushToken = async (token) => {
  try {
    const user = localCurrentUser || await getCurrentUser();
    if (user) {
      await update(COLLECTIONS.users, user.id, { pushToken: token });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const getPushToken = async () => {
  try {
    const user = localCurrentUser || await getCurrentUser();
    if (!user) return null;
    const snap = await get(COLLECTIONS.users, user.id);
    if (!snap.exists()) return null;
    return snap.data().pushToken || null;
  } catch (error) {
    return null;
  }
};

export const cacheProviders = async (providers) => {
  try {
    localCache = providers;
    localCacheTimestamp = new Date().toISOString();
    const user = localCurrentUser || await getCurrentUser();
    if (user) {
      await set(COLLECTIONS.settings, 'cache_' + user.id, { providers, timestamp: localCacheTimestamp });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const getCachedProviders = async () => {
  try {
    if (localCache) return localCache;
    const user = localCurrentUser || await getCurrentUser();
    if (!user) return [];
    const snap = await get(COLLECTIONS.settings, 'cache_' + user.id);
    if (!snap.exists()) return [];
    const data = snap.data();
    localCache = data.providers || [];
    localCacheTimestamp = data.timestamp;
    return localCache;
  } catch (error) {
    return [];
  }
};

export const getCacheAge = async () => {
  try {
    if (localCacheTimestamp) {
      const diff = Date.now() - new Date(localCacheTimestamp).getTime();
      return Math.floor(diff / 60000);
    }
    const user = localCurrentUser || await getCurrentUser();
    if (!user) return null;
    const snap = await get(COLLECTIONS.settings, 'cache_' + user.id);
    if (!snap.exists()) return null;
    const timestamp = snap.data().timestamp;
    if (!timestamp) return null;
    const diff = Date.now() - new Date(timestamp).getTime();
    return Math.floor(diff / 60000);
  } catch (error) {
    return null;
  }
};

export const clearCache = async () => {
  try {
    localCache = null;
    localCacheTimestamp = null;
    const user = localCurrentUser || await getCurrentUser();
    if (user) {
      await remove(COLLECTIONS.settings, 'cache_' + user.id);
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const getRecommendedProviders = async (userId) => {
  try {
    const [providers, bookingsSnap, favorites, reviewsSnap] = await Promise.all([
      getAllServiceProviders(),
      queryWhere(COLLECTIONS.bookings, 'userId', '==', userId),
      getUserFavorites(userId),
      getAllReviews(),
    ]);

    const bookings = await fetchAllDocs(bookingsSnap);
    const reviews = reviewsSnap;

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

    const favIds = favorites.map(f => f.businessId || f.id);
    favorites.forEach(fav => {
      const provider = providers.find(p => p.id === (fav.businessId || fav.id));
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
      const isFav = favIds.includes(p.id) ? 5 : 0;
      const score = (categoryMatch * 3) + ratingScore + reviewScore + isFav;
      return { ...p, matchScore: score };
    });

    return scored.sort((a, b) => b.matchScore - a.matchScore).slice(0, 5);
  } catch (error) {
    return [];
  }
};

export const onBookingsSnapshot = (callback) => {
  try {
    const q = query(col(COLLECTIONS.bookings), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  } catch (e) {
    return () => {};
  }
};

export const onUserBookingsSnapshot = (userId, callback) => {
  try {
    const q = query(col(COLLECTIONS.bookings), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tb = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tb - ta;
      }));
    });
  } catch (e) {
    return () => {};
  }
};

export const onNotificationsSnapshot = (userId, callback) => {
  try {
    const q = query(col(COLLECTIONS.notifications), where('userId', '==', userId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return tb - ta;
      }));
    });
  } catch (e) {
    return () => {};
  }
};

export const onMessagesSnapshot = (userId, otherUserId, callback) => {
  try {
    const q = query(
      col(COLLECTIONS.messages),
      where('participants', 'array-contains', userId)
    );
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tb = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return ta - tb;
      });
      const filtered = otherUserId
        ? all.filter(m => m.senderId === otherUserId || m.receiverId === otherUserId)
        : all;
      callback(filtered);
    });
  } catch (e) {
    return () => {};
  }
};

export const onConversationsSnapshot = (userId, callback) => {
  try {
    const q = query(col(COLLECTIONS.messages), where('participants', 'array-contains', userId));
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const convMap = {};
      all.forEach(m => {
        const otherId = m.senderId === userId ? m.receiverId : m.senderId;
        if (!convMap[otherId] || new Date(m.createdAt) > new Date(convMap[otherId].createdAt)) {
          convMap[otherId] = m;
        }
      });
      callback(Object.entries(convMap).map(([uid, msg]) => ({ userId: uid, lastMessage: msg })));
    });
  } catch (e) {
    return () => {};
  }
};

export const onPostsSnapshot = (callback) => {
  try {
    const q = query(col(COLLECTIONS.posts), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  } catch (e) {
    return () => {};
  }
};

export const onProvidersSnapshot = (callback) => {
  try {
    return onSnapshot(col(COLLECTIONS.providers), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  } catch (e) {
    return () => {};
  }
};

export const onCategoriesSnapshot = (callback) => {
  try {
    return onSnapshot(col(COLLECTIONS.categories), (snap) => {
      if (snap.empty) {
        callback(defaultCategories);
      } else {
        callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    });
  } catch (e) {
    callback(defaultCategories);
    return () => {};
  }
};

export const onBusinessesSnapshot = (callback) => {
  try {
    return onSnapshot(col(COLLECTIONS.businesses), (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  } catch (e) {
    return () => {};
  }
};

export const onReviewsSnapshot = (businessId, callback) => {
  try {
    const q = query(col(COLLECTIONS.reviews), where('businessId', '==', businessId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tb = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tb - ta;
      }));
    });
  } catch (e) {
    return () => {};
  }
};
