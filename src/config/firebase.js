import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getMessaging } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: 'AIzaSyCbcYniF1ELxbhNT_nAjLjPQVLmmpPPEZ4',
  authDomain: 'nadma-4879c.firebaseapp.com',
  projectId: 'nadma-4879c',
  storageBucket: 'nadma-4879c.firebasestorage.app',
  messagingSenderId: '989526771740',
  appId: '1:989526771740:android:cd0a063d8a371ae85137d9',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export let messaging = null;

try {
  messaging = getMessaging(app);
} catch (e) {
  messaging = null;
}

export default app;
