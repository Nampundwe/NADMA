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
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Nadma Notifications',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#1B2559',
        sound: 'default',
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      return null;
    }

    const token = await Notifications.getExpoPushTokenAsync({
      projectId: 'b6a5faa8-982c-4256-ac88-135b2a68d898',
    });
    
    if (token && token.data) {
      await savePushToken(token.data);
    }
    
    return token ? token.data : null;
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
        channelId: 'default',
      },
      trigger: null,
    });
    return true;
  } catch (error) {
    return false;
  }
};

export const addNotificationListener = (callback) => {
  if (!Notifications) return () => {};
  const sub1 = Notifications.addNotificationReceivedListener(callback);
  const sub2 = Notifications.addNotificationResponseReceivedListener(callback);
  return () => {
    sub1?.remove();
    sub2?.remove();
  };
};
