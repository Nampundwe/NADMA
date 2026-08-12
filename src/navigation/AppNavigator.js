import React, { useState, useEffect, createContext } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { getCurrentUser, setUserOnlineStatus, logout } from '../data/firebaseStorage';
import { auth } from '../config/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { registerForPushNotifications } from '../utils/notifications';
import { useTheme } from '../context/ThemeContext';
import ErrorBoundary from '../components/ErrorBoundary';

export const AuthContext = createContext();

import HomeScreen from '../screens/HomeScreen';
import ServicesScreen from '../screens/ServicesScreen';
import ServiceDetailScreen from '../screens/ServiceDetailScreen';
import RegisterScreen from '../screens/RegisterScreen';
import AboutScreen from '../screens/AboutScreen';
import AuthScreen from '../screens/AuthScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AdminScreen from '../screens/AdminScreen';
import BookingScreen from '../screens/BookingScreen';
import MyBookingsScreen from '../screens/MyBookingsScreen';
import BookingsManagerScreen from '../screens/BookingsManagerScreen';
import ChatScreen from '../screens/ChatScreen';
import MessagesInbox from '../screens/MessagesInbox';
import NotificationsScreen from '../screens/NotificationsScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import ManageProvidersScreen from '../screens/ManageProvidersScreen';
import ManageCategoriesScreen from '../screens/ManageCategoriesScreen';
import CommunityScreen from '../screens/CommunityScreen';
import ProviderDashboardScreen from '../screens/ProviderDashboardScreen';
import OnboardingScreen from '../screens/OnboardingScreen';
import SettingsScreen from '../screens/SettingsScreen';

const RootStack = createNativeStackNavigator();
const HomeStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();
const MessagesStack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function AdminGuard({ children, navigation }) {
  const { user } = React.useContext(AuthContext);
  if (!user || (user.role !== 'admin' && user.role !== 'provider')) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0B1437' }}>
        <Ionicons name="lock-closed" size={48} color="#5B9CF6" />
        <Text style={{ color: '#fff', fontSize: 18, fontWeight: 'bold', marginTop: 16 }}>Access Denied</Text>
        <Text style={{ color: '#8892B0', fontSize: 14, marginTop: 8, textAlign: 'center', paddingHorizontal: 40 }}>Only admins and providers can access this screen.</Text>
      </View>
    );
  }
  return children;
}

function HomeStackScreen() {
  const { colors } = useTheme();
  return (
    <HomeStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <HomeStack.Screen
        name="HomeMain"
        component={HomeScreen}
        options={{ title: 'Nadma - Nampundwe Services' }}
      />
      <HomeStack.Screen
        name="Services"
        component={ServicesScreen}
        options={({ route }) => ({ title: route.params.categoryName })}
      />
      <HomeStack.Screen
        name="ServiceDetail"
        component={ServiceDetailScreen}
        options={{ title: 'Service Details' }}
      />
      <HomeStack.Screen
        name="Register"
        component={RegisterScreen}
        options={{ title: 'Register Business' }}
      />
      <HomeStack.Screen
        name="Booking"
        component={BookingScreen}
        options={{ title: 'Book Service' }}
      />
      <HomeStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <HomeStack.Screen
        name="MessagesInbox"
        component={MessagesInbox}
        options={{ title: 'Messages' }}
      />
      <HomeStack.Screen
        name="Community"
        component={CommunityScreen}
        options={{ title: 'Community Board' }}
      />
      <HomeStack.Screen
        name="ProviderDashboard"
        component={ProviderDashboardScreen}
        options={{ title: 'Provider Dashboard' }}
      />
      <HomeStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
    </HomeStack.Navigator>
  );
}

