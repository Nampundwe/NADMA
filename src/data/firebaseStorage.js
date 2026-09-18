import { auth, db } from '../config/firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updatePassword, reauthenticateWithCredential, EmailAuthProvider, sendPasswordResetEmail, sendEmailVerification, reload } from 'firebase/auth';
import {
  collection, doc, getDocs, getDoc, setDoc, updateDoc, deleteDoc,
  query, where, orderBy, writeBatch, onSnapshot, addDoc
} from 'firebase/firestore';
import {
  uploadCommunityImage as uploadCommunityImageCloudinary,
  uploadImage as uploadImageCloudinary,
  uploadImageDetailed as uploadImageDetailedCloudinary,
} from '../utils/cloudinaryUpload';

const FIRST_ADMIN_EMAIL = 'munangimuyambangorodwell@gmail.com';

let localCurrentUser = null;
let localCache = null;
let localCacheTimestamp = null;

const isFirstAdminSignup = (email) => {
  if (!email) return false;
  return email.toLowerCase() === FIRST_ADMIN_EMAIL.toLowerCase();
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
  follows: 'follows',
  presence: 'presence',
  savedPosts: 'savedPosts',
  blockedUsers: 'blockedUsers',
};

const col = (name) => collection(db, name);
const ref = (name, id) => doc(db, name, id);
const get = (name, id) => getDoc(ref(name, id));
const getAll = (name) => getDocs(col(name));
const getAllDocs = getAll;
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

export const signup = async (email, password, name, role = 'user', providerInfo = null) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const firebaseUser = userCredential.user;
    const userRole = isFirstAdminSignup(email) ? 'admin' : role;
    const userData = {
      id: firebaseUser.uid,
      email,
      name,
      role: userRole,
      banned: false,
      createdAt: new Date().toISOString(),
    };
    await set(COLLECTIONS.users, firebaseUser.uid, userData);
    if (userRole === 'provider' && providerInfo) {
      const providerId = 'sp_' + Date.now();
      const providerData = {
        id: providerId,
        ownerId: firebaseUser.uid,
        name: providerInfo.businessName || name,
        category: providerInfo.category || 'General',
        description: providerInfo.description || `Professional services`,
        phone: providerInfo.phone || '',
        address: providerInfo.address || '',
        hours: providerInfo.hours || 'Mon-Sat: 8:00 AM - 5:00 PM',
        services: providerInfo.services || ['General Service'],
        rating: 0,
        reviews: 0,
        image: providerInfo.image || 'https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400',
        isUserRegistered: true,
        createdAt: new Date().toISOString(),
      };
      await set(COLLECTIONS.providers, providerId, providerData);
      userData.providerId = providerId;
      await update(COLLECTIONS.users, firebaseUser.uid, { providerId });
    }
    localCurrentUser = userData;
    return { success: true, user: userData };
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      return { success: false, error: 'Email already registered' };
    }
    if (error.code === 'auth/invalid-email') {
      return { success: false, error: 'Invalid email address' };
    }
    return { success: false, error: 'Signup failed. Please check your email and try again.' };
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
        role: 'user',
        banned: false,
        createdAt: new Date().toISOString(),
      };
      await set(COLLECTIONS.users, firebaseUser.uid, userData);
    }
    if (userData.banned) {
      await signOut(auth);
      return { success: false, error: 'Account has been banned' };
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
        role: 'user',
        banned: false,
        createdAt: new Date().toISOString(),
      };
      await set(COLLECTIONS.users, firebaseUser.uid, userData);
      localCurrentUser = userData;
      return userData;
    }
    const userData = { id: userDoc.id, ...userDoc.data() };
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
    const { password, ...safeUpdates } = updates;
    const updatedUser = { ...user, ...safeUpdates };
    await update(COLLECTIONS.users, user.id, safeUpdates);
    localCurrentUser = updatedUser;
    return updatedUser;
  } catch (error) {
    return null;
  }
};

export const changePassword = async (currentPassword, newPassword) => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not logged in' };
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    return { success: true };
  } catch (error) {
    if (error.code === 'auth/wrong-password') {
      return { success: false, error: 'Current password is incorrect' };
    }
    return { success: false, error: 'Failed to change password' };
  }
};

export const resetPassword = async (email) => {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return { success: false, error: 'No account found with this email' };
    }
    return { success: false, error: 'Failed to send reset email' };
  }
};

