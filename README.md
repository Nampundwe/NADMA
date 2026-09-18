# NADMA

A full-featured service marketplace mobile application built with React Native and Expo, connecting users with local service providers across multiple categories.

## Architecture

```
Nadma/
├── src/
│   ├── components/        # Reusable UI components
│   │   ├── BottomSheet.js
│   │   ├── EmptyState.js
│   │   ├── ErrorBoundary.js
│   │   ├── Skeleton.js
│   │   ├── SwipeablePostCard.js
│   │   └── Icon.js
│   ├── config/
│   │   ├── cloudinary.js       # Image upload configuration
│   │   └── firebase.js         # Firebase initialization
│   ├── context/
│   │   └── ThemeContext.js      # Dark/light theme provider
│   ├── data/
│   │   ├── firebaseStorage.js  # Firestore data layer (2400+ lines)
│   │   └── services.js         # Service data/constants
│   ├── navigation/
│   │   └── AppNavigator.js     # Tab + stack navigation
│   ├── screens/                # 27 screens
│   └── utils/
│       ├── cloudinaryUpload.js # Image upload to Cloudinary
│       ├── haptics.js          # Haptic feedback helpers
│       ├── imageCompression.js # Image resize/compress utils
│       ├── responsive.js       # Auto-scaling stylesheet
│       └── useNetworkAction.js # Connectivity-aware actions
├── assets/                     # Icons, splash screens
├── android/                    # Native Android project
├── eas.json                    # EAS Build configuration
├── app.json                    # Expo configuration
└── firestore.rules             # Firestore security rules
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Framework** | React Native 0.86 + Expo SDK 57 |
| **Navigation** | React Navigation v7 (Bottom Tabs + Native Stack) |
| **Backend** | Firebase (Auth + Firestore + Storage) |
| **Image Upload** | Cloudinary (via REST API, base64) |
| **State** | React Context (Theme, Toast, Network) |
| **Build** | EAS Build (APK for preview, AAB for production) |
| **Language** | JavaScript (ES modules) |

## Features

### Core
- **User Authentication** — Email/password signup with Firebase Auth
- **User Profiles** — Headline, bio, skills, experience, education, profile image
- **Onboarding Flow** — Guided profile setup after registration
- **Email Verification** — Required before accessing the app

### Service Marketplace
- **Service Listings** — Browse services by category with images, ratings, pricing
- **Service Detail** — Full service page with image gallery, reviews, booking
- **Booking System** — Date/time selection, booking management, status tracking
- **Provider Dashboard** — Accept/decline bookings, manage services, view analytics
- **Reviews & Ratings** — 1-5 star ratings with text reviews
- **Favorites** — Save and manage favorite services

### Community
- **Community Feed** — Post images with text, Facebook-style layout
- **Post Detail** — Full post view with comments and reactions
- **Reactions** — 8 emoji reactions with per-emoji breakdown counts
- **Swipe to Like** — Swipe right on posts to quick-react with thumbs up
- **Three-dot Menu** — Share and report posts
- **Report System** — Category-based reporting with reason text

### Messaging
- **Real-time Chat** — 1:1 and business-user conversations
- **Image Sharing** — Send photos in chat with Cloudinary upload
- **Reply System** — Reply to specific messages with preview
- **Message Reactions** — Emoji reactions on individual messages
- **Forward Messages** — Forward to any user
- **Read Receipts** — Sent/delivered/read checkmarks
- **Typing Indicators** — Real-time typing status
- **User Blocking** — Block/unblock users

### Notifications
- **Deep-linked Notifications** — Tap notification to navigate to exact content
- **Notification Types** — Messages, comments, likes, reactions, follows, bookings, reports
- **Real-time Updates** — Firestore snapshot listeners

### Admin
- **Admin Panel** — Manage providers, categories, users
- **User Management** — View, ban, manage all users
- **Booking Management** — View and manage all bookings

### UX Polish
- **Dark/Light Theme** — Full theme system with `ThemeContext`
- **Pull-to-Refresh** — On Home, Profile, Services, Bookings, Admin
- **Keyboard Avoiding** — Proper keyboard handling on all input screens
- **Loading Skeletons** — Skeleton placeholders during data loading
- **Toast Notifications** — Success/error/info feedback
- **Network-Aware Actions** — Connectivity checks before server calls
- **Haptic Feedback** — Tactile responses on interactions
- **Empty States** — Friendly empty state components
- **Safe Area Handling** — Proper notch/inset support

## Setup

### Prerequisites
- Node.js 18+
- Expo CLI: `npm install -g expo-cli`
- EAS CLI: `npm install -g eas-cli`
- Firebase project with Auth + Firestore enabled

### Installation

```bash
git clone https://github.com/Nampundwe/NADMA.git
cd NADMA
npm install
```

### Configuration

1. Create `src/config/firebase.js` with your Firebase config:
```js
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

2. Create `src/config/cloudinary.js`:
```js
export const CLOUDINARY_CONFIG = {
  cloudName: 'YOUR_CLOUD_NAME',
  uploadPreset: 'YOUR_UPLOAD_PRESET',
};
export const CLOUDINARY_UPLOAD_URL = `https://api.cloudinary.com/v1_1/YOUR_CLOUD_NAME/image/upload`;
```

### Running

```bash
npx expo start          # Development server
npx expo run:android    # Android device/emulator
npx expo run:ios        # iOS simulator
```

### Building

```bash
# Preview APK
eas build --platform android --profile preview

# Production AAB
eas build --platform android --profile production
```

## Data Model

### Firestore Collections

| Collection | Key Fields |
|-----------|-----------|
| `users` | name, email, phone, role, profileImage, headline, about, skills, experience, pushToken |
| `services` | title, description, image, price, category, providerId, rating, reviewCount |
| `bookings` | userId, serviceId, providerId, date, time, status, rating, review |
| `messages` | senderId, receiverId, text, imageUrl, read, reactions, replyTo, conversationType |
| `posts` | userId, text, imageUrl, reactions, comments, userProfileImage |
| `notifications` | userId, type, title, message, read, senderId, timestamp |
| `follows` | followerId, followingId |
| `blockedUsers` | blockerId, blockedId |
| `reports` | reporterId, targetType, category, reason |
| `referrals` | userId, code, referrals (count) |

## Key Design Decisions

1. **Single data layer** — All Firestore operations go through `firebaseStorage.js`, making it easy to swap backends
2. **Theme system** — `ThemeContext` provides color tokens; screens never hardcode hex values
3. **Real-time everything** — Firestore `onSnapshot` listeners for messages, notifications, user status, typing indicators
4. **Client-side user queries** — `getAllUsers()` fetches all users and filters client-side (suitable for <10K users)
5. **Cloudinary for images** — REST API with base64 upload; no Firebase Storage SDK dependency for uploads
6. **No TypeScript** — Plain JavaScript with Expo managed workflow for faster iteration
7. **Reusable components** — `Skeleton`, `EmptyState`, `BottomSheet`, `ErrorBoundary` shared across screens

## Build Profiles

| Profile | Output | Use Case |
|---------|--------|----------|
| `preview` | APK | Internal testing, direct install |
| `production` | AAB | Google Play Store submission |

## License

Private — All rights reserved.