function ProfileStackScreen() {
  const { colors } = useTheme();
  return (
    <ProfileStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerText,
        headerTitleStyle: { fontWeight: 'bold' },
      }}
    >
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
      <ProfileStack.Screen
        name="Admin"
        options={{ title: 'Admin Panel' }}
      >
        {() => <AdminGuard navigation={{ navigate: () => {} }}><AdminScreen /></AdminGuard>}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="MyBookings"
        component={MyBookingsScreen}
        options={{ title: 'My Bookings' }}
      />
      <ProfileStack.Screen
        name="BookingsManager"
        options={{ title: 'Manage Bookings' }}
      >
        {() => <AdminGuard><BookingsManagerScreen /></AdminGuard>}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications' }}
      />
      <ProfileStack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: 'Favorites' }}
      />
      <ProfileStack.Screen
        name="Chat"
        component={ChatScreen}
        options={{ title: 'Chat' }}
      />
      <ProfileStack.Screen
        name="ManageProviders"
        options={{ title: 'Manage Providers' }}
      >
        {() => <AdminGuard><ManageProvidersScreen /></AdminGuard>}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="ManageCategories"
        options={{ title: 'Manage Categories' }}
      >
        {() => <AdminGuard><ManageCategoriesScreen /></AdminGuard>}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ headerShown: false }}
      />
      <ProfileStack.Screen
        name="ProviderDashboard"
        component={ProviderDashboardScreen}
        options={{ title: 'Provider Dashboard' }}
      />
    </ProfileStack.Navigator>
  );
}

function MessagesStackScreen() {
  return (
    <MessagesStack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <MessagesStack.Screen name="MessagesInbox" component={MessagesInbox} />
      <MessagesStack.Screen name="Chat" component={ChatScreen} options={{ title: 'Chat' }} />
    </MessagesStack.Navigator>
  );
}

function MainAppWrapper() {
  return (
    <ErrorBoundary>
      <MainTabs />
    </ErrorBoundary>
  );
}

function RootScreen() {
  const { user } = React.useContext(AuthContext);
  if (user) {
    return <MainAppWrapper />;
  }
  return <AuthScreen />;
}

function MainTabs() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;
          if (route.name === 'Home') {
            iconName = focused ? 'home' : 'home-outline';
          } else if (route.name === 'Messages') {
            iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
          } else if (route.name === 'Profile') {
            iconName = focused ? 'person' : 'person-outline';
          } else if (route.name === 'Community') {
            iconName = focused ? 'megaphone' : 'megaphone-outline';
          } else if (route.name === 'About') {
            iconName = focused ? 'information-circle' : 'information-circle-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
        },
        tabBarStyle: {
          backgroundColor: colors.tabBg,
          borderTopWidth: 0,
          elevation: 12,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.08,
          shadowRadius: 12,
          height: 60,
          paddingTop: 6,
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeStackScreen} />
      <Tab.Screen name="Messages" component={MessagesStackScreen} />
      <Tab.Screen name="Profile" component={ProfileStackScreen} />
      <Tab.Screen name="Community" component={CommunityScreen} />
      <Tab.Screen name="About" component={AboutScreen} />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { colors } = useTheme();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [onboarded, setOnboarded] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const currentUser = await getCurrentUser();
          setUser(currentUser);
        } catch (e) {
          setUser(null);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    AsyncStorage.getItem('@nadma_onboarded').then((v) =>
      setOnboarded(v === 'true'),
    );
  }, []);

  useEffect(() => {
    registerForPushNotifications().catch(() => {});
  }, []);

  useEffect(() => {
    if (!user) return;
    const appState = AppState.currentState;
    if (appState === 'active') {
      setUserOnlineStatus(user.id, true);
    }
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        setUserOnlineStatus(user.id, true);
      } else if (nextState === 'background' || nextState === 'inactive') {
        setUserOnlineStatus(user.id, false);
      }
    });
    const handleUnload = () => setUserOnlineStatus(user.id, false);
    return () => {
      sub.remove();
      setUserOnlineStatus(user.id, false);
    };
  }, [user?.id]);

  const handleLogout = async () => {
    try {
      if (user) {
        await setUserOnlineStatus(user.id, false);
      }
      await logout();
    } catch (e) {}
    setUser(null);
  };

  const handleLogin = async () => {
    const currentUser = await getCurrentUser();
    setUser(currentUser);
  };

  if (loading || onboarded === null) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.bg }]}>
        <View style={[styles.loadingLogo, { backgroundColor: colors.primary }]}>
          <Ionicons name="business" size={40} color="#fff" />
        </View>
        <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>Loading Nadma...</Text>
      </View>
    );
  }

  if (!onboarded) {
    return <OnboardingScreen onComplete={() => setOnboarded(true)} />;
  }

  return (
    <AuthContext.Provider value={{ onLogout: handleLogout, onLogin: handleLogin, user }}>
      <NavigationContainer>
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Root" component={RootScreen} />
        </RootStack.Navigator>
      </NavigationContainer>
    </AuthContext.Provider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingLogo: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },
});