export const sendVerificationEmail = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return { success: false, error: 'Not logged in' };
    await sendEmailVerification(user);
    return { success: true };
  } catch (error) {
    return { success: false, error: 'Failed to send verification email' };
  }
};

export const checkEmailVerified = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return false;
    await reload(user);
    return user.emailVerified;
  } catch (error) {
    return false;
  }
};

const checkAdminAccess = async () => {
  const user = localCurrentUser || await getCurrentUser();
  if (!user || user.role !== 'admin') return false;
  return true;
};

export const getAllUsers = async () => {
  try {
    if (!(await checkAdminAccess())) return [];
    const snapshot = await getAllDocs(COLLECTIONS.users);
    const users = await fetchAllDocs(snapshot);
    return users;
  } catch (error) {
    return [];
  }
};

export const onUsersSnapshot = (callback) => {
  try {
    if (auth.currentUser === null) { callback([]); return () => {}; }
    return onSnapshot(col(COLLECTIONS.users), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      callback(docs);
    }, (error) => {
      callback([]);
    });
  } catch (e) {
    return () => {};
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

export const blockUser = async (blockerId, blockedId) => {
  try {
    const id = `${blockerId}_${blockedId}`;
    await set(COLLECTIONS.blockedUsers, id, {
      id,
      blockerId,
      blockedId,
      timestamp: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const unblockUser = async (blockerId, blockedId) => {
  try {
    const id = `${blockerId}_${blockedId}`;
    await remove(COLLECTIONS.blockedUsers, id);
    return true;
  } catch (error) {
    return false;
  }
};

export const isBlocked = async (blockerId, blockedId) => {
  try {
    const id = `${blockerId}_${blockedId}`;
    const snap = await get(COLLECTIONS.blockedUsers, id);
    return snap.exists();
  } catch (error) {
    return false;
  }
};

export const getBlockedUsers = async (userId) => {
  try {
    const snapshot = await getAllDocs(COLLECTIONS.blockedUsers);
    const all = await fetchAllDocs(snapshot);
    return all.filter((b) => b.blockerId === userId).map((b) => b.blockedId);
  } catch (error) {
    return [];
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

export const getProviderByOwnerId = async (ownerId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.providers, 'ownerId', '==', ownerId);
    const results = await fetchAllDocs(snapshot);
    return results.length > 0 ? results[0] : null;
  } catch (error) {
    return null;
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

export const replyToReview = async (reviewId, replyText) => {
  try {
    await update(COLLECTIONS.reviews, reviewId, { reply: replyText });
    return true;
  } catch (error) {
    return false;
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
    const providerSnap = await get(COLLECTIONS.providers, booking.businessId);
    if (providerSnap.exists()) {
      const provider = providerSnap.data();
      if (provider.ownerId && !adminIds.includes(provider.ownerId)) {
        await addNotification({
          id: 'notif_' + Date.now() + '_prov_' + provider.ownerId.slice(0, 4),
          userId: provider.ownerId,
          type: 'new_booking',
          title: 'New Booking',
          message: `${booking.userName} booked your service for ${booking.date} at ${booking.time}`,
          bookingId: id,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
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
      if (status === 'completed') {
        await addNotification({
          id: 'notif_rate_' + Date.now(),
          userId: booking.userId,
          type: 'booking_update',
          title: 'Rate Your Experience',
          message: `How was your service with ${booking.businessName}? Leave a review to help others.`,
          bookingId: booking.id,
          businessId: booking.businessId,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
      const providerSnap = await get(COLLECTIONS.providers, booking.businessId);
      if (providerSnap.exists()) {
        const provider = providerSnap.data();
        if (provider.ownerId && provider.ownerId !== booking.userId) {
          const providerStatusMessages = {
            approved: `${booking.userName}'s booking has been approved.`,
            rejected: `${booking.userName}'s booking has been rejected.`,
            completed: `${booking.userName}'s booking has been completed.`,
            cancelled: `${booking.userName}'s booking has been cancelled.`,
          };
          if (providerStatusMessages[status]) {
            await addNotification({
              id: 'notif_' + Date.now() + '_prov',
              userId: provider.ownerId,
              type: 'booking_update',
              title: `Booking ${status.charAt(0).toUpperCase() + status.slice(1)}`,
              message: providerStatusMessages[status],
              bookingId: booking.id,
              timestamp: new Date().toISOString(),
              read: false,
            });
          }
        }
      }
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
    const participants = [message.senderId, message.receiverId].filter(Boolean);
    let receiverId = message.receiverId;
    if (receiverId === 'admin') {
      const adminIds = await getAdminUserIds();
      receiverId = adminIds.length > 0 ? adminIds[0] : null;
      if (!receiverId) return true;
    }
    const doc = { ...message, id, receiverId, participants };
    await set(COLLECTIONS.messages, id, doc);
    try {
      const notifId = 'notif_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      await set(COLLECTIONS.notifications, notifId, {
        id: notifId,
        userId: receiverId,
        type: 'message',
        title: message.senderName || 'New Message',
        message: message.text?.substring(0, 100) || 'Sent a photo',
        body: message.text?.substring(0, 100) || 'Sent a message',
        senderId: message.senderId,
        senderName: message.senderName,
        receiverName: message.receiverName,
        businessId: message.businessId || null,
        businessName: message.businessName || null,
        conversationType: message.conversationType || 'user',
        read: false,
        timestamp: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
    } catch (e) {}
    return true;
  } catch (error) {
    return false;
  }
};

export const deleteMessage = async (messageId) => {
  try {
    await remove(COLLECTIONS.messages, messageId);
    return true;
  } catch (error) {
    return false;
  }
};

export const setTypingStatus = async (userId, chatId, isTyping) => {
  try {
    const id = `typing_${userId}_${chatId}`;
    if (isTyping) {
      await set(COLLECTIONS.presence, id, { userId, chatId, isTyping: true, timestamp: new Date().toISOString() });
    } else {
      await remove(COLLECTIONS.presence, id);
    }
  } catch (e) {}
};

export const onTypingSnapshot = (chatId, callback) => {
  try {
    const q = query(col(COLLECTIONS.presence), where('chatId', '==', chatId), where('isTyping', '==', true));
    return onSnapshot(q, (snap) => {
      const typingUsers = snap.docs.map(d => d.data().userId);
      callback(typingUsers);
    }, () => callback([]));
  } catch (e) {
    return () => {};
  }
};

export const toggleMessageReaction = async (messageId, userId, emoji) => {
  try {
    const snap = await get(COLLECTIONS.messages, messageId);
    if (!snap.exists()) return false;
    const msg = snap.data();
    const reactions = msg.reactions || {};
    if (reactions[userId] === emoji) {
      delete reactions[userId];
    } else {
      reactions[userId] = emoji;
    }
    await update(COLLECTIONS.messages, messageId, { reactions });
    return true;
  } catch (error) {
    return false;
  }
};

export const forwardMessage = async (message, toUserId, toUserName) => {
  try {
    const user = await getCurrentUser();
    if (!user) return false;
    return await sendMessage({
      senderId: user.id,
      senderName: user.name,
      receiverId: toUserId,
      receiverName: toUserName,
      text: message.text,
      imageUrl: message.imageUrl || null,
      forwarded: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return false;
  }
};

export const MESSAGE_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];

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

export const markMessagesRead = async (otherUserId, myUserId) => {
  try {
    const q = query(col(COLLECTIONS.messages),
      where('senderId', '==', otherUserId),
      where('receiverId', '==', myUserId),
      where('read', '==', false)
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return true;
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
    if (post.category === 'News') {
      try {
        const users = await getAllUsers();
        for (const u of users) {
          if (u.id !== post.userId) {
            await addNotification({
              userId: u.id,
              type: 'news',
              title: 'News Update',
              message: post.title || 'New announcement from admin',
              postId: id,
              senderId: post.userId,
              senderName: post.userName,
              read: false,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (e) {}
    }
    if (post.reposted && post.originalAuthorId && post.originalAuthorId !== post.userId) {
      await addNotification({
        userId: post.originalAuthorId,
        type: 'repost',
        title: 'New Repost',
        message: `${post.userName} reposted your post${post.title ? `: "${post.title}"` : ''}`,
        postId: id,
        senderId: post.userId,
        senderName: post.userName,
        read: false,
        timestamp: new Date().toISOString(),
      });
    }
    if (post.category !== 'News') {
      try {
        const followerIds = await getUserFollowerIds(post.userId);
        for (const fId of followerIds) {
          if (fId !== post.userId) {
            await addNotification({
              userId: fId,
              type: 'post',
              title: 'New Post',
              message: `${post.userName} shared${post.title ? ` "${post.title}"` : ' a new post'}`,
              postId: id,
              senderId: post.userId,
              senderName: post.userName,
              read: false,
              timestamp: new Date().toISOString(),
            });
          }
        }
      } catch (e) {}
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const createPost = addCommunityPost;

export const uploadCommunityImage = async (postId, uri) => {
  return uploadCommunityImageCloudinary(postId, uri);
};

export const uploadImage = async (path, uri) => {
  return uploadImageCloudinary(path, uri);
};

export const uploadImageDetailed = async (path, uri) => {
  return uploadImageDetailedCloudinary(path, uri);
};

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
    const commentsRef = collection(db, 'posts', postId, 'comments');
    await addDoc(commentsRef, comment);
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (postSnap.exists()) {
      const post = postSnap.data();
      const count = (post.commentCount || 0) + 1;
      await updateDoc(doc(db, 'posts', postId), { commentCount: count });
      if (post.userId && post.userId !== comment.userId) {
        await addNotification({
          userId: post.userId,
          type: 'post_comment',
          title: 'New Comment',
          message: `${comment.userName} commented on your post`,
          postId,
          senderId: comment.userId,
          senderName: comment.userName,
          read: false,
          timestamp: new Date().toISOString(),
        });
      }
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const onPostCommentsSnapshot = (postId, callback) => {
  try {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    return onSnapshot(commentsRef, (snap) => {
      const comments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      comments.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
      callback(comments);
    }, (error) => {
      callback([]);
    });
  } catch (e) {
    return () => {};
  }
};

export const addComment = addPostComment;

export const togglePostLike = async (postId, userId, userName) => {
  try {
    const snap = await get(COLLECTIONS.posts, postId);
    if (!snap.exists()) return false;
    const post = snap.data();
    const likes = post.likes || [];
    const idx = likes.indexOf(userId);
    const isLiking = idx === -1;
    if (isLiking) {
      likes.push(userId);
    } else {
      likes.splice(idx, 1);
    }
    await update(COLLECTIONS.posts, postId, { likes });
    if (isLiking && post.userId && post.userId !== userId) {
      await addNotification({
        userId: post.userId,
        type: 'post_like',
        title: 'New Like',
        message: `${userName || 'Someone'} liked your post`,
        postId,
        senderId: userId,
        senderName: userName,
        read: false,
        timestamp: new Date().toISOString(),
      });
    }
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

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡'];
export const REACTION_LABELS = ['Like', 'Love', 'Haha', 'Wow', 'Sad', 'Angry'];

export const togglePostReaction = async (postId, userId, userName, reaction) => {
  try {
    const snap = await get(COLLECTIONS.posts, postId);
    if (!snap.exists()) return false;
    const post = snap.data();
    const reactions = post.reactions || {};
    const prevReaction = reactions[userId];
    if (prevReaction === reaction) {
      delete reactions[userId];
    } else {
      reactions[userId] = reaction;
    }
    await update(COLLECTIONS.posts, postId, { reactions });
    if (!prevReaction && post.userId && post.userId !== userId) {
      const reactionIdx = REACTIONS.indexOf(reaction);
      const label = reactionIdx >= 0 ? REACTION_LABELS[reactionIdx] : 'reacted';
      await addNotification({
        userId: post.userId,
        type: 'post_reaction',
        title: 'New Reaction',
        message: `${userName || 'Someone'} ${label.toLowerCase()} your post`,
        postId,
        senderId: userId,
        senderName: userName,
        read: false,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const deleteComment = async (postId, commentId) => {
  try {
    await remove(`posts/${postId}/comments`, commentId);
    const postSnap = await getDoc(doc(db, 'posts', postId));
    if (postSnap.exists()) {
      const count = (postSnap.data().commentCount || 1) - 1;
      await updateDoc(doc(db, 'posts', postId), { commentCount: Math.max(0, count) });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const toggleCommentLike = async (postId, commentId, userId) => {
  try {
    const commentRef = doc(db, 'posts', postId, 'comments', commentId);
    const snap = await getDoc(commentRef);
    if (!snap.exists()) return false;
    const comment = snap.data();
    const likes = comment.likes || [];
    const idx = likes.indexOf(userId);
    if (idx === -1) {
      likes.push(userId);
    } else {
      likes.splice(idx, 1);
    }
    await updateDoc(commentRef, { likes });
    return true;
  } catch (error) {
    return false;
  }
};

export const savePost = async (userId, postId) => {
  try {
    const id = `${userId}_${postId}`;
    await set(COLLECTIONS.savedPosts, id, { userId, postId, createdAt: new Date().toISOString() });
    return true;
  } catch (error) {
    return false;
  }
};

export const unsavePost = async (userId, postId) => {
  try {
    const id = `${userId}_${postId}`;
    await remove(COLLECTIONS.savedPosts, id);
    return true;
  } catch (error) {
    return false;
  }
};

export const isPostSaved = async (userId, postId) => {
  try {
    const id = `${userId}_${postId}`;
    const snap = await get(COLLECTIONS.savedPosts, id);
    return snap.exists();
  } catch (error) {
    return false;
  }
};

export const onSavedPostsSnapshot = (userId, callback) => {
  try {
    return onSnapshot(query(col(COLLECTIONS.savedPosts), where('userId', '==', userId)), (snap) => {
      callback(snap.docs.map(d => d.data().postId));
    }, () => callback([]));
  } catch (e) {
    return () => {};
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
    return {
      totalUsers: 0,
      totalBookings: 0,
      weekBookings: 0,
      completedBookings: 0,
      totalReviews: 0,
      avgRating: 0,
      totalBusinesses: 0,
      totalProviders: 0,
      pendingBookings: 0,
    };
  }
};

export const onAdminAnalyticsSnapshot = (callback) => {
  try {
    const state = { users: [], bookings: [], reviews: [], businesses: 0, providers: 0 };
    const compute = () => {
      const thisWeek = new Date();
      thisWeek.setDate(thisWeek.getDate() - 7);
      const weekBookings = state.bookings.filter((b) => new Date(b.createdAt) > thisWeek);
      const completedBookings = state.bookings.filter((b) => b.status === 'completed');
      const pendingBookings = state.bookings.filter((b) => b.status === 'pending');
      const avgRating = state.reviews.length > 0
        ? state.reviews.reduce((sum, r) => sum + r.rating, 0) / state.reviews.length
        : 0;
      callback({
        totalUsers: state.users.length,
        totalBookings: state.bookings.length,
        weekBookings: weekBookings.length,
        completedBookings: completedBookings.length,
        totalReviews: state.reviews.length,
        avgRating: Math.round(avgRating * 10) / 10,
        totalBusinesses: state.businesses,
        totalProviders: state.providers,
        pendingBookings: pendingBookings.length,
      });
    };
    const unsub1 = onSnapshot(col(COLLECTIONS.users), (snap) => { state.users = snap.docs.map(d => d.data()); compute(); }, () => {});
    const unsub2 = onSnapshot(col(COLLECTIONS.bookings), (snap) => { state.bookings = snap.docs.map(d => d.data()); compute(); }, () => {});
    const unsub3 = onSnapshot(col(COLLECTIONS.reviews), (snap) => { state.reviews = snap.docs.map(d => d.data()); compute(); }, () => {});
    const unsub4 = onSnapshot(col(COLLECTIONS.businesses), (snap) => { state.businesses = snap.size; compute(); }, () => {});
    const unsub5 = onSnapshot(col(COLLECTIONS.providers), (snap) => { state.providers = snap.size; compute(); }, () => {});
    return () => { unsub1(); unsub2(); unsub3(); unsub4(); unsub5(); };
  } catch (e) {
    return () => {};
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
    return onSnapshot(col(COLLECTIONS.bookings), (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => {
        const ta = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tb = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tb - ta;
      });
      callback(docs);
    }, (error) => {
      callback([]);
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
      const notifs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      notifs.sort((a, b) => {
        const ta = a.timestamp ? new Date(a.timestamp).getTime() : (a.createdAt?.seconds ? a.createdAt.seconds * 1000 : 0);
        const tb = b.timestamp ? new Date(b.timestamp).getTime() : (b.createdAt?.seconds ? b.createdAt.seconds * 1000 : 0);
        return tb - ta;
      });
      callback(notifs.slice(0, 50));
    }, (error) => {
      callback([]);
    });
  } catch (e) {
    return () => {};
  }
};

export const onMessagesSnapshot = (userId, otherUserId, callback) => {
  try {
    const q1 = query(col(COLLECTIONS.messages), where('senderId', '==', userId));
    const q2 = query(col(COLLECTIONS.messages), where('receiverId', '==', userId));
    let msgs1 = [];
    let msgs2 = [];
    const emit = () => {
      const all = [...msgs1, ...msgs2].filter(m =>
        (m.senderId === userId && m.receiverId === otherUserId) ||
        (m.senderId === otherUserId && m.receiverId === userId)
      ).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      callback(all);
    };
    const unsub1 = onSnapshot(q1, (snap) => { msgs1 = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }, (err) => { console.warn('onMessagesSnapshot q1 error:', err?.message); });
    const unsub2 = onSnapshot(q2, (snap) => { msgs2 = snap.docs.map(d => ({ id: d.id, ...d.data() })); emit(); }, (err) => { console.warn('onMessagesSnapshot q2 error:', err?.message); });
    return () => { unsub1(); unsub2(); };
  } catch (e) {
    return () => {};
  }
};

export const onConversationsSnapshot = (userId, callback, filterType = null) => {
  try {
    const q1 = query(col(COLLECTIONS.messages), where('senderId', '==', userId));
    const q2 = query(col(COLLECTIONS.messages), where('receiverId', '==', userId));
    let msgs1 = [];
    let msgs2 = [];
    const process = () => {
      const all = [...msgs1, ...msgs2];
      const convMap = {};
      all.forEach(m => {
        if (filterType && m.conversationType !== filterType) return;
        const otherId = m.senderId === userId ? m.receiverId : m.senderId;
        const otherName = m.senderId === userId ? m.receiverName : m.senderName;
        const type = m.conversationType || 'business';
        if (!convMap[otherId]) {
          convMap[otherId] = {
            otherId,
            otherName,
            conversationType: type,
            businessId: m.businessId,
            businessName: m.businessName,
            lastMessage: m,
            unread: 0,
            lastTimestamp: new Date(m.timestamp || 0),
          };
        } else {
          if (new Date(m.timestamp) > convMap[otherId].lastTimestamp) {
            convMap[otherId].lastMessage = m;
            convMap[otherId].lastTimestamp = new Date(m.timestamp);
            convMap[otherId].otherName = otherName;
          }
        }
        if (m.receiverId === userId && !m.read) {
          convMap[otherId].unread = (convMap[otherId].unread || 0) + 1;
        }
      });
      const result = Object.values(convMap).sort(
        (a, b) => b.lastTimestamp - a.lastTimestamp
      );
      callback(result);
    };
    const unsub1 = onSnapshot(q1, (snap) => { msgs1 = snap.docs.map(d => ({ id: d.id, ...d.data() })); process(); }, (err) => { console.warn('onConversationsSnapshot q1 error:', err?.message); });
    const unsub2 = onSnapshot(q2, (snap) => { msgs2 = snap.docs.map(d => ({ id: d.id, ...d.data() })); process(); }, (err) => { console.warn('onConversationsSnapshot q2 error:', err?.message); });
    return () => { unsub1(); unsub2(); };
  } catch (e) {
    return () => {};
  }
};

export const onPostsSnapshot = (callback) => {
  try {
    return onSnapshot(col(COLLECTIONS.posts), async (snap) => {
      const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      docs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      const userIds = [...new Set(docs.map(d => d.userId).filter(Boolean))];
      const userMap = {};
      await Promise.all(userIds.map(async (uid) => {
        try {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            userMap[uid] = { profileImage: data.profileImage || null, name: data.name || null };
          }
        } catch (e) {}
      }));
      const enriched = docs.map(d => ({
        ...d,
        userProfileImage: d.userProfileImage || userMap[d.userId]?.profileImage || null,
        userName: d.userName || userMap[d.userId]?.name || d.userName,
      }));
      callback(enriched);
    }, (error) => {
      callback([]);
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

export const onProviderSnapshot = (providerId, callback) => {
  try {
    return onSnapshot(doc(db, COLLECTIONS.providers, providerId), (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      }
    }, (error) => {});
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

export const onReviewsSnapshot = (serviceId, callback) => {
  try {
    const q = query(col(COLLECTIONS.reviews), where('serviceId', '==', serviceId));
    return onSnapshot(q, (snap) => {
      callback(snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => {
        const ta = a.createdAt?.seconds ? a.createdAt.seconds : (a.createdAt ? new Date(a.createdAt).getTime() / 1000 : 0);
        const tb = b.createdAt?.seconds ? b.createdAt.seconds : (b.createdAt ? new Date(b.createdAt).getTime() / 1000 : 0);
        return tb - ta;
      }));
    }, (error) => {
    });
  } catch (e) {
    return () => {};
  }
};

export const setUserOnlineStatus = async (userId, isOnline) => {
  try {
    await set(COLLECTIONS.presence, userId, {
      userId,
      isOnline,
      lastSeen: new Date().toISOString(),
    });
  } catch (e) {}
};

export const onUserStatusSnapshot = (userId, callback) => {
  try {
    return onSnapshot(ref(COLLECTIONS.presence, userId), (doc) => {
      if (doc.exists()) {
        callback(doc.data());
      } else {
        callback({ isOnline: false });
      }
    }, (error) => {
    });
  } catch (e) {
    return () => {};
  }
};

// ============ FOLLOWS / CONNECTIONS ============
const followDocId = (followerId, targetId) => `${followerId}_${targetId}`;

export const isFollowing = async (followerId, targetId) => {
  try {
    if (!followerId || !targetId) return false;
    const snap = await get(COLLECTIONS.follows, followDocId(followerId, targetId));
    return snap.exists();
  } catch (error) {
    return false;
  }
};

export const toggleFollow = async (followerId, targetId, targetType = 'user', followerName = '') => {
  try {
    if (!followerId || !targetId) return false;
    if (followerId === targetId) return false;
    const docId = followDocId(followerId, targetId);
    const snap = await get(COLLECTIONS.follows, docId);
    if (snap.exists()) {
      await remove(COLLECTIONS.follows, docId);
      return false;
    }
    await set(COLLECTIONS.follows, docId, {
      followerId,
      targetId,
      targetType,
      createdAt: new Date().toISOString(),
    });
    if (targetType === 'user') {
      await addNotification({
        userId: targetId,
        type: 'follow',
        title: 'New Follower',
        message: `${followerName || 'Someone'} started following you`,
        senderId: followerId,
        senderName: followerName || '',
        read: false,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const follow = async (followerId, targetId, targetType = 'user', followerName = '') => {
  try {
    if (!followerId || !targetId) return false;
    const docId = followDocId(followerId, targetId);
    const snap = await get(COLLECTIONS.follows, docId);
    if (snap.exists()) return true;
    await set(COLLECTIONS.follows, docId, {
      followerId,
      targetId,
      targetType,
      createdAt: new Date().toISOString(),
    });
    if (targetType === 'user') {
      await addNotification({
        userId: targetId,
        type: 'follow',
        title: 'New Follower',
        message: `${followerName || 'Someone'} started following you`,
        senderId: followerId,
        senderName: followerName || '',
        read: false,
        timestamp: new Date().toISOString(),
      });
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const unfollow = async (followerId, targetId) => {
  try {
    if (!followerId || !targetId) return false;
    await remove(COLLECTIONS.follows, followDocId(followerId, targetId));
    return true;
  } catch (error) {
    return false;
  }
};

export const getFollowersCount = async (targetId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.follows, 'targetId', '==', targetId);
    return snapshot.size;
  } catch (error) {
    return 0;
  }
};

export const getFollowingCount = async (userId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.follows, 'followerId', '==', userId);
    return snapshot.size;
  } catch (error) {
    return 0;
  }
};

export const getUserFollowerIds = async (targetId) => {
  try {
    const snapshot = await queryWhere(COLLECTIONS.follows, 'targetId', '==', targetId);
    return snapshot.docs.map((d) => d.data().followerId);
  } catch (error) {
    return [];
  }
};

export const onFollowersSnapshot = (targetId, callback) => {
  try {
    if (!targetId) { callback(0); return () => {}; }
    return onSnapshot(query(col(COLLECTIONS.follows), where('targetId', '==', targetId)), (snap) => {
      callback(snap.size);
    }, (error) => {
      callback(0);
    });
  } catch (e) {
    return () => {};
  }
};

export const onUserFollowsSnapshot = (userId, callback) => {
  try {
    if (!userId) { callback([]); return () => {}; }
    return onSnapshot(query(col(COLLECTIONS.follows), where('followerId', '==', userId)), (snap) => {
      const ids = snap.docs.map((d) => d.data().targetId);
      callback(ids);
    }, (error) => {
      callback([]);
    });
  } catch (e) {
    return () => {};
  }
};

// ============ PUBLIC USER PROFILES / QUALIFICATIONS ============
export const getUserById = async (userId) => {
  try {
    if (!userId) return null;
    const snap = await get(COLLECTIONS.users, userId);
    if (!snap.exists()) return null;
    return { id: snap.id, ...snap.data() };
  } catch (error) {
    return null;
  }
};

export const onUserSnapshot = (userId, callback) => {
  try {
    if (!userId) { callback(null); return () => {}; }
    return onSnapshot(doc(db, COLLECTIONS.users, userId), (snap) => {
      if (snap.exists()) {
        callback({ id: snap.id, ...snap.data() });
      } else {
        callback(null);
      }
    }, (error) => {
      callback(null);
    });
  } catch (e) {
    return () => {};
  }
};

export const getUserPostsCount = async (userId) => {
  try {
    if (!userId) return 0;
    const snapshot = await queryWhere(COLLECTIONS.posts, 'userId', '==', userId);
    return snapshot.size;
  } catch (error) {
    return 0;
  }
};

export const updateUserProfile = async (userId, updates) => {
  try {
    if (!userId) return false;
    await update(COLLECTIONS.users, userId, updates);
    if (localCurrentUser && localCurrentUser.id === userId) {
      localCurrentUser = { ...localCurrentUser, ...updates };
    }
    return true;
  } catch (error) {
    return false;
  }
};

export const endorseUserSkill = async (userId, skillName, endorserName) => {
  try {
    if (!userId || !skillName) return false;
    const snap = await get(COLLECTIONS.users, userId);
    if (!snap.exists()) return false;
    const data = snap.data();
    const skills = Array.isArray(data.skills) ? data.skills : [];
    const idx = skills.findIndex((s) => (typeof s === 'string' ? s === skillName : s.name === skillName));
    let updated;
    if (idx === -1) {
      updated = [...skills, { name: skillName, endorsements: 1, endorsers: endorserName ? [endorserName] : [] }];
    } else {
      updated = skills.map((s, i) => {
        if (i !== idx) return s;
        const current = typeof s === 'string' ? { name: s, endorsements: 0, endorsers: [] } : { ...s };
        const endorsers = Array.isArray(current.endorsers) ? current.endorsers : [];
        if (endorserName && endorsers.includes(endorserName)) {
          return {
            ...current,
            endorsements: Math.max(0, (current.endorsements || 0) - 1),
            endorsers: endorsers.filter((n) => n !== endorserName),
          };
        }
        return {
          ...current,
          endorsements: (current.endorsements || 0) + 1,
          endorsers: endorserName ? [...endorsers, endorserName] : endorsers,
        };
      });
    }
    await update(COLLECTIONS.users, userId, { skills: updated });
    return true;
  } catch (error) {
    return false;
  }
};

// ============ PROVIDER SKILLS / ENDORSEMENTS ============
export const endorseSkill = async (providerId, skillName) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return false;
    const data = snap.data();
    const skills = Array.isArray(data.skills) ? data.skills : [];
    const idx = skills.findIndex((s) => (typeof s === 'string' ? s === skillName : s.name === skillName));
    if (idx === -1) {
      skills.push({ name: skillName, endorsements: 1 });
    } else {
      const current = typeof skills[idx] === 'string'
        ? { name: skills[idx], endorsements: 1 }
        : { ...skills[idx], endorsements: (skills[idx].endorsements || 0) + 1 };
      skills[idx] = current;
    }
    await update(COLLECTIONS.providers, providerId, { skills });
    return true;
  } catch (error) {
    return false;
  }
};

export const updateProviderSkills = async (providerId, skills) => {
  try {
    const snap = await get(COLLECTIONS.providers, providerId);
    if (!snap.exists()) return false;
    await update(COLLECTIONS.providers, providerId, { skills: Array.isArray(skills) ? skills : [] });
    return true;
  } catch (error) {
    return false;
  }
};
