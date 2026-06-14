import { Platform } from 'react-native';

let Notifications: any;

if (Platform.OS !== 'web') {
  try {
    Notifications = require('expo-notifications');
    // Verify it is a valid module and not a cached failed import (e.g. returns undefined or empty object)
    if (!Notifications || typeof Notifications.getPermissionsAsync !== 'function') {
      throw new Error('Loaded expo-notifications module is invalid or incomplete');
    }
  } catch (e: any) {
    console.warn('[Notifications Helper] Failed to load expo-notifications, using polyfill:', e.message);
    Notifications = require('../../polyfills/native/notifications.native.tsx');
  }
} else {
  Notifications = require('../../polyfills/native/notifications.native.tsx');
}

export default Notifications;
