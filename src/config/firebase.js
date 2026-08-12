import { initializeApp } from 'firebase/app';
import { initializeAuth, getReactNativePersistence } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: 'AIzaSyCbcYniF1ELxbhNT_nAjLjPQVLmmpPPEZ4',
  authDomain: 'nadma-4879c.firebaseapp.com',
  projectId: 'nadma-4879c',
  storageBucket: 'nadma-4879c.firebasestorage.app',
  messagingSenderId: '989526771740',
  appId: '1:989526771740:android:cd0a063d8a371ae85137d9',
};

const app = initializeApp(firebaseConfig);

export const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
export const db = getFirestore(app);
export const storage = getStorage(app);

let _messaging = null;
let _messagingTried = false;
export const getMessagingInstance = () => {
  if (_messagingTried) return _messaging;
  _messagingTried = true;
  try {
    const { getMessaging } = require('firebase/messaging');
    _messaging = getMessaging(app);
  } catch (e) {
    _messaging = null;
  }
  return _messaging;
};

export default app;
