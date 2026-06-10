import { toast } from 'sonner-native';

export const AndroidImportance = {
  UNSPECIFIED: 0,
  NONE: 1,
  MIN: 2,
  LOW: 3,
  DEFAULT: 4,
  HIGH: 5,
  MAX: 6,
};

export const PermissionStatus = {
  UNDETERMINED: 'undetermined',
  GRANTED: 'granted',
  DENIED: 'denied',
};

export const registerForPushNotificationsAsync = async () => {};

export const addNotificationResponseReceivedListener = (listener) => {
  return { remove: () => {} };
};

export const removeNotificationSubscription = (subscription) => {};

export const addNotificationReceivedListener = (listener) => {
  return { remove: () => {} };
};

export const removeNotificationReceivedListener = (listener) => {};

export const setNotificationChannelAsync = async (channelId, channel) => {};

export const setNotificationHandler = (handler) => {};

export const getExpoPushTokenAsync = async (options) => {
  return { data: 'expo-push-token' };
};

export const getPermissionsAsync = async () => {
  return {
    status: PermissionStatus.GRANTED,
    expires: 'never',
    granted: true,
    canAskAgain: true,
  };
};

export const requestPermissionsAsync = async () => {
  return {
    status: PermissionStatus.GRANTED,
    expires: 'never',
    granted: true,
    canAskAgain: true,
  };
};

export const scheduleNotificationAsync = async (notificationRequest) => {
  return 'mock-notification-id';
};

export const cancelAllScheduledNotificationsAsync = async () => {};

export const cancelScheduledNotificationAsync = async (identifier) => {};

export const getAllScheduledNotificationsAsync = async () => {
  return [];
};
