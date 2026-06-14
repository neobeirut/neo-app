const { getDefaultConfig } = require('expo/metro-config');
const path = require('node:path');

const config = getDefaultConfig(__dirname);

const DEV_ONLY_NATIVE_ALIASES = {
  'expo-notifications': path.resolve(
    __dirname,
    './polyfills/native/notifications.native.tsx'
  ),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    const normalizedOrigin = context.originModulePath.replace(/\\/g, '/');
    const normalizedDir = __dirname.replace(/\\/g, '/');
    
    // Bypass resolution redirect if the module is requesting from within the polyfills
    if (normalizedOrigin.includes('/polyfills/native/')) {
      return context.resolveRequest(context, moduleName, platform);
    }

    if (platform !== 'web') {
      if (
        DEV_ONLY_NATIVE_ALIASES[moduleName] &&
        process.env.NODE_ENV !== 'production' &&
        process.env.EXPO_PUBLIC_USE_REAL_NOTIFICATIONS !== 'true'
      ) {
        console.log(`[Metro Config] Redirecting ${moduleName} to local dev polyfill`);
        return context.resolveRequest(
          context,
          DEV_ONLY_NATIVE_ALIASES[moduleName],
          platform
        );
      }
    }
    return context.resolveRequest(context, moduleName, platform);
  } catch (error) {
    return context.resolveRequest(context, moduleName, platform);
  }
};

module.exports = config;
