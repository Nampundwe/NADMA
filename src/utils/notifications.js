import { Platform } from 'react-native';
import { savePushToken } from '../data/storage';

let Notifications = null;

try {
  Notifications = require('expo-notifications');
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
} catch (e) {
  Notifications = null;
}

export const registerForPushNotifications = async () => {
  if (!Notifications) return null;
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') {
      return null;
    }
    const token = await Notifications.getExpoPushTokenAsync();
    await savePushToken(token.data);
    if (Platform.OS === 'android') {
      Notifications.setNotificationChannelAsync('default', {
        name: 'Nadma Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1a237e',
      });
    }
    return token.data;
  } catch (error) {
    return null;
  }
};

export const scheduleLocalNotification = async (title, body, data = {}) => {
  if (!Notifications) return false;
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    return false;
  }
};
